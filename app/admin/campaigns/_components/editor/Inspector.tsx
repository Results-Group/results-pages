'use client'

import { useState, useRef } from 'react'
import { LayoutGrid, Settings2, Upload, Lock, Trash2, Clock, Plus, X } from 'lucide-react'
import ClientAutocomplete from '../../../_components/client-autocomplete'
import WorkspaceSelector from '../../../_components/workspace-selector'
import { MOCKUP_TYPES, type CampaignMeta, type EditorSection, type MockupType } from './types'

const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
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
  section, meta, onUpdateSection, onUpdateMeta, onUploadLogo, uploadingLogo, passwordDirty, onPasswordDirty,
}: {
  section: EditorSection | null
  meta: CampaignMeta
  onUpdateSection: (patch: Partial<EditorSection>) => void
  onUpdateMeta: (patch: Partial<CampaignMeta>) => void
  onUploadLogo: (file: File) => void
  uploadingLogo: boolean
  passwordDirty: boolean
  onPasswordDirty: (dirty: boolean) => void
}) {
  const [tab, setTab] = useState<'slide' | 'campaign'>('slide')
  const logoRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-0.5 p-0.5 rounded-lg mb-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <button
          onClick={() => setTab('slide')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-bold transition-all duration-200"
          style={tab === 'slide'
            ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3' }
            : { color: 'rgba(255,255,255,0.35)' }
          }
        >
          <Settings2 className="w-3.5 h-3.5" /> שקף
        </button>
        <button
          onClick={() => setTab('campaign')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-bold transition-all duration-200"
          style={tab === 'campaign'
            ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3' }
            : { color: 'rgba(255,255,255,0.35)' }
          }
        >
          <LayoutGrid className="w-3.5 h-3.5" /> קמפיין
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5">
        {tab === 'slide' ? (
          section ? (
            <>
              <SectionDivider label="תצוגה" />
              <div>
                <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>סוג התצוגה</label>
                <select
                  value={section.mockup_type}
                  onChange={e => onUpdateSection({ mockup_type: e.target.value as MockupType })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer transition-all duration-200"
                  style={fieldStyle}
                >
                  {(Object.entries(MOCKUP_TYPES) as [MockupType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  התצוגה קובעת כיצד הקריאייטיבים מוצגים ללקוח.
                </p>
              </div>

              <SectionDivider label="תוכן" />
              <div>
                <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>כותרת השקף</label>
                <input
                  type="text" value={section.title} onChange={e => onUpdateSection({ title: e.target.value })}
                  placeholder="כותרת" dir="auto"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>תיאור קצר על השקף</label>
                <textarea
                  value={section.description} onChange={e => onUpdateSection({ description: e.target.value })}
                  rows={3} placeholder="תיאור קצר על השקף (לא חובה)" dir="auto"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none transition-all duration-200" style={fieldStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                />
              </div>

              {meta.copies.length > 0 && (
                <>
                  <SectionDivider label="קופי" />
                  <button
                    type="button"
                    onClick={() => onUpdateSection({ useCopies: !section.useCopies })}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200"
                    style={{
                      background: section.useCopies ? 'rgba(64,225,211,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${section.useCopies ? 'rgba(64,225,211,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {/* Toggle pill */}
                    <div className="relative w-8 h-4 rounded-full transition-all duration-200 shrink-0"
                      style={{ background: section.useCopies ? '#40e1d3' : 'rgba(255,255,255,0.1)' }}>
                      <div className="absolute top-0.5 rounded-full w-3 h-3 bg-white shadow transition-all duration-200"
                        style={{ left: section.useCopies ? '18px' : '2px' }} />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs font-bold" style={{ color: section.useCopies ? '#40e1d3' : 'rgba(255,255,255,0.55)' }}>
                        {section.useCopies ? 'קופי מופעל על שקף זה' : 'הפעל קופי על שקף זה'}
                      </p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {meta.copies.length} ורסיות מוגדרות בקמפיין
                      </p>
                    </div>
                  </button>
                </>
              )}

              {meta.copies.length === 0 && (
                <p className="text-[10px] leading-relaxed px-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  כדי להפעיל קופי על שקף זה, הוסף ורסיות טקסט בטאב "קמפיין"
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>לא נבחר שקף</p>
            </div>
          )
        ) : (
          <>
            <SectionDivider label="פרטי הקמפיין" />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>לקוח</label>
              <ClientAutocomplete
                value={meta.client}
                workspaceId={meta.workspaceId}
                onChange={val => onUpdateMeta({ client: val })}
                onClientChange={(name, clientId) => onUpdateMeta({ client: name, clientId })}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>שם הקמפיין</label>
              <input
                type="text" value={meta.campaignName} onChange={e => onUpdateMeta({ campaignName: e.target.value })}
                placeholder="שם הקמפיין" dir="auto"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>קונספט</label>
              <textarea
                value={meta.concept} onChange={e => onUpdateMeta({ concept: e.target.value })}
                rows={3} placeholder="תיאור קצר של הקונספט (שקף נפרד במצגת)" dir="auto"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
            </div>

            <SectionDivider label="קופי / ווריאציות טקסט" />
            <div className="space-y-2.5">
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
                הזן כאן את ורסיות הטקסט פעם אחת, ואז בחר בטאב ״שקף״ על אילו שקפים להציג אותן.
              </p>
              {meta.copies.map((copy, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(64,225,211,0.6)' }}>ורסיה {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateMeta({ copies: meta.copies.filter((_, i) => i !== idx) })}
                      className="p-0.5 rounded transition-colors ml-auto"
                      style={{ color: 'rgba(255,255,255,0.2)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)' }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <textarea
                    value={copy}
                    onChange={e => onUpdateMeta({ copies: meta.copies.map((c, i) => i === idx ? e.target.value : c) })}
                    rows={3}
                    placeholder={`טקסט ורסיה ${idx + 1}...`}
                    dir="auto"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none transition-all duration-200"
                    style={fieldStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdateMeta({ copies: [...meta.copies, ''] })}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200"
                style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.2)', background: 'rgba(64,225,211,0.03)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.03)' }}
              >
                <Plus className="w-3.5 h-3.5" /> הוסף ורסיית קופי
              </button>
            </div>

            <SectionDivider label="ברנדינג" />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>לוגו הלקוח</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {meta.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meta.logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Upload className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  )}
                </div>
                <button
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex-1 px-3 py-2.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                >
                  {uploadingLogo ? 'מעלה...' : meta.logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
                </button>
                {meta.logoUrl && (
                  <button onClick={() => onUpdateMeta({ logoPath: null, logoUrl: null })} className="p-2 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) onUploadLogo(e.target.files[0]) }} />
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                אם לא יוגדר לוגו, ישתמש בלוגו של הלקוח (אם קיים).
              </p>
            </div>

            <SectionDivider label="אבטחה" />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 flex items-center gap-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <Lock className="w-3.5 h-3.5" /> סיסמה
              </label>
              <input
                type="password" value={meta.password}
                onChange={e => { onPasswordDirty(true); onUpdateMeta({ password: e.target.value }) }}
                placeholder={meta.hasPassword && !passwordDirty ? '••••••••' : 'ריק = ללא סיסמה'} dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
              {meta.hasPassword && !passwordDirty && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-bold" style={{ color: '#40e1d3' }}>סיסמה מוגדרת</span>
                  <button
                    type="button"
                    onClick={() => { onPasswordDirty(true); onUpdateMeta({ password: '', hasPassword: false }) }}
                    className="text-[10px] font-bold transition-colors"
                    style={{ color: 'rgba(239,68,68,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)' }}
                  >
                    הסרת סיסמה
                  </button>
                </div>
              )}
            </div>

            <SectionDivider label="תזמון" />
            <div>
              <label className="block text-[11px] font-bold mb-1.5 flex items-center gap-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <Clock className="w-3.5 h-3.5" /> תזמון פרסום
              </label>
              <input
                type="datetime-local"
                value={meta.publishAt || ''}
                onChange={e => onUpdateMeta({ publishAt: e.target.value || null })}
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-200" style={fieldStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
              <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                המצגת לא תהיה זמינה ללקוח עד למועד זה.
              </p>
            </div>

            <SectionDivider label="סביבת עבודה" />
            <WorkspaceSelector value={meta.workspaceId} onChange={val => onUpdateMeta({ workspaceId: val })} />
          </>
        )}
      </div>
    </div>
  )
}
