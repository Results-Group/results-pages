'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ReportEditor from '../_components/ReportEditor'
import type { ReportEditorInitial } from '../_components/ReportEditor'
import type { ReportTab } from '@/lib/performance-reports'

export default function EditReportPage() {
  const { id } = useParams<{ id: string }>()
  const [initial, setInitial] = useState<ReportEditorInitial | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null }
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        if (!data) return
        const rawTabs = Array.isArray(data.tabs) ? data.tabs : []
        const tabs: ReportTab[] = rawTabs.map((t: Record<string, unknown>) => ({
          id: (t.id as string) || crypto.randomUUID(),
          title: (t.title as string) || '',
          subtitle: (t.subtitle as string) || '',
          blocks: Array.isArray(t.blocks) ? t.blocks : [],
        }))

        setInitial({
          report: {
            client: data.client || '',
            client_id: data.client_id || null,
            report_name: data.report_name || '',
            period_label: data.period_label || '',
            tabs,
            tabs_en: data.tabs_en || null,
            workspace_id: data.workspace_id || null,
            logo_path: data.logo_path || null,
            brand_color: data.brand_color || null,
          },
          status: data.status || 'draft',
        })
      })
      .catch(() => setError('שגיאה בטעינת הדוח'))
  }, [id])

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="flex flex-col items-center justify-center py-24" style={{ color: 'var(--admin-text-muted)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(64,225,211,0.3)', borderTopColor: '#40e1d3' }} />
        <span className="text-sm">טוען דוח...</span>
      </div>
    )
  }

  return <ReportEditor mode="edit" initial={initial} reportId={id} />
}
