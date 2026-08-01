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
interface MonthPoint { month: string; label: string; value: number }
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
  preview?: boolean
  preview_period?: string
  locations?: { title: string | null; branch_id: string | null }[]
  summary?: Summary
  prev_summary?: Summary
  series?: { views: MonthPoint[]; interactions: MonthPoint[] } | null
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

export default function GoogleProfilePanel({ from, to, branch, pal, preview = false }: {
  from: string
  to: string
  branch: string
  pal: Palette
  preview?: boolean
}) {
  const [data, setData] = useState<GbpResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    let cancelled = false
    setLoading(true)
    const url = (p: boolean) =>
      `/api/pizza-house/gbp?from=${from}&to=${to}&branch=${branch}${p ? '&preview=1' : ''}`

    fetch(url(preview), { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(async d => {
        // Nothing synced yet? Fall back to the figures transcribed from
        // Business Profile so the tab is useful while Google's quota request
        // is pending. Only an admin gets them — a client must never be shown
        // hand-entered numbers as though they were their own live dashboard.
        if (!preview && (!d?.connected || !d?.has_data)) {
          const r2 = await fetch(url(true), { credentials: 'include' }).catch(() => null)
          if (r2?.ok) {
            const demo = await r2.json()
            if (!cancelled && demo?.connected) { setData(demo); setLoading(false); return }
          }
        }
        if (!cancelled) { setData(d); setLoading(false) }
      })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [from, to, branch, preview])

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
    <Shell pal={pal} subtitle={data.locations?.map(l => l.title).filter(Boolean).join(' · ')} preview={data.preview} preview_period={data.preview_period}>
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

      {/* min-w-0 on the children: a grid item's default min-width is auto, so a
          percentage-width chart measures against a track sized by its own
          content and Recharts resolves the width to 0 — the pie silently
          vanishes and only its legend renders. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        {data.series && data.series.views.length > 1 && <div className="lg:col-span-2 min-w-0 rounded-xl p-3" style={{ background: pal.bgElevated, border: `1px solid ${pal.border}` }}>
          <div className="text-[11px] font-bold mb-2" style={{ color: pal.textMuted }}>צפיות ואינטראקציות — לפי חודש</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={(data.series?.views ?? []).map((v, i) => ({
              label: v.label,
              views: v.value,
              interactions: data.series?.interactions[i]?.value ?? 0,
            }))}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: pal.textMuted }} />
              <YAxis tick={{ fontSize: 10, fill: pal.textMuted }} width={38} />
              <Tooltip contentStyle={{ background: pal.tooltipBg, border: `1px solid ${pal.border}`, borderRadius: 8, fontSize: 12 }} />
              <Area isAnimationActive={false} type="monotone" dataKey="views" name="צפיות" stroke={pal.cyan} fill={pal.cyan} fillOpacity={0.15} />
              <Area isAnimationActive={false} type="monotone" dataKey="interactions" name="אינטראקציות" stroke={pal.yellow} fill={pal.yellow} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>}

        <div className={`min-w-0 rounded-xl p-3${data.series && data.series.views.length > 1 ? '' : ' lg:col-span-3'}`} style={{ background: pal.bgElevated, border: `1px solid ${pal.border}` }}>
          <div className="text-[11px] font-bold mb-2" style={{ color: pal.textMuted }}>איפה מצאו את העסק</div>
          {/* Matches the doughnuts that already work in this dashboard: an
              explicit height wrapper, and animation off. With animation on the
              sectors mount at radius zero inside a tab that isn't visible yet,
              and the entry tween never runs — recharts leaves the sector groups
              in place with empty shapes, so the chart reads as a legend
              floating over nothing. */}
          <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={s.bySurface.map(x => ({ name: x.label, value: x.value }))}
                dataKey="value"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
              >
                {s.bySurface.map((_, i) => (
                  <Cell key={i} fill={pal.chartColors[i % pal.chartColors.length]} stroke="none" />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="bottom" height={36} />
              <Tooltip contentStyle={{ background: pal.tooltipBg, border: `1px solid ${pal.border}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, pal, subtitle, preview, preview_period }: { children: React.ReactNode; pal: Palette; subtitle?: string; preview?: boolean; preview_period?: string }) {
  return (
    <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 mt-4" style={{ background: pal.bgCard, border: `1px solid ${pal.border}` }}>
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <h2 className="text-sm sm:text-base font-black" style={{ color: pal.text }}>פרופיל Google</h2>
        {/* Unmissable: these numbers are real but hand-entered, not synced. */}
        {preview && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${pal.yellow}22`, color: pal.yellow, border: `1px solid ${pal.yellow}55` }}>
            נתונים מ-Google שהוזנו ידנית{preview_period ? ` · ${preview_period}` : ''} — טרם מסונכרן
          </span>
        )}
        {subtitle && <span className="text-[10px]" style={{ color: pal.textMuted }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
