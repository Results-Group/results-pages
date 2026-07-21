'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Eye, Send, Trash2, ChevronDown, ChevronUp, GripVertical, FileText, Languages, Upload } from 'lucide-react'
import type { ReportTab, ReportBlock, ReportBlockType, PerformanceReport } from '@/lib/performance-reports'
import { createStandardTemplate } from '@/lib/report-template'
import BlockEditor from './BlockEditor'
import { useT, useLocale } from '@/lib/i18n'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'
import { useToast } from '../../_components/toast'

interface Client {
  id: string
  name: string
  brand_color?: string | null
}

export interface ReportEditorInitial {
  report: Partial<PerformanceReport> & { tabs: ReportTab[] }
  status: 'draft' | 'published' | 'archived'
}

interface Props {
  mode: 'new' | 'edit'
  initial: ReportEditorInitial
  reportId?: string
}

const BLOCK_TYPE_KEYS: Record<ReportBlockType, string> = {
  kpi_grid: 'block.kpi_grid',
  strategic_note: 'block.strategic_note',
  funnel: 'block.funnel',
  data_rows: 'block.data_rows',
  source_grid: 'block.source_grid',
  table: 'block.table',
  chart: 'block.chart',
  insight_box: 'block.insight_box',
  action_list: 'block.action_list',
  idea_cards: 'block.idea_cards',
  text: 'block.text',
}

/**
 * Model output is not schema-checked. A tab returned without a `blocks` array
 * used to be stored verbatim and then thrown on by the published report page,
 * so every AI path is normalised before it reaches state.
 */
function normaliseTabs(raw: unknown): ReportTab[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is ReportTab => !!t && typeof t === 'object')
    .map(t => ({ ...t, blocks: Array.isArray(t.blocks) ? t.blocks : [] }))
}

