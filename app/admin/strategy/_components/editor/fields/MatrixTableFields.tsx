'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import { newMatrixRow, emptyCell, uid } from '@/lib/strategy/registry'
import type { MatrixTableSection, MatrixCell, CellTint } from '@/lib/strategy/types'
import { Field, TextInput, AddButton, inputStyle } from './controls'
import { useImageUpload } from './useImageUpload'
import type { FieldProps } from './index'

/**
 * The Facing table editor.
 *
 * Columns can only be added, removed and reordered on the free preset; the
 * awareness and attack-angle tables have fixed columns by definition, and
 * letting them drift would leave three slides that look alike but behave
 * differently.
 *
 * Beyond five competitor columns nothing is legible on a 16:9 slide, so the add
 * button disables with a note rather than silently letting the operator build
 * something unreadable.
 */

const MAX_COLUMNS = 5

const TINTS: { value: CellTint; label: string; swatch: string }[] = [
  { value: 'none', label: 'ללא', swatch: 'transparent' },
  { value: 'white', label: 'לבן', swatch: 'rgba(255,255,255,0.34)' },
  { value: 'green', label: 'ירוק', swatch: 'rgba(46,196,182,0.6)' },
  { value: 'light', label: 'ירוק בהיר', swatch: 'rgba(163,230,53,0.6)' },
  { value: 'alert', label: 'כתום־אדום', swatch: 'rgba(239,88,52,0.6)' },
]

