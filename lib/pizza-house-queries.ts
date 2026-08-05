import { pizzaHouseQuery } from './pizza-house-db'

/*
 * All queries work on a [from, toExclusive) datetime window.
 * The Aviv DB stores Israel local time as naive DATETIME values,
 * so the client is responsible for sending calendar dates (YYYY-MM-DD).
 */

export interface DateRange {
  from: string // 'YYYY-MM-DD 00:00:00'
  to: string // exclusive upper bound
}

const DELIVERY_PATTERN = "(name LIKE '%משלוח%' OR name LIKE '%מישלוח%')"

/**
 * Below this, a till transaction is a counter sale — a slice, a can — not an
 * order anyone would deliver.
 *
 * The owner reported ~80% deliveries while the dashboard showed 39%. Measured
 * over 30 days at Giv'at Ze'ev: 1,035 of 3,286 transactions were under ₪60 and
 * carried 7 deliveries between them (≈0%), while ₪100+ ran 68–71% delivery.
 * Counting counter sales as orders dragged the whole ratio down. Splitting them
 * out moved the number to 56%, and the rest of the gap is delivery fees keyed
 * as "מחיר כללי" (337 orders) or free deliveries never keyed at all — both
 * fixed at the till, not here.
 *
 * Approved by the client at ₪60 on 2026-08-03. Business definition, not a
 * technical constant: changing it changes what "order" means on the dashboard.
 */
const COUNTER_SALE_MAX = 60

/**
 * Every positive till transaction is exactly one of three channels. Kept as one
 * expression so the KPI cards and the channel chart can never disagree — they
 * already did once (1306 vs 1279 on the same screen).
 */
const CHANNEL_SQL = `CASE
  WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${DELIVERY_PATTERN.replace(/name/g, 'p.name')}) THEN 'delivery'
  WHEN d.sum < ${COUNTER_SALE_MAX} THEN 'counter'
  ELSE 'pickup'
END`

const PAY_TYPES: Record<number, string> = {
  0: 'מזומן',
  1: 'שיק',
  2: 'כרטיס אשראי',
  3: 'הקפה',
  4: 'תווי קניה',
  5: 'מטבע זר',
  6: 'ניכוי מס במקור',
  7: 'העברה בנקאית',
  8: 'זיכוי',
  9: 'מימוש זיכוי',
  10: 'העברת חובות',
  11: 'כרטיסי סועד',
  101: 'צמצום חובות',
}

const CARD_BRANDS: Record<string, string> = {
  '0': 'כרטיס PL',
  '1': 'מאסטרקארד',
  '2': 'ויזה',
  '3': 'דיינרס',
  '4': 'אמקס',
  '5': 'ישראכרט',
  '6': 'JCB',
  '7': 'דיסקבר',
  '8': 'מאסטרו',
}

// ── KPI summary ──

