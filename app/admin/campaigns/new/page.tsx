'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Plus, Trash2, Upload, Link2, Image, Check, Copy, ExternalLink } from 'lucide-react'

interface Asset {
  id: string
  type: 'image' | 'video'
  file_path: string
  url: string
  caption: string
}

interface Section {
  id: string
  title: string
  mockup_type: string
  assets: Asset[]
}

const MOCKUP_TYPES: Record<string, string> = {
  instagram_feed: 'פיד אינסטגרם',
  instagram_story: 'סטוריז אינסטגרם',
  facebook_feed: 'פיד פייסבוק',
  video: 'סרטונים',
  general: 'כללי',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export default function NewCampaignPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const [client, setClient] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [concept, setConcept] = useState('')
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [error, setError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSections, setUploadingSections] = useState<Record<string, number>>({})

  const inputStyle = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-primary)',
  }

  async function saveCampaign(status: 'draft' | 'published') {
    if (!client.trim() || !campaignName.trim()) {
      setError('יש למלא שם לקוח ושם קמפיין')
      return
    }
    setError('')
    setSaving(true)

    try {
      const body = {
        client: client.trim(),
        campaign_name: campaignName.trim(),
        concept: concept.trim(),
        logo_path: logoPath,
        status,
        sections: sections.map(s => ({
          id: s.id,
          title: s.title,
          mockup_type: s.mockup_type,
          assets: s.assets.map(a => ({
            id: a.id,
            type: a.type,
            file_path: a.file_path,
            url: a.url,
            caption: a.caption,
          })),
        })),
      }

      const method = campaignId ? 'PUT' : 'POST'
      const url = campaignId ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'שגיאה בשמירה')
      }

      const data = await res.json()
      if (!campaignId) {
        setCampaignId(data.id)
      }

      if (status === 'published') {
        router.push('/admin/campaigns')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    if (!campaignId) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')

      const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setLogoPath(data.file_path)
      } else {
        setError('שגיאה בהעלאת הלוגו')
      }
    } catch {
      setError('שגיאה בהעלאת הלוגו')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleAssetUpload(sectionId: string, files: FileList) {
    if (!campaignId) return
    const fileArr = Array.from(files)
    setUploadingSections(prev => ({ ...prev, [sectionId]: fileArr.length }))

    let completed = 0
    for (const file of fileArr) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'image')
        formData.append('section_id', sectionId)

        const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          const newAsset: Asset = {
            id: crypto.randomUUID(),
            type: 'image',
            file_path: data.file_path,
            url: '',
            caption: '',
          }
          setSections(prev =>
            prev.map(s =>
              s.id === sectionId ? { ...s, assets: [...s.assets, newAsset] } : s
            )
          )
        } else {
          setError(`שגיאה בהעלאת ${file.name}`)
        }
      } catch {
        setError(`שגיאה בהעלאת ${file.name}`)
      }
      completed++
      setUploadingSections(prev => ({ ...prev, [sectionId]: fileArr.length - completed }))
    }
    setUploadingSections(prev => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })
  }

  function addSection() {
    setSections(prev => [
      ...prev,
      { id: crypto.randomUUID(), title: '', mockup_type: 'general', assets: [] },
    ])
  }

  function removeSection(id: string) {
    setSections(prev => prev.filter(s => s.id !== id))
  }

  function updateSection(id: string, updates: Partial<Section>) {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }

  function removeAsset(sectionId: string, assetId: string) {
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId
          ? { ...s, assets: s.assets.filter(a => a.id !== assetId) }
          : s
      )
    )
  }

  function updateAssetCaption(sectionId: string, assetId: string, caption: string) {
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId
          ? { ...s, assets: s.assets.map(a => (a.id === assetId ? { ...a, caption } : a)) }
          : s
      )
    )
  }

  function addVideoLink(sectionId: string) {
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      type: 'video',
      file_path: '',
      url: '',
      caption: '',
    }
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId ? { ...s, assets: [...s.assets, newAsset] } : s
      )
    )
  }

  function updateVideoAsset(sectionId: string, assetId: string, updates: Partial<Asset>) {
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId
          ? { ...s, assets: s.assets.map(a => (a.id === assetId ? { ...a, ...updates } : a)) }
          : s
      )
    )
  }

  function getAssetUrl(filePath: string) {
    return `${SUPABASE_URL}/storage/v1/object/public/campaign-assets/${filePath}`
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-4 transition-colors"
          style={{ color: 'var(--admin-text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--admin-accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--admin-text-muted)')}
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לקמפיינים
        </Link>
        <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text-primary)' }}>
          קמפיין חדש
        </h2>
      </div>

      {/* Section 1: Campaign Details */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
      >
        <h3 className="text-lg font-black mb-5" style={{ color: 'var(--admin-text-primary)' }}>
          פרטי קמפיין
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>
              שם לקוח *
            </label>
            <input
              type="text"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="שם הלקוח"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>
              שם קמפיין *
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="שם הקמפיין"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>
            קונספט הקמפיין
          </label>
          <textarea
            value={concept}
            onChange={e => setConcept(e.target.value)}
            placeholder="תיאור קצר של הקונספט..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
          />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>
            לוגו לקוח
          </label>
          {!campaignId ? (
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              שמרו טיוטה כדי להעלות לוגו
            </p>
          ) : uploadingLogo ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--admin-accent)', borderTopColor: 'transparent' }} />
              <span className="text-sm" style={{ color: 'var(--admin-accent)' }}>מעלה לוגו...</span>
            </div>
          ) : logoPath ? (
            <div className="flex items-center gap-3">
              <img
                src={getAssetUrl(logoPath)}
                alt="Logo"
                className="w-16 h-16 rounded-lg object-contain"
                style={{ background: 'var(--admin-bg)' }}
              />
              <button
                onClick={() => setLogoPath(null)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--admin-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm cursor-pointer transition-colors"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
            >
              <Upload className="w-4 h-4" />
              בחירת לוגו
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleLogoUpload(f)
                }}
              />
            </label>
          )}
        </div>
      </div>

      {/* Section 2: Creative Sections */}
      <div className="mb-6">
        <h3 className="text-lg font-black mb-5" style={{ color: 'var(--admin-text-primary)' }}>
          סקציות קריאייטיב
        </h3>

        <div className="space-y-4">
          {sections.map(section => (
            <div
              key={section.id}
              className="rounded-2xl p-5"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
            >
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="text"
                  value={section.title}
                  onChange={e => updateSection(section.id, { title: e.target.value })}
                  placeholder="שם הסקציה"
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
                />
                <select
                  value={section.mockup_type}
                  onChange={e => updateSection(section.id, { mockup_type: e.target.value })}
                  className="px-4 py-2.5 rounded-xl text-sm outline-none transition-colors cursor-pointer"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
                >
                  {Object.entries(MOCKUP_TYPES).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeSection(section.id)}
                  className="p-2.5 rounded-lg transition-colors"
                  style={{ color: 'var(--admin-text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-danger-bg)'; e.currentTarget.style.color = 'var(--admin-danger)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Section Content */}
              {section.mockup_type === 'video' ? (
                <div className="space-y-3">
                  {section.assets.map(asset => (
                    <div key={asset.id} className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="url"
                          value={asset.url}
                          onChange={e => updateVideoAsset(section.id, asset.id, { url: e.target.value })}
                          placeholder="קישור לסרטון (YouTube, Vimeo...)"
                          dir="ltr"
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                          style={inputStyle}
                          onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
                        />
                        <input
                          type="text"
                          value={asset.caption}
                          onChange={e => updateVideoAsset(section.id, asset.id, { caption: e.target.value })}
                          placeholder="כיתוב"
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                          style={inputStyle}
                          onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
                        />
                      </div>
                      <button
                        onClick={() => removeAsset(section.id, asset.id)}
                        className="p-2.5 rounded-lg transition-colors mt-1"
                        style={{ color: 'var(--admin-text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-danger)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addVideoLink(section.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
                    style={{ color: 'var(--admin-accent)', border: '1px dashed var(--admin-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
                  >
                    <Link2 className="w-4 h-4" />
                    הוסף לינק לסרטון
                  </button>
                </div>
              ) : (
                <div>
                  {!campaignId ? (
                    <div
                      className="rounded-xl p-6 text-center"
                      style={{ border: '2px dashed var(--admin-border)', background: 'var(--admin-bg)' }}
                    >
                      <Image className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--admin-text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                        שמרו טיוטה כדי להעלות קבצים
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Asset Grid */}
                      {section.assets.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                          {section.assets.map(asset => (
                            <div key={asset.id} className="relative group">
                              <img
                                src={getAssetUrl(asset.file_path)}
                                alt=""
                                className="w-full h-[120px] object-cover rounded-lg"
                                style={{ background: 'var(--admin-bg)' }}
                              />
                              <button
                                onClick={() => removeAsset(section.id, asset.id)}
                                className="absolute top-1.5 left-1.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'rgba(0,0,0,0.7)', color: '#ef4444' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <textarea
                                value={asset.caption}
                                onChange={e => updateAssetCaption(section.id, asset.id, e.target.value)}
                                placeholder="כיתוב..."
                                rows={2}
                                className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg text-xs outline-none resize-none transition-colors"
                                style={inputStyle}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload Zone */}
                      {uploadingSections[section.id] ? (
                        <div
                          className="rounded-xl p-6 text-center"
                          style={{ border: '2px dashed var(--admin-accent)', background: 'rgba(243,213,109,0.04)' }}
                        >
                          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--admin-accent)', borderTopColor: 'transparent' }} />
                          <p className="text-sm font-bold" style={{ color: 'var(--admin-accent)' }}>
                            מעלה {uploadingSections[section.id]} קבצים...
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--admin-text-muted)' }}>
                            הקבצים עוברים דחיסה ואופטימיזציה
                          </p>
                        </div>
                      ) : (
                        <label
                          className="block rounded-xl p-6 text-center cursor-pointer transition-all duration-200"
                          style={{ border: '2px dashed var(--admin-border)', background: 'var(--admin-bg)' }}
                          onDragOver={e => {
                            e.preventDefault()
                            e.currentTarget.style.borderColor = 'var(--admin-accent)'
                            e.currentTarget.style.background = 'rgba(243,213,109,0.04)'
                          }}
                          onDragLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--admin-border)'
                            e.currentTarget.style.background = 'var(--admin-bg)'
                          }}
                          onDrop={e => {
                            e.preventDefault()
                            e.currentTarget.style.borderColor = 'var(--admin-border)'
                            e.currentTarget.style.background = 'var(--admin-bg)'
                            if (e.dataTransfer.files.length) {
                              handleAssetUpload(section.id, e.dataTransfer.files)
                            }
                          }}
                        >
                          <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--admin-text-muted)' }} />
                          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                            גררו קבצים לכאן או לחצו לבחירה
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={e => {
                              if (e.target.files?.length) {
                                handleAssetUpload(section.id, e.target.files)
                              }
                            }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addSection}
          className="flex items-center gap-2 mt-4 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200"
          style={{ color: 'var(--admin-accent)', border: '1px dashed var(--admin-border)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--admin-accent)'; e.currentTarget.style.background = 'var(--admin-bg-elevated)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.background = 'transparent' }}
        >
          <Plus className="w-4 h-4" />
          הוסף סקציה
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--admin-danger)' }}>{error}</p>
      )}

      {/* Footer Actions */}
      <div className="flex items-center gap-3 pt-4 pb-8" style={{ borderTop: '1px solid var(--admin-border)' }}>
        <button
          onClick={() => saveCampaign('draft')}
          disabled={saving}
          className="px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}
        >
          {saving ? 'שומר...' : 'שמור טיוטה'}
        </button>
        <button
          onClick={() => saveCampaign('published')}
          disabled={saving}
          className="px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
        >
          {saving ? 'שומר...' : 'פרסום וקבלת לינק'}
        </button>
      </div>
    </div>
  )
}
