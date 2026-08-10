import { describe, it, expect } from 'vitest'
import {
  newStatsBlock,
  newStatsGroup,
  newStatsKpi,
  newFunnelStage,
  normalizeStats,
  hasStatsContent,
  funnelWidths,
  type StatsBlock,
} from '@/lib/launch-stats'

describe('normalizeStats', () => {
  it('returns an empty block for null/undefined/garbage', () => {
    expect(normalizeStats(null)).toEqual({ kpis: [], groups: [] })
    expect(normalizeStats(undefined)).toEqual({ kpis: [], groups: [] })
    expect(normalizeStats('junk' as unknown as StatsBlock)).toEqual({ kpis: [], groups: [] })
  })

  it('tolerates partial rows and coerces non-strings', () => {
    const b = normalizeStats({
      kpis: [{ label: 'חשיפות' }, { value: 42 }] as unknown as StatsBlock['kpis'],
      groups: [{ title: 'Meta' }] as unknown as StatsBlock['groups'],
      table: { headers: ['ערוץ', 7], rows: [['Meta', null], 'bad'] } as unknown as StatsBlock['table'],
    } as StatsBlock)

    expect(b.kpis).toHaveLength(2)
    expect(b.kpis[0]).toMatchObject({ label: 'חשיפות', value: '' })
    expect(b.kpis[1].value).toBe('') // 42 is not a string — coerced to empty, never parsed
    expect(b.kpis.every(k => k.id)).toBe(true)
    expect(b.groups[0]).toMatchObject({ title: 'Meta', kpis: [] })
    expect(b.table).toEqual({ headers: ['ערוץ', ''], rows: [['Meta', ''], []] })
  })

  it('keeps sublabel/highlight/note only when present', () => {
    const full = normalizeStats({
      kpis: [{ id: 'a', label: 'רכישות', value: '94', sublabel: 'Meta + Google', highlight: true }],
      groups: [],
      note: 'נכון ל-26.06',
    })
    expect(full.kpis[0]).toEqual({ id: 'a', label: 'רכישות', value: '94', sublabel: 'Meta + Google', highlight: true })
    expect(full.note).toBe('נכון ל-26.06')

    const bare = normalizeStats({ kpis: [{ id: 'a', label: 'x', value: '1' }], groups: [] })
    expect('sublabel' in bare.kpis[0]).toBe(false)
    expect('highlight' in bare.kpis[0]).toBe(false)
    expect('note' in bare).toBe(false)
  })
})

describe('hasStatsContent', () => {
  it('is false for empty blocks', () => {
    expect(hasStatsContent(null)).toBe(false)
    expect(hasStatsContent(newStatsBlock())).toBe(false)
    expect(hasStatsContent({ kpis: [newStatsKpi()], groups: [] })).toBe(false) // no label, no value
  })

  it('a labeled KPI counts even with an empty value (template preview must render)', () => {
    expect(hasStatsContent({ kpis: [newStatsKpi('חשיפות')], groups: [] })).toBe(true)
  })

  it('a valued KPI counts', () => {
    const k = { ...newStatsKpi(), value: '8,457,214' }
    expect(hasStatsContent({ kpis: [k], groups: [] })).toBe(true)
  })

  it('a group needs a title AND at least one non-empty KPI', () => {
    const titledEmpty = { kpis: [], groups: [{ ...newStatsGroup('Meta'), kpis: [newStatsKpi()] }] }
    expect(hasStatsContent(titledEmpty)).toBe(false)

    const titledLabeled = { kpis: [], groups: [{ ...newStatsGroup('Meta'), kpis: [newStatsKpi('חשיפות')] }] }
    expect(hasStatsContent(titledLabeled)).toBe(true)

    const untitled = { kpis: [], groups: [{ ...newStatsGroup(), kpis: [newStatsKpi('חשיפות')] }] }
    expect(hasStatsContent(untitled)).toBe(false)
  })

  it('a funnel stage with a label or a value counts', () => {
    expect(hasStatsContent({ kpis: [], groups: [], funnel: { title: 'x', stages: [] } })).toBe(false)
    expect(hasStatsContent({ kpis: [], groups: [], funnel: { title: '', stages: [newFunnelStage()] } })).toBe(false)
    expect(hasStatsContent({ kpis: [], groups: [], funnel: { title: '', stages: [newFunnelStage('25%')] } })).toBe(true)
  })

  it('a table needs at least one non-empty cell; headers alone are not content', () => {
    expect(hasStatsContent({ kpis: [], groups: [], table: { headers: ['ערוץ'], rows: [] } })).toBe(false)
    expect(hasStatsContent({ kpis: [], groups: [], table: { headers: ['ערוץ'], rows: [['', '']] } })).toBe(false)
    expect(hasStatsContent({ kpis: [], groups: [], table: { headers: ['ערוץ'], rows: [['Meta']] } })).toBe(true)
  })
})

describe('funnelWidths', () => {
  // Non-numeric values so these cases exercise the percent path — with
  // numeric values the widths come from the values instead (tested below).
  const stage = (percent?: string) => ({ ...newFunnelStage('s'), value: '—', ...(percent ? { percent } : {}) })

  it('draws from the stage values first, so step-conversion percents cannot invert the shape', () => {
    // The sales funnel: percent carries "closed 66.9% OF ARRIVALS" — bigger
    // than the previous stage's percent. The bars must still narrow, because
    // the quantities do.
    const stages = [
      { ...newFunnelStage('a'), value: '4,641', percent: '100%' },
      { ...newFunnelStage('b'), value: '787', percent: '17%' },
      { ...newFunnelStage('c'), value: '447', percent: '56.8% מהפגישות' },
      { ...newFunnelStage('d'), value: '299', percent: '66.9% מהמגיעים' },
    ]
    const w = funnelWidths(stages)
    expect(w[0]).toBe(100)
    expect(w[1]).toBeGreaterThan(w[2])
    expect(w[2]).toBeGreaterThan(w[3])
    expect(Math.round(w[1])).toBe(17)
  })

  it('follows the real percentages, scaled to the widest stage', () => {
    // Lafayette's YouTube retention: 38.04 / 15.27 / 11.44 / 9.08
    const w = funnelWidths(['38.04%', '15.27%', '11.44%', '9.08%'].map(p => stage(p)))
    expect(w[0]).toBe(100)
    expect(Math.round(w[1])).toBe(40)
    expect(Math.round(w[3])).toBe(24)
    // A steep real drop must not be flattened into an even taper.
    expect(w[1]).toBeLessThan(60)
  })

  it('floors a tiny tail so it stays visible', () => {
    const w = funnelWidths([stage('100%'), stage('0.5%')])
    expect(w[1]).toBe(6)
  })

  it('falls back to an even taper when any stage has no usable percent', () => {
    const w = funnelWidths([stage('38%'), stage(), stage('9%')])
    expect(w).toEqual([100, 70, 40])
  })

  it('handles the empty case', () => {
    expect(funnelWidths([])).toEqual([])
  })
})