export async function fetchSummary(r: DateRange) {
  const [deals] = await pizzaHouseQuery<{
    revenue: number | null
    orders: number
    avg_order: number | null
    refunds: number | null
    refund_count: number
  }>(
    `SELECT
       ROUND(SUM(CASE WHEN sum > 0 THEN sum ELSE 0 END), 2) as revenue,
       COUNT(CASE WHEN sum > 0 THEN 1 END) as orders,
       ROUND(AVG(CASE WHEN sum > 0 THEN sum END), 2) as avg_order,
       ROUND(SUM(CASE WHEN sum < 0 THEN ABS(sum) ELSE 0 END), 2) as refunds,
       COUNT(CASE WHEN sum < 0 THEN 1 END) as refund_count
     FROM deals WHERE tm_open >= ? AND tm_open < ?`,
    [r.from, r.to]
  )

  const [items] = await pizzaHouseQuery<{
    items_sold: number | null
    discounts: number | null
    discounted_lines: number
  }>(
    `SELECT
       ROUND(SUM(CASE WHEN sum > 0 THEN count ELSE 0 END), 0) as items_sold,
       ROUND(SUM(sum_discount), 2) as discounts,
       COUNT(CASE WHEN sum_discount > 0 THEN 1 END) as discounted_lines
     FROM paymentitm WHERE date >= ? AND date < ?`,
    [r.from, r.to]
  )

  // Delivery is counted off `deals` on exactly the denominator the percentage
  // uses — positive-sum deals, by tm_open. Counting DISTINCT id_deal in
  // paymentitm instead swept in refunded deals and used a different date
  // column, so the KPI (1306) and the channel chart (1279) disagreed on the
  // same screen. Revenue share comes from the same pass: delivery is ~39% of
  // orders but ~56% of money, and the money is what an owner feels.
  const channelRows = await pizzaHouseQuery<{
    channel: string
    orders: number
    revenue: number | null
  }>(
    `SELECT ${CHANNEL_SQL} as channel,
            COUNT(*) as orders,
            ROUND(SUM(d.sum), 2) as revenue
     FROM deals d
     WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
     GROUP BY channel`,
    [r.from, r.to]
  )
  const channelOf = (name: string) => channelRows.find(c => c.channel === name)
  const deliveryOrders = channelOf('delivery')?.orders ?? 0
  const deliveryRevenue = Number(channelOf('delivery')?.revenue ?? 0)
  const pickupOrders = channelOf('pickup')?.orders ?? 0
  const pickupRevenue = Number(channelOf('pickup')?.revenue ?? 0)
  const counterOrders = channelOf('counter')?.orders ?? 0
  const counterRevenue = Number(channelOf('counter')?.revenue ?? 0)

  // Delivery share is of *orders* — delivery + pickup. Counter sales are
  // reported separately rather than folded into the denominator.
  const realOrders = deliveryOrders + pickupOrders
  const realOrderRevenue = deliveryRevenue + pickupRevenue

  // Customer identity = card fingerprint (id_card + validto).
  //
  // Ideally this would be phone-based, since a real person keeps their number
  // across card renewals and multi-card use. This POS holds no phone to use,
  // and that is not a guess about where to look: on 2026-08-05 every one of
  // the 26 tables in the interface database was enumerated on both branches,
  // and every column named like a customer, an address or a delivery was
  // counted. The complete result:
  //
  //   clients            the customer-club table — 2 rows (Mevaseret: 1)
  //   clients.address    empty even on those rows
  //   creditcard.phone   0 of 2180 rows — all the literal "---"
  //   deals.client_id    0 of 3926 rows
  //
  // There is no delivery-address table and no order-customer table; `deals`
  // is id_deal, tm_open, tm_close, sum, paydesk, client_id, tax*, id_z and
  // nothing else. The Aviv spec documents a full club record — phone, mobile,
  // address, delivery discount — and the table is there with those exact
  // columns. The branch simply never enrolls anyone. A delivery order arrives
  // as a plain deal with no customer attached, which is also why the delivery
  // split has to key off a line item rather than an order type.
  //
  // So the card fingerprint is the best identity this DB actually holds. Real
  // per-person identity would have to come from whatever takes the delivery
  // orders, not from the till. Don't re-litigate this from the spec — the
  // fields exist and are empty.
  //
  // Known limitation: a card renewal (new validto) counts as a new customer.
  const [customers] = await pizzaHouseQuery<{ unique_customers: number }>(
    `SELECT COUNT(DISTINCT CONCAT(id_card, '|', validto)) as unique_customers
     FROM creditcard
     WHERE date >= ? AND date < ? AND id_card != '' AND sum > 0`,
    [r.from, r.to]
  )

  // Meal cards (Cibus/Ten-Bis) are the second identity this DB actually holds:
  // dc_deals.id_card is populated on every row (852/852 verified 2026-08-01),
  // and a meal card belongs to one person. Adding them lifts identity coverage
  // from ~52% of payments (credit card only) to ~72%. The two pools can't be
  // deduplicated against each other — someone paying by both card and meal card
  // counts twice — which is why the dashboard labels this "identified
  // customers" rather than claiming a true headcount.
  const [mealCards] = await pizzaHouseQuery<{ meal_card_customers: number }>(
    `SELECT COUNT(DISTINCT id_card) as meal_card_customers
     FROM dc_deals
     WHERE date >= ? AND date < ? AND isreturn = 0
       AND id_card IS NOT NULL AND id_card NOT IN ('', '---', '0')`,
    [r.from, r.to]
  )

  // Share of payments that carry any identity at all — cash carries none.
  const [coverage] = await pizzaHouseQuery<{ identified: number; total: number }>(
    `SELECT
       SUM(CASE WHEN id_pay IN (2, 11) THEN 1 ELSE 0 END) as identified,
       COUNT(*) as total
     FROM payment WHERE date >= ? AND date < ? AND sum > 0`,
    [r.from, r.to]
  )

  // Cards seen in range that were also seen before the range = returning
  const [returning] = await pizzaHouseQuery<{ returning_customers: number }>(
    `SELECT COUNT(DISTINCT CONCAT(c.id_card, '|', c.validto)) as returning_customers
     FROM creditcard c
     WHERE c.date >= ? AND c.date < ? AND c.id_card != '' AND c.sum > 0
       AND EXISTS (
         SELECT 1 FROM creditcard p
         WHERE p.id_card = c.id_card AND p.validto = c.validto AND p.date < ?
       )`,
    [r.from, r.to, r.from]
  )

  const orders = deals?.orders ?? 0
  const cardCustomers = customers?.unique_customers ?? 0
  const mealCardCustomers = mealCards?.meal_card_customers ?? 0
  const identifiedCustomers = cardCustomers + mealCardCustomers

  return {
    revenue: deals?.revenue ?? 0,
    orders,
    avg_order: deals?.avg_order ?? 0,
    refunds: deals?.refunds ?? 0,
    refund_count: deals?.refund_count ?? 0,
    items_sold: items?.items_sold ?? 0,
    items_per_order: orders > 0 ? Math.round(((items?.items_sold ?? 0) / orders) * 10) / 10 : 0,
    discounts: items?.discounts ?? 0,
    discounted_lines: items?.discounted_lines ?? 0,
    delivery_orders: deliveryOrders,
    delivery_pct: realOrders > 0 ? Math.round((deliveryOrders / realOrders) * 100) : 0,
    delivery_revenue: deliveryRevenue,
    delivery_revenue_pct:
      realOrderRevenue > 0 ? Math.round((deliveryRevenue / realOrderRevenue) * 100) : 0,
    // The denominator behind both percentages, so the UI can state it plainly.
    order_count: realOrders,
    pickup_orders: pickupOrders,
    counter_sales: counterOrders,
    counter_sales_revenue: counterRevenue,
    counter_sale_max: COUNTER_SALE_MAX,
    unique_customers: identifiedCustomers,
    unique_by_card: cardCustomers,
    unique_by_meal_card: mealCardCustomers,
    identity_coverage_pct:
      Number(coverage?.total ?? 0) > 0
        ? Math.round((Number(coverage!.identified) / Number(coverage!.total)) * 100)
        : 0,
    returning_customers: returning?.returning_customers ?? 0,
    // Returning stays on the credit-card pool: it's the only one with usable
    // prior-period history in this DB, and mixing pools would understate it.
    returning_pct:
      cardCustomers > 0
        ? Math.round(((returning?.returning_customers ?? 0) / cardCustomers) * 100)
        : 0,
  }
}

