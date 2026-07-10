'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { ReportBlock, KpiItem, FunnelStage, DataRowItem, SourceGridItem, TableColumn, InsightStat, ActionItem, IdeaCard, ChartDataset } from '@/lib/performance-reports'

interface Props {
  block: ReportBlock
  onChange: (patch: Partial<ReportBlock>) => void
}

const fieldStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }
const labelStyle = { color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 700 as const, marginBottom: 4 }

function SmallInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`px-2.5 py-1.5 rounded text-xs outline-none ${className || ''}`} style={fieldStyle} dir="auto" />
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-1 rounded transition-colors shrink-0"
      style={{ color: 'rgba(255,255,255,0.2)' }}
      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)' }}>
      <Trash2 className="w-3 h-3" />
    </button>
  )
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-all"
      style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.2)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <Plus className="w-3 h-3" /> {label}
    </button>
  )
}

// ── KPI Grid ──
function KpiGridEditor({ block, onChange }: Props) {
  const kpis = block.kpis || []
  const update = (idx: number, patch: Partial<KpiItem>) => {
    onChange({ kpis: kpis.map((k, i) => i === idx ? { ...k, ...patch } : k) })
  }
  return (
    <div className="space-y-2">
      <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת (לא חובה)" className="w-full mb-2" />
      {kpis.map((kpi, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <SmallInput value={kpi.title} onChange={v => update(idx, { title: v })} placeholder="שם מדד" className="flex-1" />
          <SmallInput value={kpi.value} onChange={v => update(idx, { value: v })} placeholder="ערך" className="w-28" />
          <SmallInput value={kpi.subtitle || ''} onChange={v => update(idx, { subtitle: v })} placeholder="תת-כותרת" className="flex-1" />
          <SmallInput value={kpi.trend || ''} onChange={v => update(idx, { trend: v })} placeholder="מגמה" className="w-24" />
          <label className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <input type="checkbox" checked={!!kpi.highlight} onChange={e => update(idx, { highlight: e.target.checked })} />
            הדגש
          </label>
          <RemoveBtn onClick={() => onChange({ kpis: kpis.filter((_, i) => i !== idx) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ kpis: [...kpis, { title: '', value: '' }] })} label="הוסף מדד" />
    </div>
  )
}

// ── Strategic Note / Text ──
function NoteEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={block.variant || 'cyan'} onChange={e => onChange({ variant: e.target.value as 'cyan' | 'yellow' })}
          className="px-2.5 py-1.5 rounded text-xs outline-none" style={fieldStyle}>
          <option value="cyan">ציאן</option>
          <option value="yellow">צהוב</option>
        </select>
      </div>
      <textarea value={block.content || ''} onChange={e => onChange({ content: e.target.value })}
        rows={3} placeholder="תוכן..." dir="auto"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={fieldStyle} />
    </div>
  )
}

// ── Funnel ──
function FunnelEditor({ block, onChange }: Props) {
  const stages = block.stages || []
  const cards = block.summaryCards || []
  const updateStage = (idx: number, patch: Partial<FunnelStage>) => {
    onChange({ stages: stages.map((s, i) => i === idx ? { ...s, ...patch } : s) })
  }
  return (
    <div className="space-y-3">
      <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת משפך" className="w-full" />
      <div style={labelStyle}>שלבים</div>
      {stages.map((stage, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <SmallInput value={stage.label} onChange={v => updateStage(idx, { label: v })} placeholder="שם שלב" className="flex-1" />
          <SmallInput value={stage.value} onChange={v => updateStage(idx, { value: v })} placeholder="מספר" className="w-24" />
          <SmallInput value={stage.subtitle || ''} onChange={v => updateStage(idx, { subtitle: v })} placeholder="תת-כותרת" className="flex-1" />
          <SmallInput value={stage.conversionRate || ''} onChange={v => updateStage(idx, { conversionRate: v })} placeholder="% המרה" className="w-20" />
          <RemoveBtn onClick={() => onChange({ stages: stages.filter((_, i) => i !== idx) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ stages: [...stages, { label: '', value: '' }] })} label="הוסף שלב" />

      <div style={labelStyle} className="mt-3">כרטיסי סיכום</div>
      {cards.map((card, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <SmallInput value={card.value} onChange={v => onChange({ summaryCards: cards.map((c, i) => i === idx ? { ...c, value: v } : c) })} placeholder="ערך" className="w-28" />
          <SmallInput value={card.label} onChange={v => onChange({ summaryCards: cards.map((c, i) => i === idx ? { ...c, label: v } : c) })} placeholder="תיאור" className="flex-1" />
          <RemoveBtn onClick={() => onChange({ summaryCards: cards.filter((_, i) => i !== idx) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ summaryCards: [...cards, { value: '', label: '' }] })} label="הוסף כרטיס סיכום" />
    </div>
  )
}

// ── Data Rows ──
function DataRowsEditor({ block, onChange }: Props) {
  const rows = block.rows || []
  const updateRow = (idx: number, patch: Partial<DataRowItem>) => {
    onChange({ rows: rows.map((r, i) => i === idx ? { ...r, ...patch } : r) })
  }
  return (
    <div className="space-y-3">
      <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת" className="w-full" />
      {rows.map((row, idx) => (
        <div key={idx} className="rounded p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2">
            <SmallInput value={row.title} onChange={v => updateRow(idx, { title: v })} placeholder="כותרת שורה" className="flex-1" />
            <RemoveBtn onClick={() => onChange({ rows: rows.filter((_, i) => i !== idx) })} />
          </div>
          <textarea value={row.description || ''} onChange={e => updateRow(idx, { description: e.target.value })}
            rows={2} placeholder="תיאור..." dir="auto" className="w-full px-2.5 py-1.5 rounded text-xs outline-none resize-none" style={fieldStyle} />
          <div className="flex flex-wrap gap-2">
            {(row.stats || []).map((stat, sIdx) => (
              <div key={sIdx} className="flex items-center gap-1">
                <SmallInput value={stat.label} onChange={v => updateRow(idx, { stats: row.stats.map((s, si) => si === sIdx ? { ...s, label: v } : s) })} placeholder="תווית" className="w-20" />
                <SmallInput value={stat.value} onChange={v => updateRow(idx, { stats: row.stats.map((s, si) => si === sIdx ? { ...s, value: v } : s) })} placeholder="ערך" className="w-20" />
                <RemoveBtn onClick={() => updateRow(idx, { stats: row.stats.filter((_, si) => si !== sIdx) })} />
              </div>
            ))}
            <AddBtn onClick={() => updateRow(idx, { stats: [...(row.stats || []), { label: '', value: '' }] })} label="מספר" />
          </div>
        </div>
      ))}
      <AddBtn onClick={() => onChange({ rows: [...rows, { title: '', stats: [] }] })} label="הוסף שורה" />
    </div>
  )
}

// ── Source Grid ──
function SourceGridEditor({ block, onChange }: Props) {
  const sources = block.sources || []
  const update = (idx: number, patch: Partial<SourceGridItem>) => {
    onChange({ sources: sources.map((s, i) => i === idx ? { ...s, ...patch } : s) })
  }
  return (
    <div className="space-y-2">
      <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת" className="w-full" />
      {sources.map((src, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <SmallInput value={src.platform} onChange={v => update(idx, { platform: v })} placeholder="פלטפורמה" className="w-28" />
          <SmallInput value={src.value} onChange={v => update(idx, { value: v })} placeholder="ערך/מספר" className="w-24" />
          <SmallInput value={src.budget || ''} onChange={v => update(idx, { budget: v })} placeholder="תקציב" className="w-24" />
          <SmallInput value={String(src.budgetPercent || '')} onChange={v => update(idx, { budgetPercent: Number(v) || 0 })} placeholder="%" className="w-16" />
          <label className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <input type="checkbox" checked={!!src.highlight} onChange={e => update(idx, { highlight: e.target.checked })} /> הדגש
          </label>
          <RemoveBtn onClick={() => onChange({ sources: sources.filter((_, i) => i !== idx) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ sources: [...sources, { platform: '', value: '' }] })} label="הוסף מקור" />
    </div>
  )
}

// ── Table ──
function TableEditor({ block, onChange }: Props) {
  const columns = block.columns || []
  const data = block.tableData || []
  return (
    <div className="space-y-3">
      <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת טבלה" className="w-full" />
      <div style={labelStyle}>עמודות</div>
      <div className="flex flex-wrap gap-2">
        {columns.map((col, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <SmallInput value={col.label} onChange={v => onChange({ columns: columns.map((c, i) => i === idx ? { ...c, label: v, key: v.toLowerCase().replace(/\s+/g, '_') } : c) })} placeholder="שם עמודה" className="w-28" />
            <label className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <input type="checkbox" checked={!!col.highlight} onChange={e => onChange({ columns: columns.map((c, i) => i === idx ? { ...c, highlight: e.target.checked } : c) })} /> הדגש
            </label>
            <RemoveBtn onClick={() => onChange({ columns: columns.filter((_, i) => i !== idx) })} />
          </div>
        ))}
        <AddBtn onClick={() => onChange({ columns: [...columns, { key: `col_${columns.length}`, label: '' }] })} label="עמודה" />
      </div>

      {columns.length > 0 && (
        <>
          <div style={labelStyle}>שורות ({data.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="text-right px-2 py-1 font-bold" style={{ color: col.highlight ? '#40e1d3' : 'rgba(255,255,255,0.4)' }}>{col.label}</th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columns.map(col => (
                      <td key={col.key} className="px-1 py-0.5">
                        <SmallInput value={row[col.key] || ''} onChange={v => onChange({ tableData: data.map((r, i) => i === rIdx ? { ...r, [col.key]: v } : r) })} placeholder="—" className="w-full" />
                      </td>
                    ))}
                    <td><RemoveBtn onClick={() => onChange({ tableData: data.filter((_, i) => i !== rIdx) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AddBtn onClick={() => onChange({ tableData: [...data, {}] })} label="שורה" />
        </>
      )}
    </div>
  )
}

// ── Chart ──
function ChartEditor({ block, onChange }: Props) {
  const datasets = block.datasets || []
  const labels = block.labels || []
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת גרף" className="flex-1" />
        <select value={block.chartType || 'line'} onChange={e => onChange({ chartType: e.target.value as 'line' | 'bar' | 'doughnut' })}
          className="px-2.5 py-1.5 rounded text-xs outline-none" style={fieldStyle}>
          <option value="line">קו</option>
          <option value="bar">עמודות</option>
          <option value="doughnut">דונאט</option>
        </select>
      </div>
      <div>
        <div style={labelStyle}>תוויות ציר X (מופרדות בפסיק)</div>
        <SmallInput value={labels.join(', ')} onChange={v => onChange({ labels: v.split(',').map(s => s.trim()) })} placeholder="ינואר, פברואר, ..." className="w-full" />
      </div>
      <div style={labelStyle}>סדרות נתונים</div>
      {datasets.map((ds, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <SmallInput value={ds.label} onChange={v => onChange({ datasets: datasets.map((d, i) => i === idx ? { ...d, label: v } : d) })} placeholder="שם סדרה" className="w-32" />
          <SmallInput value={ds.data.join(', ')} onChange={v => onChange({ datasets: datasets.map((d, i) => i === idx ? { ...d, data: v.split(',').map(n => Number(n.trim()) || 0) } : d) })} placeholder="1, 2, 3, ..." className="flex-1" />
          <SmallInput value={ds.color || ''} onChange={v => onChange({ datasets: datasets.map((d, i) => i === idx ? { ...d, color: v } : d) })} placeholder="#40e1d3" className="w-24" />
          <RemoveBtn onClick={() => onChange({ datasets: datasets.filter((_, i) => i !== idx) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ datasets: [...datasets, { label: '', data: [], color: '#40e1d3' }] })} label="סדרה" />
    </div>
  )
}

// ── Insight Box ──
function InsightBoxEditor({ block, onChange }: Props) {
  const stats = block.insightStats || []
  return (
    <div className="space-y-2">
      <SmallInput value={block.insightTitle || ''} onChange={v => onChange({ insightTitle: v })} placeholder="כותרת תובנה" className="w-full" />
      <textarea value={block.insightText || ''} onChange={e => onChange({ insightText: e.target.value })}
        rows={3} placeholder="טקסט תובנה..." dir="auto" className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={fieldStyle} />
      <div style={labelStyle}>מיני-מדדים</div>
      <div className="flex flex-wrap gap-2">
        {stats.map((s, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <SmallInput value={s.value} onChange={v => onChange({ insightStats: stats.map((st, i) => i === idx ? { ...st, value: v } : st) })} placeholder="ערך" className="w-20" />
            <SmallInput value={s.label} onChange={v => onChange({ insightStats: stats.map((st, i) => i === idx ? { ...st, label: v } : st) })} placeholder="תווית" className="w-24" />
            <RemoveBtn onClick={() => onChange({ insightStats: stats.filter((_, i) => i !== idx) })} />
          </div>
        ))}
        <AddBtn onClick={() => onChange({ insightStats: [...stats, { value: '', label: '' }] })} label="מדד" />
      </div>
    </div>
  )
}

// ── Action List ──
function ActionListEditor({ block, onChange }: Props) {
  const actions = block.actions || []
  const update = (idx: number, patch: Partial<ActionItem>) => {
    onChange({ actions: actions.map((a, i) => i === idx ? { ...a, ...patch } : a) })
  }
  return (
    <div className="space-y-2">
      <SmallInput value={block.title || ''} onChange={v => onChange({ title: v })} placeholder="כותרת" className="w-full" />
      {actions.map((action, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1"
            style={{ background: 'rgba(64,225,211,0.15)', color: '#40e1d3' }}>{idx + 1}</span>
          <div className="flex-1 space-y-1">
            <SmallInput value={action.title} onChange={v => update(idx, { title: v })} placeholder="כותרת המלצה" className="w-full" />
            <textarea value={action.description} onChange={e => update(idx, { description: e.target.value })}
              rows={2} placeholder="תיאור..." dir="auto" className="w-full px-2.5 py-1.5 rounded text-xs outline-none resize-none" style={fieldStyle} />
            <SmallInput value={action.impact || ''} onChange={v => update(idx, { impact: v })} placeholder="אימפקט צפוי" className="w-48" />
          </div>
          <RemoveBtn onClick={() => onChange({ actions: actions.filter((_, i) => i !== idx) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ actions: [...actions, { title: '', description: '' }] })} label="המלצה" />
    </div>
  )
}

// ── Idea Cards ──
function IdeaCardsEditor({ block, onChange }: Props) {
  const ideas = block.ideas || []
  const update = (idx: number, patch: Partial<IdeaCard>) => {
    onChange({ ideas: ideas.map((d, i) => i === idx ? { ...d, ...patch } : d) })
  }
  return (
    <div className="space-y-2">
      {ideas.map((idea, idx) => (
        <div key={idx} className="rounded p-3 space-y-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2">
            <SmallInput value={idea.title} onChange={v => update(idx, { title: v })} placeholder="כותרת" className="flex-1" />
            <label className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <input type="checkbox" checked={!!idea.fullWidth} onChange={e => update(idx, { fullWidth: e.target.checked })} /> רוחב מלא
            </label>
            <RemoveBtn onClick={() => onChange({ ideas: ideas.filter((_, i) => i !== idx) })} />
          </div>
          <textarea value={idea.content} onChange={e => update(idx, { content: e.target.value })}
            rows={2} placeholder="תוכן..." dir="auto" className="w-full px-2.5 py-1.5 rounded text-xs outline-none resize-none" style={fieldStyle} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ideas: [...ideas, { title: '', content: '' }] })} label="כרטיס" />
    </div>
  )
}

// ── Main Dispatcher ──
export default function BlockEditor({ block, onChange }: Props) {
  switch (block.type) {
    case 'kpi_grid': return <KpiGridEditor block={block} onChange={onChange} />
    case 'strategic_note':
    case 'text': return <NoteEditor block={block} onChange={onChange} />
    case 'funnel': return <FunnelEditor block={block} onChange={onChange} />
    case 'data_rows': return <DataRowsEditor block={block} onChange={onChange} />
    case 'source_grid': return <SourceGridEditor block={block} onChange={onChange} />
    case 'table': return <TableEditor block={block} onChange={onChange} />
    case 'chart': return <ChartEditor block={block} onChange={onChange} />
    case 'insight_box': return <InsightBoxEditor block={block} onChange={onChange} />
    case 'action_list': return <ActionListEditor block={block} onChange={onChange} />
    case 'idea_cards': return <IdeaCardsEditor block={block} onChange={onChange} />
    default:
      return <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>סוג בלוק לא מוכר: {block.type}</p>
  }
}
