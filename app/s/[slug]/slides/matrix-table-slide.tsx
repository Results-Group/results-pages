'use client'

import { assetProxyUrl } from '@/lib/asset-url'
import { useLogoNeedsDarkBackdrop } from '@/app/c/[slug]/mockups/useLogoContrast'
import { matrixHeaderLabel } from '@/lib/strategy/registry'
import type { MatrixTableSection, MatrixColumn, MatrixCell } from '@/lib/strategy/types'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/**
 * The table behind three slides in the spec: the Facing comparison (free-form,
 * competitor logos in the headers, tinted cells), the awareness table and the
 * attack-angle table — the last two being the same component with their columns
 * locked, which is what stops this being three components and three mobile
 * layouts to keep in step.
 *
 * On mobile the whole grid collapses to one card per row, and each cell grows a
 * real label element. The distribution table's trick (hide the header row and
 * emit the label with content: attr(data-label)) can't work here: a Facing
 * header may be an image, and `content:` cannot render one.
 */

/** An SVG, not the ✓ character: the Ping font has no glyph for it, so the
 *  fallback font's check jumps in weight and baseline across platforms. */
function Check() {
  return (
    <svg className="pos-check" width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ColumnHeading({ column }: { column: MatrixColumn }) {
  const src = column.logo?.file_path ? assetProxyUrl(column.logo.file_path) : ''
  // The hook answers "is this artwork light?" — it was written for logos on a
  // white avatar circle. Here the ground is near-black, so the answer is
  // inverted: a *dark* competitor logo is the one that disappears and needs a
  // white chip behind it.
  const isLightLogo = useLogoNeedsDarkBackdrop(src)
  const needsWhiteChip = !!src && !isLightLogo

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- same-origin proxy
      <img
        src={src}
        alt={column.label}
        className={`pos-th-logo${needsWhiteChip ? ' needs-backdrop' : ''}`}
      />
    )
  }
  return <span>{column.label}</span>
}

function CellBody({ cell }: { cell: MatrixCell }) {
  if (cell.checks > 0) {
    return (
      <span className="pos-checks" aria-label={`${cell.checks}`}>
        {Array.from({ length: cell.checks }, (_, i) => <Check key={i} />)}
      </span>
    )
  }
  return <>{cell.text}</>
}

export default function MatrixTableSlide({ section, edit }: SlideProps<MatrixTableSection>) {
  const { columns, rows } = section
  const headerLabel = matrixHeaderLabel(section)
  const hasContent = rows.some(r => r.header.trim() || Object.values(r.cells).some(c => c.text.trim() || c.checks > 0))

  return (
    <div className="pos-table-slide">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      {!hasContent && <EmptyHint edit={edit}>הוסיפו שורות לטבלה</EmptyHint>}

      <div
        className="pos-table rp-anim rp-up rp-d3"
        style={{
          // The row-header column is wider than the data columns, which share
          // the rest evenly however many there are.
          gridTemplateColumns: `minmax(120px, 1.4fr) repeat(${columns.length}, minmax(90px, 1fr))`,
        }}
        role="table"
      >
        {/* Header row */}
        <div className="pos-th pos-th-corner">{headerLabel}</div>
        {columns.map(column => (
          <div className="pos-th" key={column.id}>
            <ColumnHeading column={column} />
          </div>
        ))}

        {/* Body */}
        {rows.map(row => (
          <div key={row.id} style={{ display: 'contents' }}>
            <div className="pos-cell pos-row-header">{row.header}</div>
            {columns.map(column => {
              const cell = row.cells[column.id] ?? { text: '', checks: 0, tint: 'none' as const }
              return (
                <div className="pos-cell" key={column.id} data-tint={cell.tint}>
                  {/* Hidden on desktop; on mobile it is what tells the reader
                      which column this value belongs to. */}
                  <span className="pos-cell-label" aria-hidden="true">
                    {column.logo?.file_path
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={assetProxyUrl(column.logo.file_path)} alt="" />
                      : column.label}
                  </span>
                  <CellBody cell={cell} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
