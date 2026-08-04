'use client'

import { useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import type { SplitMediaSection } from '@/lib/strategy/types'
import { Field, TextInput, TextArea } from './controls'
import { useImageUpload } from './useImageUpload'
import type { FieldProps } from './index'

export default function SplitMediaFields({ section, onChange, ensureDoc }: FieldProps<SplitMediaSection>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error } = useImageUpload(ensureDoc)

  const pick = async (file?: File) => {
    if (!file) return
    const result = await upload(file)
    if (result) onChange({ image: { file_path: result.file_path, alt: section.boxTitle || section.title } })
  }

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>

      <Field label="צד התמונה">
        <select
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          value={section.mediaSide}
          onChange={e => onChange({ mediaSide: e.target.value })}
        >
          <option value="start">ימין</option>
          <option value="end">שמאל</option>
        </select>
      </Field>

      <Field label="תמונה">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
        <div className="flex items-center gap-2">
          {section.image?.file_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetProxyUrl(section.image.file_path)} alt="" className="w-12 h-12 rounded-lg object-cover" style={{ border: '1px solid var(--admin-border)' }} />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 px-3 py-2 rounded-lg text-sm inline-flex items-center justify-center gap-2"
            style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {section.image?.file_path ? 'החלפת תמונה' : 'העלאת תמונה'}
          </button>
        </div>
        {error && <span className="block text-xs mt-1" style={{ color: '#ef4444' }}>{error}</span>}
      </Field>

      <Field label="כותרת הטקסט">
        <TextInput value={section.boxTitle} onChange={v => onChange({ boxTitle: v })} />
      </Field>
      <Field label="תיאור">
        <TextArea value={section.boxDescription} rows={5} onChange={v => onChange({ boxDescription: v })} />
      </Field>
    </>
  )
}
