'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, Trash2, ArrowRight, Code2, Upload, ChevronDown, ChevronUp, Check, FileCode2, RotateCcw, History } from 'lucide-react'
import Link from 'next/link'

type UserRole = 'admin' | 'editor' | 'viewer'

function getUserRole(): UserRole {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_session='))
    if (!cookie) return 'admin'
    const value = cookie.split('=')[1]
    const json = atob(decodeURIComponent(value))
    const parsed = JSON.parse(json)
    if (parsed.role) return parsed.role as UserRole
    return 'admin'
  } catch {
    return 'admin'
  }
}

interface PageData {
  id: string
  client: string
  slug: string
  title: string
  active: boolean
  expiresAt: string | null
  password: string | null
  filePath: string
  createdAt: string
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
  const [password, setPassword] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // HTML editor state
  const [showHtmlEditor, setShowHtmlEditor] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [htmlLoaded, setHtmlLoaded] = useState(false)
  const [savingHtml, setSavingHtml] = useState(false)

  // Stats reset state
  const [resettingStats, setResettingStats] = useState(false)
  const [viewCount, setViewCount] = useState(0)

  // File replacement state
  const [showFileReplace, setShowFileReplace] = useState(false)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userRole, setUserRole] = useState<UserRole>('admin')

  // Version history state
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null)

  useEffect(() => {
    setUserRole(getUserRole())
  }, [])

  useEffect(() => {
    fetch(`/api/pages/${id}`)
      .then(r => r.json())
      .then(data => {
        setPage(data)
        setTitle(data.title)
        setClient(data.client)
        setSlug(data.slug)
        setActive(data.active)
        setExpiresAt(data.expiresAt ? data.expiresAt.split('T')[0] : '')
        setPassword(data.password || '')
        setShortUrl(data.short_url || '')
        setViewCount(data._count?.views || 0)
      })
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

  function toggleHtmlEditor() {
    const next = !showHtmlEditor
    setShowHtmlEditor(next)
    if (next && !htmlLoaded) loadHtml()
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
        if (showHtmlEditor) loadHtml()
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
      body: JSON.stringify({ title, client, slug, active, expiresAt: expiresAt || null, password: password || null, shortUrl: shortUrl || null }),
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
        if (showHtmlEditor) loadHtml()
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
    <div className="max-w-2xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-bold mb-6 transition-colors"
        style={{ color: 'var(--admin-text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--admin-text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--admin-text-muted)'}
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לדפים
      </Link>

      <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--admin-text-primary)' }}>עריכת דף</h2>
      <div className="flex items-center gap-3 mb-8">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          <Eye className="w-3.5 h-3.5" />
          {viewCount} צפיות
        </span>
        <button
          type="button"
          onClick={handleResetStats}
          disabled={resettingStats || viewCount === 0}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
        className="mb-8 p-5 rounded-2xl"
        style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
      >
        <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>URL</p>
        <code className="text-sm" dir="ltr" style={{ color: 'var(--admin-link)' }}>/pages/{client}/{slug}</code>
      </div>

      {successMsg && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-2.5 text-sm font-bold"
          style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e' }}
        >
          <Check className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ─── HTML Content Management ─── */}
      <div
        className="mb-8 rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-border)' }}
      >
        <div
          className="p-5"
          style={{ background: 'var(--admin-bg-elevated)' }}
        >
          <h3 className="text-base font-black mb-1" style={{ color: 'var(--admin-text-primary)' }}>
            <FileCode2 className="w-4.5 h-4.5 inline-block ml-2" style={{ verticalAlign: '-2px' }} />
            ניהול תוכן HTML
          </h3>
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>ערוך את קוד ה-HTML ישירות או החלף את הקובץ</p>
        </div>

        <div className="px-5 pb-5" style={{ background: 'var(--admin-bg-elevated)' }}>
          {/* Toggle: Edit HTML Code */}
          <button
            type="button"
            onClick={toggleHtmlEditor}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 mb-3"
            style={{
              background: showHtmlEditor ? 'rgba(243, 213, 109, 0.08)' : 'var(--admin-bg)',
              border: showHtmlEditor ? '1px solid rgba(243, 213, 109, 0.3)' : '1px solid var(--admin-border)',
              color: showHtmlEditor ? 'var(--admin-accent)' : 'var(--admin-text-secondary)',
            }}
          >
            <span className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              עריכת קוד HTML
            </span>
            {showHtmlEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHtmlEditor && (
            <div className="mb-4">
              {htmlLoading ? (
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
                        background: '#0d0d1a',
                        color: '#e2e8f0',
                        fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
                        minHeight: '500px',
                        padding: '16px',
                        tabSize: 2,
                        whiteSpace: 'pre',
                        overflowWrap: 'normal',
                        overflowX: 'auto',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveHtml}
                    disabled={savingHtml}
                    className="mt-3 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
                  >
                    {savingHtml ? 'שומר HTML...' : 'שמירת קוד HTML'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Toggle: Replace File */}
          <button
            type="button"
            onClick={() => setShowFileReplace(!showFileReplace)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: showFileReplace ? 'rgba(243, 213, 109, 0.08)' : 'var(--admin-bg)',
              border: showFileReplace ? '1px solid rgba(243, 213, 109, 0.3)' : '1px solid var(--admin-border)',
              color: showFileReplace ? 'var(--admin-accent)' : 'var(--admin-text-secondary)',
            }}
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              החלפת קובץ HTML
            </span>
            {showFileReplace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFileReplace && (
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] || null
                  setReplaceFile(f)
                }}
              />

              {!replaceFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 rounded-xl text-sm transition-all duration-200 cursor-pointer"
                  style={{
                    border: '2px dashed var(--admin-border)',
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-text-muted)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--admin-accent)'
                    e.currentTarget.style.color = 'var(--admin-accent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--admin-border)'
                    e.currentTarget.style.color = 'var(--admin-text-muted)'
                  }}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  <span className="font-bold block">לחצו לבחירת קובץ HTML</span>
                  <span className="text-xs opacity-60 mt-1 block">או גררו קובץ לכאן</span>
                </button>
              ) : (
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <FileCode2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--admin-text-primary)' }} dir="ltr">
                        {replaceFile.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                        {(replaceFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setReplaceFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--admin-danger)', background: 'var(--admin-danger-bg)' }}
                    >
                      ביטול
                    </button>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--admin-text-muted)' }}>
                    הקובץ הנוכחי יוחלף. פעולה זו בלתי הפיכה.
                  </p>
                  <button
                    type="button"
                    onClick={handleUploadReplace}
                    disabled={uploadingFile}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
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
        className="mb-8 rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-border)' }}
      >
        <button
          type="button"
          onClick={toggleVersions}
          className="w-full flex items-center justify-between p-5 text-right transition-colors"
          style={{ background: 'var(--admin-bg-elevated)' }}
        >
          <span>
            <h3 className="text-base font-black mb-0.5" style={{ color: 'var(--admin-text-primary)' }}>
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
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
                  >
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--admin-text-primary)' }}>
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
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-40"
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
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>כותרת</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>לקוח</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>תאריך תוקף</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>סיסמה לדף (אופציונלי)</label>
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="השאר ריק ללא הגנה"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--admin-text-muted)' }}>
            {password ? '🔒 הדף מוגן בסיסמה' : 'ללא סיסמה — הדף נגיש לכולם'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>קישור קצר (אופציונלי)</label>
          <input
            type="text"
            value={shortUrl}
            onChange={e => setShortUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="cycle-q1"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
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
          <span className="text-sm font-bold" style={{ color: 'var(--admin-text-secondary)' }}>
            {active ? 'פעיל' : 'מושבת'}
          </span>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            {saving ? 'שומר...' : 'שמירה'}
          </button>
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-200"
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
