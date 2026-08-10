'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import { compressImageClient, isImageFile } from '@/lib/image-compress'
import { normalizeProfile, type ProfileBlock } from '@/lib/launch-stats'
import { useT } from '@/lib/i18n'

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-hover-bg)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
  colorScheme: 'var(--color-scheme)',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
      {children}
    </label>
  )
}

/** Declared at module scope, not inside the panel: a component created during
 *  render is a fresh type every pass, so React remounts it and the file input
 *  loses its ref between renders. */
function ImageSlot({
  label, hint, removeLabel, path, maxHeight, inputRef, busy, onPick, onClear,
}: {
  label: string
  hint: string
  removeLabel: string
  path?: string
  maxHeight: number
  inputRef: React.RefObject<HTMLInputElement | null>
  busy: boolean
  onPick: (file: File) => void
  onClear: () => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }}
      />
      {path ? (
        <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetProxyUrl(path)} alt="" className="w-full object-cover" style={{ maxHeight }} />
          <button
            type="button" onClick={onClear}
            className="absolute top-1.5 left-1.5 p-1 rounded-md"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
            aria-label={removeLabel}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
          style={{ color: 'var(--admin-text-secondary)', background: 'var(--admin-hover-bg)', border: '1px dashed var(--admin-border)' }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {hint}
        </button>
      )}
    </div>
  )
}

/**
 * Inspector panel for the Facebook page / YouTube channel cover mockups.
 *
 * The two images upload through the campaign's own assets endpoint, the same
 * one the creative grid uses, so they land in the same storage folder and are
 * cleaned up with the campaign. Uploading needs a campaign id, so the panel
 * says so plainly rather than failing on click when the campaign is still an
 * unsaved draft.
 */
export default function ProfileFields({
  profile,
  campaignId,
  onChange,
}: {
  profile?: ProfileBlock | null
  campaignId: string | null
  onChange: (profile: ProfileBlock) => void
}) {
  const t = useT()
  const p = normalizeProfile(profile)
  const [busy, setBusy] = useState<'cover' | 'avatar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const patch = (next: Partial<ProfileBlock>) => onChange({ ...p, ...next })

  async function upload(slot: 'cover' | 'avatar', file: File) {
    if (!campaignId) { setError(t('campaigns.profile.saveFirst')); return }
    if (!isImageFile(file)) { setError(t('campaigns.profile.imagesOnly')); return }
    setBusy(slot); setError(null)
    try {
      // Same client-side compression the creative grid uses — the endpoint caps
      // at 50 MB and a phone photo can exceed it before compression.
      const { blob, filename } = await compressImageClient(file)
      const fd = new FormData()
      fd.append('file', blob, filename)
      const res = await fetch(`/api/campaigns/${campaignId}/assets`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'upload failed')
      const { file_path } = await res.json()
      patch(slot === 'cover' ? { coverPath: file_path } : { avatarPath: file_path })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('campaigns.profile.uploadError'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {!campaignId && (
        <p className="text-[11px] leading-relaxed px-2.5 py-2 rounded-lg" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          {t('campaigns.profile.saveFirst')}
        </p>
      )}

      <ImageSlot
        label={t('campaigns.profile.cover')} hint={t('campaigns.profile.coverHint')}
        removeLabel={t('campaigns.profile.remove')} path={p.coverPath} maxHeight={110}
        inputRef={coverRef} busy={busy === 'cover'}
        onPick={file => upload('cover', file)} onClear={() => patch({ coverPath: '' })}
      />
      <ImageSlot
        label={t('campaigns.profile.avatar')} hint={t('campaigns.profile.avatarHint')}
        removeLabel={t('campaigns.profile.remove')} path={p.avatarPath} maxHeight={96}
        inputRef={avatarRef} busy={busy === 'avatar'}
        onPick={file => upload('avatar', file)} onClear={() => patch({ avatarPath: '' })}
      />

      <div>
        <Label>{t('campaigns.profile.name')}</Label>
        <input
          type="text" value={p.name} dir="auto" placeholder={t('campaigns.profile.namePlaceholder')}
          onChange={e => patch({ name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
        />
      </div>

      <div>
        <Label>{t('campaigns.profile.handle')}</Label>
        <input
          type="text" value={p.handle ?? ''} dir="auto" placeholder="@medera"
          onChange={e => patch({ handle: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
        />
      </div>

      <div>
        <Label>{t('campaigns.profile.meta')}</Label>
        <input
          type="text" value={p.meta ?? ''} dir="auto" placeholder={t('campaigns.profile.metaPlaceholder')}
          onChange={e => patch({ meta: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
        />
      </div>

      <div>
        <Label>{t('campaigns.profile.bio')}</Label>
        <textarea
          value={p.bio ?? ''} dir="auto" rows={2} placeholder={t('campaigns.profile.bioPlaceholder')}
          onChange={e => patch({ bio: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={fieldStyle}
        />
      </div>

      {error && <p className="text-[11px]" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
