import { describe, it, expect } from 'vitest'
import { hasUnsavedNewWork } from '@/lib/campaign-dirty'

const empty = { meta: { client: '', campaignName: '', concept: '' }, sections: [] }

describe('hasUnsavedNewWork', () => {
  it('an existing campaign is never "new work" — autosave owns it', () => {
    expect(hasUnsavedNewWork({ ...empty, sections: [{}] }, 'some-id')).toBe(false)
  })

  it('a pristine new editor loses nothing', () => {
    expect(hasUnsavedNewWork(empty, null)).toBe(false)
  })

  it('whitespace-only meta does not arm the guard', () => {
    expect(hasUnsavedNewWork({ ...empty, meta: { client: '  ', campaignName: ' ', concept: '' } }, null)).toBe(false)
  })

  it('any slide arms the guard', () => {
    expect(hasUnsavedNewWork({ ...empty, sections: [{}] }, null)).toBe(true)
  })

  it('typed meta arms the guard', () => {
    expect(hasUnsavedNewWork({ ...empty, meta: { client: 'לקוח', campaignName: '', concept: '' } }, null)).toBe(true)
    expect(hasUnsavedNewWork({ ...empty, meta: { client: '', campaignName: 'קמפיין', concept: '' } }, null)).toBe(true)
    expect(hasUnsavedNewWork({ ...empty, meta: { client: '', campaignName: '', concept: 'קונספט' } }, null)).toBe(true)
  })
})
