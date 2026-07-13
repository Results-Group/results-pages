'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
} from 'recharts'
import { RefreshCw, LogOut, TrendingUp, TrendingDown, Minus, Pizza, Truck, Store, Sun, Moon, Clock, PackageX } from 'lucide-react'

// ── Types ──

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
  branch: string
  branches: { id: string; label: string }[]
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
  orderTiming?: { avg_minutes: number; byHour: { hour: number; avg_minutes: number; orders: number }[] }
  deadItems?: { name: string; sale_price: number; category: string }[]
}

// ── Dual-theme palettes ──

interface Palette {
  yellow: string; yellowSubtle: string; yellowMedium: string
  cyan: string
  bg: string; bgCard: string; bgElevated: string
  border: string; borderInput: string
  text: string; textSecondary: string; textMuted: string
  success: string; danger: string; info: string
  chartColors: string[]
  colorScheme: 'dark' | 'light'
  stickyBg: string
  tooltipBg: string
}

const DARK: Palette = {
  yellow: '#F3D56D',
  yellowSubtle: 'rgba(243,213,109,0.08)',
  yellowMedium: 'rgba(243,213,109,0.15)',
  cyan: '#22D3EE',
  bg: '#050505',
  bgCard: '#0f0f0f',
  bgElevated: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  borderInput: 'rgba(255,255,255,0.18)',
  text: '#ffffff',
  textSecondary: '#d1d1d1',
  textMuted: 'rgba(255,255,255,0.6)',
  success: '#4ade80',
  danger: '#f87171',
  info: '#a78bfa',
  chartColors: ['#F3D56D', '#22D3EE', '#4ade80', '#f97316', '#a78bfa', '#ec4899', '#14b8a6', '#84cc16', '#ef4444', '#06b6d4'],
  colorScheme: 'dark',
  stickyBg: 'rgba(5,5,5,0.92)',
  tooltipBg: '#1a1a1a',
}

const LIGHT: Palette = {
  yellow: '#b8860b',
  yellowSubtle: 'rgba(184,134,11,0.08)',
  yellowMedium: 'rgba(184,134,11,0.12)',
  cyan: '#0891b2',
  bg: '#f5f5f5',
  bgCard: '#ffffff',
  bgElevated: 'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.1)',
  borderInput: 'rgba(0,0,0,0.2)',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: 'rgba(0,0,0,0.5)',
  success: '#16a34a',
  danger: '#dc2626',
  info: '#7c3aed',
  chartColors: ['#b8860b', '#0891b2', '#16a34a', '#ea580c', '#7c3aed', '#db2777', '#0d9488', '#65a30d', '#dc2626', '#0284c7'],
  colorScheme: 'light',
  stickyBg: 'rgba(245,245,245,0.92)',
  tooltipBg: '#ffffff',
}

// ── Helpers ──

const DAY_NAMES = ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const FONT = { fontFamily: 'Ping, sans-serif' }

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 })
const money = (v: number | string | null | undefined) => '₪' + nf.format(Number(v ?? 0))
const num = (v: number | string | null | undefined) => nf.format(Number(v ?? 0))

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function todayLocal(): Date { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12) }
function daysAgo(n: number): Date { const d = todayLocal(); d.setDate(d.getDate() - n); return d }

const PRESETS: { id: string; label: string; range: () => { from: string; to: string } }[] = [
  { id: 'today', label: 'היום', range: () => ({ from: isoDate(todayLocal()), to: isoDate(todayLocal()) }) },
  { id: 'yesterday', label: 'אתמול', range: () => ({ from: isoDate(daysAgo(1)), to: isoDate(daysAgo(1)) }) },
  { id: '7d', label: '7 ימים', range: () => ({ from: isoDate(daysAgo(6)), to: isoDate(todayLocal()) }) },
  { id: '30d', label: '30 יום', range: () => ({ from: isoDate(daysAgo(29)), to: isoDate(todayLocal()) }) },
  { id: 'month', label: 'החודש', range: () => { const t = todayLocal(); return { from: isoDate(new Date(t.getFullYear(), t.getMonth(), 1, 12)), to: isoDate(t) } } },
  { id: 'prev-month', label: 'חודש קודם', range: () => { const t = todayLocal(); return { from: isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1, 12)), to: isoDate(new Date(t.getFullYear(), t.getMonth(), 0, 12)) } } },
  { id: 'all', label: 'הכל', range: () => ({ from: '2026-04-25', to: isoDate(todayLocal()) }) },
]