// ── Time series with automatic granularity ──

export async function fetchTimeseries(r: DateRange, rangeDays: number) {
  let bucketExpr: string
  let granularity: 'hour' | 'day' | 'week'
  if (rangeDays <= 2) {
    bucketExpr = "DATE_FORMAT(tm_open, '%Y-%m-%d %H:00')"
    granularity = 'hour'
  } else if (rangeDays <= 92) {
    bucketExpr = "DATE_FORMAT(tm_open, '%Y-%m-%d')"
    granularity = 'day'
  } else {
    bucketExpr = "DATE_FORMAT(DATE_SUB(tm_open, INTERVAL WEEKDAY(tm_open) DAY), '%Y-%m-%d')"
    granularity = 'week'
  }

  const rows = await pizzaHouseQuery<{ bucket: string; revenue: number; orders: number }>(
    `SELECT ${bucketExpr} as bucket,
            ROUND(SUM(CASE WHEN sum > 0 THEN sum ELSE 0 END), 2) as revenue,
            COUNT(CASE WHEN sum > 0 THEN 1 END) as orders
     FROM deals
     WHERE tm_open >= ? AND tm_open < ?
     GROUP BY bucket ORDER BY bucket ASC`,
    [r.from, r.to]
  )
  return { granularity, points: rows }
}

