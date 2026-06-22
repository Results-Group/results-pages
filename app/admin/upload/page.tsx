'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileUp } from 'lucide-react'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [client, setClient] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const router = useRouter()

  function handleFileChange(f: File | null) {
    setFile(f)
    if (f && !title) {
      const name = f.name.replace(/\.html$/i, '').replace(/[-_]/g, ' ')
      setTitle(name)
      setSlug(f.name.replace(/\.html$/i, '').toLowerCase().replace(/\s+/g, '-'))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !client || !title || !slug) {
      setError('יש למלא את כל השדות ולבחור קובץ')
      return
    }

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('client', client)
    formData.append('title', title)
    formData.append('slug', slug)
    if (expiresAt) formData.append('expiresAt', expiresAt)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'שגיאה בהעלאה')
      setUploading(false)
      return
    }

    router.push('/admin')
  }

  const inputStyle = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-primary)',
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-black mb-8" style={{ color: 'var(--admin-text-primary)' }}>העלאת דף חדש</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File upload */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>קובץ HTML</label>
          <div
            className="rounded-2xl p-10 text-center cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragOver ? '#F3D56D' : 'var(--admin-border)'}`,
              background: dragOver ? 'rgba(243,213,109,0.04)' : 'var(--admin-bg-elevated)',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files[0] || null) }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileUp className="w-5 h-5" style={{ color: '#F3D56D' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--admin-text-primary)' }}>
                  {file.name} <span style={{ color: 'var(--admin-text-muted)' }}>({(file.size / 1024).toFixed(0)} KB)</span>
                </p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--admin-text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>גרור קובץ HTML לכאן או לחץ לבחירה</p>
              </div>
            )}
          </div>
          <input
            id="file-input"
            type="file"
            accept=".html"
            className="hidden"
            onChange={e => handleFileChange(e.target.files?.[0] || null)}
          />
        </div>

        {/* Client */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>לקוח (שם תיקייה)</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="medera"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = '#F3D56D'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>כותרת</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="דוח קמפיינים מאי 2026"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = '#F3D56D'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>Slug (חלק ב-URL)</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="campaign-report-may26"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = '#F3D56D'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          {slug && client && (
            <p className="text-xs mt-2" dir="ltr" style={{ color: 'var(--admin-text-muted)' }}>
              URL: /pages/{client}/{slug}
            </p>
          )}
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>תאריך תוקף (אופציונלי)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            dir="ltr"
            onFocus={e => e.currentTarget.style.borderColor = '#F3D56D'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
          style={{ background: '#F3D56D', color: '#050505' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px rgba(243,213,109,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
        >
          {uploading ? 'מעלה...' : 'העלאה'}
        </button>
      </form>
    </div>
  )
}
