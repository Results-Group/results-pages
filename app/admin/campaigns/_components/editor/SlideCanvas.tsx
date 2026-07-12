'use client'

import { useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Upload, Trash2, GripVertical, Link2, RefreshCw, LayoutTemplate, ImageIcon } from 'lucide-react'
import CanvasAsset from './CanvasAsset'
import type { EditorAsset, EditorSection } from './types'
import { isImageFile, MAX_FILE_BYTES, MAX_FILE_MB } from '@/lib/image-compress'

interface UploadProgress {
  total: number
  done: number
  failed: number
}

interface CanvasProps {
  section: EditorSection | null
  clientName: string
  clientLogoUrl: string | null
  device: 'desktop' | 'mobile'
  uploading: number
  uploadProgress?: UploadProgress
  copies: string[]
  activeCopyIdx: number
  onActiveCopyChange: (idx: number) => void
  onUpdateSection: (patch: Partial<EditorSection>) => void
  onUpdateAsset: (assetId: string, patch: Partial<EditorAsset>) => void
  onRemoveAsset: (assetId: string) => void
  onMoveAsset: (from: number, to: number) => void
  onUploadFiles: (files: FileList | File[]) => void
  onReplaceAsset: (assetId: string, file: File) => void
  onAddVideo: () => void
}

function SortableAssetCard({ asset, section, clientName, clientLogoUrl, captionOverride, onUpdateAsset, onRemoveAsset, onReplaceAsset }: {
  asset: EditorAsset
  section: EditorSection
  clientName: string
  clientLogoUrl: string | null
  captionOverride?: string
  onUpdateAsset: (assetId: string, patch: Partial<EditorAsset>) => void
  onRemoveAsset: (assetId: string) => void
  onReplaceAsset: (assetId: string, file: File) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id })
  const replaceRef = useRef<HTMLInputElement>(null)
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Hover overlay controls */}
      <div className="absolute top-2 left-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <button type="button" {...attributes} {...listeners}
          className="p-1.5 rounded-lg cursor-grab active:cursor-grabbing touch-none backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="גרור">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => replaceRef.current?.click()}
          className="p-1.5 rounded-lg backdrop-blur-sm transition-colors"
          style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="החלף תמונה">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onRemoveAsset(asset.id)}
          className="p-1.5 rounded-lg backdrop-blur-sm transition-colors"
          style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} aria-label="מחק">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <input ref={replaceRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) onReplaceAsset(asset.id, e.target.files[0]); e.target.value = '' }} />
      </div>

      {/* Asset card wrapper */}
      <div className="rounded-xl overflow-hidden transition-all duration-300" style={{ border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
        <CanvasAsset asset={asset} mockupType={section.mockup_type} clientName={clientName} clientLogoUrl={clientLogoUrl} captionOverride={captionOverride} />
      </div>

      {section.mockup_type !== 'instagram_story' && (
        <input
          type="text"
          value={asset.caption}
          onChange={e => onUpdateAsset(asset.id, { caption: e.target.value })}
          placeholder="הוסף כיתוב..."
          dir="auto"
          className="w-full mt-2.5 px-3 py-2 rounded-lg text-xs outline-none transition-all duration-200"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
        />
      )}
    </div>
  )
}

