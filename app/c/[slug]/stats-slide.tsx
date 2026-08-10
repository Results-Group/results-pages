'use client'

// Imported here as well as in presentation.tsx so the admin editor's canvas,
// which renders this component directly, gets the same styles. The bundler
// dedupes the second import.
import './presentation.css'
import { normalizeStats, funnelWidths, type StatsBlock, type StatsKpi, type StatsFunnel } from '@/lib/launch-stats'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

/**
 * The "סיכום נתונים" (KPI summary) slide. Rendered by BOTH the public deck and
 * the admin editor's canvas — the editor must never grow its own copy of this
 * layout, or what the operator approves drifts from what the client receives.
 */
export default function StatsSlide({
  stats,
  title,
  description,
  lang = 'he',
}: {
  stats?: StatsBlock | null
  title?: string
  description?: string
  lang?: 'he' | 'en'
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key

  const b = normalizeStats(stats)
  const kpis = b.kpis.filter(kpiVisible)
  const groups = b.groups.filter(g => g.title.trim() && g.kpis.some(kpiVisible))
  const tableRows = b.table ? b.table.rows.filter(r => r.some(c => c.trim())) : []
  const showTable = !!b.table && tableRows.length > 0
  const funnelStages = b.funnel ? b.funnel.stages.filter(s => s.label.trim() || s.value.trim()) : null

  return (
    <div className="stats-slide">
      <h2 className="slide-title rp-anim rp-in rp-d1">{title || t('public.stats.title')}</h2>
      {description && <p className="dist-intro rp-anim rp-up rp-d1">{description}</p>}

      {kpis.length > 0 && (
        <div className="stats-grid rp-anim rp-up rp-d2">
          {kpis.map(k => (
            <KpiTile key={k.id} kpi={k} />
          ))}
        </div>
      )}

      {funnelStages && funnelStages.length > 0 && (
        <ViewFunnel funnel={{ ...b.funnel!, stages: funnelStages }} />
      )}

      {groups.length > 0 && (
        <div className="stats-groups rp-anim rp-up rp-d2">
          {groups.map(g => (
            <div className="stats-group" key={g.id}>
              <h3 className="stats-group-title">{g.title}</h3>
              <div className="stats-group-list">
                {g.kpis.filter(kpiVisible).map(k => (
                  <div className={`stats-group-row${k.highlight ? ' highlight' : ''}`} key={k.id}>
                    <span className="stats-group-label">{k.label}</span>
                    <span className="stats-group-value">{k.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showTable && (
        <div className="stats-table-wrap rp-anim rp-up rp-d3">
          <table className="stats-table">
            <thead>
              <tr>
                {b.table!.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri}>
                  {b.table!.headers.map((_, ci) => (
                    <td key={ci}>{row[ci]?.trim() || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {b.note?.trim() && <p className="stats-note rp-anim rp-up rp-d3">{b.note}</p>}
    </div>
  )
}

function kpiVisible(k: StatsKpi): boolean {
  return !!(k.label.trim() || k.value.trim())
}

/** Video-retention funnel. Bar widths come from funnelWidths — see the note
 *  there on why they follow the real percentages when those are available. */
function ViewFunnel({ funnel }: { funnel: StatsFunnel }) {
  const widths = funnelWidths(funnel.stages)
  return (
    <div className="stats-funnel rp-anim rp-up rp-d2">
      {funnel.title.trim() && <h3 className="dist-block-title">{funnel.title}</h3>}
      {funnel.stages.map((s, i) => (
        <div className="stats-funnel-row" key={s.id}>
          <span className="stats-funnel-label">{s.label}</span>
          <span className="stats-funnel-track">
            <span className="stats-funnel-fill" style={{ width: `${widths[i]}%` }} />
          </span>
          <span className="stats-funnel-value">
            {s.value || '—'}
            {s.percent?.trim() && <em className="stats-funnel-pct">{s.percent}</em>}
          </span>
        </div>
      ))}
    </div>
  )
}

function KpiTile({ kpi }: { kpi: StatsKpi }) {
  return (
    <div className={`stats-tile${kpi.highlight ? ' highlight' : ''}`}>
      <span className="stats-tile-label">{kpi.label}</span>
      {/* An empty value renders a dash rather than nothing, so a pre-labeled
          template tile reads as "to be filled" instead of looking broken. */}
      <span className="stats-tile-value">{kpi.value || '—'}</span>
      {kpi.sublabel?.trim() && <span className="stats-tile-sub">{kpi.sublabel}</span>}
    </div>
  )
}
