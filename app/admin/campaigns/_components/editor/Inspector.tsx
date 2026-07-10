'use client'

import { useState, useRef } from 'react'
import { LayoutGrid, Settings2, Upload, Lock, Trash2, Clock } from 'lucide-react'
import ClientAutocomplete from '../../../_components/client-autocomplete'
import WorkspaceSelector from '../../../_components/workspace-selector'
import { MOCKUP_TYPES, type CampaignMeta, type EditorSection, type MockupType } from './types'

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-bg-elevated)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
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
      <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ background: 'var(--admin-bg)' }}>
        <button
          onClick={() => setTab('slide')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={tab === 'slide' ? { background: 'var(--admin-bg-elevated)', color: 'var(--admin-text-primary)' } : { color: 'var(--admin-text-muted)' }}
        >
          <Settings2 className="w-3.5 h-3.5" /> שקף
        </button>
        <button
          onClick={() => setTab('campaign')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={tab === 'campaign' ? { background: 'var(--admin-bg-elevated)', color: 'var(--admin-text-primary)' } : { color: 'var(--admin-text-muted)' }}
        >
          <LayoutGrid className="w-3.5 h-3.5" /> קמפיין
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5">
        {tab === 'slide' ? (
          section ? (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>סוג התצוגה</label>
                <select
                  value={section.mockup_type}
                  onChange={e => onUpdateSection({ mockup_type: e.target.value as MockupType })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={fieldStyle}
                >
                  {(Object.entries(MOCKUP_TYPES) as [MockupType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
                  התצוגה קובעת כיצד הקריאייטיבים מוצגים ללקוח (מוקאפ רשתות חברתיות, וידאו, או תצוגה כללית).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>כותרת השקף</label>
                <input
                  type="text" value={section.title} onChange={e => onUpdateSection({ title: e.target.value })}
                  placeholder="כותרת" dir="auto"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>טקסט / קופי</label>
                <textarea
                  value={section.description} onChange={e => onUpdateSection({ description: e.target.value })}
                  rows={4} placeholder="טקסט שיופיע מעל הקריאייטיבים" dir="auto"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none" style={fieldStyle}
                />
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>לא נבחר שקף</p>
          )
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>לקוח</label>
              <ClientAutocomplete
                value={meta.client}
                workspaceId={meta.workspaceId}
                onChange={val => onUpdateMeta({ client: val })}
                onClientChange={(name, clientId) => onUpdateMeta({ client: name, clientId })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>שם הקמפיין</label>
              <input
                type="text" value={meta.campaignName} onChange={e => onUpdateMeta({ campaignName: e.target.value })}
                placeholder="שם הקמפיין" dir="auto"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>קונספט</label>
              <textarea
                value={meta.concept} onChange={e => onUpdateMeta({ concept: e.target.value })}
                rows={3} placeholder="תיאור קצר של הקונספט (שקף נפרד במצגת)" dir="auto"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none" style={fieldStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>לוגו הלקוח</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
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
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                >
                  {uploadingLogo ? 'מעלה...' : meta.logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
                </button>
                {meta.logoUrl && (
                  <button onClick={() => onUpdateMeta({ logoPath: null, logoUrl: null })} className="p-2 rounded-lg" style={{ color: 'var(--admin-text-muted)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) onUploadLogo(e.target.files[0]) }} />
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--admin-text-muted)' }}>
                אם לא יוגדר לוגו, ישתמש בלוגו של הלקוח (אם קיים).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                <Lock className="w-3.5 h-3.5" /> סיסמה (הגנה על המצגת)
              </label>
              <input
                type="password" value={meta.password}
                onChange={e => { onPasswordDirty(true); onUpdateMeta({ password: e.target.value }) }}
                placeholder={meta.hasPassword && !passwordDirty ? '••••••••' : 'ריק = ללא סיסמה'} dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle}
              />
              {meta.hasPassword && !passwordDirty && (
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px]" style={{ color: 'var(--admin-accent)' }}>סיסמה מוגדרת</span>
                  <button
                    type="button"
                    onClick={() => { onPasswordDirty(true); onUpdateMeta({ password: '', hasPassword: false }) }}
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--admin-danger)' }}
                  >
                    הסרת סיסמה
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                <Clock className="w-3.5 h-3.5" /> תזמון פרסום (אופציונלי)
              </label>
              <input
                type="datetime-local"
                value={meta.publishAt || ''}
                onChange={e => onUpdateMeta({ publishAt: e.target.value || null })}
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={fieldStyle}
              />
              <p className="text-[11px] mt-2" style={{ color: 'var(--admin-text-muted)' }}>
                המצגת לא תהיה זמינה ללקוח עד למועד זה (תצוגה מקדימה לצוות תמיד זמינה).
              </p>
            </div>

            <WorkspaceSelector value={meta.workspaceId} onChange={val => onUpdateMeta({ workspaceId: val })} />
          </>
        )}
      </div>
    </div>
  )
}
