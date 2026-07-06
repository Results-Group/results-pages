'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
} from 'recharts'
import { RefreshCw, LogOut, TrendingUp, TrendingDown, Minus, Pizza } from 'lucide-react'

// ── Types (mirror of API response) ──

interface Summary {
  revenue: number
  orders: number
  avg_order: number
  refunds: number
  refund_count: number
  items_sold: number
  items_per_order: number
  discounts: number
  discounted_lines: number
  delivery_orders: number
  delivery_pct: number
  unique_customers: number
  returning_customers: number
  returning_pct: number
}

interface DashboardData {
  range: { from: string; to: string; days: number }
  prev_range: { from: string; to: string }
  summary: Summary
  prev_summary: Summary
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
}

// ── Helpers ──

const COLORS = ['#667eea', '#34d399', '#fbbf24', '#f97316', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16']
const DAY_NAMES = ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 })
const money = (v: number | string | null | undefined) => '₪' + nf.format(Number(v ?? 0))
const num = (v: number | string | null | undefined) => nf.format(Number(v ?? 0))

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function todayLocal(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
}

function daysAgo(n: number): Date {
  const d = todayLocal()
  d.setDate(d.getDate() - n)
  return d
}

const PRESETS: { id: string; label: string; range: () => { from: string; to: string } }[] = [
  { id: 'today', label: 'היום', range: () => ({ from: isoDate(todayLocal()), to: isoDate(todayLocal()) }) },
  { id: 'yesterday', label: 'אתמול', range: () => ({ from: isoDate(daysAgo(1)), to: isoDate(daysAgo(1)) }) },
  { id: '7d', label: '7 ימים', range: () => ({ from: isoDate(daysAgo(6)), to: isoDate(todayLocal()) }) },
  { id: '30d', label: '30 יום', range: () => ({ from: isoDate(daysAgo(29)), to: isoDate(todayLocal()) }) },
  {
    id: 'month',
    label: 'החודש',
    range: () => {
      const t = todayLocal()
      return { from: isoDate(new Date(t.getFullYear(), t.getMonth(), 1, 12)), to: isoDate(t) }
    },
  },
  {
    id: 'prev-month',
    label: 'חודש קודם',
    range: () => {
      const t = todayLocal()
      return {
        from: isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1, 12)),
        to: isoDate(new Date(t.getFullYear(), t.getMonth(), 0, 12)),
      }
    },
  },
  { id: 'all', label: 'הכל', range: () => ({ from: '2026-04-25', to: isoDate(todayLocal()) }) },
]

function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const cur = Number(current)
  const prev = Number(previous)
  if (!prev) return <span className="text-xs text-slate-500">—</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Minus className="w-3 h-3" /> 0%
      </span>
    )
  const good = invert ? pct < 0 : pct > 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-200 mb-4 mt-10 first:mt-0">{children}</h2>
}

const tooltipStyle = {
  background: '#16213e',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  color: '#e2e8f0',
  direction: 'rtl' as const,
  fontFamily: 'Heebo, sans-serif',
}

// ── Page ──

