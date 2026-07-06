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

  const [delivery] = await pizzaHouseQuery<{ delivery_orders: number }>(
    `SELECT COUNT(DISTINCT id_deal) as delivery_orders
     FROM paymentitm
     WHERE date >= ? AND date < ? AND ${DELIVERY_PATTERN}`,
    [r.from, r.to]
  )

  const [customers] = await pizzaHouseQuery<{ unique_customers: number }>(
    `SELECT COUNT(DISTINCT CONCAT(id_card, '|', validto)) as unique_customers
     FROM creditcard
     WHERE date >= ? AND date < ? AND id_card != '' AND sum > 0`,
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
    delivery_orders: delivery?.delivery_orders ?? 0,
    delivery_pct: orders > 0 ? Math.round(((delivery?.delivery_orders ?? 0) / orders) * 100) : 0,
    unique_customers: customers?.unique_customers ?? 0,
    returning_customers: returning?.returning_customers ?? 0,
    returning_pct:
      (customers?.unique_customers ?? 0) > 0
        ? Math.round(((returning?.returning_customers ?? 0) / customers!.unique_customers) * 100)
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
  // New vs returning within range
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

  // VIP customers active in range: total all-time spend
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
    `SELECT
       CASE WHEN dlv.id_deal IS NOT NULL THEN 'delivery' ELSE 'pickup' END as channel,
       COUNT(*) as orders,
       ROUND(SUM(d.sum), 2) as revenue,
       ROUND(AVG(d.sum), 2) as avg_order
     FROM deals d
     LEFT JOIN (
       SELECT DISTINCT id_deal FROM paymentitm
       WHERE date >= ? AND date < ? AND ${DELIVERY_PATTERN}
     ) dlv ON dlv.id_deal = d.id_deal
     WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
     GROUP BY channel`,
    [r.from, r.to, r.from, r.to]
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
       AND i.name NOT IN (
         SELECT DISTINCT name FROM paymentitm
         WHERE date >= ? AND date < ? AND sum > 0
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
