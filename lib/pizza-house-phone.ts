import 'server-only'
import { supabase } from './supabase'
import { pizzaHouseQuery } from './pizza-house-db'
import {
  phoneOrderRows, derivePhoneCustomers,
  type RawPhoneOrder, type PhoneCustomersRpc, type PhoneCustomers,
} from './pizza-house-phone-pure'

/**
 * Phone-linked orders: the server half (POS read, Supabase write/read).
 * The logic worth testing lives in pizza-house-phone-pure.ts; the design in
 * docs/superpowers/specs/2026-09-26-pizza-phone-customers-design.md.
 */

export type PhoneSnapshotResult =
  | { rows: number; dropped: number }
  | { skipped: 'no_key' | 'no_link_columns' }

const UPSERT_BATCH = 500

/**
 * Re-upserts the branch's whole client_delivery snapshot into
 * pizza_phone_orders. Must run inside runWithBranch().
 *
 * The whole snapshot every night, not "since yesterday": it is idempotent by
 * (branch, deal), costs a few thousand small rows, and means a night the POS
 * was unreachable — or mid-way through rebuilding the table, which it does
 * around 00:10 — heals itself on the next run with no bookkeeping.
 *
 * Skips, rather than fails, on the two states that are not errors: no key
 * configured (the caller logs that loudly) and a branch Aviv has not linked
 * yet (Giv'at Ze'ev as of 2026-09-26 — it joins by itself the night after
 * the columns appear).
 */
export async function snapshotPhoneOrders(branchId: string): Promise<PhoneSnapshotResult> {
  const key = process.env.PIZZAHOUSE_PHONE_KEY
  if (!key) return { skipped: 'no_key' }

  const [col] = await pizzaHouseQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'client_delivery' AND column_name = 'last_deal_id'`,
  )
  if (!Number(col?.n)) return { skipped: 'no_link_columns' }

  // Exactly these five columns. The table also holds names, emails and
  // ID-card numbers; none of that is ever selected.
  const raw = await pizzaHouseQuery<RawPhoneOrder>(
    `SELECT phone, phone_solar, last_deal_id, last_deal_date, last_deal_sum
     FROM client_delivery WHERE last_deal_id > 0`,
  )
  const { rows, dropped } = phoneOrderRows(branchId, raw, key)

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const { error } = await supabase
      .from('pizza_phone_orders')
      .upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict: 'branch_id,deal_id' })
    // Loud, not swallowed — the backup manifest taught us what silent
    // nightly failures cost.
    if (error) throw new Error(`pizza_phone_orders upsert failed: ${error.message}`)
  }
  return { rows: rows.length, dropped }
}

interface NaiveRange { from: string; to: string }

/**
 * The dashboard's phone-based customer figures for one branch or several
 * (the "all branches" view passes every id and a person who orders from both
 * is counted once). Two RPC calls — the requested range and the previous
 * one, so the "vs previous period" deltas compare like with like. Returns
 * null when the branches hold no phone data yet.
 */
export async function fetchPhoneCustomers(
  branchIds: string[],
  range: NaiveRange,
  prevRange: NaiveRange,
  fromDate: string,
  prevFromDate: string,
): Promise<PhoneCustomers | null> {
  const call = async (r: NaiveRange): Promise<PhoneCustomersRpc> => {
    const { data, error } = await supabase.rpc('pizza_phone_customers', {
      p_branches: branchIds, p_from: r.from, p_to: r.to,
    })
    if (error) throw new Error(`pizza_phone_customers failed: ${error.message}`)
    return data as PhoneCustomersRpc
  }
  const [current, prev] = await Promise.all([call(range), call(prevRange)])
  return derivePhoneCustomers(current, prev, fromDate, prevFromDate)
}
