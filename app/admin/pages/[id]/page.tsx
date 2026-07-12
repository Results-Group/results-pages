'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, Trash2, ArrowRight, Code2, Upload, ChevronDown, ChevronUp, Check, FileCode2, RotateCcw, History, Paintbrush } from 'lucide-react'
import Link from 'next/link'
import VisualEditor, { type VisualEditorRef } from './visual-editor'
import ClientAutocomplete from '../../_components/client-autocomplete'
import WorkspaceSelector from '../../_components/workspace-selector'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'
import { useToast } from '../../_components/toast'

type UserRole = 'admin' | 'editor' | 'viewer'

async function fetchUserRole(): Promise<UserRole> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return 'viewer'
    const { user } = await res.json()
    return (user?.role as UserRole) || 'viewer'
  } catch {
    return 'viewer'
  }
}

/** Format a UTC ISO string as local wall time for a datetime-local input ('YYYY-MM-DDTHH:mm'). */
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface PageData {
  id: string
  client: string
  slug: string
  title: string
  active: boolean
  expiresAt: string | null
  publish_at: string | null
  password: string | null
  filePath: string
  createdAt: string
  workspace_id: string | null
  _count: { views: number }
}

interface Version {
  id: string
  page_id: string
  file_path: string
  created_at: string
  label: string | null
}

