'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, ExternalLink, Copy, Trash2, Edit3, Check, Compass } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'
import { useToast } from '../_components/toast'
import { useConfirm } from '../_components/confirm-dialog'

interface StrategyDocSummary {
  id: string
  client: string
  doc_name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  section_count: number
  updated_at: string
  workspace_id: string | null
}

const STATUS_DOT: Record<string, string> = { draft: '#f59e0b', published: '#40e1d3', archived: '#64748b' }

export default function StrategyListPage() {
  const t = useT()
  const locale = useLocale()
  const { showToast } = useToast()
  const confirmDialog = useConfirm()
  const [docs, setDocs] = useState<StrategyDocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const STATUS_LABELS: Record<string, string> = {
    draft: t('common.draft'), published: t('common.published'), archived: t('common.archived'),
  }

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      fetch(`/api/strategy-docs?${params}`)
        .then(res => {
          // 401 means the session expired mid-session; send them to log in
          // rather than rendering an empty list that looks like "no documents".
          if (res.status === 401) { window.location.href = '/admin/login'; return null }
          return res.json()
        })
        .then(data => { if (Array.isArray(data)) setDocs(data); setLoading(false) })
        .catch(() => setLoading(false))
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const copyLink = (doc: StrategyDocSummary) => {
    navigator.clipboard.writeText(`${window.location.origin}/s/${doc.slug}`)
    setCopied(doc.id)
    setTimeout(() => setCopied(null), 1600)
  }

  const remove = async (doc: StrategyDocSummary) => {
    if (!(await confirmDialog({ message: `${t('strategy.confirmDelete')} "${doc.doc_name}"?`, variant: 'danger' }))) return
    const res = await fetch(`/api/strategy-docs/${doc.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      showToast(t('strategy.movedToTrash'), 'success')
    } else {
      showToast(t('strategy.deleteFailed'), 'error')
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', { month: 'short', day: 'numeric' })

  const card: React.CSSProperties = { background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
            <Compass className="w-5 h-5" /> {t('strategy.title')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>{t('strategy.subtitle')}</p>
        </div>
        <Link
          href="/admin/strategy/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5"
          style={{ background: 'var(--admin-accent, #40e1d3)', color: '#06282a' }}
        >
          <Plus className="w-4 h-4" /> {t('strategy.new')}
        </Link>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 inset-inline-start-3" style={{ insetInlineStart: 12, color: 'var(--admin-text-muted)' }} />
        <input
          className="w-full py-2 rounded-lg text-sm outline-none"
          style={{ ...card, color: 'var(--admin-text-primary)', paddingInlineStart: 36, paddingInlineEnd: 12 }}
          placeholder={t('strategy.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? null : docs.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: 'var(--admin-text-muted)' }}>{t('strategy.empty')}</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={card}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[doc.status] }} title={STATUS_LABELS[doc.status]} />

              <div className="min-w-0 flex-1">
                <Link href={`/admin/strategy/${doc.id}`} className="text-sm font-semibold truncate block" style={{ color: 'var(--admin-text-primary)' }}>
                  {doc.doc_name}
                </Link>
                <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                  {doc.client} · {doc.section_count} {t('strategy.slides')} · {formatDate(doc.updated_at)}
                </span>
              </div>

              {doc.status === 'published' && (
                <>
                  <button onClick={() => copyLink(doc)} className="p-2 rounded-lg opacity-70 hover:opacity-100" aria-label={t('strategy.copyLink')}>
                    {copied === doc.id ? <Check className="w-4 h-4" style={{ color: '#40e1d3' }} /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a href={`/s/${doc.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg opacity-70 hover:opacity-100" aria-label={t('strategy.open')}>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </>
              )}
              <Link href={`/admin/strategy/${doc.id}`} className="p-2 rounded-lg opacity-70 hover:opacity-100" aria-label={t('common.edit')}>
                <Edit3 className="w-4 h-4" />
              </Link>
              <button onClick={() => remove(doc)} className="p-2 rounded-lg opacity-70 hover:opacity-100" style={{ color: '#ef4444' }} aria-label={t('common.delete')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
