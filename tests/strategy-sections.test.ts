import { describe, it, expect } from 'vitest'
import { SECTION_KINDS, ALL_SECTION_KINDS, createPresetMatrix } from '@/lib/strategy/registry'
import { normalizeSection, normalizeSections, serializeSections, isUnknownSection } from '@/lib/strategy/normalize'
import { createBrandPositioningTemplate, TEMPLATE_SECTION_COUNT } from '@/lib/strategy/template'
import type { SectionKind, MatrixTableSection, HeatGaugesSection, PositioningMapSection } from '@/lib/strategy/types'

const kinds = ALL_SECTION_KINDS

describe('registry completeness', () => {
  it('covers every kind in the union exactly once', () => {
    expect(kinds.length).toBe(9)
    for (const kind of kinds) {
      expect(SECTION_KINDS[kind].kind).toBe(kind)
      expect(SECTION_KINDS[kind].labelKey).toMatch(/^strategy\.kind\./)
    }
  })

  it('gives every kind a factory that produces its own kind', () => {
    for (const kind of kinds) {
      expect(SECTION_KINDS[kind].create().kind).toBe(kind)
    }
  })
})

describe('normalizeSection — round-trips a freshly created section', () => {
  it.each(kinds)('%s survives normalization unchanged', kind => {
    const created = SECTION_KINDS[kind].create()
    expect(normalizeSection(created)).toEqual(created)
  })
})

/**
 * The regression that matters. In the campaign builder the editor autosaved the
 * document it loaded, so any field the loader forgot to copy was erased from
 * the database by the next save — distribution plans were lost that way. These
 * assert the loader is additive, never subtractive.
 */
describe('normalizeSection — never drops data', () => {
  it.each(kinds)('keeps an unknown field on a %s section', kind => {
    const withFuture = { ...SECTION_KINDS[kind].create(), fieldFromAFutureDeploy: 'keep me' }
    const out = normalizeSection(withFuture) as unknown as Record<string, unknown>
    expect(out.fieldFromAFutureDeploy).toBe('keep me')
  })

  it('keeps a whole section whose kind this deploy has never heard of', () => {
    const alien = { kind: 'not_yet_invented', id: 'abc', payload: { deep: [1, 2, 3] } }
    const parsed = normalizeSection(alien)
    expect(isUnknownSection(parsed)).toBe(true)
    // And it must serialize back byte-for-byte, not as a placeholder.
    expect(serializeSections([parsed])).toEqual([alien])
  })

  it('round-trips a mixed document without losing anything', () => {
    const stored: unknown[] = [
      SECTION_KINDS.statement.create(),
      { kind: 'from_the_future', id: 'x1', whatever: true },
      SECTION_KINDS.heat_gauges.create(),
    ]
    expect(serializeSections(normalizeSections(stored))).toEqual(stored)
  })
})

describe('normalizeSection — hostile input never throws', () => {
  const hostile: unknown[] = [
    null,
    undefined,
    42,
    'a string',
    {},
    { kind: 'matrix_table', rows: 'not an array', columns: null },
    { kind: 'heat_gauges', gauges: [{ value: 'seven' }, { value: 999 }, null] },
    { kind: 'positioning_map', points: [{ x: 50, y: -80 }], zones: [{ r: 12 }] },
    { kind: 'info', groups: [{ bullets: 'nope' }] },
    { kind: 'boxes', boxes: null },
  ]

  it.each(hostile.map((h, i) => [i, h] as const))('input #%i is handled', (_i, input) => {
    expect(() => normalizeSection(input)).not.toThrow()
  })

  it('clamps a gauge to the 0-10 half-step grid a slider can actually reach', () => {
    const s = normalizeSection({ kind: 'heat_gauges', gauges: [{ value: 999 }, { value: -4 }, { value: 3.27 }] }) as HeatGaugesSection
    expect(s.gauges.map(g => g.value)).toEqual([10, 0, 3.5])
  })

  it('clamps map coordinates into the plot instead of rendering off-canvas', () => {
    const s = normalizeSection({ kind: 'positioning_map', points: [{ x: 50, y: -80 }], zones: [{ r: 12 }] }) as PositioningMapSection
    expect(s.points[0]).toMatchObject({ x: 1, y: -1 })
    expect(s.zones[0].r).toBeLessThanOrEqual(0.9)
  })
})

