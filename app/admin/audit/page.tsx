'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScrollText, Megaphone, FileText, Contact, Users, Building } from 'lucide-react'

interface AuditEntry {
  id: string
  user_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'יצירה', update: 'עדכון', delete: 'מחיקה', restore: 'שחזור', publish: 'פרסום', purge: 'מחיקה לצמיתות',
}
const ACTION_COLORS: Record<string, string> = {
  create: '#2EC4B6', update: '#5B8CDB', delete: '#f59e0b', restore: '#22c55e', publish: '#40e1d3', purge: '#ef4444',
}
const ENTITY_LABELS: Record<string, string> = {
  campaign: 'קמפיין', page: 'דף', client: 'לקוח', user: 'משתמש', workspace: 'סביבה',
}
function entityIcon(type: string) {
  if (type === 'campaign') return <Megaphone className="w-3.5 h-3.5" />
  if (type === 'page') return <FileText className="w-3.5 h-3.5" />
  if (type === 'client') return <Contact className="w-3.5 h-3.5" />
  if (type === 'user') return <Users className="w-3.5 h-3.5" />
  return <Building className="w-3.5 h-3.5" />
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (entityFilter) params.set('entity_type', entityFilter)
      if (actionFilter) params.set('action', actionFilter)
      const res = await fetch(`/api/audit?${params}`)
      setEntries(res.ok ? await res.json() : [])
    } finally {
      setLoading(false)
    }
  }, [entityFilter, actionFilter])

  useEffect(() => { load() }, [load])

  const selectStyle: React.CSSProperties = {
    background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)',
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
          <ScrollText className="w-5 h-5" /> יומן פעילות
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>מי עשה מה ומתי במערכת</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={selectStyle}>
          <option value="">כל הסוגים</option>
          {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={selectStyle}>
          <option value="">כל הפעולות</option>
          {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <ScrollText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--admin-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>אין פעילות מתועדת</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg px-3.5 py-2.5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
              <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-secondary)' }}>
                {entityIcon(e.entity_type)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded shrink-0" style={{ color: ACTION_COLORS[e.action] || '#94a3b8', background: 'var(--admin-bg)' }}>
                {ACTION_LABELS[e.action] || e.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--admin-text-primary)' }}>
                  <span style={{ color: 'var(--admin-text-muted)' }}>{ENTITY_LABELS[e.entity_type] || e.entity_type}: </span>
                  {e.entity_label || e.entity_id || '—'}
                </p>
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--admin-text-muted)' }}>{e.user_email || 'מערכת'}</span>
              <span className="text-xs shrink-0 hidden sm:block" style={{ color: 'var(--admin-text-muted)' }}>{formatDate(e.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
