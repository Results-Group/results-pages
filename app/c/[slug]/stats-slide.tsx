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
          {groups.map(g => {
            const plat = platformOf(g.title)
            return (
              <div
                className="stats-group"
                key={g.id}
                style={plat ? ({ '--plat-color': plat.color } as React.CSSProperties) : undefined}
              >
                <h3 className="stats-group-title">
                  {plat && <span className="stats-group-icon" style={{ color: plat.color }}>{plat.icon}</span>}
                  {g.title}
                </h3>
                <div className="stats-group-list">
                  {g.kpis.filter(kpiVisible).map(k => (
                    <div className={`stats-group-row${k.highlight ? ' highlight' : ''}`} key={k.id}>
                      <span className="stats-group-label">{k.label}</span>
                      <span className="stats-group-value">{k.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
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

/**
 * Platform badge for a group whose title names an ad platform — the source
 * report marks each platform block with the platform's colour on the start
 * edge; the icon is the ask on top of that. Detection is by name so the
 * operator controls it from the title alone, no extra field.
 */
function platformOf(title: string): { icon: React.ReactNode; color: string } | null {
  const s = title.toLowerCase()
  if (/meta|facebook|instagram|פייסבוק|אינסטגרם|מטא/.test(s)) {
    return {
      color: '#4267B2',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6.9 6.5C4.2 6.5 2 9.2 2 12.4c0 3 1.6 5.1 3.9 5.1 1.5 0 2.7-.9 4.1-3.2l1.2-2 .2.3c-1.7 3.1-3.3 4.9-5.6 4.9C3 17.5 1 15.2 1 12.3 1 8.7 3.5 5.5 6.9 5.5c1.9 0 3.5 1 5.1 3.3C13.6 6.5 15.2 5.5 17 5.5c3.4 0 6 3.2 6 6.8 0 2.9-2 5.2-4.8 5.2-2.3 0-3.9-1.8-5.6-4.9l-.9-1.6c-1.5-2.7-2.9-4.5-4.8-4.5zm10 0c-1.4 0-2.6.9-4 3.2l.9 1.6c1.5 2.8 2.7 4.2 4.2 4.2 1.7 0 3-1.6 3-3.9 0-2.8-1.8-5.1-4.1-5.1z" />
        </svg>
      ),
    }
  }
  if (/google|youtube|גוגל|יוטיוב/.test(s)) {
    return {
      color: '#FBBC05',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 1 0 0 20c5.5 0 9.6-3.9 9.6-9.6 0-.7-.1-1.2-.2-1.8H12v3.7h5.5c-.3 1.5-1.7 3.9-5.5 3.9a6.2 6.2 0 0 1 0-12.4c1.8 0 3 .8 3.7 1.4l2.6-2.5A9.6 9.6 0 0 0 12 2z" />
        </svg>
      ),
    }
  }
  if (/tiktok|טיקטוק|טיק טוק/.test(s)) {
    return {
      color: '#fe2c55',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.6 2h-3.2v13.1a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .9.1V9.1a6.1 6.1 0 0 0-.9-.1 6.1 6.1 0 1 0 6.1 6.1V8.6a7.8 7.8 0 0 0 4.5 1.4V6.8A4.6 4.6 0 0 1 16.6 2z" />
        </svg>
      ),
    }
  }
  return null
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
