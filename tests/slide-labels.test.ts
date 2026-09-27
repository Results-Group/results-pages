import { describe, it, expect } from 'vitest'
import { untitledCreativeLabels } from '@/lib/slide-labels'

const kind = (m: string) => ({ facebook_feed: 'פיד פייסבוק', instagram_reels: 'רילס' } as Record<string, string>)[m] ?? ''

describe('untitledCreativeLabels', () => {
  it('names an untitled ad by its chapter and kind, with the part when a section spans screens', () => {
    const labels = untitledCreativeLabels([
      { type: 'cover' },
      { type: 'divider', title: 'CASHBACK' },
      { type: 'creatives', mockupType: 'facebook_feed', part: 1, partsTotal: 2 },
      { type: 'creatives', mockupType: 'facebook_feed', part: 2, partsTotal: 2 },
      { type: 'divider', title: 'VIDEOS' },
      { type: 'creatives', mockupType: 'instagram_reels' },
    ], kind, 'מתוך')
    expect(labels).toEqual(['', '', 'CASHBACK · פיד פייסבוק · 1 מתוך 2', 'CASHBACK · פיד פייסבוק · 2 מתוך 2', '', 'VIDEOS · רילס'])
  })

  it('leaves titled slides to the deck’s own naming', () => {
    expect(untitledCreativeLabels([{ type: 'creatives', title: 'Hooks', mockupType: 'facebook_feed' }], kind, 'מתוך')).toEqual([''])
  })

  it('before any divider, names by kind alone; with nothing true to say, says nothing', () => {
    expect(untitledCreativeLabels([
      { type: 'creatives', mockupType: 'facebook_feed' },
      { type: 'creatives', mockupType: 'unknown_kind' },
    ], kind, 'מתוך')).toEqual(['פיד פייסבוק', ''])
  })

  it('numbers a second section of the same kind in the same chapter, so the two can be told apart', () => {
    const labels = untitledCreativeLabels([
      { type: 'divider', title: 'CASHBACK' },
      { type: 'creatives', key: 'a', mockupType: 'facebook_feed', part: 1, partsTotal: 2 },
      { type: 'creatives', key: 'a', mockupType: 'facebook_feed', part: 2, partsTotal: 2 },
      { type: 'creatives', key: 'b', mockupType: 'facebook_feed' },
    ], kind, 'מתוך')
    expect(labels.slice(1)).toEqual(['CASHBACK · פיד פייסבוק · 1 מתוך 2', 'CASHBACK · פיד פייסבוק · 2 מתוך 2', 'CASHBACK · פיד פייסבוק (2)'])
  })
})
