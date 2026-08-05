import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { runWithBranch, listPizzaBranches, pizzaHouseQuery } from '@/lib/pizza-house-db'
import { captureException } from '@/lib/logger'

/**
 * GET /api/pizza-house/customer-identity — diagnostic, owner/admin only.
 *
 * Round two. The first pass searched for phone-shaped columns and found only
 * empty ones, but it only ever looked at tables it already knew about. This
 * one makes no assumption about the schema: it lists every table with its row
 * count, then every column anywhere in the database whose name looks like a
 * customer, an address or a delivery — with how many rows actually hold a
 * value. If a delivery customer is recorded anywhere in this POS, it shows up
 * here.
 *
 * Reports counts and column names only — never a phone, name or address.
 *
 * Read-only. Delete once the identity question is settled.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Column names that would carry a customer, an address or a delivery. */
const INTERESTING = [
  'client', 'customer', 'member', 'club', 'lakoach',
  'address', 'addr', 'street', 'city', 'house', 'apart', 'floor', 'entrance', 'zip',
  'deliv', 'mishloach', 'shaliach', 'courier', 'driver', 'order',
  'phone', 'tel', 'mobile', 'cell', 'name',
]

/** Identifiers come from information_schema, but they are interpolated into
 *  SQL, so nothing but word characters gets through. */
const safe = (s: string) => /^[A-Za-z0-9_]+$/.test(s)

/** Present, rather than a placeholder the till types to skip a required field. */
const REAL = (col: string) =>
  `\`${col}\` IS NOT NULL AND TRIM(\`${col}\`) NOT IN ('', '-', '--', '---', '0', '000')`

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const out: Record<string, unknown> = {}

  for (const branch of listPizzaBranches()) {
    try {
      out[branch.label] = await runWithBranch(branch.id, async () => {
        // ── 1. Every table in the database, with how much is in it ──
        const tables = await pizzaHouseQuery<{ name: string; approx: number }>(
          `SELECT TABLE_NAME as name, TABLE_ROWS as approx
             FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_ROWS DESC`
        )

        // ── 2. Every customer/address/delivery-shaped column, anywhere ──
        const cols = await pizzaHouseQuery<{ t: string; c: string; ty: string }>(
          `SELECT TABLE_NAME as t, COLUMN_NAME as c, DATA_TYPE as ty
             FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND (${INTERESTING.map(() => 'LOWER(COLUMN_NAME) LIKE ?').join(' OR ')})
            ORDER BY TABLE_NAME, ORDINAL_POSITION`,
          INTERESTING.map(p => `%${p}%`)
        )

        // ── 3. How many rows actually hold a value, per column ──
        // Skipped for tables the row estimate says are empty, so a wide schema
        // doesn't spend the whole function budget on zeroes.
        const rowsOf = new Map(tables.map(t => [t.name, Number(t.approx ?? 0)]))
        const populated = []
        const empty = []
        for (const c of cols) {
          if (!safe(c.t) || !safe(c.c)) continue
          if ((rowsOf.get(c.t) ?? 0) === 0) { empty.push(`${c.t}.${c.c}`); continue }
          try {
            const [n] = await pizzaHouseQuery<{ total: number; filled: number; uniq: number }>(
              `SELECT COUNT(*) as total,
                      SUM(CASE WHEN ${REAL(c.c)} THEN 1 ELSE 0 END) as filled,
                      COUNT(DISTINCT CASE WHEN ${REAL(c.c)} THEN \`${c.c}\` END) as uniq
                 FROM \`${c.t}\``
            )
            const total = Number(n.total), filled = Number(n.filled)
            const row = {
              col: `${c.t}.${c.c}`,
              type: c.ty,
              rows: total,
              filled,
              distinct: Number(n.uniq),
              pct: total ? Math.round((filled / total) * 100) : 0,
            }
            if (filled > 0) populated.push(row)
            else empty.push(`${c.t}.${c.c} (${total} rows)`)
          } catch (e) {
            empty.push(`${c.t}.${c.c} — ${String(e).slice(0, 80)}`)
          }
        }

        return {
          // Sorted by what is actually filled, so the answer is at the top.
          columns_with_data: populated.sort((a, b) => b.filled - a.filled),
          columns_empty: empty,
          tables: tables.map(t => `${t.name} (~${Number(t.approx ?? 0)})`),
        }
      })
    } catch (err) {
      captureException(err, { route: 'GET /api/pizza-house/customer-identity', branch: branch.id })
      out[branch.label] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
  }

  return NextResponse.json(out)
}
