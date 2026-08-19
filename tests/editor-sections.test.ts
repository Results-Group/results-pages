import { describe, it, expect } from 'vitest'
import { sectionFromApi, sectionToApi } from '@/app/admin/campaigns/_components/editor/types'
import { newDistributionPlan } from '@/lib/distribution'

/**
 * The editor autosaves the document it loaded, so anything this mapper drops on
 * load is erased from the database by the next save. These tests exist because
 * that already happened once: distribution plans saved correctly, vanished on
 * reload, and were wiped on publish.
 */
describe('sectionFromApi', () => {
  it('carries the distribution plan through a load', () => {
    const plan = { ...newDistributionPlan(), paragraph: 'תוכנית הפצה', channels: [{ id: 'a', name: 'Meta', budget: 5000 }] }
    const section = sectionFromApi({ id: 's1', mockup_type: 'distribution', plan }, [])
    expect(section.plan).toEqual(plan)
    expect(section.plan?.channels[0].budget).toBe(5000)
  })

  it('leaves plan undefined for sections that have none', () => {
    expect(sectionFromApi({ id: 's1', mockup_type: 'general' }, []).plan).toBeUndefined()
  })

  it('carries the stats block through a load', () => {
    const stats = {
      kpis: [{ id: 'k1', label: 'חשיפות', value: '8,457,214', highlight: true }],
      groups: [{ id: 'g1', title: 'Meta', kpis: [{ id: 'k2', label: 'השקעה', value: '₪29,920' }] }],
      table: { headers: ['ערוץ', 'קליקים'], rows: [['Meta', '9,643']] },
      note: 'נכון ל-26.06',
    }
    const section = sectionFromApi({ id: 's1', mockup_type: 'stats', stats }, [])
    expect(section.stats).toEqual(stats)
  })

  it('leaves stats undefined for sections that have none', () => {
    expect(sectionFromApi({ id: 's1', mockup_type: 'general' }, []).stats).toBeUndefined()
  })

  it('keeps every editable field', () => {
    const section = sectionFromApi({
      id: 's1',
      title: 'כותרת',
      mockup_type: 'instagram_feed',
      description: 'תיאור',
      copyIds: ['c1'],
      assets: [{ id: 'a1', type: 'image', file_path: 'p.webp', url: '', caption: 'כיתוב', public_url: '' }],
    }, ['c1', 'c2'])

    expect(section).toMatchObject({
      id: 's1',
      title: 'כותרת',
      mockup_type: 'instagram_feed',
      description: 'תיאור',
      copyIds: ['c1'],
    })
    expect(section.assets[0]).toMatchObject({ id: 'a1', file_path: 'p.webp', caption: 'כיתוב' })
  })

  it('maps the legacy useCopies flag onto copyIds', () => {
    expect(sectionFromApi({ id: 's1', useCopies: true }, ['c1', 'c2']).copyIds).toEqual(['c1', 'c2'])
    expect(sectionFromApi({ id: 's1', useCopies: false }, ['c1', 'c2']).copyIds).toEqual([])
    // An explicit copyIds array always wins over the legacy flag
    expect(sectionFromApi({ id: 's1', useCopies: true, copyIds: [] }, ['c1']).copyIds).toEqual([])
  })

  it('fills defaults for a half-written section', () => {
    const section = sectionFromApi({}, [])
    expect(section.id).toBeTruthy()
    expect(section.mockup_type).toBe('general')
    expect(section.title).toBe('')
    expect(section.assets).toEqual([])
  })
})

/**
 * The structural closure of the wipe trap: load → serialize must return
 * exactly what came from the API. A field added to sectionFromApi but
 * forgotten in sectionToApi (or vice versa) fails HERE instead of silently
 * erasing operator data on the next autosave. When adding a section field,
 * add it to this fixture too.
 */
describe('sectionToApi round-trip (never drops data)', () => {
  const fullSection = {
    id: 's-full',
    title: 'כותרת',
    mockup_type: 'divider' as const,
    description: 'תיאור',
    copyIds: ['c1', 'c2'],
    overviewLabel: 'סקירת השקה',
    plan: { ...newDistributionPlan(), bullets: ['נקודה'], channels: [{ id: 'ch1', name: 'Meta', budget: 5000, percent: 50, formats: 'פיד', audience: 'Broad', start: '2026-08-01', end: '2026-08-31' }] },
    stats: {
      kpis: [{ id: 'k1', label: 'חשיפות', value: '1,000', sublabel: 'תת', highlight: true }],
      groups: [{ id: 'g1', title: 'Meta', kpis: [{ id: 'k2', label: 'השקעה', value: '₪1' }] }],
      funnel: { title: 'משפך', stages: [{ id: 'f1', label: 'לידים', value: '10', percent: '100%' }] },
      table: { headers: ['א', 'ב'], rows: [['1', '2']] },
      note: 'הערה',
    },
    profile: { name: 'Medera', handle: '@medera', coverPath: 'p/cover.webp', avatarPath: 'p/logo.webp', bio: 'ביו' },
    assets: [{ id: 'a1', type: 'image' as const, file_path: 'p.webp', public_url: 'https://x/p.webp', url: 'https://youtu.be/x', caption: 'כיתוב' }],
  }

  it('api → editor → api returns the identical section', () => {
    const roundTripped = sectionToApi(sectionFromApi(fullSection, []))
    // public_url is editor-only (derived on load, never persisted) — everything
    // else must survive byte for byte.
    const { assets, ...rest } = fullSection
    expect(roundTripped).toEqual({
      ...rest,
      assets: assets.map(({ public_url: _drop, ...a }) => a),
    })
  })

  it('a sparse section round-trips without inventing fields', () => {
    const sparse = { id: 's-min', title: '', mockup_type: 'general' as const, description: '', copyIds: [], assets: [] }
    expect(sectionToApi(sectionFromApi(sparse, []))).toEqual(sparse)
  })
})