export default function ReportEditor({ mode, initial, reportId }: Props) {
  const router = useRouter()
  const t = useT()
  const locale = useLocale()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(initial.status)
  const [dirty, setDirty] = useState(false)

  useUnsavedChanges(dirty)
  const [clients, setClients] = useState<Client[]>([])
  const [activeTabIdx, setActiveTabIdx] = useState(0)

  // Meta
  const [client, setClient] = useState(initial.report.client || '')
  const [clientId, setClientId] = useState<string | null>(initial.report.client_id || null)
  const [reportName, setReportName] = useState(initial.report.report_name || '')
  const [periodLabel, setPeriodLabel] = useState(initial.report.period_label || '')
  const [password, setPassword] = useState('')
  const [tabs, setTabs] = useState<ReportTab[]>(initial.report.tabs)

  const [translating, setTranslating] = useState(false)
  const [importing, setImporting] = useState(false)
  const excelInputRef = useRef<HTMLInputElement>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/clients').then(r => r.ok ? r.json() : []).then(setClients).catch(() => {})
  }, [])

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients
    const s = clientSearch.toLowerCase()
    return clients.filter(c => c.name.toLowerCase().includes(s))
  }, [clients, clientSearch])

  const selectClient = (c: Client) => {
    setClient(c.name)
    setClientId(c.id)
    setClientSearch('')
    setShowClientDropdown(false)
  }

  // Tab management
  const markDirty = () => setDirty(true)

  const addTab = () => {
    markDirty()
    setTabs(prev => [...prev, {
      id: crypto.randomUUID(),
      title: locale === 'en' ? `Tab ${prev.length + 1}` : `טאב ${prev.length + 1}`,
      subtitle: '',
      blocks: [],
    }])
    setActiveTabIdx(tabs.length)
  }

  const removeTab = (idx: number) => {
    if (!confirm(t('reports.deleteTab'))) return
    markDirty()
    setTabs(prev => prev.filter((_, i) => i !== idx))
    if (activeTabIdx >= tabs.length - 1) setActiveTabIdx(Math.max(0, tabs.length - 2))
  }

  const updateTab = (idx: number, patch: Partial<ReportTab>) => {
    markDirty()
    setTabs(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  const moveTab = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= tabs.length) return
    markDirty()
    setTabs(prev => {
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return next
    })
    setActiveTabIdx(newIdx)
  }

  // Block management within active tab
  const activeTab = tabs[activeTabIdx] || null

  const addBlock = (type: ReportBlockType) => {
    if (!activeTab) return
    const newBlock: ReportBlock = { id: crypto.randomUUID().slice(0, 8), type }
    updateTab(activeTabIdx, { blocks: [...activeTab.blocks, newBlock] })
  }

  // This is the path for ALL block content — every KPI, table cell and insight.
  // Without markDirty the unsaved-changes guard never armed, so a whole tab of
  // work could be closed away without a warning.
  const updateBlock = useCallback((blockId: string, patch: Partial<ReportBlock>) => {
    markDirty()
    setTabs(prev => prev.map((t, i) => {
      if (i !== activeTabIdx) return t
      return { ...t, blocks: t.blocks.map(b => b.id === blockId ? { ...b, ...patch } : b) }
    }))
  }, [activeTabIdx])

  const removeBlock = (blockId: string) => {
    if (!activeTab) return
    updateTab(activeTabIdx, { blocks: activeTab.blocks.filter(b => b.id !== blockId) })
  }

  const moveBlock = (blockId: string, dir: -1 | 1) => {
    if (!activeTab) return
    const idx = activeTab.blocks.findIndex(b => b.id === blockId)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= activeTab.blocks.length) return
    const next = [...activeTab.blocks]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    updateTab(activeTabIdx, { blocks: next })
  }

  // Load template
  const loadTemplate = () => {
    markDirty()
    if (tabs.length > 0 && tabs.some(tb => (tb.blocks || []).length > 0)) {
      if (!confirm(t('reports.replaceConfirm'))) return
    }
    setTabs(createStandardTemplate())
    setActiveTabIdx(0)
  }

  // Save
  const save = useCallback(async (newStatus?: 'draft' | 'published' | 'archived') => {
    if (!client.trim() || !reportName.trim()) {
      showToast(t('reports.requiredFields'))
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        client: client.trim(),
        client_id: clientId,
        report_name: reportName.trim(),
        period_label: periodLabel.trim() || null,
        tabs,
        status: newStatus ?? status,
      }
      if (password.trim()) body.password = password.trim()

      const url = mode === 'new' ? '/api/reports' : `/api/reports/${reportId}`
      const method = mode === 'new' ? 'POST' : 'PUT'

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || t('reports.saveError'))
        return
      }

      const saved = await res.json()
      if (newStatus) setStatus(newStatus)
      setDirty(false)
      showToast(newStatus === 'published' ? t('common.published') : t('reports.saving').replace('...', ''), 'success')

      if (mode === 'new') {
        router.push(`/admin/reports/${saved.id}`)
      }
    } finally {
      setSaving(false)
    }
  }, [client, clientId, reportName, periodLabel, tabs, status, password, mode, reportId, router])

  const importExcel = useCallback(async (file: File) => {
    if (tabs.length > 0 && tabs.some(tb => tb.blocks.length > 0)) {
      if (!confirm(t('reports.importConfirm'))) return
    }
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/reports/import-excel', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || t('reports.importError'))
        return
      }
      const { tabs: imported } = await res.json()
      markDirty()
      setTabs(normaliseTabs(imported))
      setActiveTabIdx(0)
    } finally {
      setImporting(false)
      if (excelInputRef.current) excelInputRef.current.value = ''
    }
  }, [tabs])

  const translate = useCallback(async (direction: 'he-to-en' | 'en-to-he') => {
    if (mode === 'new') {
      showToast(t('reports.saveBeforeTranslate'))
      return
    }
    setTranslating(true)
    try {
      // Save first so the API has the latest tabs
      await save()
      const res = await fetch(`/api/reports/${reportId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || t('reports.translateError'))
        return
      }
      const result = await res.json()
      if (direction === 'en-to-he') {
        markDirty()
        setTabs(normaliseTabs(result.tabs))
      }
      showToast(direction === 'he-to-en' ? t('reports.enCreated') : t('reports.heCreated'), 'success')
    } finally {
      setTranslating(false)
    }
  }, [mode, reportId, save])

  const fieldStyle = { background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }

  // Block type picker
  const [showBlockPicker, setShowBlockPicker] = useState(false)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black" style={{ color: 'var(--admin-text-primary)' }}>
          {mode === 'new' ? t('reports.new') : t('reports.edit')}
        </h2>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
              <button onClick={() => translate('he-to-en')} disabled={translating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-all"
                style={{ color: 'var(--admin-text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)'; e.currentTarget.style.color = '#40e1d3' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-secondary)' }}>
                <Languages className="w-3.5 h-3.5" /> {translating ? '...' : 'HE → EN'}
              </button>
              <button onClick={() => translate('en-to-he')} disabled={translating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-all"
                style={{ color: 'var(--admin-text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)'; e.currentTarget.style.color = '#40e1d3' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-secondary)' }}>
                <Languages className="w-3.5 h-3.5" /> {translating ? '...' : 'EN → HE'}
              </button>
            </div>
          )}
          <button onClick={loadTemplate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)'; e.currentTarget.style.color = '#40e1d3' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.color = 'var(--admin-text-secondary)' }}>
            <FileText className="w-3.5 h-3.5" /> {t('reports.loadTemplate')}
          </button>
          <button onClick={() => excelInputRef.current?.click()} disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)'; e.currentTarget.style.color = '#40e1d3' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.color = 'var(--admin-text-secondary)' }}>
            <Upload className="w-3.5 h-3.5" /> {importing ? t('reports.importing') : t('reports.importExcel')}
          </button>
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(f) }} />
          <button onClick={() => save()} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
            <Save className="w-4 h-4" /> {saving ? t('reports.saving') : t('reports.saveDraft')}
          </button>
          <button onClick={() => save('published')} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'rgba(64,225,211,0.15)', border: '1px solid rgba(64,225,211,0.4)', color: '#40e1d3' }}>
            <Send className="w-4 h-4" /> {t('reports.publish')}
          </button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="rounded-xl p-5 mb-6 space-y-4" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }}>
        <div className="grid grid-cols-2 gap-4">
          <div ref={clientDropdownRef} className="relative">
            <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('common.client')}</label>
            <input value={client}
              onChange={e => { setClient(e.target.value); setClientId(null); setClientSearch(e.target.value); setShowClientDropdown(true) }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder={locale === 'en' ? 'Client name...' : 'שם לקוח...'} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle} />
            {showClientDropdown && filteredClients.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg shadow-xl"
                style={{ background: '#111', border: '1px solid var(--admin-border)' }}>
                {filteredClients.slice(0, 20).map(c => (
                  <button key={c.id} onClick={() => selectClient(c)}
                    className="block w-full text-right px-3 py-2 text-sm transition-colors hover:bg-white/5" style={{ color: 'var(--admin-text-primary)' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('reports.reportName')}</label>
            <input value={reportName} onChange={e => setReportName(e.target.value)}
              placeholder={t('reports.reportNamePlaceholder')} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('reports.period')}</label>
            <input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)}
              placeholder={t('reports.periodPlaceholder')} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle} />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('common.password')} ({locale === 'en' ? 'optional' : 'לא חובה'})</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"
              placeholder={locale === 'en' ? 'Protect report...' : 'להגנת הדוח...'} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {tabs.map((tab, idx) => (
          <div key={tab.id} className="flex items-center shrink-0">
            <button
              onClick={() => setActiveTabIdx(idx)}
              className="px-4 py-2 rounded-t-lg text-xs font-bold transition-all relative"
              style={{
                background: activeTabIdx === idx ? 'rgba(64,225,211,0.1)' : 'var(--admin-hover-bg)',
                border: `1px solid ${activeTabIdx === idx ? 'rgba(64,225,211,0.3)' : 'var(--admin-border)'}`,
                borderBottom: activeTabIdx === idx ? '2px solid #40e1d3' : '1px solid var(--admin-border)',
                color: activeTabIdx === idx ? '#40e1d3' : 'var(--admin-text-secondary)',
              }}
            >
              {tab.title || (locale === 'en' ? `Tab ${idx + 1}` : `טאב ${idx + 1}`)}
            </button>
          </div>
        ))}
        <button onClick={addTab} className="px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
          style={{ color: 'rgba(64,225,211,0.6)', border: '1px dashed rgba(64,225,211,0.2)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <Plus className="w-3.5 h-3.5 inline" /> {t('reports.addTab')}
        </button>
      </div>

      {/* Active tab editor */}
      {activeTab && (
        <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }}>
          {/* Tab meta */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <input value={activeTab.title} onChange={e => updateTab(activeTabIdx, { title: e.target.value })}
                placeholder={t('reports.tabTitle')} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle} />
              <input value={activeTab.subtitle || ''} onChange={e => updateTab(activeTabIdx, { subtitle: e.target.value })}
                placeholder={t('reports.tabSubtitle')} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle} />
            </div>
            <button onClick={() => moveTab(activeTabIdx, -1)} disabled={activeTabIdx === 0}
              className="p-1.5 rounded disabled:opacity-20" style={{ color: 'var(--admin-text-muted)' }} aria-label="הזז למעלה"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => moveTab(activeTabIdx, 1)} disabled={activeTabIdx === tabs.length - 1}
              className="p-1.5 rounded disabled:opacity-20" style={{ color: 'var(--admin-text-muted)' }} aria-label="הזז למטה"><ChevronDown className="w-4 h-4" /></button>
            {tabs.length > 1 && (
              <button onClick={() => removeTab(activeTabIdx)} className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--admin-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                aria-label="מחק לשונית">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Blocks */}
          <div className="space-y-4">
            {activeTab.blocks.map((block, bIdx) => (
              <div key={block.id} className="rounded-lg relative" style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
                <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  <GripVertical className="w-3.5 h-3.5" style={{ color: 'var(--admin-text-muted)' }} />
                  <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(64,225,211,0.5)' }}>{t(BLOCK_TYPE_KEYS[block.type] as any)}</span>
                  <div className="flex-1" />
                  <button onClick={() => moveBlock(block.id, -1)} disabled={bIdx === 0}
                    className="p-1 rounded disabled:opacity-20" style={{ color: 'var(--admin-text-muted)' }} aria-label="הזז למעלה"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveBlock(block.id, 1)} disabled={bIdx === activeTab.blocks.length - 1}
                    className="p-1 rounded disabled:opacity-20" style={{ color: 'var(--admin-text-muted)' }} aria-label="הזז למטה"><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeBlock(block.id)} className="p-1 rounded transition-colors"
                    style={{ color: 'var(--admin-text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                    aria-label="מחק בלוק">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-4">
                  <BlockEditor block={block} onChange={patch => updateBlock(block.id, patch)} />
                </div>
              </div>
            ))}
          </div>

          {/* Add block */}
          <div className="relative mt-4">
            <button onClick={() => setShowBlockPicker(!showBlockPicker)}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-xs font-bold transition-all"
              style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.2)', background: 'rgba(64,225,211,0.03)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.03)' }}>
              <Plus className="w-4 h-4" /> {t('reports.addBlock')}
            </button>
            {showBlockPicker && (
              <div className="absolute z-20 bottom-full mb-1 w-full rounded-lg shadow-xl p-2 grid grid-cols-3 gap-1"
                style={{ background: '#111', border: '1px solid var(--admin-border)' }}>
                {(Object.keys(BLOCK_TYPE_KEYS) as ReportBlockType[]).map(type => (
                  <button key={type} onClick={() => { addBlock(type); setShowBlockPicker(false) }}
                    className="text-right px-3 py-2 rounded text-xs font-semibold transition-colors hover:bg-white/5"
                    style={{ color: 'var(--admin-text-secondary)' }}>
                    {t(BLOCK_TYPE_KEYS[type] as any)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
