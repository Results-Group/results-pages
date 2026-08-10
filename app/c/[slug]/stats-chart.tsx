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

export default function StatsChart({ table }: { table: StatsTable }) {
  const [metricIdx, setMetricIdx] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

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
      </div>
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
    </div>
  )
}
