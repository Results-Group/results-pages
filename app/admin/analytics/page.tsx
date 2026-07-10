'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart3, Eye, Smartphone, Monitor } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from 'recharts'

interface AnalyticsData {
  total: number
  days: number
  timeseries: { date: string; count: number }[]
  devices: { mobile: number; desktop: number }
  topPages: { id: string; title: string; views: number }[]
}

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString('he-IL', { month: 'numeric', day: 'numeric' })
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?days=${days}`)
      setData(res.ok ? await res.json() : null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const deviceTotal = data ? data.devices.mobile + data.devices.desktop : 0
  const mobilePct = deviceTotal ? Math.round((data!.devices.mobile / deviceTotal) * 100) : 0

  const cardStyle: React.CSSProperties = { background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
            <BarChart3 className="w-5 h-5" /> אנליטיקס
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>צפיות בדפים לאורך זמן</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm outline-none" style={cardStyle}>
          <option value={7}>7 ימים אחרונים</option>
          <option value={30}>30 ימים אחרונים</option>
          <option value={90}>90 ימים אחרונים</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>
      ) : !data ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>שגיאה בטעינת הנתונים</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                <Eye className="w-4 h-4" /> <span className="text-xs">סה"כ צפיות</span>
              </div>
              <p className="text-2xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{data.total.toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                <Smartphone className="w-4 h-4" /> <span className="text-xs">מובייל</span>
              </div>
              <p className="text-2xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{mobilePct}%</p>
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{data.devices.mobile.toLocaleString()} צפיות</p>
            </div>
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                <Monitor className="w-4 h-4" /> <span className="text-xs">דסקטופ</span>
              </div>
              <p className="text-2xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{100 - mobilePct}%</p>
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{data.devices.desktop.toLocaleString()} צפיות</p>
            </div>
          </div>

          <div className="rounded-xl p-4" style={cardStyle}>
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--admin-text-secondary)' }}>צפיות לאורך זמן</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.timeseries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2EC4B6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2EC4B6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: 'var(--admin-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--admin-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 8, color: 'var(--admin-text-primary)' }}
                  labelFormatter={(label) => fmtDay(String(label))}
                  formatter={(v) => [v as number, 'צפיות']}
                />
                <Area type="monotone" dataKey="count" stroke="#2EC4B6" strokeWidth={2} fill="url(#viewsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl p-4" style={cardStyle}>
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--admin-text-secondary)' }}>דפים מובילים</h3>
            {data.topPages.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>אין נתונים</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, data.topPages.length * 40)}>
                <BarChart data={data.topPages} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--admin-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="title" width={140} tick={{ fill: 'var(--admin-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 8, color: 'var(--admin-text-primary)' }}
                    formatter={(v) => [v as number, 'צפיות']}
                    cursor={{ fill: 'rgba(46,196,182,0.08)' }}
                  />
                  <Bar dataKey="views" fill="#2EC4B6" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