// ── Heatmap: day of week x hour ──

export async function fetchHeatmap(r: DateRange) {
  return pizzaHouseQuery<{ dow: number; hour: number; orders: number; revenue: number }>(
    `SELECT DAYOFWEEK(tm_open) as dow, HOUR(tm_open) as hour,
            COUNT(*) as orders,
            ROUND(SUM(sum), 2) as revenue
     FROM deals
     WHERE tm_open >= ? AND tm_open < ? AND sum > 0
     GROUP BY dow, hour ORDER BY dow, hour`,
    [r.from, r.to]
  )
}

export async function fetchWeekdays(r: DateRange) {
  return pizzaHouseQuery<{ dow: number; orders: number; revenue: number; avg_order: number }>(
    `SELECT DAYOFWEEK(tm_open) as dow,
            COUNT(*) as orders,
            ROUND(SUM(sum), 2) as revenue,
            ROUND(AVG(sum), 2) as avg_order
     FROM deals
     WHERE tm_open >= ? AND tm_open < ? AND sum > 0
     GROUP BY dow ORDER BY dow`,
    [r.from, r.to]
  )
}

// ── Customers ──

export async function fetchCustomers(r: DateRange) {
  // New vs returning within range — identity = card fingerprint (see the
  // long note on `customers` above for why phone-based dedup isn't possible).
  const newVsReturning = await pizzaHouseQuery<{ kind: string; customers: number; revenue: number }>(
    `SELECT
       CASE WHEN first_seen >= ? THEN 'new' ELSE 'returning' END as kind,
       COUNT(*) as customers,
       ROUND(SUM(range_spend), 2) as revenue
     FROM (
       SELECT CONCAT(id_card, '|', validto) as card,
              MIN(date) as first_seen,
              SUM(CASE WHEN date >= ? AND date < ? THEN sum ELSE 0 END) as range_spend
       FROM creditcard
       WHERE id_card != '' AND sum > 0
       GROUP BY card
       HAVING SUM(CASE WHEN date >= ? AND date < ? THEN 1 ELSE 0 END) > 0
     ) t
     GROUP BY kind`,
    [r.from, r.from, r.to, r.from, r.to]
  )

  // Visit frequency distribution (all-time behavior of customers active in range)
  const frequency = await pizzaHouseQuery<{ bucket: string; customers: number }>(
    `SELECT
       CASE
         WHEN visits = 1 THEN '1'
         WHEN visits = 2 THEN '2'
         WHEN visits BETWEEN 3 AND 5 THEN '3-5'
         ELSE '6+'
       END as bucket,
       COUNT(*) as customers
     FROM (
       SELECT CONCAT(id_card, '|', validto) as card, COUNT(DISTINCT id_docum) as visits
       FROM creditcard
       WHERE id_card != '' AND sum > 0
       GROUP BY card
       HAVING SUM(CASE WHEN date >= ? AND date < ? THEN 1 ELSE 0 END) > 0
     ) t
     GROUP BY bucket
     ORDER BY FIELD(bucket, '1', '2', '3-5', '6+')`,
    [r.from, r.to]
  )

  // VIP customers active in range: total all-time spend. `last4` = card tail;
  // UI renders it as "•••• 1234".
  const vip = await pizzaHouseQuery<{
    last4: string
    nm_card: string
    visits: number
    total_spend: number
    range_spend: number
    last_visit: string
  }>(
    `SELECT
       id_card as last4,
       MAX(nm_card) as nm_card,
       COUNT(DISTINCT id_docum) as visits,
       ROUND(SUM(sum), 2) as total_spend,
       ROUND(SUM(CASE WHEN date >= ? AND date < ? THEN sum ELSE 0 END), 2) as range_spend,
       MAX(date) as last_visit
     FROM creditcard
     WHERE id_card != '' AND sum > 0
     GROUP BY id_card, validto
     HAVING range_spend > 0
     ORDER BY total_spend DESC
     LIMIT 10`,
    [r.from, r.to]
  )

  // Institutional segment: meal cards by company
  const mealCards = await pizzaHouseQuery<{ company: string; orders: number; revenue: number }>(
    `SELECT
       CASE WHEN name_company IS NULL OR name_company = '' THEN 'כרטיס סועד כללי' ELSE name_company END as company,
       COUNT(*) as orders,
       ROUND(SUM(sum), 2) as revenue
     FROM dc_deals
     WHERE date >= ? AND date < ? AND sum > 0
     GROUP BY company ORDER BY revenue DESC`,
    [r.from, r.to]
  )

  return { newVsReturning, frequency, vip, mealCards }
}

