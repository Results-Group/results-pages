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
