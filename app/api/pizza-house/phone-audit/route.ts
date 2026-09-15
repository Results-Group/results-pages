import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { runWithBranch, listPizzaBranches, pizzaHouseQuery } from '@/lib/pizza-house-db'
import { captureException } from '@/lib/logger'

/**
 * GET /api/pizza-house/phone-audit — diagnostic, owner/admin only. TEMPORARY.
 *
 * Aviv says they now expose customer phone numbers. On 2026-09-15 Mevaseret
 * gained a `client_delivery` table (2,225 rows, 99.7% with a phone) — but
 * `deals.client_id` stayed empty, so no order can be tied to a customer.
 * Giv'at Ze'ev could not be checked from a workstation: its credentials are
 * Vercel "sensitive" variables, which cannot be read back by anyone. Running
 * the same checks here, where those variables already live, is the only way
 * to answer the question without a password changing hands.
 *
 * Returns counts only. It never selects a phone, a name or an email — the
 * table holds real customers, and none of that belongs in a JSON response.
 *
 * Delete once both branches are answered.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const EMPTY = "('','---','0','0000000','---------','-')"

/**
 * The 26 tables both branches had when every one was enumerated on 2026-08-05
 * (see the note in lib/pizza-house-queries.ts). Anything outside this set is
 * something Aviv added since — which is exactly where an order↔customer link
 * would live if they built one, since deals.client_id is still empty.
 */
const BASELINE = new Set([
  'advanced_pay', 'auto_item', 'cheque', 'clients', 'credit', 'credit_realize',
  'creditcard', 'dc_deals', 'deal_change', 'deals', 'debts', 'departments',
  'family', 'groups', 'item_status', 'items', 'items_drag', 'items_sale',
  'payment', 'paymentitm', 'suppliers', 'tips', 'vauch', 'worker',
  'worker_hours', 'z_info',
])

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  // `!session.scope`: the shared Pizza House password mints a scoped session in
  // the same format, and it must not reach a route that reads customer tables.
  if (!session || session.scope || !(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const out: Record<string, unknown> = { checked_at: new Date().toISOString() }

  for (const branch of listPizzaBranches()) {
    try {
      out[branch.label] = await runWithBranch(branch.id, async () => {
        const one = async (sql: string): Promise<number | string | null> => {
          const [row] = await pizzaHouseQuery<Record<string, unknown>>(sql)
          const v = row ? Object.values(row)[0] : null
          return typeof v === 'number' || v === null ? (v as number | null) : String(v)
        }

        const hasDelivery = Number(await one(
          `SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'client_delivery'`,
        )) > 0

        const result: Record<string, unknown> = {
          schema: {
            tables: await one('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()'),
            columns: await one('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()'),
            client_delivery_exists: hasDelivery,
          },
          orders: {
            total: await one('SELECT COUNT(*) FROM deals'),
            linked_to_a_customer: await one('SELECT COUNT(*) FROM deals WHERE client_id IS NOT NULL AND client_id <> 0'),
            last_order_at: await one('SELECT MAX(tm_open) FROM deals'),
          },
          club_clients: {
            rows: await one('SELECT COUNT(*) FROM clients'),
            with_phone: await one(`SELECT COUNT(*) FROM clients WHERE TRIM(COALESCE(phone,'')) NOT IN ${EMPTY}`),
          },
        }

        // Every table by name and row count — names only, never contents.
        const tables = await pizzaHouseQuery<{ name: string }>(
          `SELECT TABLE_NAME AS name FROM information_schema.tables
           WHERE table_schema = DATABASE() ORDER BY TABLE_NAME`,
        )
        const inventory: Record<string, number | string> = {}
        const added: Record<string, unknown> = {}
        for (const { name } of tables) {
          let rows: number | string
          try {
            rows = Number(await one(`SELECT COUNT(*) FROM \`${name}\``))
          } catch {
            rows = 'לא קריא'
          }
          inventory[name] = rows
          if (BASELINE.has(name)) continue
          // A table Aviv added: show its column names, and whether it is shaped
          // like a link — something pointing at an order AND at a customer.
          const cols = (await pizzaHouseQuery<{ c: string }>(
            `SELECT COLUMN_NAME AS c FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = '${name}' ORDER BY ORDINAL_POSITION`,
          )).map(r => r.c)
          // Only id-shaped columns count as a reference. A loose /deal/ matched
          // client_delivery.next_deal_memo — a free-text note — and reported
          // the customer list as an order link, which is the opposite of true.
          const refsOrder = cols.filter(c => /^(id_?(deal|receipt|docum|order)|(deal|receipt|docum|order)_?id)$/i.test(c))
          const refsCustomer = cols.filter(c => /^(id_?(client|customer|delivery)|(client|customer|delivery)_?id)$/i.test(c))
          const entry: Record<string, unknown> = {
            rows, columns: cols,
            looks_like_order_customer_link: refsOrder.length > 0 && refsCustomer.length > 0,
          }
          if (refsOrder.includes('id_deal') && typeof rows === 'number' && rows > 0) {
            entry.rows_matching_an_order = await one(
              `SELECT COUNT(*) FROM \`${name}\` x JOIN deals d ON d.id_deal = x.id_deal`,
            )
          }
          added[name] = entry
        }
        result.tables = { baseline: BASELINE.size, now: tables.length, added_since_aug_5: added, all: inventory }

        if (hasDelivery) {
          result.delivery_customers = {
            rows: await one('SELECT COUNT(*) FROM client_delivery'),
            with_phone: await one(`SELECT COUNT(*) FROM client_delivery WHERE TRIM(COALESCE(phone,'')) NOT IN ${EMPTY}`),
            unique_phones: await one(`SELECT COUNT(DISTINCT phone) FROM client_delivery WHERE TRIM(COALESCE(phone,'')) NOT IN ${EMPTY}`),
            table_created_at: await one(
              `SELECT CREATE_TIME FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = 'client_delivery'`,
            ),
            orders_matching_a_delivery_customer: await one(
              'SELECT COUNT(*) FROM deals d JOIN client_delivery c ON c.id = d.client_id WHERE d.client_id <> 0',
            ),
          }
        }
        return result
      })
    } catch (err) {
      captureException(err, { route: 'GET /api/pizza-house/phone-audit', branch: branch.id })
      out[branch.label] = { error: 'הבדיקה נכשלה בסניף הזה' }
    }
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'private, no-store' } })
}
