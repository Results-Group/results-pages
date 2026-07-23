'use client'

import { useState, useRef } from 'react'
import { LayoutGrid, Settings2, Upload, Lock, Trash2, Clock, Plus, X, Sparkles, Loader2, Check, Image as ImageIcon, CopyPlus } from 'lucide-react'
import ClientAutocomplete from '../../../_components/client-autocomplete'
import { MOCKUP_TYPES, newCopy, type CampaignMeta, type EditorSection, type MockupType } from './types'
import { useT, useDir } from '@/lib/i18n'

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-hover-bg)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
  // Keep native controls (dropdown, date picker) on the same scheme as the
  // admin theme, so the OS never paints e.g. a white popup under light text.
  colorScheme: 'var(--color-scheme)',
}

function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="w-1 h-1 rounded-full" style={{ background: '#40e1d3' }} />
      {label && <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: 'rgba(64,225,211,0.6)' }}>{label}</span>}
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(64,225,211,0.15), transparent)' }} />
    </div>
  )
}

export default function Inspector({
  section, meta, onUpdateSection, onUpdateMeta, onUploadLogo, uploadingLogo, passwordDirty, onPasswordDirty, onGenerateCopy, onApplyContentToAll, slug, onSlugChange,
}: {
  section: EditorSection | null
  meta: CampaignMeta
  onUpdateSection: (patch: Partial<EditorSection>) => void
  onUpdateMeta: (patch: Partial<CampaignMeta>) => void
  onUploadLogo: (file: File) => void
  uploadingLogo: boolean
  passwordDirty: boolean
  onPasswordDirty: (dirty: boolean) => void
  onGenerateCopy?: (section: EditorSection) => Promise<{ captions: string[]; titles: string[]; grounded: boolean } | null>
  onApplyContentToAll?: () => void
  slug?: string | null
  onSlugChange?: (slug: string) => void
}) {
  const [tab, setTab] = useState<'slide' | 'campaign'>('slide')
  const logoRef = useRef<HTMLInputElement>(null)
  const [copyLoading, setCopyLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<{ captions: string[]; titles: string[] } | null>(null)
  const [applyingLogo, setApplyingLogo] = useState(false)
  const t = useT()
  const dir = useDir()

  // Pull the client's saved logo into this campaign — no re-upload needed.
  async function useClientLogo() {
    if (!meta.clientId) return
    setApplyingLogo(true)
    try {
      const res = await fetch(`/api/clients/${meta.clientId}`)
      if (res.ok) {
        const client = await res.json()
        if (client?.logo_path) onUpdateMeta({ logoPath: client.logo_path, logoUrl: client.logo_url || null })
      }
    } catch { /* ignore */ } finally {
      setApplyingLogo(false)
    }
  }

  async function handleGenerateCopy() {
    if (!section || !onGenerateCopy) return
    setCopyLoading(true)
    const res = await onGenerateCopy(section)
    if (res) setSuggestions({ captions: res.captions, titles: res.titles })
    setCopyLoading(false)
  }

  const mockupLabels: Record<MockupType, string> = {
    instagram_feed: t('campaigns.mockup.instagram_feed'),
    instagram_story: t('campaigns.mockup.instagram_story'),
    facebook_feed: t('campaigns.mockup.facebook_feed'),
    carousel: t('campaigns.mockup.carousel'),
    video: t('campaigns.mockup.video'),
    general: t('campaigns.mockup.general'),
    divider: t('campaigns.mockup.divider'),
  }

  return (
    // A <form autoComplete="off"> around the whole inspector tells the browser
    // "these fields are not for saved credentials". Chrome/Safari respect this
    // for text inputs (they only ignore autocomplete="off" on password fields,
    // which is why the password field also has decoys + autoComplete="new-password").
    // onSubmit={preventDefault} keeps Enter inside a text field from posting
    // the "form" since we have no server target — the editor autosaves.
    <form
      autoComplete="off"
      onSubmit={e => e.preventDefault()}
      className="flex flex-col h-full"
    >
      {/* Tabs */}
      <div className="flex gap-0.5 p-0.5 rounded-lg mb-5" style={{ background: 'var(--admin-hover-bg)' }}>
        <button
          onClick={() => setTab('slide')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-bold transition-all duration-200"
          style={tab === 'slide'
            ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3' }
            : { color: 'var(--admin-text-muted)' }
          }
        >
          <Settings2 className="w-3.5 h-3.5" /> {t('campaigns.tabSlide')}
        </button>
        <button
          onClick={() => setTab('campaign')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-bold transition-all duration-200"
          style={tab === 'campaign'
            ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3' }
            : { color: 'var(--admin-text-muted)' }
          }
        >
          <LayoutGrid className="w-3.5 h-3.5" /> {t('campaigns.tabCampaign')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5">
        {tab === 'slide' ? (
          section ? (
            <>
              <SectionDivider label={t('campaigns.displaySection')} />
              <div>
                <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.displayType')}</label>
                <select
                  value={section.mockup_type}
                  onChange={e => onUpdateSection({ mockup_type: e.target.value as MockupType })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer transition-all duration-200"
                  style={fieldStyle}
                >
                  {(Object.keys(MOCKUP_TYPES) as MockupType[]).map(val => (
                    <option key={val} value={val}>{mockupLabels[val]}</option>
                  ))}
                </select>
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
                  {t('campaigns.displayHint')}
                </p>
              </div>

              <SectionDivider label={t('campaigns.contentSection')} />
              <div>
                <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.slideTitle')}</label>
                <input
                  type="text" value={section.title} onChange={e => onUpdateSection({ title: e.target.value })}
                  placeholder={t('campaigns.slideTitlePlaceholder')} dir="auto"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.slideDescription')}</label>
                <textarea
                  value={section.description} onChange={e => onUpdateSection({ description: e.target.value })}
                  rows={3} placeholder={t('campaigns.slideDescriptionPlaceholder')} dir="auto"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none transition-all duration-200" style={fieldStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
                />
                {onApplyContentToAll && (section.title.trim() || section.description.trim()) && (
                  <button
                    type="button"
                    onClick={onApplyContentToAll}
                    className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                    style={{ color: 'var(--admin-text-secondary)', background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}
                    title={t('campaigns.applyContentToAllHint')}
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                    {t('campaigns.applyContentToAll')}
                  </button>
                )}
              </div>

              {/* AI copy generation */}
              {onGenerateCopy && (
                <div>
                  <button
                    type="button"
                    onClick={handleGenerateCopy}
                    disabled={copyLoading}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-50"
                    style={{ color: '#04211d', background: '#40e1d3' }}
                  >
                    {copyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {copyLoading ? t('campaigns.generatingCopy') : t('campaigns.generateCopy')}
                  </button>

                  {suggestions && (suggestions.titles.length > 0 || suggestions.captions.length > 0) && (
                    <div className="mt-3 rounded-lg p-3 space-y-3" style={{ background: 'rgba(64,225,211,0.04)', border: '1px solid rgba(64,225,211,0.15)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(64,225,211,0.7)' }}>{t('campaigns.aiSuggestions')}</span>
                        <button type="button" onClick={() => setSuggestions(null)} className="p-0.5 rounded" style={{ color: 'var(--admin-text-muted)' }} aria-label={t('campaigns.dismissSuggestions')}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {suggestions.titles.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.suggestedTitles')}</span>
                          {suggestions.titles.map((s, i) => (
                            <button
                              key={i} type="button" dir="auto"
                              onClick={() => onUpdateSection({ title: s })}
                              title={t('campaigns.applyTitle')}
                              className="flex items-center gap-2 w-full text-right px-2.5 py-1.5 rounded-md text-xs transition-colors"
                              style={{ background: 'var(--admin-hover-bg)', color: 'var(--admin-text-secondary)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--admin-hover-bg)' }}
                            >
                              <Check className="w-3 h-3 shrink-0" style={{ color: '#40e1d3' }} />
                              <span className="flex-1 min-w-0">{s}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {suggestions.captions.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.suggestedCaptions')}</span>
                          {suggestions.captions.map((s, i) => (
                            <button
                              key={i} type="button" dir="auto"
                              onClick={() => onUpdateSection({ description: s })}
                              title={t('campaigns.applyCaption')}
                              className="flex items-start gap-2 w-full text-right px-2.5 py-1.5 rounded-md text-xs leading-relaxed transition-colors"
                              style={{ background: 'var(--admin-hover-bg)', color: 'var(--admin-text-secondary)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--admin-hover-bg)' }}
                            >
                              <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#40e1d3' }} />
                              <span className="flex-1 min-w-0">{s}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {meta.copies.length > 0 ? (
                <>
                  <SectionDivider label={t('campaigns.copySection')} />
                  {(() => {
                    const selected = new Set(section.copyIds ?? [])
                    const allSelected = meta.copies.every(c => selected.has(c.id))
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
                            {selected.size} / {meta.copies.length} {t('campaigns.copyVersionsCount')}
                          </p>
                          <button
                            type="button"
                            onClick={() => onUpdateSection({
                              copyIds: allSelected ? [] : meta.copies.map(c => c.id),
                            })}
                            className="text-[10px] font-bold transition-colors"
                            style={{ color: '#40e1d3' }}
                          >
                            {allSelected ? t('campaigns.copySelectNone') : t('campaigns.copySelectAll')}
                          </button>
                        </div>
                        {meta.copies.map((copy, idx) => {
                          const checked = selected.has(copy.id)
                          const preview = copy.body.trim().slice(0, 60)
                          const heading = copy.label.trim() || `${t('campaigns.versionLabel')} ${idx + 1}`
                          return (
                            <button
                              key={copy.id}
                              type="button"
                              onClick={() => {
                                const next = new Set(selected)
                                if (checked) next.delete(copy.id); else next.add(copy.id)
                                // Preserve the campaign-copies order so tab
                                // order in the presentation stays stable.
                                onUpdateSection({ copyIds: meta.copies.filter(c => next.has(c.id)).map(c => c.id) })
                              }}
                              className={`flex items-start gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                              style={{
                                background: checked ? 'rgba(64,225,211,0.08)' : 'var(--admin-hover-bg)',
                                border: `1px solid ${checked ? 'rgba(64,225,211,0.3)' : 'var(--admin-border)'}`,
                              }}
                            >
                              <span
                                className="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all duration-200"
                                style={{
                                  background: checked ? '#40e1d3' : 'transparent',
                                  border: `1.5px solid ${checked ? '#40e1d3' : 'var(--admin-border)'}`,
                                }}
                              >
                                {checked && <Check className="w-3 h-3" style={{ color: '#04211d' }} strokeWidth={3} />}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold" style={{ color: checked ? '#40e1d3' : 'var(--admin-text-secondary)' }}>{heading}</p>
                                {preview && (
                                  <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--admin-text-muted)' }} dir="auto">{preview}{copy.body.trim().length > 60 && '…'}</p>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </>
              ) : (
                <p className="text-[10px] leading-relaxed px-1" style={{ color: 'var(--admin-text-muted)' }}>
                  {t('campaigns.copyHintEmpty')}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs font-semibold" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.noSlideSelected')}</p>
            </div>
          )
        ) : (
          <>
            <SectionDivider label={t('campaigns.campaignDetails')} />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.client')}</label>
              <ClientAutocomplete
                value={meta.client}
                workspaceId={meta.workspaceId}
                onChange={val => onUpdateMeta({ client: val })}
                onClientChange={(name, clientId) => onUpdateMeta({ client: name, clientId })}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.campaignName')}</label>
              <input
                type="text" value={meta.campaignName} onChange={e => onUpdateMeta({ campaignName: e.target.value })}
                placeholder={t('campaigns.campaignNamePlaceholder')} dir="auto"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.concept')}</label>
              <textarea
                value={meta.concept} onChange={e => onUpdateMeta({ concept: e.target.value })}
                rows={3} placeholder={t('campaigns.conceptPlaceholder')} dir="auto"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
              />
            </div>

            <SectionDivider label={t('campaigns.copyVariationsSection')} />
            <div className="space-y-2.5">
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
                {t('campaigns.copyVariationsHint')}
              </p>
              {meta.copies.map((copy, idx) => (
                <div key={copy.id}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(64,225,211,0.6)' }}>{t('campaigns.versionLabel')} {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateMeta({
                        copies: meta.copies.filter((_, i) => i !== idx),
                      })}
                      className="p-0.5 rounded transition-colors ml-auto"
                      style={{ color: 'var(--admin-text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                      aria-label={`${t('campaigns.versionLabel')} ${idx + 1} — הסר`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={copy.label}
                    onChange={e => onUpdateMeta({
                      copies: meta.copies.map((c, i) => i === idx ? { ...c, label: e.target.value } : c),
                    })}
                    placeholder={t('campaigns.copyLabelPlaceholder')}
                    dir="auto"
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-1.5 transition-all duration-200"
                    style={fieldStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
                  />
                  <textarea
                    value={copy.body}
                    onChange={e => onUpdateMeta({
                      copies: meta.copies.map((c, i) => i === idx ? { ...c, body: e.target.value } : c),
                    })}
                    rows={3}
                    placeholder={`${t('campaigns.versionPlaceholder')} ${idx + 1}...`}
                    dir="auto"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none transition-all duration-200"
                    style={fieldStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdateMeta({ copies: [...meta.copies, newCopy()] })}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200"
                style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.2)', background: 'rgba(64,225,211,0.03)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.03)' }}
              >
                <Plus className="w-3.5 h-3.5" /> {t('campaigns.addCopyVersion')}
              </button>
            </div>

            <SectionDivider label={t('campaigns.brandingSection')} />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.clientLogo')}</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                  style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
                  {meta.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meta.logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Upload className="w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
                  )}
                </div>
                <button
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex-1 px-3 py-2.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all duration-200"
                  style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
                >
                  {uploadingLogo ? t('campaigns.uploading') : meta.logoUrl ? t('campaigns.replaceLogo') : t('campaigns.uploadLogo')}
                </button>
                {meta.logoUrl && (
                  <button onClick={() => onUpdateMeta({ logoPath: null, logoUrl: null })} className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--admin-text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                    aria-label={t('campaigns.deleteLogo')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) onUploadLogo(e.target.files[0]) }} />
              </div>
              {meta.clientId && (
                <button
                  onClick={useClientLogo}
                  disabled={applyingLogo}
                  className="flex items-center justify-center gap-1.5 w-full mt-2 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-40"
                  style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.25)', background: 'rgba(64,225,211,0.03)' }}
                >
                  {applyingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  {t('campaigns.useClientLogo')}
                </button>
              )}
              <p className="text-[10px] mt-2" style={{ color: 'var(--admin-text-muted)' }}>
                {t('campaigns.logoFallbackHint')}
              </p>
            </div>

            <SectionDivider label={t('campaigns.securitySection')} />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 flex items-center gap-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                <Lock className="w-3.5 h-3.5" /> {t('common.password')}
              </label>
              {/* Trap Chrome/Safari's "this looks like a login form" heuristic.
                  The browser fills the FIRST username-shaped field it finds and
                  offers to save the password once you type; hidden decoys
                  before the real password absorb the autofill and the prompt. */}
              <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
              <input type="password" name="fake-password" autoComplete="new-password" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
              <input
                type="password" value={meta.password}
                // "new-password" tells Chrome this is a set-password field, so
                // it stops autofilling saved credentials and stops prompting
                // to save on every keystroke. Plain "off" is ignored on
                // password inputs.
                autoComplete="new-password"
                onChange={e => { onPasswordDirty(true); onUpdateMeta({ password: e.target.value }) }}
                placeholder={meta.hasPassword && !passwordDirty ? '••••••••' : t('campaigns.passwordPlaceholderEmpty')} dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
              />
              {meta.hasPassword && !passwordDirty && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-bold" style={{ color: '#40e1d3' }}>{t('campaigns.passwordSet')}</span>
                  <button
                    type="button"
                    onClick={() => { onPasswordDirty(true); onUpdateMeta({ password: '', hasPassword: false }) }}
                    className="text-[10px] font-bold transition-colors"
                    style={{ color: 'rgba(239,68,68,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)' }}
                  >
                    {t('campaigns.removePassword')}
                  </button>
                </div>
              )}
            </div>

            {onSlugChange && (
              <>
                <SectionDivider label={t('campaigns.urlSection')} />
                <div>
                  <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                    {t('campaigns.urlLabel')}
                  </label>
                  <input
                    type="text"
                    value={slug || ''}
                    // The slug is the public link, so keep it to URL-safe
                    // characters as the user types; the server slugifies and
                    // enforces uniqueness on save.
                    onChange={e => onSlugChange(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                    placeholder="relax-petah-tikva"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
                  />
                  {slug && (
                    <p className="text-[10px] mt-2 break-all" dir="ltr" style={{ color: 'rgba(64,225,211,0.65)' }}>
                      /c/{slug}
                    </p>
                  )}
                  <p className="text-[10px] mt-1.5" style={{ color: 'var(--admin-text-muted)' }}>
                    {t('campaigns.urlHint')}
                  </p>
                </div>
              </>
            )}

            <SectionDivider label={t('campaigns.schedulingSection')} />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 flex items-center gap-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                <Clock className="w-3.5 h-3.5" /> {t('campaigns.publishSchedule')}
              </label>
              <input
                type="datetime-local"
                value={meta.publishAt || ''}
                onChange={e => onUpdateMeta({ publishAt: e.target.value || null })}
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
              />
              <p className="text-[10px] mt-2" style={{ color: 'var(--admin-text-muted)' }}>
                {t('campaigns.publishScheduleHint')}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1.5 flex items-center gap-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                <Clock className="w-3.5 h-3.5" /> {t('campaigns.expirySchedule')}
              </label>
              <input
                type="datetime-local"
                value={meta.expiresAt || ''}
                onChange={e => onUpdateMeta({ expiresAt: e.target.value || null })}
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
              />
              <p className="text-[10px] mt-2" style={{ color: 'var(--admin-text-muted)' }}>
                {t('campaigns.expiryScheduleHint')}
              </p>
            </div>
          </>
        )}
      </div>
    </form>
  )
}
