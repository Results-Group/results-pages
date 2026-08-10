import { describe, it, expect } from 'vitest'
import { sectionFromApi } from '@/app/admin/campaigns/_components/editor/types'
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
