// Aggregate several branches' dashboard payloads into one unified "all branches"
// view. SQL ROUND() returns DECIMAL as strings, so everything is coerced via n().

const n = (v: unknown): number => Number(v ?? 0) || 0
const r2 = (v: number) => Math.round(v * 100) / 100
const r1 = (v: number) => Math.round(v * 10) / 10

export interface BranchData {
  summary: Record<string, unknown>
  prev_summary: Record<string, unknown>
  timeseries: { granularity: string; points: { bucket: string; revenue: number; orders: number }[] }
  heatmap: { dow: number; hour: number; orders: number; revenue: number }[]
  weekdays: { dow: number; orders: number; revenue: number; avg_order: number }[]
  customers: {
    newVsReturning: { kind: string; customers: number; revenue: number }[]
    frequency: { bucket: string; customers: number }[]
    vip: { last4: string; nm_card: string; visits: number; total_spend: number; range_spend: number; last_visit: string }[]
    mealCards: { company: string; orders: number; revenue: number }[]
  }
  products: {
    top: { name: string; qty: number; revenue: number; prev_revenue: number | null }[]
    categories: { category: string; qty: number; revenue: number }[]
    bundles: { name: string; qty: number; revenue: number }[]
    discountedItems: { name: string; times: number; discount_total: number }[]
  }
  channels: { channel: string; orders: number; revenue: number; avg_order: number }[]
  payments: {
    methods: { id_pay: number; count: number; total: number; label: string }[]
    brands: { brand: string; count: number; total: number; label: string }[]
  }
  freshness: { last_deal: string | null; last_z_update: string | null }
  orderTiming?: { avg_minutes: number; byHour: { hour: number; avg_minutes: number; orders: number }[] }
  deadItems?: { name: string; sale_price: number; category: string }[]
}

/** Group rows across branches by a key, summing the given numeric fields. */
function groupSum<T extends Record<string, unknown>>(
  lists: (T[] | undefined)[],
  keyOf: (r: T) => string,
  sumFields: (keyof T)[],
): { rows: T[]; groups: Map<string, T[]> } {
  const groups = new Map<string, T[]>()
  for (const arr of lists) for (const r of arr || []) {
    const k = keyOf(r)
    const bucket = groups.get(k)
    if (bucket) bucket.push(r); else groups.set(k, [r])
  }
  const rows = [...groups.values()].map(rs => {
    const base = { ...rs[0] } as T
    for (const f of sumFields) (base as Record<string, unknown>)[f as string] = rs.reduce((a, r) => a + n(r[f]), 0)
    return base
  })
  return { rows, groups }
}

function aggSummary(list: Record<string, unknown>[]): Record<string, number> {
  const s = {
    revenue: 0, orders: 0, refunds: 0, refund_count: 0, items_sold: 0, discounts: 0,
    discounted_lines: 0, delivery_orders: 0, unique_customers: 0, returning_customers: 0,
  }
  for (const x of list) {
    s.revenue += n(x.revenue); s.orders += n(x.orders); s.refunds += n(x.refunds)
    s.refund_count += n(x.refund_count); s.items_sold += n(x.items_sold); s.discounts += n(x.discounts)
    s.discounted_lines += n(x.discounted_lines); s.delivery_orders += n(x.delivery_orders)
    s.unique_customers += n(x.unique_customers); s.returning_customers += n(x.returning_customers)
  }
  return {
    ...s,
    avg_order: s.orders ? r2(s.revenue / s.orders) : 0,
    items_per_order: s.orders ? r2(s.items_sold / s.orders) : 0,
    delivery_pct: s.orders ? r1((s.delivery_orders / s.orders) * 100) : 0,
    returning_pct: s.unique_customers ? r1((s.returning_customers / s.unique_customers) * 100) : 0,
  }
}

const maxDate = (list: (string | null | undefined)[]): string | null =>
  list.filter(Boolean).sort().slice(-1)[0] ?? null

const topBy = <T>(rows: T[], field: keyof T, limit: number): T[] =>
  [...rows].sort((a, b) => n(b[field]) - n(a[field])).slice(0, limit)