// ── Products, promos, categories ──

export async function fetchProducts(r: DateRange, prev: DateRange) {
  const top = await pizzaHouseQuery<{
    name: string
    qty: number
    revenue: number
    prev_revenue: number | null
  }>(
    `SELECT cur.name, cur.qty, cur.revenue, prv.revenue as prev_revenue
     FROM (
       SELECT name, ROUND(SUM(count), 0) as qty, ROUND(SUM(sum), 2) as revenue
       FROM paymentitm
       WHERE date >= ? AND date < ? AND sum > 0
       GROUP BY name
     ) cur
     LEFT JOIN (
       SELECT name, ROUND(SUM(sum), 2) as revenue
       FROM paymentitm
       WHERE date >= ? AND date < ? AND sum > 0
       GROUP BY name
     ) prv ON prv.name = cur.name
     ORDER BY cur.revenue DESC
     LIMIT 15`,
    [r.from, r.to, prev.from, prev.to]
  )

  const categories = await pizzaHouseQuery<{ category: string; qty: number; revenue: number }>(
    `SELECT
       COALESCE(NULLIF(TRIM(g.name), ''), 'ללא קטגוריה') as category,
       ROUND(SUM(p.count), 0) as qty,
       ROUND(SUM(p.sum), 2) as revenue
     FROM paymentitm p
     LEFT JOIN groups g ON p.grp = g.id
     WHERE p.date >= ? AND p.date < ? AND p.sum > 0
     GROUP BY category ORDER BY revenue DESC`,
    [r.from, r.to]
  )

  // Bundles/promos: names matching typical bundle patterns
  const bundles = await pizzaHouseQuery<{ name: string; qty: number; revenue: number }>(
    `SELECT name, ROUND(SUM(count), 0) as qty, ROUND(SUM(sum), 2) as revenue
     FROM paymentitm
     WHERE date >= ? AND date < ? AND sum > 0
       AND (name LIKE '%מגשים%' OR name LIKE '%+%' OR name LIKE '%קומבינה%' OR name LIKE '%מבצע%' OR name LIKE '2 %')
     GROUP BY name ORDER BY revenue DESC LIMIT 10`,
    [r.from, r.to]
  )

  const discountedItems = await pizzaHouseQuery<{ name: string; times: number; discount_total: number }>(
    `SELECT name, COUNT(*) as times, ROUND(SUM(sum_discount), 2) as discount_total
     FROM paymentitm
     WHERE date >= ? AND date < ? AND sum_discount > 0
     GROUP BY name ORDER BY discount_total DESC LIMIT 10`,
    [r.from, r.to]
  )

  return { top, categories, bundles, discountedItems }
}

// ── Channels: delivery vs pickup ──

