'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import { Eye, Phone, Navigation, Globe, UtensilsCrossed, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * Google Business Profile panel.
 *
 * Reads our cached copy through /api/pizza-house/gbp — never Google directly —
 * so it renders at page speed and survives Google being slow or rate limited.
 *
 * Deliberately explicit about its own emptiness: before the first sync there is
 * a real difference between "not connected", "connected but nothing synced yet"
 * and "zero activity", and a restaurant owner should never have to guess which
 * one a blank panel means.
 */

interface Surface { metric: string; label: string; value: number; pct: number }
interface Summary {
  views: number
  interactions: number
  calls: number
  directions: number
  websiteClicks: number
  conversations: number
  bookings: number
  menuViews: number
  bySurface: Surface[]
}
interface GbpResponse {
  connected: boolean
  reason?: string
  has_data?: boolean
  locations?: { title: string | null; branch_id: string | null }[]
  summary?: Summary
  prev_summary?: Summary
  series?: { views: { day: string; value: number }[]; interactions: { day: string; value: number }[] }
}

interface Palette {
  yellow: string; cyan: string; bgCard: string; bgElevated: string
  border: string; text: string; textSecondary: string; textMuted: string
  success: string; danger: string; chartColors: string[]; tooltipBg: string
}

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 })
const num = (v: number) => nf.format(v || 0)

function Delta({ current, previous, pal }: { current: number; previous: number; pal: Palette }) {
  if (!previous) return <span className="text-[11px]" style={{ color: pal.textMuted }}>—</span>
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  const neutral = pct === 0
  const color = neutral ? pal.textSecondary : pct > 0 ? pal.success : pal.danger
  const Icon = neutral ? Minus : pct > 0 ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums" style={{ color }}>
      <Icon className="w-3 h-3" />{pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function GoogleProfilePanel({ from, to, branch, pal }: {
  from: string
  to: string
  branch: string
  pal: Palette
}) {
  const [data, setData] = useState<GbpResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/pizza-house/gbp?from=${from}&to=${to}&branch=${branch}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [from, to, branch])

  if (loading) {
    return (
      <Shell pal={pal}>
        <div className="text-xs py-6 text-center" style={{ color: pal.textMuted }}>טוען נתוני Google…</div>
      </Shell>
    )
  }

  if (!data?.connected) {
    return (
      <Shell pal={pal}>
        <div className="text-xs py-6 text-center leading-relaxed" style={{ color: pal.textMuted }}>
          {data?.reason ?? 'הפרופיל העסקי טרם חובר'}
          <div className="mt-1 opacity-70">הנתונים יופיעו כאן אוטומטית לאחר החיבור.</div>
        </div>
      </Shell>
    )
  }

  if (!data.has_data) {
    return (
      <Shell pal={pal}>
        <div className="text-xs py-6 text-center leading-relaxed" style={{ color: pal.textMuted }}>
          החיבור פעיל, אך טרם התקבלו נתונים מ-Google.
          <div className="mt-1 opacity-70">הסנכרון רץ מדי לילה, ולגוגל יש פיגור של יומיים-שלושה.</div>
        </div>
      </Shell>
    )
  }

  const s = data.summary!
  const p = data.prev_summary!

  const kpis = [
    { label: 'צפיות בפרופיל', value: s.views, prev: p.views, icon: Eye, color: pal.cyan },
    { label: 'אינטראקציות', value: s.interactions, prev: p.interactions, icon: TrendingUp, color: pal.yellow },
    { label: 'שיחות', value: s.calls, prev: p.calls, icon: Phone, color: pal.text },
    { label: 'בקשות מסלול', value: s.directions, prev: p.directions, icon: Navigation, color: pal.text },
    { label: 'קליקים לאתר', value: s.websiteClicks, prev: p.websiteClicks, icon: Globe, color: pal.text },
    { label: 'צפיות בתפריט', value: s.menuViews, prev: p.menuViews, icon: UtensilsCrossed, color: pal.text },
  ]
  if (s.conversations > 0 || p.conversations > 0) {
    kpis.push({ label: 'הודעות', value: s.conversations, prev: p.conversations, icon: MessageSquare, color: pal.text })
  }

  return (
    <Shell pal={pal} subtitle={data.locations?.map(l => l.title).filter(Boolean).join(' · ')}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl p-3" style={{ background: pal.bgElevated, border: `1px solid ${pal.border}` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <k.icon className="w-3 h-3" style={{ color: pal.textMuted }} />
              <span className="text-[10px]" style={{ color: pal.textMuted }}>{k.label}</span>
            </div>
            <div className="text-lg sm:text-xl font-black tabular-nums leading-tight" style={{ color: k.color }}>
              {num(k.value)}
            </div>
            <div className="mt-0.5"><Delta current={k.value} previous={k.prev} pal={pal} /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <div className="lg:col-span-2 rounded-xl p-3" style={{ background: pal.bgElevated, border: `1px solid ${pal.border}` }}>
          <div className="text-[11px] font-bold mb-2" style={{ color: pal.textMuted }}>צפיות ואינטראקציות לאורך זמן</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={(data.series?.views ?? []).map((v, i) => ({
              day: v.day.slice(5),
              views: v.value,
              interactions: data.series?.interactions[i]?.value ?? 0,
            }))}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: pal.textMuted }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: pal.textMuted }} width={38} />
              <Tooltip contentStyle={{ background: pal.tooltipBg, border: `1px solid ${pal.border}`, borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="views" name="צפיות" stroke={pal.cyan} fill={pal.cyan} fillOpacity={0.15} />
              <Area type="monotone" dataKey="interactions" name="אינטראקציות" stroke={pal.yellow} fill={pal.yellow} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-3" style={{ background: pal.bgElevated, border: `1px solid ${pal.border}` }}>
          <div className="text-[11px] font-bold mb-2" style={{ color: pal.textMuted }}>איפה מצאו את העסק</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={s.bySurface} dataKey="value" nameKey="label" innerRadius={45} outerRadius={72} paddingAngle={2}>
                {s.bySurface.map((_, i) => (
                  <Cell key={i} fill={pal.chartColors[i % pal.chartColors.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: pal.tooltipBg, border: `1px solid ${pal.border}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, pal, subtitle }: { children: React.ReactNode; pal: Palette; subtitle?: string }) {
  return (
    <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 mt-4" style={{ background: pal.bgCard, border: `1px solid ${pal.border}` }}>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm sm:text-base font-black" style={{ color: pal.text }}>פרופיל Google</h2>
        {subtitle && <span className="text-[10px]" style={{ color: pal.textMuted }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