export function aggregateBranches(list: BranchData[]): BranchData {
  // Timeseries: same granularity across branches (range is identical); sum per bucket.
  const ts = groupSum(list.map(b => b.timeseries?.points), p => p.bucket, ['revenue', 'orders'])
  const timeseries = {
    granularity: list[0]?.timeseries?.granularity || 'day',
    points: ts.rows.sort((a, b) => (a.bucket < b.bucket ? -1 : 1)),
  }

  const weekdays = groupSum(list.map(b => b.weekdays), w => String(w.dow), ['orders', 'revenue']).rows
    .map(w => ({ ...w, avg_order: w.orders ? r2(w.revenue / w.orders) : 0 }))
    .sort((a, b) => a.dow - b.dow)

  const channels = groupSum(list.map(b => b.channels), c => c.channel, ['orders', 'revenue']).rows
    .map(c => ({ ...c, avg_order: c.orders ? r2(c.revenue / c.orders) : 0 }))

  // Order timing: weighted average of minutes by order count.
  const timingGroups = groupSum(list.map(b => b.orderTiming?.byHour), h => String(h.hour), ['orders'])
  const byHour = timingGroups.rows.map(h => {
    const rows = timingGroups.groups.get(String(h.hour)) || []
    const totalOrders = rows.reduce((a, r) => a + n(r.orders), 0)
    const weighted = rows.reduce((a, r) => a + n(r.avg_minutes) * n(r.orders), 0)
    return { hour: h.hour, orders: totalOrders, avg_minutes: totalOrders ? r1(weighted / totalOrders) : 0 }
  }).sort((a, b) => a.hour - b.hour)
  const allTimingOrders = byHour.reduce((a, h) => a + h.orders, 0)
  const orderTiming = {
    avg_minutes: allTimingOrders ? r1(byHour.reduce((a, h) => a + h.avg_minutes * h.orders, 0) / allTimingOrders) : 0,
    byHour,
  }

  // Dead items: union across branches (dedup by name).
  const deadMap = new Map<string, { name: string; sale_price: number; category: string }>()
  for (const b of list) for (const d of b.deadItems || []) if (!deadMap.has(d.name)) deadMap.set(d.name, d)

  return {
    summary: aggSummary(list.map(b => b.summary)),
    prev_summary: aggSummary(list.map(b => b.prev_summary)),
    timeseries,
    heatmap: groupSum(list.map(b => b.heatmap), h => `${h.dow}-${h.hour}`, ['orders', 'revenue']).rows,
    weekdays,
    customers: {
      newVsReturning: groupSum(list.map(b => b.customers?.newVsReturning), x => x.kind, ['customers', 'revenue']).rows,
      frequency: groupSum(list.map(b => b.customers?.frequency), x => x.bucket, ['customers']).rows,
      vip: topBy(list.flatMap(b => b.customers?.vip || []), 'range_spend', 20),
      mealCards: topBy(groupSum(list.map(b => b.customers?.mealCards), x => x.company, ['orders', 'revenue']).rows, 'revenue', 20),
    },
    products: {
      top: topBy(groupSum(list.map(b => b.products?.top), x => x.name, ['qty', 'revenue', 'prev_revenue']).rows, 'revenue', 15),
      categories: groupSum(list.map(b => b.products?.categories), x => x.category, ['qty', 'revenue']).rows,
      bundles: topBy(groupSum(list.map(b => b.products?.bundles), x => x.name, ['qty', 'revenue']).rows, 'revenue', 15),
      discountedItems: topBy(groupSum(list.map(b => b.products?.discountedItems), x => x.name, ['times', 'discount_total']).rows, 'discount_total', 15),
    },
    channels,
    payments: {
      methods: groupSum(list.map(b => b.payments?.methods), x => String(x.id_pay), ['count', 'total']).rows,
      brands: groupSum(list.map(b => b.payments?.brands), x => x.brand, ['count', 'total']).rows,
    },
    freshness: {
      last_deal: maxDate(list.map(b => b.freshness?.last_deal)),
      last_z_update: maxDate(list.map(b => b.freshness?.last_z_update)),
    },
    orderTiming,
    deadItems: [...deadMap.values()],
  }
}
