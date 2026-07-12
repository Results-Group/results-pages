'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2, RotateCcw, FileText, Megaphone, AlertTriangle } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'

interface TrashedPage {
  id: string
  title: string
  client: string
  deleted_at: string | null
}

interface TrashedCampaign {
  id: string
  campaign_name: string
  client: string
  deleted_at: string | null
}

interface TrashedReport {
  id: string
  report_name: string
  client: string
  deleted_at: string | null
}

export default function TrashPage() {
  const t = useT()
  const locale = useLocale()

  function formatDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const [pages, setPages] = useState<TrashedPage[]>([])
  const [campaigns, setCampaigns] = useState<TrashedCampaign[]>([])
  const [reports, setReports] = useState<TrashedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes, rRes] = await Promise.all([
        fetch('/api/pages?deleted=1'),
        fetch('/api/campaigns?deleted=1'),
        fetch('/api/reports?deleted=1'),
      ])
      setPages(pRes.ok ? await pRes.json() : [])
      setCampaigns(cRes.ok ? await cRes.json() : [])
      setReports(rRes.ok ? await rRes.json() : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function restore(kind: 'pages' | 'campaigns' | 'reports', id: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/${kind}/${id}/restore`, { method: 'POST' })
      if (res.ok) await load()
    } finally {
      setBusy(null)
    }
  }

  async function purge(kind: 'pages' | 'campaigns' | 'reports', id: string) {
    if (!confirm(t('trash.purgeConfirm'))) return
    setBusy(id)
    try {
      const res = await fetch(`/api/${kind}/${id}?purge=1`, { method: 'DELETE' })
      if (res.ok) await load()
    } finally {
      setBusy(null)
    }
  }

  const isEmpty = pages.length === 0 && campaigns.length === 0 && reports.length === 0

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
          <Trash2 className="w-5 h-5" /> {t('trash.title')}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>
          {t('trash.subtitle')}
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('common.loading')}</p>
      ) : isEmpty ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <Trash2 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--admin-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('trash.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {campaigns.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                <Megaphone className="w-4 h-4" /> {t('trash.campaigns')} ({campaigns.length})
              </h3>
              <div className="space-y-2">
                {campaigns.map(c => (
                  <TrashRow
                    key={c.id}
                    title={c.campaign_name}
                    subtitle={c.client}
                    deletedAt={c.deleted_at}
                    busy={busy === c.id}
                    onRestore={() => restore('campaigns', c.id)}
                    onPurge={() => purge('campaigns', c.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {reports.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                <FileText className="w-4 h-4" /> {t('trash.reports')} ({reports.length})
              </h3>
              <div className="space-y-2">
                {reports.map(r => (
                  <TrashRow
                    key={r.id}
                    title={r.report_name}
                    subtitle={r.client}
                    deletedAt={r.deleted_at}
                    busy={busy === r.id}
                    onRestore={() => restore('reports', r.id)}
                    onPurge={() => purge('reports', r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {pages.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                <FileText className="w-4 h-4" /> {t('trash.pages')} ({pages.length})
              </h3>
              <div className="space-y-2">
                {pages.map(p => (
                  <TrashRow
                    key={p.id}
                    title={p.title}
                    subtitle={p.client}
                    deletedAt={p.deleted_at}
                    busy={busy === p.id}
                    onRestore={() => restore('pages', p.id)}
                    onPurge={() => purge('pages', p.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function TrashRow({ title, subtitle, deletedAt, busy, onRestore, onPurge }: {
  title: string
  subtitle: string
  deletedAt: string | null
  busy: boolean
  onRestore: () => void
  onPurge: () => void
}) {
  const t = useT()
  const locale = useLocale()

  function formatDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }}>{title}</p>
        <p className="text-xs truncate" style={{ color: 'var(--admin-text-muted)' }}>
          {subtitle}{deletedAt ? ` · ${t('trash.deleted')} ${formatDate(deletedAt)}` : ''}
        </p>
      </div>
      <button
        onClick={onRestore}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
        style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-accent)' }}
      >
        <RotateCcw className="w-3.5 h-3.5" /> {t('trash.restore')}
      </button>
      <button
        onClick={onPurge}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
        style={{ background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)' }}
      >
        <AlertTriangle className="w-3.5 h-3.5" /> {t('trash.purge')}
      </button>
    </div>
  )
}
