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
      <div className="absolute top-2 left-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" {...attributes} {...listeners}
          className="p-1.5 rounded-lg cursor-grab active:cursor-grabbing touch-none"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }} aria-label="גרור">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => replaceRef.current?.click()}
          className="p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }} aria-label="החלף תמונה">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onRemoveAsset(asset.id)}
          className="p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.7)', color: '#ef4444' }} aria-label="מחק">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <input ref={replaceRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) onReplaceAsset(asset.id, e.target.files[0]); e.target.value = '' }} />
      </div>

      <CanvasAsset asset={asset} mockupType={section.mockup_type} clientName={clientName} clientLogoUrl={clientLogoUrl} />

      {/* Story mockups never display captions */}
      {section.mockup_type !== 'instagram_story' && (
        <input
          type="text"
          value={asset.caption}
          onChange={e => onUpdateAsset(asset.id, { caption: e.target.value })}
          placeholder="הוסף כיתוב..."
          dir="auto"
          className="w-full mt-2 px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8eaed' }}
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
      <div className="flex items-center justify-center h-full text-sm" style={{ color: '#7a8288' }}>
        בחר שקף מהרשימה או הוסף שקף חדש כדי להתחיל
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
    <div className="h-full overflow-auto" style={{ background: '#0b0f10' }}>
      <div className="mx-auto px-6 py-8 transition-all duration-300" style={{ maxWidth }}>
        {/* Inline-editable title */}
        <input
          type="text"
          value={section.title}
          onChange={e => onUpdateSection({ title: e.target.value })}
          placeholder="כותרת השקף"
          dir="auto"
          className="w-full bg-transparent outline-none text-2xl font-bold mb-3"
          style={{ color: '#fff' }}
        />

        {/* Inline-editable copy */}
        <textarea
          value={section.description}
          onChange={e => onUpdateSection({ description: e.target.value })}
          placeholder={isDivider ? 'טקסט שיופיע על שקף הביניים...' : 'טקסט / קופי שיופיע מעל הקריאייטיבים...'}
          rows={2}
          dir="auto"
          className="w-full bg-transparent outline-none text-sm mb-6 resize-none leading-relaxed"
          style={{ color: '#a0aab0' }}
        />

        {isDivider ? (
          <div className="rounded-2xl py-16 text-center" style={{ border: '1px dashed rgba(255,255,255,0.15)' }}>
            <LayoutTemplate className="w-8 h-8 mx-auto mb-3" style={{ color: '#40e1d3' }} />
            <p className="text-sm" style={{ color: '#7a8288' }}>שקף ביניים — מציג כותרת וטקסט בלבד</p>
          </div>
        ) : isVideo ? (
          <div className="space-y-4">
            {section.assets.map(asset => (
              <div key={asset.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input type="url" value={asset.url} onChange={e => onUpdateAsset(asset.id, { url: e.target.value })}
                      placeholder="קישור לסרטון (YouTube, Vimeo...)" dir="ltr"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={videoFieldStyle} />
                    <input type="text" value={asset.caption} onChange={e => onUpdateAsset(asset.id, { caption: e.target.value })}
                      placeholder="כיתוב" dir="auto"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={videoFieldStyle} />
                  </div>
                  <button onClick={() => onRemoveAsset(asset.id)} className="p-2 rounded-lg" style={{ color: '#ef4444' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {asset.url && (
                  <div className="mt-3">
                    <CanvasAsset asset={asset} mockupType="video" clientName={clientName} clientLogoUrl={clientLogoUrl} />
                  </div>
                )}
              </div>
            ))}
            <button onClick={onAddVideo} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ color: '#40e1d3', border: '1px dashed rgba(255,255,255,0.15)' }}>
              <Link2 className="w-4 h-4" /> הוסף לינק לסרטון
            </button>
          </div>
        ) : (
          <>
            {section.assets.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={section.assets.map(a => a.id)} strategy={rectSortingStrategy}>
                  <div className={isStory ? 'grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5' : 'grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5'}>
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
              <div className="rounded-xl p-6 text-center" style={{ border: '2px dashed #40e1d3', background: 'rgba(64,225,211,0.05)' }}>
                <div className="w-7 h-7 border-2 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: '#40e1d3', borderTopColor: 'transparent' }} />
                <p className="text-sm" style={{ color: '#40e1d3' }}>מעלה {uploading} קבצים...</p>
              </div>
            ) : (
              <label className="block rounded-xl p-6 text-center cursor-pointer transition-all"
                style={{ border: '2px dashed rgba(255,255,255,0.15)' }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#40e1d3' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; if (e.dataTransfer.files.length) onUploadFiles(e.dataTransfer.files) }}>
                <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: '#7a8288' }} />
                <p className="text-sm" style={{ color: '#7a8288' }}>גררו תמונות לכאן או לחצו לבחירה</p>
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
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e8eaed',
}