/**
 * Cells are keyed by column id, never by index: with an index-parallel array,
 * removing a column shifts every row's data by one and the deck still renders,
 * so nobody notices until a client sees a competitor credited with the wrong
 * capability.
 */
describe('matrix_table — cells follow their column', () => {
  it('drops cells for a removed column and fills cells for a new one', () => {
    const table = SECTION_KINDS.matrix_table.create()
    const [first, second] = table.columns
    table.rows[0].cells[first.id] = { text: 'A', checks: 0, tint: 'green', checkTint: 'none' }
    table.rows[0].cells[second.id] = { text: 'B', checks: 0, tint: 'alert', checkTint: 'none' }

    const withColumnRemoved = { ...table, columns: [second] }
    const out = normalizeSection(withColumnRemoved) as MatrixTableSection

    expect(Object.keys(out.rows[0].cells)).toEqual([second.id])
    // The surviving column keeps its own value — not the removed column's.
    expect(out.rows[0].cells[second.id].text).toBe('B')
  })

  it('gives a row a blank cell for a column added after it', () => {
    const table = SECTION_KINDS.matrix_table.create()
    const added = { id: 'new-col', label: 'מתחרה 3' }
    const out = normalizeSection({ ...table, columns: [...table.columns, added] }) as MatrixTableSection
    expect(out.rows[0].cells['new-col']).toEqual({ text: '', checks: 0, tint: 'none', checkTint: 'none' })
  })

  it('locks the preset tables to their fixed columns', () => {
    expect((createPresetMatrix('checks') as MatrixTableSection).columns.map(c => c.label)).toEqual(['יודע', 'לא יודע'])
    expect((createPresetMatrix('twocol') as MatrixTableSection).columns.map(c => c.label)).toEqual(['זווית תקיפה'])
  })

  it('rejects an invented tint rather than emitting an unstyled cell', () => {
    const table = SECTION_KINDS.matrix_table.create()
    const colId = table.columns[0].id
    table.rows[0].cells[colId] = { text: '', checks: 0, tint: 'neon' as never, checkTint: 'none' }
    expect((normalizeSection(table) as MatrixTableSection).rows[0].cells[colId].tint).toBe('none')
  })

  it('gives the check its own colour, independent of the cell background', () => {
    // A red "doesn't know" cell with a green tick reads as a contradiction.
    const table = SECTION_KINDS.matrix_table.create()
    const colId = table.columns[0].id
    table.rows[0].cells[colId] = { text: '', checks: 1, tint: 'alert', checkTint: 'alert' }
    const out = normalizeSection(table) as MatrixTableSection
    expect(out.rows[0].cells[colId]).toMatchObject({ tint: 'alert', checkTint: 'alert' })
  })
})

describe('the brand-positioning template', () => {
  const template = createBrandPositioningTemplate()

  it('lays out the whole deck as specified', () => {
    expect(template).toHaveLength(TEMPLATE_SECTION_COUNT)
  })

  it('opens with the plan-purpose statement and closes with the concept slide', () => {
    expect(template[0]).toMatchObject({ kind: 'statement', title: 'מטרת התכנית' })
    expect(template[template.length - 1]).toMatchObject({ kind: 'split_media', title: 'קונספט', mediaSide: 'end' })
  })

  it('includes all nine technical-information slides', () => {
    const infos = template.filter(s => s.kind === 'info')
    expect(infos).toHaveLength(9)
    expect(infos[0].title).toBe('מה?')
  })

  it('marks המיצוב as the hero statement — the deck hangs on it', () => {
    const hero = template.filter(s => s.kind === 'statement' && s.variant === 'hero')
    expect(hero).toHaveLength(1)
    expect(hero[0].title).toBe('מיצוב')
  })

  it('carries the fixed copy from the spec, not placeholders', () => {
    const purpose = template[0]
    if (purpose.kind !== 'statement') throw new Error('expected a statement')
    const text = JSON.stringify(purpose.body)
    expect(text).toContain('מיצוב המותג הינו בסיס לפעילות בכלל הערוצים')
  })

  it('gives every section a unique id', () => {
    const ids = template.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('survives a normalize round-trip untouched', () => {
    expect(normalizeSections(template)).toEqual(template)
  })

  it('uses only kinds the registry knows', () => {
    for (const section of template) {
      expect(kinds).toContain(section.kind as SectionKind)
    }
  })
})
