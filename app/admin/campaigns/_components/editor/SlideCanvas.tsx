'use client'

import { useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Upload, Trash2, GripVertical, Link2, RefreshCw, LayoutTemplate } from 'lucide-react'
import CanvasAsset from './CanvasAsset'
import type { EditorAsset, EditorSection } from './types'

interface CanvasProps {
  section: EditorSection | null
  clientName: string
  clientLogoUrl: string | null
  device: 'desktop' | 'mobile'
  uploading: number
  onUpdateSection: (patch: Partial<EditorSection>) => void
  onUpdateAsset: (assetId: string, patch: Partial<EditorAsset>) => void
  onRemoveAsset: (assetId: string) => void
  onMoveAsset: (from: number, to: number) => void
  onUploadFiles: (files: FileList | File[]) => void
  onReplaceAsset: (assetId: string, file: File) => void
  onAddVideo: () => void
}

function SortableAssetCard({ asset, section, clientName, clientLogoUrl, onUpdateAsset, onRemoveAsset, onReplaceAsset }: {
  asset: EditorAsset
  section: EditorSection
  clientName: string
  clientLogoUrl: string | null
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
        <CanvasAsset asset={asset} mockupType={section.mockup_type} clientName={clientName} clientLogoUrl={clientLogoUrl} />
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
  section, clientName, clientLogoUrl, device, uploading,
  onUpdateSection, onUpdateAsset, onRemoveAsset, onMoveAsset, onUploadFiles, onReplaceAsset, onAddVideo,
}: CanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !section) return
    const from = section.assets.findIndex(a => a.id === active.id)
    const to = section.assets.findIndex(a => a.id === over.id)
    if (from >= 0 && to >= 0) onMoveAsset(from, to)
  }

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
          placeholder={isDivider ? 'טקסט שיופיע על שקף הביניים...' : 'טקסט / קופי שיופיע מעל הקריאייטיבים...'}
          rows={2}
          dir="auto"
          className="w-full bg-transparent outline-none text-sm mb-8 resize-none leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        />

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
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {asset.url && (
                  <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <CanvasAsset asset={asset} mockupType="video" clientName={clientName} clientLogoUrl={clientLogoUrl} />
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
                        onUpdateAsset={onUpdateAsset}
                        onRemoveAsset={onRemoveAsset}
                        onReplaceAsset={onReplaceAsset}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {uploading > 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ border: '2px dashed rgba(64,225,211,0.4)', background: 'rgba(64,225,211,0.04)' }}>
                <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'rgba(64,225,211,0.3)', borderTopColor: '#40e1d3' }} />
                <p className="text-sm font-bold" style={{ color: '#40e1d3' }}>מעלה {uploading} קבצים...</p>
              </div>
            ) : (
              <label
                className="relative block rounded-2xl p-8 text-center cursor-pointer transition-all duration-300"
                style={{ border: '2px dashed rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)' }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(64,225,211,0.4)'; e.currentTarget.style.background = 'rgba(64,225,211,0.04)' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; if (e.dataTransfer.files.length) onUploadFiles(e.dataTransfer.files) }}
              >
                <div className="absolute top-0 right-0 w-10 h-10" style={{ borderTop: '2px solid rgba(64,225,211,0.15)', borderRight: '2px solid rgba(64,225,211,0.15)' }} />
                <div className="absolute bottom-0 left-0 w-10 h-10" style={{ borderBottom: '2px solid rgba(64,225,211,0.08)', borderLeft: '2px solid rgba(64,225,211,0.08)' }} />
                <Upload className="w-7 h-7 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
                <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>גררו תמונות לכאן או לחצו לבחירה</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>PNG, JPG, WebP</p>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { if (e.target.files?.length) onUploadFiles(e.target.files); e.target.value = '' }} />
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
