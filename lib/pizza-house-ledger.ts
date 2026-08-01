import 'server-only'
import { createHmac } from 'node:crypto'
import { supabase } from './supabase'
import { pizzaHouseQuery } from './pizza-house-db'

/**
 * Our own memory of Pizza House customers.
 *
 * The POS purges its deal tables — five weeks of history for a seven-year-old
 * restaurant — so "returning customers" computed against the POS can never be
 * meaningful. This module folds each day's identities into a Supabase ledger
 * that outlives those purges.
 *
 * Identities are HMAC'd before they leave MySQL. Answering "same person as
 * before?" needs a stable token, not the card itself, so the raw identifier is
 * never stored on our side.
 */

export type IdentityType = 'card' | 'meal_card'

export interface DayIdentity {
  identity_type: IdentityType
  identity_hash: string
  visits: number
  spend: number
}

function hashIdentity(raw: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is required to hash customer identities')
  return createHmac('sha256', secret).update(raw).digest('hex')
}

/**
 * Every identity that transacted on `day` (YYYY-MM-DD), from both pools.
 * Must run inside runWithBranch().
 */
export async function fetchDayIdentities(day: string): Promise<DayIdentity[]> {
  const next = new Date(`${day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const to = next.toISOString().slice(0, 10)

  const cards = await pizzaHouseQuery<{ raw: string; visits: number; spend: number | null }>(
    `SELECT CONCAT(id_card, '|', validto) as raw, COUNT(*) as visits, ROUND(SUM(sum), 2) as spend
     FROM creditcard
     WHERE date >= ? AND date < ? AND id_card != '' AND sum > 0
     GROUP BY raw`,
    [day, to]
  )

  const mealCards = await pizzaHouseQuery<{ raw: string; visits: number; spend: number | null }>(
    `SELECT id_card as raw, COUNT(*) as visits, ROUND(SUM(sum), 2) as spend
     FROM dc_deals
     WHERE date >= ? AND date < ? AND isreturn = 0
       AND id_card IS NOT NULL AND id_card NOT IN ('', '---', '0')
     GROUP BY raw`,
    [day, to]
  )

  return [
    ...cards.map(c => ({
      identity_type: 'card' as const,
      identity_hash: hashIdentity(`card:${c.raw}`),
      visits: Number(c.visits) || 0,
      spend: Number(c.spend) || 0,
    })),
    ...mealCards.map(c => ({
      identity_type: 'meal_card' as const,
      identity_hash: hashIdentity(`meal:${c.raw}`),
      visits: Number(c.visits) || 0,
      spend: Number(c.spend) || 0,
    })),
  ]
}

/**
 * Folds a day's identities into the ledger. Idempotent per (branch, day):
 * re-running the same day recomputes rather than double-counting, because
 * visits/spend for that day are added only when the row's last_seen predates it.
 */
export async function recordDay(branchId: string, day: string, identities: DayIdentity[]) {
  if (identities.length === 0) return { seen: 0, created: 0 }

  const hashes = identities.map(i => i.identity_hash)
  const { data: existing, error: readErr } = await supabase
    .from('pizza_customer_ledger')
    .select('identity_type,identity_hash,first_seen,last_seen,visits,total_spend')
    .eq('branch_id', branchId)
    .in('identity_hash', hashes)
  if (readErr) throw readErr

  const byKey = new Map(
    (existing || []).map(r => [`${r.identity_type}:${r.identity_hash}`, r])
  )

  const rows = identities.map(i => {
    const prev = byKey.get(`${i.identity_type}:${i.identity_hash}`)
    if (!prev) {
      return {
        branch_id: branchId,
        identity_type: i.identity_type,
        identity_hash: i.identity_hash,
        first_seen: day,
        last_seen: day,
        visits: i.visits,
        total_spend: i.spend,
        updated_at: new Date().toISOString(),
      }
    }
    // Replaying a day we already folded in must not inflate the totals.
    const alreadyCounted = prev.last_seen >= day
    return {
      branch_id: branchId,
      identity_type: i.identity_type,
      identity_hash: i.identity_hash,
      first_seen: prev.first_seen < day ? prev.first_seen : day,
      last_seen: prev.last_seen > day ? prev.last_seen : day,
      visits: alreadyCounted ? prev.visits : prev.visits + i.visits,
      total_spend: alreadyCounted ? prev.total_spend : Number(prev.total_spend) + i.spend,
      updated_at: new Date().toISOString(),
    }
  })

  const { error: upsertErr } = await supabase
    .from('pizza_customer_ledger')
    .upsert(rows, { onConflict: 'branch_id,identity_type,identity_hash' })
  if (upsertErr) throw upsertErr

  return { seen: rows.length, created: rows.length - byKey.size }
}

export async function logLedgerRun(input: {
  branch_id: string
  covered_date: string
  identities_seen: number
  new_identities: number
  ok: boolean
  error?: string
}) {
  await supabase.from('pizza_ledger_runs').insert(input)
}

/**
 * Returning customers straight from our ledger: active in the range, and first
 * seen before it. Unlike the POS-based version this keeps working as history
 * accumulates. Returns null while the ledger is too young to be meaningful, so
 * the dashboard can keep showing the POS figure instead of a misleading zero.
 */
export async function ledgerReturning(
  branchId: string,
  from: string,
  to: string
): Promise<{ active: number; returning: number } | null> {
  const { data: earliest } = await supabase
    .from('pizza_customer_ledger')
    .select('first_seen')
    .eq('branch_id', branchId)
    .order('first_seen', { ascending: true })
    .limit(1)

  const start = earliest?.[0]?.first_seen
  // Needs at least a fortnight of ledger before the range to say anything.
  if (!start) return null
  const cutoff = new Date(`${from}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 14)
  if (new Date(`${start}T00:00:00Z`) > cutoff) return null

  const { data: active, error } = await supabase
    .from('pizza_customer_ledger')
    .select('first_seen')
    .eq('branch_id', branchId)
    .gte('last_seen', from)
    .lte('last_seen', to)
  if (error || !active) return null

  return {
    active: active.length,
    returning: active.filter(r => r.first_seen < from).length,
  }
}
