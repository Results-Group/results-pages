'use client'

import { useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import type { PositioningMapSection } from '@/lib/strategy/types'
import { Field, TextInput, RepeaterCard, AddButton, uid, inputStyle } from './controls'
import { useImageUpload } from './useImageUpload'
import type { FieldProps } from './index'

/**
 * Axis labels, the competitor list and the highlight ring.
 *
 * Positions are dragged on the slide itself, but every coordinate also has a
 * numeric field here. That is both the precise route and the accessible one —
 * drag is a convenience layer over a form that works entirely by keyboard.
 * Values are shown as 0–100% because -1..1 means nothing to an operator.
 */

const toPct = (v: number) => Math.round(((v + 1) / 2) * 100)
const fromPct = (v: number) => Math.min(1, Math.max(-1, (v / 100) * 2 - 1))

function NumberField({ label, value, onChange, min = 0, max = 100 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <label className="flex-1">
      <span className="block text-[11px] mb-1" style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none" style={inputStyle}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
    </label>
  )
}

export default function PositioningMapFields({ section, onChange, ensureDoc }: FieldProps<PositioningMapSection>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingPoint = useRef<string | null>(null)
  const { upload, uploading, error } = useImageUpload(ensureDoc)

  const setPoints = (points: PositioningMapSection['points']) => onChange({ points })
  const patchPoint = (id: string, p: Partial<PositioningMapSection['points'][number]>) =>
    setPoints(section.points.map(pt => (pt.id === id ? { ...pt, ...p } : pt)))

  const pickLogo = async (file?: File) => {
    const id = pendingPoint.current
    pendingPoint.current = null
    if (!file || !id) return
    const result = await upload(file)
    if (result) {
      const point = section.points.find(p => p.id === id)
      patchPoint(id, { logo: { file_path: result.file_path, alt: point?.label || '' } })
    }
  }

  const zone = section.zones[0]

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>

      <span className="block text-xs mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>ציר אופקי</span>
      <div className="flex gap-1.5 mb-3">
        <TextInput value={section.axisX.startLabel} placeholder="ימין" onChange={v => onChange({ axisX: { ...section.axisX, startLabel: v } })} />
        <TextInput value={section.axisX.endLabel} placeholder="שמאל" onChange={v => onChange({ axisX: { ...section.axisX, endLabel: v } })} />
      </div>
      <span className="block text-xs mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>ציר אנכי</span>
      <div className="flex gap-1.5 mb-4">
        <TextInput value={section.axisY.startLabel} placeholder="למטה" onChange={v => onChange({ axisY: { ...section.axisY, startLabel: v } })} />
        <TextInput value={section.axisY.endLabel} placeholder="למעלה" onChange={v => onChange({ axisY: { ...section.axisY, endLabel: v } })} />
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />

      <span className="block text-xs mb-2" style={{ color: 'var(--admin-text-muted)' }}>מותגים על המפה</span>
      {section.points.map((point, i) => (
        <RepeaterCard key={point.id} title={`מותג ${i + 1}`} onRemove={() => setPoints(section.points.filter(p => p.id !== point.id))}>
          <div className="mb-2"><TextInput value={point.label} placeholder="שם המותג" onChange={v => patchPoint(point.id, { label: v })} /></div>
          <div className="flex items-center gap-2 mb-2">
            {point.logo?.file_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetProxyUrl(point.logo.file_path)} alt="" className="w-9 h-9 rounded object-contain bg-white p-0.5" />
            )}
            <button
              type="button"
              disabled={uploading}
              onClick={() => { pendingPoint.current = point.id; fileRef.current?.click() }}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center justify-center gap-1.5"
              style={inputStyle}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {point.logo?.file_path ? 'החלפת לוגו' : 'העלאת לוגו'}
            </button>
          </div>
          <div className="flex gap-1.5">
            <NumberField label="אופקי %" value={toPct(point.x)} onChange={v => patchPoint(point.id, { x: fromPct(v) })} />
            <NumberField label="אנכי %" value={toPct(point.y)} onChange={v => patchPoint(point.id, { y: fromPct(v) })} />
          </div>
        </RepeaterCard>
      ))}
      {error && <span className="block text-xs mb-2" style={{ color: '#ef4444' }}>{error}</span>}
      <div className="mb-4">
        <AddButton onClick={() => setPoints([...section.points, { id: uid(), label: '', x: 0, y: 0 }])}>מותג</AddButton>
      </div>

      <span className="block text-xs mb-2" style={{ color: 'var(--admin-text-muted)' }}>עיגול הדגשה</span>
      {zone ? (
        <RepeaterCard title="עיגול" onRemove={() => onChange({ zones: [] })}>
          <div className="flex gap-1.5">
            <NumberField label="אופקי %" value={toPct(zone.cx)} onChange={v => onChange({ zones: [{ ...zone, cx: fromPct(v) }] })} />
            <NumberField label="אנכי %" value={toPct(zone.cy)} onChange={v => onChange({ zones: [{ ...zone, cy: fromPct(v) }] })} />
            <NumberField label="גודל %" min={4} max={50} value={Math.round(zone.r * 100)} onChange={v => onChange({ zones: [{ ...zone, r: v / 100 }] })} />
          </div>
        </RepeaterCard>
      ) : (
        <AddButton onClick={() => onChange({ zones: [{ id: uid(), cx: 0, cy: 0, r: 0.22 }] })}>עיגול הדגשה</AddButton>
      )}
    </>
  )
}