export async function fetchChannels(r: DateRange) {
  const rows = await pizzaHouseQuery<{
    channel: string
    orders: number
    revenue: number
    avg_order: number
  }>(
    // Same CHANNEL_SQL as the KPI cards — these two disagreed on screen once
    // (1306 vs 1279) and the fix is that there is only one definition.
    `SELECT ${CHANNEL_SQL} as channel,
       COUNT(*) as orders,
       ROUND(SUM(d.sum), 2) as revenue,
       ROUND(AVG(d.sum), 2) as avg_order
     FROM deals d
     WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
     GROUP BY channel`,
    [r.from, r.to]
  )
  return rows
}

// ── Payments ──

export async function fetchPayments(r: DateRange) {
  const methods = await pizzaHouseQuery<{ id_pay: number; count: number; total: number }>(
    `SELECT id_pay, COUNT(*) as count, ROUND(SUM(sum), 2) as total
     FROM payment
     WHERE date >= ? AND date < ? AND sum > 0
     GROUP BY id_pay ORDER BY total DESC`,
    [r.from, r.to]
  )

  const brands = await pizzaHouseQuery<{ brand: string; count: number; total: number }>(
    `SELECT brand, COUNT(*) as count, ROUND(SUM(sum), 2) as total
     FROM creditcard
     WHERE date >= ? AND date < ? AND sum > 0
     GROUP BY brand ORDER BY total DESC`,
    [r.from, r.to]
  )

  return {
    methods: methods.map(m => ({ ...m, label: PAY_TYPES[m.id_pay] ?? `אחר (${m.id_pay})` })),
    brands: brands.map(b => ({ ...b, label: CARD_BRANDS[String(b.brand).trim()] ?? `מותג ${b.brand}` })),
  }
}

// ── Order processing time ──

export async function fetchOrderTiming(r: DateRange) {
  const [summary] = await pizzaHouseQuery<{ avg_minutes: number }>(
    `SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, tm_open, tm_close)) / 60, 1) as avg_minutes
     FROM deals
     WHERE tm_open >= ? AND tm_open < ? AND sum > 0 AND tm_close > tm_open
       AND TIMESTAMPDIFF(MINUTE, tm_open, tm_close) BETWEEN 1 AND 180`,
    [r.from, r.to]
  )

  const byHour = await pizzaHouseQuery<{ hour: number; avg_minutes: number; orders: number }>(
    `SELECT HOUR(tm_open) as hour,
            ROUND(AVG(TIMESTAMPDIFF(SECOND, tm_open, tm_close)) / 60, 1) as avg_minutes,
            COUNT(*) as orders
     FROM deals
     WHERE tm_open >= ? AND tm_open < ? AND sum > 0 AND tm_close > tm_open
       AND TIMESTAMPDIFF(MINUTE, tm_open, tm_close) BETWEEN 1 AND 180
     GROUP BY hour ORDER BY hour`,
    [r.from, r.to]
  )

  return { avg_minutes: summary?.avg_minutes ?? 0, byHour }
}

// ── Dead items (in catalog but not sold in range) ──

export async function fetchDeadItems(r: DateRange) {
  return pizzaHouseQuery<{ name: string; sale_price: number; category: string }>(
    `SELECT i.name, i.sale_price,
            COALESCE(NULLIF(TRIM(g.name), ''), 'ללא קטגוריה') as category
     FROM items i
     LEFT JOIN \`groups\` g ON i.grp = g.id
     WHERE i.sale_price > 0
       -- NOT EXISTS rather than NOT IN: if the subquery returns even one NULL
       -- name, NOT IN is never true and the whole "items that did not sell"
       -- panel silently renders empty instead of listing anything.
       AND NOT EXISTS (
         SELECT 1 FROM paymentitm p
         WHERE p.name = i.name AND p.date >= ? AND p.date < ? AND p.sum > 0
       )
     ORDER BY i.sale_price DESC
     LIMIT 20`,
    [r.from, r.to]
  )
}

// ── Data freshness ──

export async function fetchFreshness() {
  const [row] = await pizzaHouseQuery<{ last_deal: string | null; last_z_update: string | null }>(
    `SELECT
       (SELECT MAX(tm_open) FROM deals) as last_deal,
       (SELECT MAX(date_z_update) FROM z_info) as last_z_update`
  )
  return row ?? { last_deal: null, last_z_update: null }
}
