'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import type { ReportTab, ReportBlock } from '@/lib/performance-reports'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'
import './report.css'

interface Props {
  report: {
    client: string
    reportName: string
    periodLabel: string
    tabs: ReportTab[]
    tabsEn: ReportTab[] | null
  }
  brandColor: string | null
}

export default function ReportPresentation({ report, brandColor }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [lang, setLang] = useState<'he' | 'en'>('he')

  const activeTabs = useMemo(() => {
    if (lang === 'en' && report.tabsEn?.length) return report.tabsEn
    return report.tabs
  }, [lang, report.tabs, report.tabsEn])

  const hasEn = !!report.tabsEn?.length
  const tab = activeTabs[activeTab] || null

  const navigate = (dir: -1 | 1) => {
    setActiveTab(prev => Math.min(Math.max(prev + dir, 0), activeTabs.length - 1))
  }

  return (
    <div className="report-pres" dir={lang === 'en' ? 'ltr' : 'rtl'}
      style={brandColor ? { '--brand-accent': brandColor, '--brand-accent-glow': `${brandColor}33` } as React.CSSProperties : undefined}>

      {/* Header */}
      <header className="report-header">
        <div className="report-header-title">
          <img src="https://static.wixstatic.com/media/515225_d7ed5ed1634e4012828342de92956ccf~mv2.png" alt="Results Digital" style={{ height: 36, filter: 'none' }} />
          <h1>{report.client} — <span>{report.reportName}</span></h1>
        </div>
        <div className="report-header-right">
          {hasEn && (
            <>
              <button className={`report-lang-btn${lang === 'he' ? ' active' : ''}`} onClick={() => setLang('he')}>עברית</button>
              <button className={`report-lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>English</button>
            </>
          )}
          {report.periodLabel && <div className="report-date-badge">{report.periodLabel}</div>}
          <button className="report-pdf-btn" onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PDF
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="report-container">
        <main className="report-content">
          {tab && (
            <div key={`${activeTab}-${lang}`} className="report-tab">
              {tab.title && (
                <h2 className="report-tab-title" dangerouslySetInnerHTML={{ __html: formatTitle(tab.title) }} />
              )}
              {tab.subtitle && <p className="report-tab-subtitle">{tab.subtitle}</p>}

              {tab.blocks.map(block => (
                <BlockRenderer key={block.id} block={block} />
              ))}
            </div>
          )}

          {/* Slide navigation */}
          {activeTabs.length > 1 && (
            <div className="report-nav">
              <button className="report-nav-btn" disabled={activeTab === 0} onClick={() => navigate(-1)}>
                ← {(lang === 'en' ? en : he)['public.previous']}
              </button>
              <div className="report-dots">
                {activeTabs.map((_, i) => (
                  <div key={i} className={`report-dot${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)} />
                ))}
              </div>
              <span className="report-slide-num">{activeTab + 1} / {activeTabs.length}</span>
              <button className="report-nav-btn" disabled={activeTab === activeTabs.length - 1} onClick={() => navigate(1)}>
                {(lang === 'en' ? en : he)['public.next']} →
              </button>
            </div>
          )}
        </main>

        <footer className="report-footer">
          Powered by <a href="https://www.resultsdigital.org" target="_blank" rel="noopener noreferrer">Results Digital</a>
        </footer>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTitle(title: string): string {
  // Escape first so an editor-supplied title can't inject markup, then wrap
  // text after " — " or after ":" in accent color.
  return escapeHtml(title)
    .replace(/—\s*(.+)$/, '— <span>$1</span>')
    .replace(/:\s*(.+)$/, ': <span>$1</span>')
}

// ── Block Renderer ──

function BlockRenderer({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case 'kpi_grid': return <KpiGrid block={block} />
    case 'strategic_note':
    case 'text': return <StrategicNote block={block} />
    case 'funnel': return <Funnel block={block} />
    case 'data_rows': return <DataRows block={block} />
    case 'source_grid': return <SourceGrid block={block} />
    case 'table': return <Table block={block} />
    case 'chart': return <Chart block={block} />
    case 'insight_box': return <InsightBox block={block} />
    case 'action_list': return <ActionList block={block} />
    case 'idea_cards': return <IdeaCards block={block} />
    default: return null
  }
}