export default function PizzaHouseDashboard() {
  const router = useRouter()
  const [preset, setPreset] = useState('7d')
  const [from, setFrom] = useState(PRESETS.find(p => p.id === '7d')!.range().from)
  const [to, setTo] = useState(PRESETS.find(p => p.id === '7d')!.range().to)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (f: string, t: string, refresh = false) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/pizza-house/dashboard?from=${f}&to=${t}${refresh ? '&refresh=1' : ''}`)
        if (res.status === 401) {
          router.push('/pizza-house/login')
          return
        }
        if (!res.ok) throw new Error((await res.json()).error || 'שגיאה בטעינת נתונים')
        setData(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
      }
    },
    [router]
  )

  useEffect(() => {
    load(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyPreset(id: string) {
    const p = PRESETS.find(x => x.id === id)!
    const r = p.range()
    setPreset(id)
    setFrom(r.from)
    setTo(r.to)
    load(r.from, r.to)
  }

  function applyCustom(f: string, t: string) {
    setPreset('custom')
    setFrom(f)
    setTo(t)
    if (f && t && f <= t) load(f, t)
  }

  async function logout() {
    await fetch('/api/pizza-house/auth', { method: 'DELETE' })
    router.push('/pizza-house/login')
  }

  // Heatmap matrix
  const heatmap = useMemo(() => {
    if (!data) return null
    const hours = Array.from({ length: 16 }, (_, i) => (i + 9) % 24) // 9:00..24:00
    const max = Math.max(1, ...data.heatmap.map(h => h.orders))
    const map = new Map(data.heatmap.map(h => [`${h.dow}-${h.hour}`, h]))
    return { hours, max, map }
  }, [data])

  const s = data?.summary
  const p = data?.prev_summary

  return (
    <div dir="rtl" className="min-h-screen text-slate-200 pb-16" style={{ background: '#0f0f23', fontFamily: 'Heebo, sans-serif' }}>
      {/* Header */}
      <header className="px-6 pt-6 pb-2 flex items-center justify-between flex-wrap gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
            <Pizza className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #667eea, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Pizza House — דאשבורד שיווק
            </h1>
            {data?.freshness.last_deal && (
              <p className="text-xs text-slate-500">עסקה אחרונה בקופה: {data.freshness.last_deal.replace('T', ' ').slice(0, 16)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(from, to, true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            רענון
          </button>
          <button onClick={logout} className="p-2.5 rounded-xl text-slate-400 hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.1)' }} title="התנתקות">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Date picker bar */}
      <div className="sticky top-0 z-20 px-6 py-3 mb-6" style={{ background: 'rgba(15,15,35,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-2 flex-wrap">
          {PRESETS.map(pr => (
            <button
              key={pr.id}
              onClick={() => applyPreset(pr.id)}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={
                preset === pr.id
                  ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }
              }
            >
              {pr.label}
            </button>
          ))}
          <div className="flex items-center gap-2 mr-2">
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => applyCustom(e.target.value, to)}
              className="px-2.5 py-1.5 rounded-lg text-sm text-slate-200 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
            />
            <span className="text-slate-500 text-sm">עד</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => applyCustom(from, e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-sm text-slate-200 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
            />
          </div>
          {data && (
            <span className="text-xs text-slate-500 mr-auto">
              השוואה מול {data.prev_range.from} — {data.prev_range.to}
            </span>
          )}
        </div>
      </div>

      <main className="px-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin ml-3" /> טוען נתונים מהקופה...
          </div>
        )}

        {data && s && p && (
          <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="!p-5" >
                <div className="text-xs text-slate-400 mb-1">הכנסות</div>
                <div className="text-2xl font-black text-white">{money(s.revenue)}</div>
                <Delta current={s.revenue} previous={p.revenue} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">הזמנות</div>
                <div className="text-2xl font-black text-white">{num(s.orders)}</div>
                <Delta current={s.orders} previous={p.orders} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">סל ממוצע</div>
                <div className="text-2xl font-black text-white">{money(s.avg_order)}</div>
                <Delta current={s.avg_order} previous={p.avg_order} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">פריטים להזמנה</div>
                <div className="text-2xl font-black text-white">{s.items_per_order}</div>
                <Delta current={s.items_per_order} previous={p.items_per_order} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">אחוז משלוחים</div>
                <div className="text-2xl font-black text-white">{s.delivery_pct}%</div>
                <Delta current={s.delivery_pct} previous={p.delivery_pct} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">לקוחות ייחודיים (אשראי)</div>
                <div className="text-2xl font-black text-white">{num(s.unique_customers)}</div>
                <Delta current={s.unique_customers} previous={p.unique_customers} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">אחוז לקוחות חוזרים</div>
                <div className="text-2xl font-black text-white">{s.returning_pct}%</div>
                <Delta current={s.returning_pct} previous={p.returning_pct} />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">הנחות שניתנו</div>
                <div className="text-2xl font-black text-amber-300">{money(s.discounts)}</div>
                <Delta current={s.discounts} previous={p.discounts} invert />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">זיכויים / החזרות</div>
                <div className="text-2xl font-black text-red-300">{money(s.refunds)}</div>
                <Delta current={s.refunds} previous={p.refunds} invert />
              </Card>
              <Card>
                <div className="text-xs text-slate-400 mb-1">פריטים שנמכרו</div>
                <div className="text-2xl font-black text-white">{num(s.items_sold)}</div>
                <Delta current={s.items_sold} previous={p.items_sold} />
              </Card>
            </div>

            {/* ── Trends ── */}
            <SectionTitle>מגמות וזמנים</SectionTitle>
            <Card className="mb-4">
              <div className="text-sm text-slate-400 mb-3">
                הכנסות והזמנות {data.timeseries.granularity === 'hour' ? 'לפי שעה' : data.timeseries.granularity === 'week' ? 'לפי שבוע' : 'לפי יום'}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.timeseries.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v: string) => (data.timeseries.granularity === 'hour' ? v.slice(11) : v.slice(5).split('-').reverse().join('/'))}
                    reversed
                  />
                  <YAxis yAxisId="rev" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v: number) => nf.format(v)} />
                  <YAxis yAxisId="ord" orientation="left" tick={{ fill: '#34d399', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => (name === 'הכנסות' ? money(v as number) : num(v as number))} />
                  <Legend wrapperStyle={{ fontFamily: 'Heebo' }} />
                  <Bar yAxisId="rev" dataKey="revenue" name="הכנסות" fill="#667eea" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="ord" dataKey="orders" name="הזמנות" stroke="#34d399" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Heatmap */}
              <Card>
                <div className="text-sm text-slate-400 mb-3">מפת חום: הזמנות לפי יום ושעה</div>
                {heatmap && (
                  <div className="overflow-x-auto">
                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `52px repeat(${heatmap.hours.length}, minmax(20px, 1fr))` }}>
                      <div />
                      {heatmap.hours.map(h => (
                        <div key={h} className="text-[10px] text-slate-500 text-center">{h}</div>
                      ))}
                      {[1, 2, 3, 4, 5, 6, 7].map(dow => (
                        <Fragment key={dow}>
                          <div className="text-[11px] text-slate-400 flex items-center">{DAY_NAMES[dow]}</div>
                          {heatmap.hours.map(h => {
                            const cell = heatmap.map.get(`${dow}-${h}`)
                            const intensity = cell ? cell.orders / heatmap.max : 0
                            return (
                              <div
                                key={`${dow}-${h}`}
                                className="rounded aspect-square"
                                title={cell ? `${DAY_NAMES[dow]} ${h}:00 — ${cell.orders} הזמנות, ${money(cell.revenue)}` : `${DAY_NAMES[dow]} ${h}:00 — אין`}
                                style={{
                                  background: intensity ? `rgba(102, 126, 234, ${0.15 + intensity * 0.85})` : 'rgba(255,255,255,0.03)',
                                }}
                              />
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2">כהה = פחות הזמנות, בהיר = יותר. שימושי לתזמון קמפיינים ומבצעי שעות שפל.</div>
                  </div>
                )}
              </Card>

              {/* Weekdays */}
              <Card>
                <div className="text-sm text-slate-400 mb-3">ימי שבוע: הזמנות וסל ממוצע</div>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={data.weekdays.map(w => ({ ...w, name: DAY_NAMES[w.dow] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} reversed />
                    <YAxis yAxisId="o" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis yAxisId="a" orientation="left" tick={{ fill: '#fbbf24', fontSize: 11 }} tickFormatter={(v: number) => '₪' + v} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => (name === 'סל ממוצע' ? money(v as number) : num(v as number))} />
                    <Legend wrapperStyle={{ fontFamily: 'Heebo' }} />
                    <Bar yAxisId="o" dataKey="orders" name="הזמנות" fill="#667eea" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="a" dataKey="avg_order" name="סל ממוצע" stroke="#fbbf24" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── Customers ── */}
            <SectionTitle>לקוחות (זיהוי לפי כרטיס אשראי)</SectionTitle>
            <div className="mb-4 p-3 rounded-xl text-xs text-amber-200/80" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
              מועדון הלקוחות בקופה אינו פעיל, ולכן הזיהוי מבוסס על כרטיסי אשראי בלבד (משלמי מזומן אינם נספרים). המלצה שיווקית: להתחיל לאסוף לקוחות למועדון בקופה.
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              <Card>
                <div className="text-sm text-slate-400 mb-3">חדשים מול חוזרים</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.customers.newVsReturning.map(x => ({ name: x.kind === 'new' ? 'חדשים' : 'חוזרים', value: x.customers }))}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {data.customers.newVsReturning.map((_, i) => (
                        <Cell key={i} fill={['#667eea', '#34d399'][i % 2]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontFamily: 'Heebo' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <div className="text-sm text-slate-400 mb-3">תדירות ביקורים (כל הזמנים)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.customers.frequency.map(f => ({ ...f, name: f.bucket + ' ביקורים' }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} reversed />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} orientation="right" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="customers" name="לקוחות" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <div className="text-sm text-slate-400 mb-3">כרטיסי סועד לפי חברה</div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {data.customers.mealCards.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-slate-300">{m.company}</span>
                      <span className="text-slate-400 text-xs">{num(m.orders)} הזמנות</span>
                      <span className="font-bold text-emerald-400">{money(m.revenue)}</span>
                    </div>
                  ))}
                  {data.customers.mealCards.length === 0 && <div className="text-slate-500 text-sm">אין נתונים בטווח</div>}
                </div>
              </Card>
            </div>

            <Card className="mt-4">
              <div className="text-sm text-slate-400 mb-3">לקוחות VIP שהיו פעילים בטווח (לפי סך הוצאה כולל)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-white/10">
                      <th className="text-right py-2 px-3">כרטיס (4 ספרות)</th>
                      <th className="text-right py-2 px-3">סוג</th>
                      <th className="text-right py-2 px-3">ביקורים</th>
                      <th className="text-right py-2 px-3">הוצאה בטווח</th>
                      <th className="text-right py-2 px-3">הוצאה כוללת</th>
                      <th className="text-right py-2 px-3">ביקור אחרון</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.vip.map((v, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-mono text-slate-300">•••• {v.last4}</td>
                        <td className="py-2 px-3 text-slate-400">{v.nm_card || '—'}</td>
                        <td className="py-2 px-3">{num(v.visits)}</td>
                        <td className="py-2 px-3 text-emerald-400 font-medium">{money(v.range_spend)}</td>
                        <td className="py-2 px-3 font-bold text-white">{money(v.total_spend)}</td>
                        <td className="py-2 px-3 text-slate-400 text-xs">{v.last_visit?.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Products & Promos ── */}
            <SectionTitle>מוצרים, מבצעים וקטגוריות</SectionTitle>
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <div className="text-sm text-slate-400 mb-3">מוצרים מובילים (מול תקופה קודמת)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-white/10">
                        <th className="text-right py-2 px-2">#</th>
                        <th className="text-right py-2 px-2">מוצר</th>
                        <th className="text-right py-2 px-2">כמות</th>
                        <th className="text-right py-2 px-2">הכנסה</th>
                        <th className="text-right py-2 px-2">מגמה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.top.map((item, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-1.5 px-2 text-slate-500">{i + 1}</td>
                          <td className="py-1.5 px-2 text-slate-200">{item.name}</td>
                          <td className="py-1.5 px-2 text-slate-400">{num(item.qty)}</td>
                          <td className="py-1.5 px-2 font-bold text-white">{money(item.revenue)}</td>
                          <td className="py-1.5 px-2">
                            <Delta current={Number(item.revenue)} previous={Number(item.prev_revenue ?? 0)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <div className="text-sm text-slate-400 mb-3">הכנסות לפי קטגוריה</div>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={data.products.categories.map(c => ({ name: c.category, value: Number(c.revenue) }))} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {data.products.categories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={v => money(v as number)} />
                      <Legend wrapperStyle={{ fontFamily: 'Heebo', fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <div className="text-sm text-slate-400 mb-3">מבצעים ובאנדלים</div>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {data.products.bundles.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-slate-300 truncate ml-2">{b.name}</span>
                        <span className="text-slate-500 text-xs whitespace-nowrap">{num(b.qty)} יח׳</span>
                        <span className="font-bold text-emerald-400 whitespace-nowrap mr-3">{money(b.revenue)}</span>
                      </div>
                    ))}
                    {data.products.bundles.length === 0 && <div className="text-slate-500 text-sm">אין מבצעים בטווח</div>}
                  </div>
                </Card>
              </div>
            </div>

            <Card className="mt-4">
              <div className="text-sm text-slate-400 mb-3">פריטים עם הכי הרבה הנחות</div>
              <div className="grid md:grid-cols-2 gap-2">
                {data.products.discountedItems.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.05)' }}>
                    <span className="text-slate-300 truncate ml-2">{d.name}</span>
                    <span className="text-slate-500 text-xs whitespace-nowrap">{num(d.times)} פעמים</span>
                    <span className="font-bold text-amber-300 whitespace-nowrap mr-3">-{money(d.discount_total)}</span>
                  </div>
                ))}
                {data.products.discountedItems.length === 0 && <div className="text-slate-500 text-sm">אין הנחות בטווח</div>}
              </div>
            </Card>

            {/* ── Channels & Payments ── */}
            <SectionTitle>ערוצים ואמצעי תשלום</SectionTitle>
            <div className="grid lg:grid-cols-3 gap-4">
              <Card>
                <div className="text-sm text-slate-400 mb-3">משלוחים מול איסוף/ישיבה</div>
                <div className="space-y-3">
                  {data.channels.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-200">{c.channel === 'delivery' ? '🛵 משלוחים' : '🏪 איסוף / ישיבה'}</span>
                        <span className="text-emerald-400 font-black">{money(c.revenue)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {num(c.orders)} הזמנות · סל ממוצע {money(c.avg_order)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <div className="text-sm text-slate-400 mb-3">אמצעי תשלום</div>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={data.payments.methods.map(m => ({ name: m.label, value: Number(m.total) }))} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {data.payments.methods.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={v => money(v as number)} />
                    <Legend wrapperStyle={{ fontFamily: 'Heebo', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <div className="text-sm text-slate-400 mb-3">מותגי אשראי</div>
                <div className="space-y-2">
                  {data.payments.brands.map((b, i) => {
                    const total = data.payments.brands.reduce((acc, x) => acc + Number(x.total), 0)
                    const pct = total ? Math.round((Number(b.total) / total) * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">{b.label}</span>
                          <span className="text-slate-400">
                            {money(b.total)} · {pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            <p className="text-xs text-slate-600 mt-10 text-center">
              הנתונים נשלפים ישירות מקופת Aviv POS ומתעדכנים אוטומטית · אין נתוני עלות בקופה ולכן מוצגות הכנסות בלבד (ללא רווחיות)
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