// ── Sub-components ──

function Delta({ current, previous, invert = false, pal }: { current: number; previous: number; invert?: boolean; pal: Palette }) {
  const cur = Number(current), prev = Number(previous)
  if (!prev) return <span className="text-xs" style={{ color: pal.textMuted }}>—</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0)
    return <span className="inline-flex items-center gap-1 text-xs" style={{ color: pal.textSecondary }}><Minus className="w-3 h-3" /> 0%</span>
  const good = invert ? pct < 0 : pct > 0
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: good ? pal.success : pal.danger }}>
      {pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

function Card({ children, className = '', pal }: { children: React.ReactNode; className?: string; pal: Palette }) {
  return (
    <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-5 ${className}`}
      style={{ background: pal.bgCard, border: `1px solid ${pal.border}`, boxShadow: pal.colorScheme === 'light' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, pal }: { children: React.ReactNode; pal: Palette }) {
  return <h2 className="text-sm sm:text-lg font-bold mb-2.5 sm:mb-4 mt-6 sm:mt-10 first:mt-0" style={{ color: pal.text }}>{children}</h2>
}

// recharts Legend text needs explicit color override via formatter
function legendFmt(pal: Palette) {
  return (value: string) => <span style={{ color: pal.textSecondary }}>{value}</span>
}

// ── Page ──

export default function PizzaHouseDashboard() {
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [preset, setPreset] = useState('7d')
  const [from, setFrom] = useState(PRESETS.find(p => p.id === '7d')!.range().from)
  const [to, setTo] = useState(PRESETS.find(p => p.id === '7d')!.range().to)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [branch, setBranch] = useState('main')

  useEffect(() => {
    const saved = localStorage.getItem('ph_theme') as 'dark' | 'light' | null
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [])

  const pal = theme === 'dark' ? DARK : LIGHT

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('ph_theme', next)
  }

  const tooltipStyle = { background: pal.tooltipBg, border: `1px solid ${pal.border}`, borderRadius: 12, color: pal.text, direction: 'rtl' as const, ...FONT }
  const tipItem = { color: pal.text }
  const tipLabel = { color: pal.textSecondary }

  const load = useCallback(
    async (f: string, t: string, refresh = false, b = branch) => {
      setLoading(true); setError('')
      try {
        const res = await fetch(`/api/pizza-house/dashboard?from=${f}&to=${t}&branch=${b}${refresh ? '&refresh=1' : ''}`)
        if (res.status === 401) { router.push('/pizza-house/login'); return }
        if (!res.ok) throw new Error((await res.json()).error || 'שגיאה בטעינת נתונים')
        setData(await res.json())
      } catch (e) { setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים') }
      finally { setLoading(false) }
    }, [router, branch])

  useEffect(() => { load(from, to) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(id: string) { const p = PRESETS.find(x => x.id === id)!; const r = p.range(); setPreset(id); setFrom(r.from); setTo(r.to); load(r.from, r.to) }
  function applyCustom(f: string, t: string) { setPreset('custom'); setFrom(f); setTo(t); if (f && t && f <= t) load(f, t) }
  function changeBranch(b: string) { setBranch(b); load(from, to, false, b) }
  async function logout() { await fetch('/api/pizza-house/auth', { method: 'DELETE' }); router.push('/pizza-house/login') }

  const heatmap = useMemo(() => {
    if (!data) return null
    const hours = Array.from({ length: 16 }, (_, i) => (i + 9) % 24)
    const max = Math.max(1, ...data.heatmap.map(h => h.orders))
    const map = new Map(data.heatmap.map(h => [`${h.dow}-${h.hour}`, h]))
    return { hours, max, map }
  }, [data])

  const s = data?.summary
  const p = data?.prev_summary

  return (
    <div dir="rtl" className="min-h-screen pb-8" style={{ background: pal.bg, color: pal.text, ...FONT }}>

      {/* ── Header ── */}
      <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: pal.yellowMedium }}>
              <Pizza className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: pal.yellow }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-black truncate" style={{ color: pal.yellow }}>
                <span className="sm:hidden">Pizza House</span>
                <span className="hidden sm:inline">Pizza House — דאשבורד שיווק</span>
              </h1>
              {data?.freshness.last_deal && (
                <p className="text-[10px] sm:text-xs truncate" style={{ color: pal.textMuted }}>
                  עסקה אחרונה: {data.freshness.last_deal.replace('T', ' ').slice(0, 16)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {data && data.branches && data.branches.length > 1 && (
              <select
                value={branch}
                onChange={e => changeBranch(e.target.value)}
                className="px-2.5 sm:px-3 py-2 rounded-xl text-sm font-bold outline-none cursor-pointer"
                style={{ background: pal.bgCard, border: `1px solid ${pal.border}`, color: pal.text }}
                title="בחירת סניף"
              >
                {data.branches.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            )}
            <button onClick={toggleTheme} className="p-2 sm:p-2.5 rounded-xl transition-colors" style={{ border: `1px solid ${pal.border}`, color: pal.textSecondary }} title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => load(from, to, true)} className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: pal.yellow, color: pal.colorScheme === 'dark' ? '#050505' : '#ffffff' }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">רענון</span>
            </button>
            <button onClick={logout} className="p-2 sm:p-2.5 rounded-xl transition-colors" style={{ border: `1px solid ${pal.border}`, color: pal.textMuted }} title="התנתקות">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Date picker bar ── */}
      <div className="sticky top-0 z-20 px-4 sm:px-6 py-2.5 sm:py-3 mb-3 sm:mb-6" style={{ background: pal.stickyBg, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${pal.border}` }}>
        <div className="max-w-7xl mx-auto space-y-2 sm:space-y-0">
          {/* Presets: grid on mobile, flex on desktop */}
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
            {PRESETS.map(pr => (
              <button key={pr.id} onClick={() => applyPreset(pr.id)}
                className="px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition-colors whitespace-nowrap text-center"
                style={preset === pr.id
                  ? { background: pal.yellow, color: pal.colorScheme === 'dark' ? '#050505' : '#ffffff' }
                  : { background: pal.bgElevated, color: pal.textSecondary }}>
                {pr.label}
              </button>
            ))}
          </div>
          {/* Custom date inputs + comparison text */}
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={from} max={to} onChange={e => applyCustom(e.target.value, to)}
              className="px-2 py-1.5 rounded-lg text-xs outline-none flex-1 sm:flex-none sm:w-auto min-w-0"
              style={{ background: pal.bgElevated, border: `1px solid ${pal.borderInput}`, color: pal.text, colorScheme: pal.colorScheme }} />
            <span className="text-xs" style={{ color: pal.textMuted }}>עד</span>
            <input type="date" value={to} min={from} onChange={e => applyCustom(from, e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs outline-none flex-1 sm:flex-none sm:w-auto min-w-0"
              style={{ background: pal.bgElevated, border: `1px solid ${pal.borderInput}`, color: pal.text, colorScheme: pal.colorScheme }} />
            {data && <span className="text-[10px] sm:text-xs mr-auto whitespace-nowrap hidden sm:inline" style={{ color: pal.textMuted }}>השוואה מול {data.prev_range.from} — {data.prev_range.to}</span>}
          </div>
        </div>
      </div>

      <main className="px-4 sm:px-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ color: pal.danger, background: pal.colorScheme === 'dark' ? 'rgba(248,113,113,0.1)' : 'rgba(220,38,38,0.06)', border: `1px solid ${pal.danger}33` }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center h-64" style={{ color: pal.textMuted }}>
            <RefreshCw className="w-6 h-6 animate-spin ml-3" /> טוען נתונים מהקופה...
          </div>
        )}

        {data && s && p && (
          <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
              {([
                { label: 'הכנסות', val: money(s.revenue), color: pal.yellow, k: 'revenue' as const, invert: false },
                { label: 'הזמנות', val: num(s.orders), color: pal.text, k: 'orders' as const, invert: false },
                { label: 'סל ממוצע', val: money(s.avg_order), color: pal.text, k: 'avg_order' as const, invert: false },
                { label: 'פריטים להזמנה', val: String(s.items_per_order), color: pal.text, k: 'items_per_order' as const, invert: false },
                { label: 'אחוז משלוחים', val: s.delivery_pct + '%', color: pal.text, k: 'delivery_pct' as const, invert: false },
                { label: 'לקוחות ייחודיים', val: num(s.unique_customers), color: pal.cyan, k: 'unique_customers' as const, invert: false },
                { label: 'לקוחות חוזרים', val: s.returning_pct + '%', color: pal.cyan, k: 'returning_pct' as const, invert: false },
                { label: 'הנחות שניתנו', val: money(s.discounts), color: pal.yellow, k: 'discounts' as const, invert: true },
                { label: 'זיכויים / החזרות', val: money(s.refunds), color: pal.danger, k: 'refunds' as const, invert: true },
                { label: 'פריטים שנמכרו', val: num(s.items_sold), color: pal.text, k: 'items_sold' as const, invert: false },
              ]).map((kpi) => (
                <Card key={kpi.k} pal={pal}>
                  <div className="text-[10px] sm:text-xs mb-0.5 sm:mb-1" style={{ color: pal.textMuted }}>{kpi.label}</div>
                  <div className="text-lg sm:text-2xl font-black leading-tight" style={{ color: kpi.color }}>{kpi.val}</div>
                  <Delta current={s[kpi.k]} previous={p[kpi.k]} invert={kpi.invert} pal={pal} />
                </Card>
              ))}
            </div>

            {/* ── Order timing KPI ── */}
            {data.orderTiming && (
              <>
                <SectionTitle pal={pal}>ביצועים תפעוליים</SectionTitle>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                  <Card pal={pal}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4" style={{ color: pal.cyan }} />
                      <span className="text-[11px] sm:text-xs" style={{ color: pal.textMuted }}>זמן טיפול ממוצע בהזמנה</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black" style={{ color: pal.cyan }}>
                      {data.orderTiming.avg_minutes} <span className="text-sm font-bold" style={{ color: pal.textMuted }}>דקות</span>
                    </div>
                  </Card>
                  <Card className="sm:col-span-1 lg:col-span-2" pal={pal}>
                    <div className="text-[11px] sm:text-xs mb-2 sm:mb-3" style={{ color: pal.textMuted }}>זמן טיפול לפי שעה ביום</div>
                    <div className="h-[150px] sm:h-[180px]"><ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.orderTiming.byHour}>
                        <defs>
                          <linearGradient id="gradCyanArea2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={pal.cyan} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={pal.cyan} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} tickFormatter={(v: number) => `${v}:00`} axisLine={false} tickLine={false} reversed />
                        <YAxis yAxisId="m" orientation="right" tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} tickFormatter={(v: number) => v + '′'} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="o" orientation="left" tick={{ fill: pal.textMuted, fontSize: 10, ...FONT }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={tipItem} labelStyle={tipLabel} cursor={{ fill: pal.bgElevated }} formatter={(v, name) => name === 'הזמנות' ? num(v as number) : (v as number) + ' דקות'} />
                        <Legend wrapperStyle={FONT} formatter={legendFmt(pal)} />
                        <Bar yAxisId="o" dataKey="orders" name="הזמנות" fill={pal.bgElevated} radius={[6, 6, 0, 0]} />
                        <Area yAxisId="m" dataKey="avg_minutes" name="דקות טיפול" type="monotone" stroke={pal.cyan} strokeWidth={2} fill="url(#gradCyanArea2)" dot={{ fill: pal.cyan, r: 3, strokeWidth: 0 }} />
                      </ComposedChart>
                    </ResponsiveContainer></div>
                  </Card>
                </div>
              </>
            )}

            {/* ── Trends ── */}
            <SectionTitle pal={pal}>מגמות וזמנים</SectionTitle>
            <Card className="mb-4" pal={pal}>
              <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>
                הכנסות והזמנות {data.timeseries.granularity === 'hour' ? 'לפי שעה' : data.timeseries.granularity === 'week' ? 'לפי שבוע' : 'לפי יום'}
              </div>
              <div className="h-[220px] sm:h-[280px]"><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.timeseries.points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradYellow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pal.yellow} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={pal.yellow} stopOpacity={0.25} />
                    </linearGradient>
                    <linearGradient id="gradCyanArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pal.cyan} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={pal.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bucket" tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => (data.timeseries.granularity === 'hour' ? v.slice(11) : v.slice(5).split('-').reverse().join('/'))} reversed />
                  <YAxis yAxisId="rev" orientation="right" tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} tickFormatter={(v: number) => nf.format(v)} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ord" orientation="left" tick={{ fill: pal.cyan, fontSize: 11, ...FONT }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ ...tooltipStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} itemStyle={tipItem} labelStyle={tipLabel} cursor={{ fill: pal.bgElevated }} formatter={(v, name) => (name === 'הכנסות' ? money(v as number) : num(v as number))} />
                  <Legend wrapperStyle={FONT} formatter={legendFmt(pal)} />
                  <Bar yAxisId="rev" dataKey="revenue" name="הכנסות" fill="url(#gradYellow)" radius={[6, 6, 0, 0]} />
                  <Area yAxisId="ord" dataKey="orders" name="הזמנות" type="monotone" stroke={pal.cyan} strokeWidth={2.5} fill="url(#gradCyanArea)" dot={false} activeDot={{ r: 5, fill: pal.cyan, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer></div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-2 sm:gap-4">
              {/* Heatmap */}
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-2 sm:mb-3" style={{ color: pal.textMuted }}>מפת חום: הזמנות לפי יום ושעה</div>
                {heatmap && (
                  <div className="overflow-x-auto">
                    <div className="grid gap-[2px] sm:gap-[3px]" style={{ gridTemplateColumns: `36px repeat(${heatmap.hours.length}, minmax(16px, 1fr))`, minWidth: 340 }}>
                      <div />
                      {heatmap.hours.map(h => <div key={h} className="text-[10px] text-center" style={{ color: pal.textMuted }}>{h}</div>)}
                      {[1, 2, 3, 4, 5, 6, 7].map(dow => (
                        <Fragment key={dow}>
                          <div className="text-[11px] flex items-center" style={{ color: pal.textSecondary }}>{DAY_NAMES[dow]}</div>
                          {heatmap.hours.map(h => {
                            const cell = heatmap.map.get(`${dow}-${h}`)
                            const intensity = cell ? cell.orders / heatmap.max : 0
                            const heatColor = pal.colorScheme === 'dark'
                              ? (intensity ? `rgba(243,213,109,${0.1 + intensity * 0.9})` : pal.bgElevated)
                              : (intensity ? `rgba(184,134,11,${0.08 + intensity * 0.45})` : pal.bgElevated)
                            return (
                              <div key={`${dow}-${h}`} className="rounded aspect-square"
                                title={cell ? `${DAY_NAMES[dow]} ${h}:00 — ${cell.orders} הזמנות, ${money(cell.revenue)}` : `${DAY_NAMES[dow]} ${h}:00 — אין`}
                                style={{ background: heatColor }} />
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                    <div className="text-[10px] mt-2" style={{ color: pal.textMuted }}>כהה = פחות הזמנות, בהיר = יותר</div>
                  </div>
                )}
              </Card>

              {/* Weekdays */}
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>ימי שבוע: הזמנות וסל ממוצע</div>
                <div className="h-[200px] sm:h-[260px]"><ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.weekdays.map(w => ({ ...w, name: DAY_NAMES[w.dow] }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradYellowWk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={pal.yellow} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={pal.yellow} stopOpacity={0.25} />
                      </linearGradient>
                      <linearGradient id="gradCyanWk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={pal.cyan} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={pal.cyan} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fill: pal.textSecondary, fontSize: 12, ...FONT }} axisLine={false} tickLine={false} reversed />
                    <YAxis yAxisId="o" orientation="right" tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="a" orientation="left" tick={{ fill: pal.cyan, fontSize: 11, ...FONT }} tickFormatter={(v: number) => '₪' + v} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ ...tooltipStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} itemStyle={tipItem} labelStyle={tipLabel} cursor={{ fill: pal.bgElevated }} formatter={(v, name) => (name === 'סל ממוצע' ? money(v as number) : num(v as number))} />
                    <Legend wrapperStyle={FONT} formatter={legendFmt(pal)} />
                    <Bar yAxisId="o" dataKey="orders" name="הזמנות" fill="url(#gradYellowWk)" radius={[6, 6, 0, 0]} />
                    <Area yAxisId="a" dataKey="avg_order" name="סל ממוצע" type="monotone" stroke={pal.cyan} strokeWidth={2.5} fill="url(#gradCyanWk)" dot={false} activeDot={{ r: 5, fill: pal.cyan, strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer></div>
              </Card>
            </div>

            {/* ── Customers ── */}
            <SectionTitle pal={pal}>לקוחות (זיהוי לפי כרטיס אשראי)</SectionTitle>
            <div className="mb-4 p-3 rounded-xl text-xs" style={{ color: pal.yellow, background: pal.yellowSubtle, border: `1px solid ${pal.yellow}33` }}>
              מועדון הלקוחות בקופה אינו פעיל, ולכן הזיהוי מבוסס על כרטיסי אשראי בלבד (משלמי מזומן אינם נספרים). המלצה שיווקית: להתחיל לאסוף לקוחות למועדון בקופה.
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>חדשים מול חוזרים</div>
                <div className="h-[180px] sm:h-[220px]"><ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.customers.newVsReturning.map(x => ({ name: x.kind === 'new' ? 'חדשים' : 'חוזרים', value: x.customers }))} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3}>
                      {data.customers.newVsReturning.map((_, i) => <Cell key={i} fill={pal.chartColors[i % 2]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tipItem} labelStyle={tipLabel} />
                    <Legend wrapperStyle={{ ...FONT, fontSize: 12 }} formatter={legendFmt(pal)} />
                  </PieChart>
                </ResponsiveContainer></div>
              </Card>
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>תדירות ביקורים (כל הזמנים)</div>
                <div className="h-[180px] sm:h-[220px]"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.customers.frequency.map(f => ({ ...f, name: f.bucket + ' ביקורים' }))}>
                    <defs>
                      <linearGradient id="gradInfo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={pal.info} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={pal.info} stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} axisLine={false} tickLine={false} reversed />
                    <YAxis tick={{ fill: pal.textSecondary, fontSize: 11, ...FONT }} orientation="right" axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ ...tooltipStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} itemStyle={tipItem} labelStyle={tipLabel} cursor={{ fill: pal.bgElevated }} />
                    <Bar dataKey="customers" name="לקוחות" fill="url(#gradInfo)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer></div>
              </Card>
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>כרטיסי סועד לפי חברה</div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {data.customers.mealCards.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style={{ background: pal.bgElevated }}>
                      <span style={{ color: pal.textSecondary }}>{m.company}</span>
                      <span className="text-xs" style={{ color: pal.textMuted }}>{num(m.orders)} הזמנות</span>
                      <span className="font-bold" style={{ color: pal.cyan }}>{money(m.revenue)}</span>
                    </div>
                  ))}
                  {data.customers.mealCards.length === 0 && <div className="text-sm" style={{ color: pal.textMuted }}>אין נתונים בטווח</div>}
                </div>
              </Card>
            </div>

            {/* VIP table — desktop table, mobile cards */}
            <Card className="mt-3 sm:mt-4" pal={pal}>
              <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>לקוחות VIP שהיו פעילים בטווח (לפי סך הוצאה כולל)</div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${pal.border}` }}>
                      {['כרטיס (4 ספרות)', 'סוג', 'ביקורים', 'הוצאה בטווח', 'הוצאה כוללת', 'ביקור אחרון'].map(h => (
                        <th key={h} className="text-right py-2 px-3 text-xs font-bold" style={{ color: pal.textMuted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.vip.map((v, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${pal.border}33` }}>
                        <td className="py-2 px-3 font-mono" style={{ color: pal.textSecondary }}>•••• {v.last4}</td>
                        <td className="py-2 px-3" style={{ color: pal.textMuted }}>{v.nm_card || '—'}</td>
                        <td className="py-2 px-3" style={{ color: pal.text }}>{num(v.visits)}</td>
                        <td className="py-2 px-3 font-medium" style={{ color: pal.cyan }}>{money(v.range_spend)}</td>
                        <td className="py-2 px-3 font-bold" style={{ color: pal.yellow }}>{money(v.total_spend)}</td>
                        <td className="py-2 px-3 text-xs" style={{ color: pal.textMuted }}>{v.last_visit?.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {data.customers.vip.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-lg" style={{ background: pal.bgElevated }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-sm" style={{ color: pal.textSecondary }}>•••• {v.last4}</span>
                      <span className="text-[10px]" style={{ color: pal.textMuted }}>{v.nm_card || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: pal.textMuted }}>{num(v.visits)} ביקורים</span>
                      <span className="font-medium" style={{ color: pal.cyan }}>{money(v.range_spend)}</span>
                      <span className="font-bold" style={{ color: pal.yellow }}>{money(v.total_spend)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Products & Promos ── */}
            <SectionTitle pal={pal}>מוצרים, מבצעים וקטגוריות</SectionTitle>
            <div className="grid lg:grid-cols-2 gap-2 sm:gap-4">
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>מוצרים מובילים (מול תקופה קודמת)</div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 420 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${pal.border}` }}>
                        {['#', 'מוצר', 'כמות', 'הכנסה', 'מגמה'].map(h => (
                          <th key={h} className="text-right py-2 px-2 text-xs font-bold" style={{ color: pal.textMuted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.top.map((item, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${pal.border}22` }}>
                          <td className="py-1.5 px-2" style={{ color: pal.textMuted }}>{i + 1}</td>
                          <td className="py-1.5 px-2" style={{ color: pal.textSecondary }}>{item.name}</td>
                          <td className="py-1.5 px-2" style={{ color: pal.textMuted }}>{num(item.qty)}</td>
                          <td className="py-1.5 px-2 font-bold" style={{ color: pal.text }}>{money(item.revenue)}</td>
                          <td className="py-1.5 px-2"><Delta current={Number(item.revenue)} previous={Number(item.prev_revenue ?? 0)} pal={pal} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile list */}
                <div className="sm:hidden space-y-1.5">
                  {data.products.top.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: i % 2 === 0 ? pal.bgElevated : 'transparent' }}>
                      <span className="text-[10px] w-4 flex-shrink-0" style={{ color: pal.textMuted }}>{i + 1}</span>
                      <span className="text-xs truncate flex-1 min-w-0" style={{ color: pal.textSecondary }}>{item.name}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: pal.textMuted }}>{num(item.qty)}</span>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: pal.text }}>{money(item.revenue)}</span>
                      <span className="flex-shrink-0"><Delta current={Number(item.revenue)} previous={Number(item.prev_revenue ?? 0)} pal={pal} /></span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-3 sm:space-y-4">
                <Card pal={pal}>
                  <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>הכנסות לפי קטגוריה</div>
                  <div className="h-[190px] sm:h-[230px]"><ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.products.categories.map(c => ({ name: c.category, value: Number(c.revenue) }))} dataKey="value" innerRadius={38} outerRadius={62} paddingAngle={2}>
                        {data.products.categories.map((_, i) => <Cell key={i} fill={pal.chartColors[i % pal.chartColors.length]} stroke="none" />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tipItem} labelStyle={tipLabel} formatter={v => money(v as number)} />
                      <Legend wrapperStyle={{ ...FONT, fontSize: 11 }} formatter={legendFmt(pal)} />
                    </PieChart>
                  </ResponsiveContainer></div>
                </Card>
                <Card pal={pal}>
                  <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>מבצעים ובאנדלים</div>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {data.products.bundles.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style={{ background: pal.bgElevated }}>
                        <span className="truncate ml-2" style={{ color: pal.textSecondary }}>{b.name}</span>
                        <span className="text-xs whitespace-nowrap" style={{ color: pal.textMuted }}>{num(b.qty)} יח׳</span>
                        <span className="font-bold whitespace-nowrap mr-3" style={{ color: pal.cyan }}>{money(b.revenue)}</span>
                      </div>
                    ))}
                    {data.products.bundles.length === 0 && <div className="text-sm" style={{ color: pal.textMuted }}>אין מבצעים בטווח</div>}
                  </div>
                </Card>
              </div>
            </div>

            <Card className="mt-4" pal={pal}>
              <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>פריטים עם הכי הרבה הנחות</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                {data.products.discountedItems.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg" style={{ background: pal.yellowSubtle }}>
                    <span className="truncate ml-2" style={{ color: pal.textSecondary }}>{d.name}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: pal.textMuted }}>{num(d.times)} פעמים</span>
                    <span className="font-bold whitespace-nowrap mr-3" style={{ color: pal.yellow }}>-{money(d.discount_total)}</span>
                  </div>
                ))}
                {data.products.discountedItems.length === 0 && <div className="text-sm" style={{ color: pal.textMuted }}>אין הנחות בטווח</div>}
              </div>
            </Card>

            {/* ── Dead items ── */}
            {data.deadItems && data.deadItems.length > 0 && (
              <Card className="mt-4" pal={pal}>
                <div className="flex items-center gap-2 mb-3">
                  <PackageX className="w-4 h-4" style={{ color: pal.danger }} />
                  <span className="text-xs sm:text-sm" style={{ color: pal.textMuted }}>מוצרים שלא נמכרו בטווח ({data.deadItems.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2">
                  {data.deadItems.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg" style={{ background: pal.bgElevated }}>
                      <div className="min-w-0 ml-2">
                        <div className="truncate" style={{ color: pal.textSecondary }}>{d.name}</div>
                        <div className="text-[10px]" style={{ color: pal.textMuted }}>{d.category}</div>
                      </div>
                      <span className="font-bold whitespace-nowrap" style={{ color: pal.textMuted }}>{money(d.sale_price)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Channels & Payments ── */}
            <SectionTitle pal={pal}>ערוצים ואמצעי תשלום</SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>משלוחים מול איסוף/ישיבה</div>
                <div className="space-y-3">
                  {data.channels.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: pal.bgElevated }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold inline-flex items-center gap-1.5" style={{ color: pal.textSecondary }}>
                          {c.channel === 'delivery' ? <><Truck className="w-4 h-4" style={{ color: pal.cyan }} /> משלוחים</> : <><Store className="w-4 h-4" style={{ color: pal.yellow }} /> איסוף / ישיבה</>}
                        </span>
                        <span className="font-black" style={{ color: pal.yellow }}>{money(c.revenue)}</span>
                      </div>
                      <div className="text-xs" style={{ color: pal.textMuted }}>{num(c.orders)} הזמנות · סל ממוצע {money(c.avg_order)}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>אמצעי תשלום</div>
                <div className="h-[190px] sm:h-[230px]"><ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.payments.methods.map(m => ({ name: m.label, value: Number(m.total) }))} dataKey="value" innerRadius={38} outerRadius={62} paddingAngle={2}>
                      {data.payments.methods.map((_, i) => <Cell key={i} fill={pal.chartColors[i % pal.chartColors.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tipItem} labelStyle={tipLabel} formatter={v => money(v as number)} />
                    <Legend wrapperStyle={{ ...FONT, fontSize: 11 }} formatter={legendFmt(pal)} />
                  </PieChart>
                </ResponsiveContainer></div>
              </Card>
              <Card pal={pal}>
                <div className="text-xs sm:text-sm mb-3" style={{ color: pal.textMuted }}>מותגי אשראי</div>
                <div className="space-y-2">
                  {data.payments.brands.map((b, i) => {
                    const total = data.payments.brands.reduce((acc, x) => acc + Number(x.total), 0)
                    const pct = total ? Math.round((Number(b.total) / total) * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: pal.textSecondary }}>{b.label}</span>
                          <span style={{ color: pal.textMuted }}>{money(b.total)} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: pal.bgElevated }}>
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: pal.chartColors[i % pal.chartColors.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            <p className="text-[10px] sm:text-xs mt-10 text-center" style={{ color: pal.textMuted }}>
              הנתונים נשלפים ישירות מקופת Aviv POS ומתעדכנים אוטומטית · אין נתוני עלות בקופה ולכן מוצגות הכנסות בלבד (ללא רווחיות)
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 sm:mt-12 py-4 sm:py-6 px-4 sm:px-6" style={{ borderTop: `1px solid ${pal.border}` }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="https://www.resultsdigital.org" target="_blank" rel="noopener noreferrer"
            className="text-[10px] sm:text-xs transition-opacity hover:opacity-100" style={{ color: pal.textMuted, opacity: 0.6, textDecoration: 'none' }}>
            www.resultsdigital.org
          </a>
          <p className="text-[10px] sm:text-xs" style={{ color: pal.textMuted, opacity: 0.6, margin: 0 }}>By Results Group</p>
        </div>
      </footer>
    </div>
  )
}
