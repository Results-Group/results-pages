'use client'

import { useCallback, useRef, useState } from 'react'
import { X, UploadCloud, Sparkles, Image as ImageIcon, Film } from 'lucide-react'
import { isImageFile, MAX_FILE_BYTES } from '@/lib/image-compress'
import type { MockupType } from './types'

const MAX_ASSETS_PER_SLIDE = 4

/** Mockup types the employee can bulk-upload into (divider has no assets). */
const SMART_TYPES: { value: MockupType; label: string; icon: React.ReactNode }[] = [
  { value: 'instagram_feed', label: 'פיד אינסטגרם', icon: <ImageIcon className="w-4 h-4" /> },
  { value: 'instagram_story', label: 'סטוריז אינסטגרם', icon: <ImageIcon className="w-4 h-4" /> },
  { value: 'facebook_feed', label: 'פיד פייסבוק', icon: <ImageIcon className="w-4 h-4" /> },
  { value: 'general', label: 'כללי', icon: <ImageIcon className="w-4 h-4" /> },
  { value: 'video', label: 'סרטונים', icon: <Film className="w-4 h-4" /> },
]

export default function SmartUploadModal({ open, onClose, onConfirm }: {
  open: boolean
  onClose: () => void
  onConfirm: (files: File[], mockupType: MockupType) => void
}) {
  const [mockupType, setMockupType] = useState<MockupType>('instagram_feed')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid: File[] = []
    for (const f of Array.from(incoming)) {
      if (!isImageFile(f)) continue
      if (f.size > MAX_FILE_BYTES) continue
      valid.push(f)
    }
    setFiles(prev => [...prev, ...valid])
  }, [])

  const reset = useCallback(() => { setFiles([]); setDragOver(false) }, [])

  if (!open) return null

  const slideCount = Math.ceil(files.length / MAX_ASSETS_PER_SLIDE)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { onClose(); reset() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5"
        style={{ background: '#0c0e10', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: '#40e1d3' }} />
            <h3 className="text-base font-bold text-white">העלאה חכמה</h3>
          </div>
          <button onClick={() => { onClose(); reset() }} className="p-1 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }} aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          גרור את כל הקבצים בבת אחת — המערכת תסדר אותם אוטומטית ל-{MAX_ASSETS_PER_SLIDE} גרפיקות בכל שקף.
        </p>

        {/* Mockup type — chosen once for all created slides */}
        <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>סוג מוקאפ (חל על כל השקפים שייווצרו)</label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SMART_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setMockupType(t.value)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={mockupType === t.value
                ? { background: 'rgba(64,225,211,0.12)', border: '1px solid rgba(64,225,211,0.4)', color: '#40e1d3' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Dropzone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
          style={{
            border: `1.5px dashed ${dragOver ? 'rgba(64,225,211,0.6)' : 'rgba(255,255,255,0.14)'}`,
            background: dragOver ? 'rgba(64,225,211,0.06)' : 'rgba(255,255,255,0.02)',
          }}
        >
          <UploadCloud className="w-7 h-7" style={{ color: dragOver ? '#40e1d3' : 'rgba(255,255,255,0.4)' }} />
          <p className="text-xs font-semibold text-white">גרור קבצים לכאן או לחץ לבחירה</p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>ניתן לבחור הרבה קבצים יחד</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
              נבחרו <b style={{ color: '#40e1d3' }}>{files.length}</b> קבצים → ייווצרו <b style={{ color: '#40e1d3' }}>{slideCount}</b> שקפים
            </span>
            <button onClick={reset} className="underline" style={{ color: 'rgba(255,255,255,0.4)' }}>נקה</button>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => { onClose(); reset() }}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)' }}
          >
            ביטול
          </button>
          <button
            disabled={files.length === 0}
            onClick={() => { onConfirm(files, mockupType); onClose(); reset() }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: '#04211d', background: '#40e1d3' }}
          >
            <Sparkles className="w-4 h-4" /> צור {slideCount > 0 ? slideCount : ''} שקפים
          </button>
        </div>
      </div>
    </div>
  )
}
