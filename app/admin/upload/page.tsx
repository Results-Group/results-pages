'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileUp } from 'lucide-react'
import ClientAutocomplete from '../_components/client-autocomplete'
import { useT, useLocale } from '@/lib/i18n'
import { slugifyPath } from '@/lib/slug'

function getWorkspaceCookie(): string | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_workspace='))
    if (!cookie) return null
    return cookie.substring('rp_workspace='.length)
  } catch { return null }
}

export default function UploadPage() {
  const t = useT()
  const locale = useLocale()
  const [file, setFile] = useState<File | null>(null)
  const [client, setClient] = useState('')
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)

  useEffect(() => { setActiveWorkspaceId(getWorkspaceCookie()) }, [])
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [password, setPassword] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const router = useRouter()

  function handleFileChange(f: File | null) {
    setFile(f)
    if (f) {
      const name = f.name.replace(/\.html$/i, '').replace(/[-_]/g, ' ')
      if (!title) setTitle(name)
      setSlug(f.name.replace(/\.html$/i, '').toLowerCase().replace(/\s+/g, '-'))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !client || !title || !slug) {
      setError(t('upload.fillRequired'))
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
    if (password.trim()) formData.append('password', password.trim())
    if (shortUrl.trim()) formData.append('shortUrl', shortUrl.trim())

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || t('upload.error'))
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
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--admin-text-primary)' }}>{t('upload.title')}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File upload */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.htmlFile')}</label>
          <div
            className="rounded-xl p-7 text-center cursor-pointer transition-colors"
            style={{
              border: `2px dashed ${dragOver ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
              background: dragOver ? 'var(--admin-accent-subtle)' : 'var(--admin-bg-elevated)',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files[0] || null) }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileUp className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                  {file.name} <span style={{ color: 'var(--admin-text-muted)' }}>({(file.size / 1024).toFixed(0)} KB)</span>
                </p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--admin-text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('upload.dragHint')}</p>
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
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.clientFolder')}</label>
          <ClientAutocomplete value={client} onChange={setClient} workspaceId={activeWorkspaceId} placeholder={t('upload.clientPlaceholder')} dir="ltr" />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.titleLabel')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('upload.titlePlaceholder')}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.slugLabel')}</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="campaign-report-may26"
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          {slug && client && (
            <p className="text-xs mt-2" dir="ltr" style={{ color: 'var(--admin-text-muted)' }}>
              URL: /pages/{slugifyPath(client)}/{slugifyPath(slug)}
            </p>
          )}
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.expirationLabel')}</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            dir="ltr"
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.passwordLabel')}</label>
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('upload.passwordPlaceholder')}
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--admin-text-muted)' }}>
            {password.trim() ? `🔒 ${t('upload.passwordHintSet')}` : t('upload.passwordHintEmpty')}
          </p>
        </div>

        {/* Short URL */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('upload.shortUrlLabel')}</label>
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

        {error && <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {uploading ? t('upload.uploading') : t('upload.submit')}
        </button>
      </form>
    </div>
  )
}
