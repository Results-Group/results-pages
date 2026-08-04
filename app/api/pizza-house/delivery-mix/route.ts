import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { runWithBranch, listPizzaBranches, pizzaHouseQuery } from '@/lib/pizza-house-db'
import { captureException } from '@/lib/logger'

/**
 * GET /api/pizza-house/delivery-mix — diagnostic, owner/admin only.
 *
 * The client reports ~80% of orders are deliveries; the dashboard shows ~34%.
 * Detection keys off a "דמי משלוח" line item, so this reports, per branch:
 *  - how deliveries are keyed (name/price spread), to catch missed variants
 *  - the delivery share by order size, because counter micro-sales (a slice,
 *    a can of Coke) are "deals" in the POS but not "orders" to an owner, and
 *    they sit in the denominator
 *  - orders carrying a generic ₪10/₪15 line but no named delivery item —
 *    likely deliveries keyed as "מחיר כללי"
 *
 * Read-only against the POS. Delete once the definition is settled.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const NAMED = "(p.name LIKE '%משלוח%' OR p.name LIKE '%מישלוח%')"
const HAS_NAMED = `EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${NAMED})`

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 90)
  const out: Record<string, unknown> = { days }

  for (const branch of listPizzaBranches()) {
    try {
      const data = await runWithBranch(branch.id, async () => {
        const [totals] = await pizzaHouseQuery<{ orders: number; revenue: number; delivery: number }>(
          `SELECT COUNT(*) as orders, ROUND(SUM(d.sum)) as revenue,
                  SUM(CASE WHEN ${HAS_NAMED} THEN 1 ELSE 0 END) as delivery
           FROM deals d WHERE d.sum > 0 AND d.tm_open >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
          [days]
        )

        const buckets = await pizzaHouseQuery<{ bucket: string; orders: number; delivery: number }>(
          `SELECT CASE WHEN d.sum < 30 THEN '1. <30' WHEN d.sum < 60 THEN '2. 30-60'
                       WHEN d.sum < 100 THEN '3. 60-100' WHEN d.sum < 150 THEN '4. 100-150'
                       ELSE '5. 150+' END as bucket,
                  COUNT(*) as orders,
                  SUM(CASE WHEN ${HAS_NAMED} THEN 1 ELSE 0 END) as delivery
           FROM deals d WHERE d.sum > 0 AND d.tm_open >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY bucket ORDER BY bucket`,
          [days]
        )

        const feeVariants = await pizzaHouseQuery<{ name: string; price: number; n: number }>(
          `SELECT p.name, p.price, COUNT(*) as n FROM paymentitm p
           WHERE ${NAMED} AND p.date >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY p.name, p.price ORDER BY n DESC LIMIT 15`,
          [days]
        )

        const [generic] = await pizzaHouseQuery<{ n: number }>(
          `SELECT COUNT(DISTINCT d.id_deal) as n
           FROM deals d JOIN paymentitm p ON p.id_deal = d.id_deal
           WHERE d.sum > 0 AND d.tm_open >= DATE_SUB(NOW(), INTERVAL ? DAY)
             AND p.price IN (10, 15, 20, 25) AND p.name LIKE '%מחיר כללי%'
             AND NOT ${HAS_NAMED}`,
          [days]
        )

        const [big] = await pizzaHouseQuery<{ orders: number; delivery: number }>(
          `SELECT COUNT(*) as orders, SUM(CASE WHEN ${HAS_NAMED} THEN 1 ELSE 0 END) as delivery
           FROM deals d WHERE d.sum >= 60 AND d.tm_open >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
          [days]
        )

        const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
        return {
          orders: totals.orders,
          revenue: totals.revenue,
          avg_order: totals.orders ? Math.round(totals.revenue / totals.orders) : 0,
          delivery_orders: totals.delivery,
          delivery_pct_all_deals: pct(totals.delivery, totals.orders),
          delivery_pct_excluding_counter_sales: pct(big.delivery, big.orders),
          orders_over_60: big.orders,
          maybe_delivery_keyed_generically: generic.n,
          by_size: buckets.map(b => ({ ...b, pct: pct(b.delivery, b.orders) })),
          fee_variants: feeVariants,
        }
      })
      out[branch.label] = data
    } catch (err) {
      captureException(err, { route: 'GET /api/pizza-house/delivery-mix', branch: branch.id })
      out[branch.label] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
  }

  return NextResponse.json(out)
}
