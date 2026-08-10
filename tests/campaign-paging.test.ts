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

  it('a stats section renders one slide with content, zero without', () => {
    const empty = { ...section('stats', 0), stats: { kpis: [], groups: [] } }
    expect(slidesPerSection(empty)).toBe(0)

    const withKpi = { ...section('stats', 0), stats: { kpis: [{ id: 'k1', label: 'חשיפות', value: '' }], groups: [] } }
    expect(slidesPerSection(withKpi)).toBe(1)

    const built = buildCampaignSlides({
      client: 'Acme', campaignName: 'Q3', concept: null,
      clientLogoUrl: null, date: '', sections: [withKpi, empty],
    })
    const statsSlides = built.filter(s => s.type === 'stats')
    expect(statsSlides).toHaveLength(1)
    expect(statsSlides[0].stats?.kpis[0].label).toBe('חשיפות')
  })

  it('report decks page like the launch reports: one film per pane, graphics together', () => {
    const statsSection = { ...section('stats', 0), stats: { kpis: [{ id: 'k', label: 'x', value: '1' }], groups: [] } }
    const videos = { ...section('video', 3), assets: [0, 1, 2].map(i => ({ ...asset(i), type: 'video' as const, caption: `One liner ${i}`, url: 'https://youtu.be/x' })) }
    const graphics = section('instagram_feed', 5)

    // Report rules: each video its own pane, all five graphics on one.
    expect(slidesPerSection(videos, { report: true })).toBe(3)
    expect(slidesPerSection(graphics, { report: true })).toBe(1)
    // The same sections in a creative deck keep the classic split.
    expect(slidesPerSection(videos)).toBe(2)
    expect(slidesPerSection(graphics)).toBe(3)

    const sections = [statsSection, videos, graphics]
    const built = buildCampaignSlides({
      client: 'Acme', campaignName: 'Q3', concept: null,
      clientLogoUrl: null, date: '', sections,
    })
    // A solo film's pane carries the film's name, not "title · 1 מתוך 3".
    const videoSlides = built.filter(s => s.type === 'creatives' && s.mockupType === 'video')
    expect(videoSlides.map(s => s.title)).toEqual(['One liner 0', 'One liner 1', 'One liner 2'])
    expect(videoSlides.every(s => !s.partsTotal)).toBe(true)
    // And the sidebar total agrees with the built deck.
    expect(countClientSlides(sections, { hasConcept: false })).toBe(built.length)
  })

  it('the sidebar total equals the number of slides actually built', () => {
    const sections = [
      section('landing_page', 1),
      section('facebook_feed', 4),
      section('facebook_feed', 0),
      section('video', 5),
      section('carousel', 6),
      { ...section('stats', 0), stats: { kpis: [{ id: 'k1', label: 'קליקים', value: '9,643' }], groups: [] } },
    ]
    const built = buildCampaignSlides({
      client: 'Acme', campaignName: 'Q3', concept: 'קונספט',
      clientLogoUrl: null, date: '', sections,
    })
    expect(countClientSlides(sections, { hasConcept: true })).toBe(built.length)
  })
})
