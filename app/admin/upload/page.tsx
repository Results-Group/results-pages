'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [client, setClient] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
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

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-6">העלאת דף חדש</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File upload */}
        <div>
          <label className="block text-sm font-medium mb-1.5">קובץ HTML</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0] || null) }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {file ? (
              <p className="text-sm font-medium">{file.name} <span className="text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span></p>
            ) : (
              <p className="text-gray-400 text-sm">גרור קובץ HTML לכאן או לחץ לבחירה</p>
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
          <label className="block text-sm font-medium mb-1.5">לקוח (שם תיקייה)</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="medera"
            dir="ltr"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1.5">כותרת</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="דוח קמפיינים מאי 2026"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Slug (חלק ב-URL)</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="campaign-report-may26"
            dir="ltr"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
          {slug && client && (
            <p className="text-xs text-gray-400 mt-1" dir="ltr">
              URL: /pages/{client}/{slug}
            </p>
          )}
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-sm font-medium mb-1.5">תאריך תוקף (אופציונלי)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            dir="ltr"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {uploading ? 'מעלה...' : 'העלאה'}
        </button>
      </form>
    </div>
  )
}