export default function MatrixTableFields({ section, onChange, ensureDoc }: FieldProps<MatrixTableSection>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingColumn = useRef<string | null>(null)
  const { upload, uploading, error } = useImageUpload(ensureDoc)
  const [openCell, setOpenCell] = useState<{ row: string; col: string } | null>(null)

  const isFree = section.preset === 'free'

  const setRows = (rows: MatrixTableSection['rows']) => onChange({ rows })

  const patchCell = (rowId: string, colId: string, patch: Partial<MatrixCell>) =>
    setRows(section.rows.map(r =>
      r.id === rowId
        ? { ...r, cells: { ...r.cells, [colId]: { ...(r.cells[colId] ?? emptyCell()), ...patch } } }
        : r,
    ))

  const addColumn = () => {
    const column = { id: uid(), label: `עמודה ${section.columns.length + 1}` }
    onChange({
      columns: [...section.columns, column],
      // Every row gets the new cell immediately, so the grid can never render
      // a hole while the normalizer catches up.
      rows: section.rows.map(r => ({ ...r, cells: { ...r.cells, [column.id]: emptyCell() } })),
    })
  }

  const removeColumn = (colId: string) => {
    onChange({
      columns: section.columns.filter(c => c.id !== colId),
      rows: section.rows.map(r => {
        const cells = { ...r.cells }
        delete cells[colId]
        return { ...r, cells }
      }),
    })
  }

  const moveColumn = (index: number, delta: number) => {
    const next = section.columns.slice()
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ columns: next })
  }

  const pickLogo = async (file?: File) => {
    const colId = pendingColumn.current
    pendingColumn.current = null
    if (!file || !colId) return
    const result = await upload(file)
    if (result) {
      onChange({
        columns: section.columns.map(c =>
          c.id === colId ? { ...c, logo: { file_path: result.file_path, alt: c.label } } : c,
        ),
      })
    }
  }

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />

      {isFree && (
        <>
          <span className="block text-xs mb-2" style={{ color: 'var(--admin-text-muted)' }}>עמודות</span>
          {section.columns.map((column, i) => (
            <div key={column.id} className="flex items-center gap-1.5 mb-1.5">
              <div className="flex flex-col">
                <button type="button" onClick={() => moveColumn(i, -1)} disabled={i === 0} className="p-0.5 opacity-60 hover:opacity-100 disabled:opacity-20" aria-label="הזז ימינה">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => moveColumn(i, 1)} disabled={i === section.columns.length - 1} className="p-0.5 opacity-60 hover:opacity-100 disabled:opacity-20" aria-label="הזז שמאלה">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
              {column.logo?.file_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetProxyUrl(column.logo.file_path)} alt="" className="w-8 h-8 rounded object-contain bg-white p-0.5" />
              )}
              <input
                className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none" style={inputStyle}
                value={column.label}
                onChange={e => onChange({ columns: section.columns.map(c => (c.id === column.id ? { ...c, label: e.target.value } : c)) })}
              />
              <button
                type="button" disabled={uploading}
                onClick={() => { pendingColumn.current = column.id; fileRef.current?.click() }}
                className="p-1.5 rounded-lg opacity-70 hover:opacity-100" style={{ color: 'var(--admin-text-muted)' }}
                aria-label="לוגו"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button" onClick={() => removeColumn(column.id)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100" style={{ color: '#ef4444' }}
                aria-label="הסר עמודה"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {error && <span className="block text-xs mb-2" style={{ color: '#ef4444' }}>{error}</span>}
          <div className="mb-4">
            {section.columns.length < MAX_COLUMNS ? (
              <AddButton onClick={addColumn}>עמודה</AddButton>
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--admin-text-muted)' }}>
                {MAX_COLUMNS} עמודות הן המרב שנקרא היטב בשקף
              </span>
            )}
          </div>
        </>
      )}

      <span className="block text-xs mb-2" style={{ color: 'var(--admin-text-muted)' }}>שורות</span>
      {section.rows.map((row, i) => (
        <div key={row.id} className="rounded-xl p-2.5 mb-2" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] w-4" style={{ color: 'var(--admin-text-muted)' }}>{i + 1}</span>
            <input
              className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none" style={inputStyle}
              value={row.header} placeholder="שם השורה"
              onChange={e => setRows(section.rows.map(r => (r.id === row.id ? { ...r, header: e.target.value } : r)))}
            />
            <button type="button" onClick={() => setRows(section.rows.filter(r => r.id !== row.id))} className="p-1.5 rounded-lg opacity-60 hover:opacity-100" style={{ color: '#ef4444' }} aria-label="הסר שורה">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(section.columns.length, 3)}, 1fr)` }}>
            {section.columns.map(column => {
              const cell = row.cells[column.id] ?? emptyCell()
              const isOpen = openCell?.row === row.id && openCell?.col === column.id
              return (
                <div key={column.id}>
                  <button
                    type="button"
                    onClick={() => setOpenCell(isOpen ? null : { row: row.id, col: column.id })}
                    className="w-full px-2 py-1.5 rounded-lg text-[11px] truncate text-start"
                    style={{
                      ...inputStyle,
                      borderColor: cell.tint === 'none' ? 'var(--admin-border)' : TINTS.find(t => t.value === cell.tint)?.swatch,
                    }}
                    title={column.label}
                  >
                    {cell.checks > 0 ? '✓'.repeat(cell.checks) : cell.text || column.label}
                  </button>

                  {isOpen && (
                    <div className="mt-1 p-2 rounded-lg" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                      <input
                        className="w-full px-2 py-1 rounded text-[11px] outline-none mb-1.5" style={inputStyle}
                        value={cell.text} placeholder="טקסט"
                        onChange={e => patchCell(row.id, column.id, { text: e.target.value, checks: 0 })}
                      />
                      <div className="flex gap-1 mb-1.5">
                        {[0, 1, 2, 3].map(n => (
                          <button
                            key={n} type="button"
                            onClick={() => patchCell(row.id, column.id, { checks: n, text: n > 0 ? '' : cell.text })}
                            className="flex-1 py-1 rounded text-[11px]"
                            style={{ ...inputStyle, opacity: cell.checks === n ? 1 : 0.5 }}
                          >
                            {n === 0 ? '—' : '✓'.repeat(n)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {TINTS.map(tint => (
                          <button
                            key={tint.value} type="button" title={tint.label}
                            onClick={() => patchCell(row.id, column.id, { tint: tint.value })}
                            className="flex-1 h-5 rounded"
                            style={{
                              background: tint.swatch,
                              border: `1px solid ${cell.tint === tint.value ? 'var(--admin-text-primary)' : 'var(--admin-border)'}`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <AddButton onClick={() => setRows([...section.rows, newMatrixRow(section.columns)])}>שורה</AddButton>
    </>
  )
}