function KpiGrid({ block }: { block: ReportBlock }) {
  const kpis = block.kpis || []
  if (!kpis.length) return null
  return (
    <>
      {block.title && <h3 className="rpt-section-title">{block.title}</h3>}
      <div className="rpt-kpi-grid">
        {kpis.map((kpi, i) => (
          <div key={i} className={`rpt-kpi-card${kpi.highlight ? ' highlight' : ''}`}>
            <div className="rpt-kpi-title">{kpi.title}</div>
            <div className="rpt-kpi-value">{kpi.value}</div>
            {kpi.subtitle && <div className="rpt-kpi-subtitle">{kpi.subtitle}</div>}
            {kpi.trend && <div className="rpt-kpi-trend">{kpi.trend}</div>}
          </div>
        ))}
      </div>
    </>
  )
}

function StrategicNote({ block }: { block: ReportBlock }) {
  if (!block.content) return null
  return <div className={`rpt-note${block.variant === 'yellow' ? ' yellow' : ''}`}>{block.content}</div>
}

function Funnel({ block }: { block: ReportBlock }) {
  const stages = block.stages || []
  const cards = block.summaryCards || []
  if (!stages.length) return null
  const widths = stages.map((_, i) => `${100 - i * (60 / Math.max(stages.length - 1, 1))}%`)
  return (
    <>
      {block.title && <h3 className="rpt-section-title">{block.title}</h3>}
      <div className="rpt-funnel">
        {stages.map((stage, i) => (
          <div key={i}>
            <div className="rpt-funnel-stage" style={{ width: widths[i], background: `rgba(255,220,113,${0.1 - i * 0.02})` }}>
              <div>
                <div className="rpt-funnel-label">{stage.label}</div>
                <div className="rpt-funnel-value">{stage.value}</div>
                {stage.subtitle && <div className="rpt-funnel-sub">{stage.subtitle}</div>}
              </div>
            </div>
            {stage.conversionRate && i < stages.length - 1 && (
              <div className="rpt-funnel-arrow">
                <div className="rpt-funnel-arrow-line" />
                <div className="rpt-funnel-conv">{stage.conversionRate}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      {cards.length > 0 && (
        <div className="rpt-funnel-summary">
          {cards.map((card, i) => (
            <div key={i} className="rpt-funnel-summary-card">
              <div className="rpt-funnel-summary-val">{card.value}</div>
              <div className="rpt-funnel-summary-label">{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function DataRows({ block }: { block: ReportBlock }) {
  const rows = block.rows || []
  if (!rows.length) return null
  return (
    <>
      {block.title && <h3 className="rpt-section-title">{block.title}</h3>}
      {rows.map((row, i) => (
        <div key={i} className="rpt-data-row">
          <div className="rpt-data-row-info">
            <div className="rpt-data-row-title">{row.title}</div>
            {row.description && <div className="rpt-data-row-desc">{row.description}</div>}
          </div>
          {row.stats?.length > 0 && (
            <div className="rpt-data-row-stats">
              {row.stats.map((stat, si) => (
                <div key={si} className="rpt-stat-group">
                  <span className="rpt-stat-label">{stat.label}</span>
                  <span className={`rpt-stat-number${stat.highlight ? '' : ''}`} style={stat.highlight ? { color: 'var(--brand-accent)' } : undefined}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function SourceGrid({ block }: { block: ReportBlock }) {
  const sources = block.sources || []
  if (!sources.length) return null
  return (
    <>
      {block.title && <h3 className="rpt-section-title">{block.title}</h3>}
      <div className="rpt-source-grid">
        {sources.map((src, i) => (
          <div key={i} className={`rpt-source-card${src.highlight ? ' highlight' : ''}`}>
            <div className="rpt-source-name">{src.platform}</div>
            <div className="rpt-source-value">{src.value}</div>
            {src.budget && <div className="rpt-source-budget">{src.budget}</div>}
            {src.budgetPercent !== undefined && src.budgetPercent > 0 && (
              <div className="rpt-progress-track">
                <div className="rpt-progress-fill" style={{ width: `${Math.min(src.budgetPercent, 100)}%` }}>
                  {src.budgetPercent}%
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function Table({ block }: { block: ReportBlock }) {
  const columns = block.columns || []
  const data = block.tableData || []
  if (!columns.length) return null
  return (
    <>
      {block.title && <h3 className="rpt-section-title">{block.title}</h3>}
      <div className="rpt-table-container">
        <table className="rpt-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} className={col.highlight ? 'highlight-col' : ''}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={rIdx}>
                {columns.map(col => (
                  <td key={col.key} className={col.highlight ? 'highlight-col' : ''}>{row[col.key] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const CHART_COLORS = ['#FFDC71', '#00E5FF', '#1877F2', '#a78bfa', '#4ade80', '#f87171', '#fb923c']

function Chart({ block }: { block: ReportBlock }) {
  const labels = block.labels || []
  const datasets = block.datasets || []
  if (!labels.length || !datasets.length) return null

  if (block.chartType === 'doughnut') {
    const pieData = labels.map((label, i) => ({ name: label, value: datasets[0]?.data[i] || 0 }))
    return (
      <div className="rpt-chart-container">
        {block.title && <div className="rpt-chart-title">{block.title}</div>}
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
            <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const chartData = labels.map((label, i) => {
    const point: Record<string, unknown> = { name: label }
    datasets.forEach(ds => { point[ds.label] = ds.data[i] || 0 })
    return point
  })

  const ChartComponent = block.chartType === 'bar' ? BarChart : LineChart

  return (
    <div className="rpt-chart-container">
      {block.title && <div className="rpt-chart-title">{block.title}</div>}
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} />
          <YAxis tick={{ fill: '#aaa', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
          <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
          {datasets.map((ds, i) => (
            block.chartType === 'bar'
              ? <Bar key={ds.label} dataKey={ds.label} fill={ds.color || CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
              : <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

function InsightBox({ block }: { block: ReportBlock }) {
  if (!block.insightTitle && !block.insightText) return null
  return (
    <div className="rpt-insight">
      {block.insightTitle && <div className="rpt-insight-title">{block.insightTitle}</div>}
      {block.insightText && <div className="rpt-insight-text">{block.insightText}</div>}
      {(block.insightStats?.length ?? 0) > 0 && (
        <div className="rpt-insight-stats">
          {block.insightStats!.map((stat, i) => (
            <div key={i}>
              <div className="rpt-insight-stat-val">{stat.value}</div>
              <div className="rpt-insight-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionList({ block }: { block: ReportBlock }) {
  const actions = block.actions || []
  if (!actions.length) return null
  return (
    <>
      {block.title && <h3 className="rpt-section-title">{block.title}</h3>}
      {actions.map((action, i) => (
        <div key={i} className="rpt-action-item">
          <div className="rpt-action-num">{i + 1}</div>
          <div className="rpt-action-content">
            <h4>{action.title}</h4>
            <p>{action.description}</p>
            {action.impact && <div className="rpt-action-impact">{action.impact}</div>}
          </div>
        </div>
      ))}
    </>
  )
}

function IdeaCards({ block }: { block: ReportBlock }) {
  const ideas = block.ideas || []
  if (!ideas.length) return null
  return (
    <div className="rpt-ideas-grid">
      {ideas.map((idea, i) => (
        <div key={i} className={`rpt-idea-card${idea.fullWidth ? ' full-width' : ''}`}>
          <h4>{idea.title}</h4>
          <p>{idea.content}</p>
        </div>
      ))}
    </div>
  )
}