export default function EditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [page, setPage] = useState<PageData | null>(null)
  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [slug, setSlug] = useState('')
  const [active, setActive] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [password, setPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [shortUrl, setShortUrl] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // HTML editor state
  const [activeTab, setActiveTab] = useState<'visual' | 'code' | 'replace'>('visual')
  const visualEditorRef = useRef<VisualEditorRef>(null)
  const [htmlContent, setHtmlContent] = useState('')
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [htmlLoaded, setHtmlLoaded] = useState(false)
  const [savingHtml, setSavingHtml] = useState(false)

  // Stats reset state
  const [resettingStats, setResettingStats] = useState(false)
  const [viewCount, setViewCount] = useState(0)

  // File replacement state
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userRole, setUserRole] = useState<UserRole>('admin')
  const [dirty, setDirty] = useState(false)
  const { showToast } = useToast()

  useUnsavedChanges(dirty)

  // Version history state
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null)

  useEffect(() => {
    fetchUserRole().then(r => setUserRole(r))
  }, [])

  useEffect(() => {
    fetch(`/api/pages/${id}`)
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null }
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then(data => {
        if (!data) return
        setPage(data)
        setTitle(data.title)
        setClient(data.client)
        setSlug(data.slug)
        setActive(data.active)
        setExpiresAt(data.expiresAt ? data.expiresAt.split('T')[0] : '')
        setPublishAt(data.publish_at ? toLocalDatetimeInput(data.publish_at) : '')
        setHasPassword(!!data.has_password)
        setPassword('')
        setPasswordTouched(false)
        setShortUrl(data.short_url || '')
        setWorkspaceId(data.workspace_id || null)
        setViewCount(data._count?.views || 0)
      })
      .catch(() => setError('שגיאה בטעינת הדף'))
    loadHtml()
  }, [id])

  async function loadHtml() {
    if (htmlLoaded) return
    setHtmlLoading(true)
    try {
      const res = await fetch(`/api/pages/${id}/html`)
      if (res.ok) {
        const data = await res.json()
        setHtmlContent(data.html)
        setHtmlLoaded(true)
      } else {
        setError('לא ניתן לטעון את קובץ ה-HTML')
      }
    } catch {
      setError('שגיאה בטעינת ה-HTML')
    }
    setHtmlLoading(false)
  }

  function handleTabChange(tab: 'visual' | 'code' | 'replace') {
    if (activeTab === 'visual' && tab !== 'visual' && visualEditorRef.current) {
      setHtmlContent(visualEditorRef.current.getHtml())
    }
    setActiveTab(tab)
  }

  async function handleSaveVisualHtml(html: string) {
    setSavingHtml(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch(`/api/pages/${id}/html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      })
      if (res.ok) {
        setSuccessMsg('השינויים נשמרו בהצלחה!')
        setHtmlContent(html)
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה בשמירה')
      }
    } catch {
      setError('שגיאה בשמירה')
    }
    setSavingHtml(false)
  }

  async function handleSaveHtml() {
    setSavingHtml(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch(`/api/pages/${id}/html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent }),
      })
      if (res.ok) {
        setSuccessMsg('קוד ה-HTML נשמר בהצלחה!')
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה בשמירת ה-HTML')
      }
    } catch {
      setError('שגיאה בשמירת ה-HTML')
    }
    setSavingHtml(false)
  }

  async function handleUploadReplace() {
    if (!replaceFile) return
    setUploadingFile(true)
    setError('')
    setSuccessMsg('')
    try {
      const formData = new FormData()
      formData.append('file', replaceFile)
      const res = await fetch(`/api/pages/${id}/html`, {
        method: 'PUT',
        body: formData,
      })
      if (res.ok) {
        setSuccessMsg('הקובץ הוחלף בהצלחה!')
        setReplaceFile(null)
        setHtmlLoaded(false)
        setHtmlContent('')
        loadHtml()
        setActiveTab('visual')
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה בהעלאת הקובץ')
      }
    } catch {
      setError('שגיאה בהעלאת הקובץ')
    }
    setUploadingFile(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccessMsg('')

    const res = await fetch(`/api/pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // datetime-local values are local wall time — convert to UTC ISO client-side,
      // since the server (UTC on Vercel) would otherwise parse them 3h off
      body: JSON.stringify({ title, client, slug, active, expiresAt: expiresAt || null, publishAt: publishAt ? new Date(publishAt).toISOString() : null, ...(passwordTouched ? { password: password || null } : {}), shortUrl: shortUrl || null, workspace_id: workspaceId }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'שגיאה בשמירה')
    } else {
      router.push('/admin')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`למחוק את "${page?.title}"? פעולה זו בלתי הפיכה.`)) return
    await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    router.push('/admin')
  }

  async function handleResetStats() {
    if (!confirm('לאפס את כל הסטטיסטיקות של דף זה? פעולה זו בלתי הפיכה.')) return
    setResettingStats(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch(`/api/pages/${id}/views`, { method: 'DELETE' })
      if (res.ok) {
        setViewCount(0)
        setSuccessMsg('הסטטיסטיקות אופסו בהצלחה!')
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה באיפוס הסטטיסטיקות')
      }
    } catch {
      setError('שגיאה באיפוס הסטטיסטיקות')
    }
    setResettingStats(false)
  }

  async function loadVersions() {
    if (versionsLoaded) return
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/pages/${id}/versions`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions || [])
        setVersionsLoaded(true)
      }
    } catch {
      // Graceful degradation — table may not exist yet
    }
    setVersionsLoading(false)
  }

  function toggleVersions() {
    const next = !showVersions
    setShowVersions(next)
    if (next && !versionsLoaded) loadVersions()
  }

  async function handleRestore(versionId: string) {
    if (!confirm('לשחזר גרסה זו? הגרסה הנוכחית תישמר בהיסטוריה.')) return
    setRestoringVersion(versionId)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch(`/api/pages/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      if (res.ok) {
        setSuccessMsg('הגרסה שוחזרה בהצלחה!')
        setHtmlLoaded(false)
        setHtmlContent('')
        loadHtml()
        setVersionsLoaded(false)
        loadVersions()
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה בשחזור הגרסה')
      }
    } catch {
      setError('שגיאה בשחזור הגרסה')
    }
    setRestoringVersion(null)
  }

  const inputStyle = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-primary)',
  }

  if (!page) return <p style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors"
        style={{ color: 'var(--admin-text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--admin-text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--admin-text-muted)'}
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לדפים
      </Link>

      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--admin-text-primary)' }}>עריכת דף</h2>
      <div className="flex items-center gap-3 mb-6">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          <Eye className="w-3.5 h-3.5" />
          {viewCount} צפיות
        </span>
        <button
          type="button"
          onClick={handleResetStats}
          disabled={resettingStats || viewCount === 0}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            color: 'var(--admin-danger)',
            border: '1px solid var(--admin-danger-border)',
            background: 'transparent',
          }}
          onMouseEnter={e => { if (!resettingStats && viewCount > 0) e.currentTarget.style.background = 'var(--admin-danger-bg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <RotateCcw className="w-3 h-3" />
          {resettingStats ? 'מאפס...' : 'איפוס סטטיסטיקה'}
        </button>
        <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          נוצר {new Date(page.createdAt).toLocaleDateString('he-IL')}
        </span>
      </div>

      <div
        className="mb-6 p-4 rounded-xl"
        style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
      >
        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>URL</p>
        <code className="text-sm" dir="ltr" style={{ color: 'var(--admin-link)' }}>/pages/{client}/{slug}</code>
      </div>

      {successMsg && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-2.5 text-sm font-medium"
          style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e' }}
        >
          <Check className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ─── HTML Content Management ─── */}
      <div
        className="mb-6 rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--admin-border)' }}
      >
        <div className="p-5" style={{ background: 'var(--admin-bg-elevated)' }}>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--admin-text-primary)' }}>
            <FileCode2 className="w-4.5 h-4.5 inline-block ml-2" style={{ verticalAlign: '-2px' }} />
            ניהול תוכן
          </h3>
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>ערוך את תוכן הדף ויזואלית, דרך הקוד, או החלף את הקובץ</p>
        </div>

        <div className="px-5 pb-5" style={{ background: 'var(--admin-bg-elevated)' }}>
          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
            {([
              { key: 'visual' as const, label: 'עורך ויזואלי', Icon: Paintbrush },
              { key: 'code' as const, label: 'קוד HTML', Icon: Code2 },
              { key: 'replace' as const, label: 'החלפת קובץ', Icon: Upload },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: activeTab === key ? 'var(--admin-bg-elevated)' : 'transparent',
                  color: activeTab === key ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
                  boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Visual Editor tab */}
          {activeTab === 'visual' && (
            htmlLoading ? (
              <div className="flex items-center justify-center py-16" style={{ color: 'var(--admin-text-muted)' }}>
                <span className="text-sm">טוען עורך...</span>
              </div>
            ) : htmlLoaded ? (
              <VisualEditor
                ref={visualEditorRef}
                html={htmlContent}
                onSave={handleSaveVisualHtml}
                saving={savingHtml}
              />
            ) : (
              <div className="flex items-center justify-center py-16" style={{ color: 'var(--admin-text-muted)' }}>
                <span className="text-sm">לא ניתן לטעון את תוכן הדף</span>
              </div>
            )
          )}

          {/* Code Editor tab */}
          {activeTab === 'code' && (
            htmlLoading ? (
              <div className="flex items-center justify-center py-12" style={{ color: 'var(--admin-text-muted)' }}>
                <span className="text-sm">טוען HTML...</span>
              </div>
            ) : (
              <>
                <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{ background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>HTML</span>
                    <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {htmlContent.length.toLocaleString()} תווים
                    </span>
                  </div>
                  <textarea
                    value={htmlContent}
                    onChange={e => setHtmlContent(e.target.value)}
                    dir="ltr"
                    spellCheck={false}
                    className="w-full outline-none resize-y text-sm leading-relaxed"
                    style={{
                      background: '#0d0d1a', color: '#e2e8f0',
                      fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
                      minHeight: '500px', padding: '16px', tabSize: 2,
                      whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveHtml}
                  disabled={savingHtml}
                  className="mt-3 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40"
                  style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  {savingHtml ? 'שומר HTML...' : 'שמירת קוד HTML'}
                </button>
              </>
            )
          )}

          {/* File Replace tab */}
          {activeTab === 'replace' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={e => setReplaceFile(e.target.files?.[0] || null)}
              />
              {!replaceFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 rounded-xl text-sm transition-all duration-200 cursor-pointer"
                  style={{ border: '2px dashed var(--admin-border)', background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--admin-accent)'; e.currentTarget.style.color = 'var(--admin-accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  <span className="font-medium block">לחצו לבחירת קובץ HTML</span>
                  <span className="text-xs opacity-60 mt-1 block">או גררו קובץ לכאן</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <FileCode2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }} dir="ltr">{replaceFile.name}</p>
                      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{(replaceFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setReplaceFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--admin-danger)', background: 'var(--admin-danger-bg)' }}
                    >
                      ביטול
                    </button>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--admin-text-muted)' }}>הקובץ הנוכחי יוחלף. הגרסה הנוכחית תישמר בהיסטוריה.</p>
                  <button
                    type="button"
                    onClick={handleUploadReplace}
                    disabled={uploadingFile}
                    className="w-full py-3 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  >
                    {uploadingFile ? 'מעלה קובץ...' : 'אישור והחלפת הקובץ'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Version History ─── */}
      <div
        className="mb-6 rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--admin-border)' }}
      >
        <button
          type="button"
          onClick={toggleVersions}
          className="w-full flex items-center justify-between p-5 text-right transition-colors"
          style={{ background: 'var(--admin-bg-elevated)' }}
        >
          <span>
            <h3 className="text-base font-semibold mb-0.5" style={{ color: 'var(--admin-text-primary)' }}>
              <History className="w-4.5 h-4.5 inline-block ml-2" style={{ verticalAlign: '-2px' }} />
              היסטוריית גרסאות
            </h3>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>שחזור גרסאות קודמות של הדף</p>
          </span>
          {showVersions ? <ChevronUp className="w-5 h-5" style={{ color: 'var(--admin-text-muted)' }} /> : <ChevronDown className="w-5 h-5" style={{ color: 'var(--admin-text-muted)' }} />}
        </button>

        {showVersions && (
          <div className="px-5 pb-5" style={{ background: 'var(--admin-bg-elevated)' }}>
            {versionsLoading ? (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--admin-text-muted)' }}>
                <span className="text-sm">טוען היסטוריה...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--admin-text-muted)' }}>
                <span className="text-sm">אין גרסאות קודמות</span>
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                    style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                        {new Date(v.created_at).toLocaleString('he-IL', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {v.label && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>{v.label}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestore(v.id)}
                      disabled={restoringVersion === v.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-40"
                      style={{
                        background: 'rgba(243, 213, 109, 0.1)',
                        border: '1px solid rgba(243, 213, 109, 0.25)',
                        color: 'var(--admin-accent)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(243, 213, 109, 0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(243, 213, 109, 0.1)' }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {restoringVersion === v.id ? 'משחזר...' : 'שחזור'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Page Settings Form ─── */}
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>כותרת</label>
          <input
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true) }}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>לקוח</label>
          <ClientAutocomplete value={client} onChange={setClient} workspaceId={workspaceId} placeholder="בחר לקוח או הקלד שם חדש" dir="ltr" />
        </div>

        <WorkspaceSelector value={workspaceId} onChange={setWorkspaceId} />

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>תאריך פרסום (אופציונלי)</label>
          <input
            type="datetime-local"
            value={publishAt}
            onChange={e => setPublishAt(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--admin-text-muted)' }}>הדף לא יהיה זמין לצפייה עד למועד זה</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>תאריך תוקף</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>סיסמה לדף (אופציונלי)</label>
          <input
            type="text"
            value={password}
            onChange={e => { setPassword(e.target.value); setPasswordTouched(true); setDirty(true) }}
            placeholder={hasPassword && !passwordTouched ? '••••••••' : 'השאר ריק ללא הגנה'}
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--admin-text-muted)' }}>
            {hasPassword && !passwordTouched
              ? '🔒 הדף מוגן בסיסמה (הקלד כדי לשנות)'
              : passwordTouched && password
                ? '🔒 סיסמה חדשה תוגדר בשמירה'
                : passwordTouched && !password
                  ? 'הסיסמה תוסר בשמירה'
                  : 'ללא סיסמה — הדף נגיש לכולם'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>קישור קצר (אופציונלי)</label>
          <input
            type="text"
            value={shortUrl}
            onChange={e => setShortUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="cycle-q1"
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          {shortUrl && (
            <p className="text-xs mt-1.5" dir="ltr" style={{ color: '#a78bfa' }}>
              /r/{shortUrl}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActive(!active)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: active ? 'var(--admin-success)' : 'var(--admin-border-input)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
              style={{ transform: active ? 'translateX(-2px)' : 'translateX(-22px)' }}
            />
          </button>
          <span className="text-sm font-medium" style={{ color: 'var(--admin-text-secondary)' }}>
            {active ? 'פעיל' : 'מושבת'}
          </span>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {saving ? 'שומר...' : 'שמירה'}
          </button>
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{ color: 'var(--admin-danger)', border: '1px solid var(--admin-danger-border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-danger-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 className="w-4 h-4" />
              מחיקה
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
