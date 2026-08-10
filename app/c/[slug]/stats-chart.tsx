'use client'

import { useMemo, useState } from 'react'
import type { StatsTable } from '@/lib/launch-stats'

/**
 * Interactive bar chart over the stats table — the reader picks a metric
 * (chip per numeric column) and the months redraw. Derived entirely from the
 * table the operator already fills in, so there is nothing extra to edit and
 * the chart can never disagree with the numbers beside it.
 *
 * Hand-rolled bars rather than a chart library: the deck ships no charting
 * dependency, and the design is the house look, not a library default.
 */

/** "₪916,265" / "6.08x" / "61.6%" / "1,537" → the number inside, or null. */
function parseMetric(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** A totals row anchors the table, but on the chart it would dwarf the months
 *  it sums — so it stays in the table only. */
function isTotalsRow(row: string[]): boolean {
  return /סה.?"?כ|total/i.test(row[0] || '')
}

export default function StatsChart({ table, lang = 'he' }: { table: StatsTable; lang?: 'he' | 'en' }) {
  const [metricIdx, setMetricIdx] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [mode, setMode] = useState<'bars' | 'line'>('bars')

  const model = useMemo(() => {
    const rows = table.rows.filter(r => r.some(c => c.trim()) && !isTotalsRow(r))
    if (rows.length < 2) return null
    // A column is chartable when every non-empty cell in it reads as a number.
    const metricColumns = table.headers
      .map((label, col) => ({ label, col }))
      .filter(({ col }) => {
        if (col === 0) return false // the label column (months)
        const cells = rows.map(r => (r[col] || '').trim()).filter(Boolean)
        return cells.length >= 2 && cells.every(c => parseMetric(c) !== null)
      })
    if (!metricColumns.length) return null
    return { rows, metricColumns }
  }, [table])

  if (!model) return null
  const { rows, metricColumns } = model

  const active = metricColumns.find(m => m.col === metricIdx) ?? metricColumns[0]
  const values = rows.map(r => parseMetric((r[active.col] || '').trim()))
  const max = Math.max(...values.map(v => v ?? 0))
  if (max <= 0) return null

  const barsLabel = lang === 'en' ? 'Bars' : 'עמודות'
  const lineLabel = lang === 'en' ? 'Trend' : 'מגמה'

  return (
    <div className="stats-chart rp-anim rp-up rp-d3">
      <div className="stats-chart-head" role="tablist">
        {metricColumns.map(m => (
          <button
            key={m.col}
            role="tab"
            aria-selected={m.col === active.col}
            className={`stats-chart-chip${m.col === active.col ? ' on' : ''}`}
            onClick={() => setMetricIdx(m.col)}
          >
            {m.label}
          </button>
        ))}
        {/* Bars ↔ trend switch, set apart from the metric chips. */}
        <div className="stats-chart-mode" role="tablist" aria-label={`${barsLabel} / ${lineLabel}`}>
          <button
            role="tab"
            aria-selected={mode === 'bars'}
            className={`stats-chart-chip${mode === 'bars' ? ' on' : ''}`}
            onClick={() => setMode('bars')}
            title={barsLabel}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <line x1="6" y1="20" x2="6" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="18" y1="20" x2="18" y2="14" />
            </svg>
            {barsLabel}
          </button>
          <button
            role="tab"
            aria-selected={mode === 'line'}
            className={`stats-chart-chip${mode === 'line' ? ' on' : ''}`}
            onClick={() => setMode('line')}
            title={lineLabel}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
            </svg>
            {lineLabel}
          </button>
        </div>
      </div>
      {mode === 'bars' ? (
        <div className="stats-chart-plot">
          {rows.map((row, i) => {
            const v = values[i]
            const h = v === null ? 0 : Math.max(4, (v / max) * 100)
            return (
              <div
                key={i}
                className="stats-chart-col"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="stats-chart-value" style={{ opacity: hovered === null || hovered === i ? 1 : 0.35 }}>
                  {(row[active.col] || '').trim() || '—'}
                </div>
                <div className="stats-chart-track">
                  {/* Keyed by metric so switching replays the grow animation. */}
                  <div
                    key={active.col}
                    className={`stats-chart-bar${hovered === i ? ' hot' : ''}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <div className="stats-chart-label">{(row[0] || '').trim()}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <TrendPlot
          key={active.col}
          rows={rows}
          col={active.col}
          values={values}
          max={max}
          hovered={hovered}
          onHover={setHovered}
        />
      )}
    </div>
  )
}

/**
 * The trend view: one SVG, fixed viewBox, months on the x-axis in reading
 * order (first row at the inline start — right, in Hebrew). Text lives inside
 * the SVG so labels, dots and the line can never drift apart when the card
 * resizes.
 */
function TrendPlot({ rows, col, values, max, hovered, onHover }: {
  rows: string[][]
  col: number
  values: (number | null)[]
  max: number
  hovered: number | null
  onHover: (i: number | null) => void
}) {
  const W = 700
  const H = 250
  const TOP = 42 // room for the value labels above the peaks
  const BOTTOM = 34 // room for the month labels
  const SIDE = 60
  const n = rows.length

  // RTL reading order: row 0 sits at the right edge, like the bars.
  const x = (i: number) => SIDE + ((n - 1 - i) / (n - 1)) * (W - SIDE * 2)
  const y = (v: number) => TOP + (1 - v / max) * (H - TOP - BOTTOM)

  const pts = values.map((v, i) => (v === null ? null : { i, px: x(i), py: y(v) }))
  const line = pts.filter(Boolean) as { i: number; px: number; py: number }[]
  if (line.length < 2) return null

  const path = line.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.px},${p.py}`).join(' ')
  const area = `${path} L${line[line.length - 1].px},${H - BOTTOM} L${line[0].px},${H - BOTTOM} Z`

  // Past six points the value labels start colliding at the dense end, so a
  // crowded trend shows values on hover only — the dots still tell the shape.
  const dense = line.length > 6

  return (
    <svg className="stats-chart-trend" viewBox={`0 0 ${W} ${H}`} role="img">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Quiet horizontal guides, the table's hairline grammar. */}
      {[0.25, 0.5, 0.75].map(f => {
        const gy = TOP + f * (H - TOP - BOTTOM)
        return <line key={f} x1={SIDE / 2} x2={W - SIDE / 2} y1={gy} y2={gy} stroke="rgba(255,255,255,0.05)" />
      })}
      <path d={area} fill="url(#trend-fill)" />
      <path d={path} fill="none" stroke="var(--brand-cyan)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="stats-chart-trend-line" />
      {line.map(p => (
        <g
          key={p.i}
          onMouseEnter={() => onHover(p.i)}
          onMouseLeave={() => onHover(null)}
          opacity={hovered === null || hovered === p.i ? 1 : 0.4}
          style={{ transition: 'opacity .2s' }}
        >
          {/* Generous invisible hit area — the visible dot is small. */}
          <circle cx={p.px} cy={p.py} r="22" fill="transparent" />
          <circle cx={p.px} cy={p.py} r={hovered === p.i ? 7 : 5} fill="var(--bg-dark)" stroke="var(--brand-cyan)" strokeWidth="2.5" />
          <text
            x={p.px}
            y={p.py - 16}
            textAnchor="middle"
            className="stats-chart-trend-value"
            opacity={dense ? (hovered === p.i ? 1 : 0) : 1}
            style={{ transition: 'opacity .2s' }}
          >
            {(rows[p.i][col] || '').trim()}
          </text>
          <text x={p.px} y={H - 10} textAnchor="middle" className="stats-chart-trend-label">
            {(rows[p.i][0] || '').trim()}
          </text>
        </g>
      ))}
    </svg>
  )
}