export default function SlideCanvas({
  section, clientName, clientLogoUrl, device, uploading, uploadProgress,
  copies, activeCopyIdx, onActiveCopyChange,
  onUpdateSection, onUpdateAsset, onRemoveAsset, onMoveAsset, onUploadFiles, onReplaceAsset, onAddVideo,
}: CanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: '#050505' }}>
        <div className="relative p-10 rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div className="absolute top-0 right-0 w-8 h-8" style={{ borderTop: '2px solid rgba(64,225,211,0.2)', borderRight: '2px solid rgba(64,225,211,0.2)' }} />
          <div className="absolute bottom-0 left-0 w-8 h-8" style={{ borderBottom: '2px solid rgba(64,225,211,0.1)', borderLeft: '2px solid rgba(64,225,211,0.1)' }} />
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>בחר שקף מהרשימה או הוסף שקף חדש</p>
        </div>
      </div>
    )
  }

  const isDivider = section.mockup_type === 'divider'
  const isVideo = section.mockup_type === 'video'
  const isStory = section.mockup_type === 'instagram_story'
  const maxWidth = device === 'mobile' ? 420 : 960
  const hasCopies = section.useCopies && copies.length > 0
  const activeCopy = hasCopies ? (copies[activeCopyIdx] ?? copies[0] ?? '') : undefined

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !section) return
    const from = section.assets.findIndex(a => a.id === active.id)
    const to = section.assets.findIndex(a => a.id === over.id)
    if (from >= 0 && to >= 0) onMoveAsset(from, to)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(isImageFile)
    if (files.length) onUploadFiles(files)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) onUploadFiles(e.target.files)
    e.target.value = ''
  }

  const settled = uploadProgress ? uploadProgress.done + uploadProgress.failed : 0
  const total = uploadProgress?.total ?? 0
  const isUploading = uploading > 0
  const progressPct = total > 0 ? Math.round((settled / total) * 100) : 0
  const MAX_ASSETS = 4
  const atLimit = section.assets.length >= MAX_ASSETS

  return (
    <div className="h-full overflow-auto" style={{ background: '#050505' }}>
      <div className="mx-auto px-6 py-8 transition-all duration-300" style={{ maxWidth }}>
        {/* Inline-editable title */}
        <input
          type="text"
          value={section.title}
          onChange={e => onUpdateSection({ title: e.target.value })}
          placeholder="כותרת השקף"
          dir="auto"
          className="w-full bg-transparent outline-none text-2xl font-black mb-2 transition-colors"
          style={{ color: '#fff' }}
          onFocus={e => { e.currentTarget.style.color = '#40e1d3' }}
          onBlur={e => { e.currentTarget.style.color = '#fff' }}
        />

        {/* Accent underline */}
        <div className="w-12 h-0.5 rounded-full mb-4" style={{ background: '#40e1d3', opacity: 0.6 }} />

        {/* Inline-editable copy */}
        <textarea
          value={section.description}
          onChange={e => onUpdateSection({ description: e.target.value })}
          placeholder={isDivider ? 'טקסט שיופיע על שקף הביניים...' : 'תיאור קצר על השקף (לא חובה)...'}
          rows={2}
          dir="auto"
          className="w-full bg-transparent outline-none text-sm mb-8 resize-none leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        />

        {/* Copy version switcher + preview */}
        {hasCopies && activeCopy !== undefined && (
          <div className="rounded-xl px-4 py-3 mb-6" style={{ background: 'rgba(64,225,211,0.04)', border: '1px solid rgba(64,225,211,0.12)' }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(64,225,211,0.6)' }}>קופי פעיל</span>
              <div className="flex gap-1">
                {copies.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onActiveCopyChange(i)}
                    className="w-6 h-6 rounded-md text-[11px] font-bold transition-all duration-200"
                    style={activeCopyIdx === i
                      ? { background: '#40e1d3', color: '#050505' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm leading-relaxed" dir="auto" style={{ color: 'rgba(255,255,255,0.7)' }}>{activeCopy}</p>
          </div>
        )}

        {isDivider ? (
          <div className="relative rounded-2xl py-20 text-center" style={{ border: '1px dashed rgba(64,225,211,0.2)', background: 'rgba(64,225,211,0.02)' }}>
            <div className="absolute top-0 right-0 w-12 h-12" style={{ borderTop: '2px solid rgba(64,225,211,0.2)', borderRight: '2px solid rgba(64,225,211,0.2)' }} />
            <div className="absolute bottom-0 left-0 w-12 h-12" style={{ borderBottom: '2px solid rgba(64,225,211,0.1)', borderLeft: '2px solid rgba(64,225,211,0.1)' }} />
            <LayoutTemplate className="w-8 h-8 mx-auto mb-3" style={{ color: '#40e1d3' }} />
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>שקף ביניים — מציג כותרת וטקסט בלבד</p>
          </div>
        ) : isVideo ? (
          <div className="space-y-4">
            {section.assets.map(asset => (
              <div key={asset.id} className="rounded-xl p-4 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input type="url" value={asset.url} onChange={e => onUpdateAsset(asset.id, { url: e.target.value })}
                      placeholder="קישור לסרטון (YouTube, Vimeo...)" dir="ltr"
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={videoFieldStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    />
                    <input type="text" value={asset.caption} onChange={e => onUpdateAsset(asset.id, { caption: e.target.value })}
                      placeholder="כיתוב" dir="auto"
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={videoFieldStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  <button onClick={() => onRemoveAsset(asset.id)} className="p-2 rounded-lg transition-colors"
                    style={{ color: 'rgba(239,68,68,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'transparent' }}
                    aria-label="הסר נכס">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {asset.url && (
                  <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <CanvasAsset asset={asset} mockupType="video" clientName={clientName} clientLogoUrl={clientLogoUrl} captionOverride={activeCopy} />
                  </div>
                )}
              </div>
            ))}
            <button onClick={onAddVideo} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200"
              style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.25)', background: 'rgba(64,225,211,0.03)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.03)' }}>
              <Link2 className="w-4 h-4" /> הוסף לינק לסרטון
            </button>
          </div>
        ) : (
          <>
            {section.assets.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={section.assets.map(a => a.id)} strategy={rectSortingStrategy}>
                  <div className={isStory ? 'grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6' : 'grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6'}>
                    {section.assets.map(asset => (
                      <SortableAssetCard
                        key={asset.id}
                        asset={asset}
                        section={section}
                        clientName={clientName}
                        clientLogoUrl={clientLogoUrl}
                        captionOverride={activeCopy}
                        onUpdateAsset={onUpdateAsset}
                        onRemoveAsset={onRemoveAsset}
                        onReplaceAsset={onReplaceAsset}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Upload progress banner — shown while uploading, above the drop zone */}
            {isUploading && (
              <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(64,225,211,0.06)', border: '1px solid rgba(64,225,211,0.15)' }}>
                <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0" style={{ borderColor: 'rgba(64,225,211,0.25)', borderTopColor: '#40e1d3' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold" style={{ color: '#40e1d3' }}>
                      מעלה {settled}/{total} תמונות...
                    </span>
                    {uploadProgress?.failed ? (
                      <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>{uploadProgress.failed} נכשלו</span>
                    ) : null}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #40e1d3, #22c55e)' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Drop zone / at-limit indicator */}
            {atLimit ? (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ border: '2px dashed rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span className="text-sm font-black" style={{ color: '#ef4444' }}>4</span>
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>הגעת למגבלת 4 תמונות לשקף</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.18)' }}>הוסף שקף חדש כדי להוסיף תמונות נוספות</p>
                </div>
              </div>
            ) : (
              <label
                className="relative block rounded-2xl cursor-pointer transition-all duration-300"
                style={{
                  padding: section.assets.length === 0 ? '3rem 2rem' : '1.25rem 1.5rem',
                  border: isDragOver
                    ? '2px dashed rgba(64,225,211,0.6)'
                    : '2px dashed rgba(255,255,255,0.07)',
                  background: isDragOver ? 'rgba(64,225,211,0.06)' : 'rgba(255,255,255,0.01)',
                }}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="absolute top-0 right-0 w-8 h-8" style={{ borderTop: `2px solid ${isDragOver ? 'rgba(64,225,211,0.4)' : 'rgba(64,225,211,0.12)'}`, borderRight: `2px solid ${isDragOver ? 'rgba(64,225,211,0.4)' : 'rgba(64,225,211,0.12)'}` }} />
                <div className="absolute bottom-0 left-0 w-8 h-8" style={{ borderBottom: `2px solid ${isDragOver ? 'rgba(64,225,211,0.3)' : 'rgba(64,225,211,0.06)'}`, borderLeft: `2px solid ${isDragOver ? 'rgba(64,225,211,0.3)' : 'rgba(64,225,211,0.06)'}` }} />

                {/* Asset count badge */}
                {section.assets.length > 0 && (
                  <div className="absolute top-2 right-10 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                    {section.assets.length}/{MAX_ASSETS}
                  </div>
                )}

                {section.assets.length === 0 ? (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Upload className="w-5 h-5" style={{ color: isDragOver ? '#40e1d3' : 'rgba(255,255,255,0.25)' }} />
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: isDragOver ? '#40e1d3' : 'rgba(255,255,255,0.35)' }}>
                      {isDragOver ? 'שחרר להעלאה' : 'גררו תמונות לכאן או לחצו לבחירה'}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
                      PNG, JPG, WebP, HEIC — עד {MAX_FILE_MB} MB לקובץ · עד {MAX_ASSETS} תמונות לשקף
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <ImageIcon className="w-4 h-4" style={{ color: isDragOver ? '#40e1d3' : 'rgba(255,255,255,0.25)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: isDragOver ? '#40e1d3' : 'rgba(255,255,255,0.35)' }}>
                        {isDragOver ? 'שחרר להוסיף' : `הוסף עוד תמונות (${MAX_ASSETS - section.assets.length} נותרו)`}
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>גרור או לחץ לבחירה</p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const videoFieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.85)',
}
