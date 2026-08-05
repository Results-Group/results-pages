import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { runWithBranch, listPizzaBranches, pizzaHouseQuery } from '@/lib/pizza-house-db'
import { captureException } from '@/lib/logger'

/**
 * GET /api/pizza-house/customer-identity — diagnostic, owner/admin only.
 *
 * The dashboard identifies a customer by credit-card fingerprint because
 * `creditcard.phone` turned out to be the literal "---" on all 2,180 rows.
 * The Aviv interface spec (Pos_Interface.pdf) documents a *customer club*
 * table carrying phone, mobile, address and a delivery discount, keyed onto
 * every deal by a club-customer number — a source we never looked at.
 *
 * Same trap as last time, so this proves nothing by reading the spec: it walks
 * the live schema for every phone-shaped column, counts how many rows actually
 * hold a number, and measures what share of deals carry a club id.
 *
 * Reports counts only — never a phone number, a name or an address.
 *
 * Read-only. Delete once the identity question is settled.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Column names that would carry a phone in a Hebrew POS schema. */
const PHONE_LIKE = ['phone', 'tel', 'mobile', 'cell', 'pelefon', 'nayad']
/** Columns on `deals` that could be the "מספר לקוח מועדון" link. */
const CLIENT_LIKE = ['client', 'customer', 'member', 'club', 'lakoach']

/** Identifiers come from information_schema, but they are interpolated into
 *  SQL, so nothing but word characters gets through. */
const safe = (s: string) => /^[A-Za-z0-9_]+$/.test(s)

/** A value that is present rather than a placeholder the till types to skip. */
const REAL = (col: string) =>
  `${col} IS NOT NULL AND TRIM(${col}) NOT IN ('', '-', '--', '---', '0', '000', 'לא ידוע')`

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 90)
  const out: Record<string, unknown> = { days }

  for (const branch of listPizzaBranches()) {
    try {
      out[branch.label] = await runWithBranch(branch.id, async () => {
        // ── 1. Every phone-shaped column in the database ──
        const cols = await pizzaHouseQuery<{ table_name: string; column_name: string; data_type: string }>(
          `SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, DATA_TYPE as data_type
             FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND (${PHONE_LIKE.map(() => 'LOWER(COLUMN_NAME) LIKE ?').join(' OR ')})
            ORDER BY TABLE_NAME`,
          PHONE_LIKE.map(p => `%${p}%`)
        )

        // ── 2. For each, how many rows actually hold a number ──
        const phoneColumns = []
        for (const c of cols) {
          if (!safe(c.table_name) || !safe(c.column_name)) continue
          try {
            const [n] = await pizzaHouseQuery<{ total: number; filled: number; distinct_filled: number }>(
              `SELECT COUNT(*) as total,
                      SUM(CASE WHEN ${REAL(c.column_name)} THEN 1 ELSE 0 END) as filled,
                      COUNT(DISTINCT CASE WHEN ${REAL(c.column_name)} THEN ${c.column_name} END) as distinct_filled
                 FROM ${c.table_name}`
            )
            phoneColumns.push({
              table: c.table_name,
              column: c.column_name,
              rows: Number(n.total),
              with_phone: Number(n.filled),
              distinct_phones: Number(n.distinct_filled),
              fill_pct: Number(n.total) ? Math.round((Number(n.filled) / Number(n.total)) * 100) : 0,
            })
          } catch (e) {
            phoneColumns.push({ table: c.table_name, column: c.column_name, error: String(e).slice(0, 120) })
          }
        }

        // ── 3. Which column on `deals` links a deal to a club customer ──
        const dealCols = await pizzaHouseQuery<{ column_name: string; data_type: string }>(
          `SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type
             FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals'
            ORDER BY ORDINAL_POSITION`
        )
        const clientCols = dealCols.filter(c =>
          CLIENT_LIKE.some(p => c.column_name.toLowerCase().includes(p)) && safe(c.column_name))

        // ── 4. How much of the real traffic carries that link ──
        const linkage = []
        for (const c of clientCols) {
          try {
            const [n] = await pizzaHouseQuery<{ orders: number; linked: number; people: number }>(
              `SELECT COUNT(*) as orders,
                      SUM(CASE WHEN ${REAL(`d.${c.column_name}`)} THEN 1 ELSE 0 END) as linked,
                      COUNT(DISTINCT CASE WHEN ${REAL(`d.${c.column_name}`)} THEN d.${c.column_name} END) as people
                 FROM deals d
                WHERE d.sum > 0 AND d.tm_open >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
              [days]
            )
            linkage.push({
              column: c.column_name,
              orders: Number(n.orders),
              orders_with_client: Number(n.linked),
              coverage_pct: Number(n.orders) ? Math.round((Number(n.linked) / Number(n.orders)) * 100) : 0,
              distinct_clients: Number(n.people),
            })
          } catch (e) {
            linkage.push({ column: c.column_name, error: String(e).slice(0, 120) })
          }
        }

        // ── 5. Today's number, to compare against ──
        const [current] = await pizzaHouseQuery<{ card_customers: number }>(
          `SELECT COUNT(DISTINCT CONCAT(id_card, '|', validto)) as card_customers
             FROM creditcard
            WHERE date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND id_card != '' AND sum > 0`,
          [days]
        )

        return {
          phone_columns: phoneColumns,
          deals_client_columns: linkage,
          deals_columns: dealCols.map(c => c.column_name).join(', '),
          current_dashboard_unique_customers: Number(current?.card_customers ?? 0),
        }
      })
    } catch (err) {
      captureException(err, { route: 'GET /api/pizza-house/customer-identity', branch: branch.id })
      out[branch.label] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
  }

  return NextResponse.json(out)
}
