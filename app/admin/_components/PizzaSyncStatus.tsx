'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'

interface Alert {
  branch_id: string
  label: string
  day: string
  kind: 'branch' | 'all'
  orders: number
  usual_orders: number
  resolved: boolean
}

/**
 * Days a Pizza House till sent (almost) nothing, shown next to the backup
 * status. Renders nothing when every flagged day has since been re-sent —
 * this strip is only worth the space when there is something to chase.
 */
export default function PizzaSyncStatus() {
  const t = useT()
  const locale = useLocale()
  const [alerts, setAlerts] = useState<Alert[] | null>(null)

  useEffect(() => {
    fetch('/api/pizza-house/sync-alerts')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((d: { alerts: Alert[] }) => setAlerts(d.alerts))
      .catch(() => setAlerts([]))
  }, [])

  const open = (alerts || []).filter(a => !a.resolved)
  if (!open.length) return null

  const fmt = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })
  const byBranch = new Map<string, Alert[]>()
  for (const a of open) byBranch.set(a.label, [...(byBranch.get(a.label) || []), a])

  return (
    <div
      className="flex items-start gap-2 text-xs mb-5 px-3 py-2 rounded-lg"
      style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)' }}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
      <div className="space-y-1 min-w-0">
        <div style={{ color: 'var(--admin-text-secondary)' }}>{t('pizzaSync.title')}</div>
        {[...byBranch.entries()].map(([label, list]) => (
          <div key={label}>
            <span className="font-bold" style={{ color: 'var(--admin-text-primary)' }}>{label}: </span>
            {list.map((a, i) => (
              <span key={a.day}>
                {i > 0 && ' · '}
                {fmt(a.day)}
                {a.kind === 'all' && <span style={{ opacity: 0.7 }}> ({t('pizzaSync.allQuiet')})</span>}
              </span>
            ))}
          </div>
        ))}
        <div style={{ opacity: 0.8 }}>{t('pizzaSync.hint')}</div>
      </div>
    </div>
  )
}
