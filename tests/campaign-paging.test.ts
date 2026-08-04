import { describe, it, expect } from 'vitest'
import {
  buildCampaignSlides, countClientSlides, creativesPerScreen, pageAssets, slidesPerSection,
} from '@/lib/slides'
import type { CampaignSection } from '@/lib/campaigns'

/**
 * The paging invariant: the editor's page breaks, the sidebar's slide count
 * and the deck the client scrolls are three views of one split. They have
 * drifted apart twice — most recently the video and landing-page branches of
 * the canvas paged by their own (missing) rules, so five video links read as
 * one screen in the editor and arrived as three in the deck.
 */

const asset = (i: number) => ({ id: `a${i}`, file_path: `p/${i}.webp`, caption: '', url: '' })

function section(type: string, count: number): CampaignSection {
  return {
    id: `s-${type}`,
    title: '',
    description: '',
    mockup_type: type,
    assets: Array.from({ length: count }, (_, i) => asset(i)),
  } as unknown as CampaignSection
}

const TYPES = [
  'instagram_feed', 'instagram_story', 'instagram_reels', 'facebook_feed',
  'carousel', 'video', 'landing_page', 'general',
]

describe('creatives paging', () => {
  it('pages two creatives per screen by default', () => {
    expect(creativesPerScreen(section('facebook_feed', 4))).toBe(2)
    expect(slidesPerSection(section('facebook_feed', 4))).toBe(2)
    expect(slidesPerSection(section('facebook_feed', 5))).toBe(3)
  })

  it('keeps a carousel on one screen and gives each landing page its own', () => {
    expect(slidesPerSection(section('carousel', 6))).toBe(1)
    expect(slidesPerSection(section('landing_page', 3))).toBe(3)
  })

  it('pages video links like any other creative', () => {
    // The regression: the editor rendered all five in one column.
    expect(slidesPerSection(section('video', 5))).toBe(3)
    expect(pageAssets(section('video', 5).assets!, creativesPerScreen(section('video', 5))))
      .toHaveLength(3)
  })

  it('empty sections produce no slide at all', () => {
    for (const type of TYPES) expect(slidesPerSection(section(type, 0))).toBe(0)
  })

  it('the split the editor draws matches the slides the client gets', () => {
    for (const type of TYPES) {
      for (const count of [1, 2, 3, 4, 5, 7]) {
        const s = section(type, count)
        const editorPages = pageAssets(s.assets!, creativesPerScreen(s))
        expect(editorPages.length, `${type} × ${count}`).toBe(slidesPerSection(s))
      }
    }
  })

  it('the sidebar total equals the number of slides actually built', () => {
    const sections = [
      section('landing_page', 1),
      section('facebook_feed', 4),
      section('facebook_feed', 0),
      section('video', 5),
      section('carousel', 6),
    ]
    const built = buildCampaignSlides({
      client: 'Acme', campaignName: 'Q3', concept: 'קונספט',
      clientLogoUrl: null, date: '', sections,
    })
    expect(countClientSlides(sections, { hasConcept: true })).toBe(built.length)
  })
})
