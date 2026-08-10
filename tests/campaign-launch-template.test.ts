import { describe, it, expect } from 'vitest'
import { createCampaignLaunchTemplate } from '@/lib/campaign-launch-template'
import { sectionFromApi } from '@/app/admin/campaigns/_components/editor/types'
import { countClientSlides, slidesPerSection } from '@/lib/slides'
import { hasVisibleContent } from '@/lib/distribution'
import { hasStatsContent } from '@/lib/launch-stats'

describe('createCampaignLaunchTemplate', () => {
  it('has the three-part launch structure, one stats slide per platform', () => {
    const sections = createCampaignLaunchTemplate()
    expect(sections.map(s => s.mockup_type)).toEqual([
      'stats', 'stats', 'stats', 'stats',              // overview + Meta + Google + TikTok
      'divider', 'video', 'video', 'instagram_feed',   // creative showcase
      'divider', 'distribution',                        // launch plan
    ])
    expect(sections.map(s => s.title).slice(0, 4)).toEqual([
      'סקירה כללית', 'Meta Ads', 'Google Ads', 'TikTok',
    ])
  })

  it('gives the video platforms a retention funnel and Meta none', () => {
    const [, meta, google, tiktok] = createCampaignLaunchTemplate()
    expect(meta.stats?.funnel).toBeUndefined()
    expect(google.stats?.funnel?.stages).toHaveLength(4)
    expect(tiktok.stats?.funnel?.title).toBe('משפך צפיות וידאו')
  })

  it('gives every section and every nested item a unique id', () => {
    const sections = createCampaignLaunchTemplate()
    const ids = sections.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Two invocations never share ids — a template is a factory, not a constant.
    const again = createCampaignLaunchTemplate()
    expect(again.map(s => s.id).some(id => ids.includes(id))).toBe(false)
  })

  /**
   * The wipe-trap regression test: the editor autosaves the document it loaded,
   * so any template field sectionFromApi drops would be erased from the
   * database on the operator's first save. Cheapest possible insurance.
   */
  it('every section survives the sectionFromApi round-trip unchanged', () => {
    for (const section of createCampaignLaunchTemplate()) {
      const mapped = sectionFromApi(section, [])
      expect(mapped, section.title).toMatchObject(section)
    }
  })

  it('pre-labeled stats slides render immediately; empty creative sections render nothing', () => {
    const sections = createCampaignLaunchTemplate()
    const stats = sections.filter(s => s.mockup_type === 'stats')
    const creatives = sections.filter(s => ['video', 'instagram_feed'].includes(s.mockup_type))
    const distribution = sections.find(s => s.mockup_type === 'distribution')!

    // The operator opens the template and must SEE the stats scaffolding.
    for (const s of stats) {
      expect(hasStatsContent(s.stats), s.title).toBe(true)
      expect(slidesPerSection(s), s.title).toBe(1)
    }
    // Empty creative sections stay out of the client's deck until filled.
    for (const s of creatives) expect(slidesPerSection(s), s.title).toBe(0)
    // Named channels with no budget still render the plan table scaffolding.
    expect(hasVisibleContent(distribution.plan)).toBe(true)
    expect(slidesPerSection(distribution)).toBe(1)

    // cover + 4 stats + 2 dividers + distribution + closing = 9 (no concept yet)
    expect(countClientSlides(sections, { hasConcept: false })).toBe(9)
  })
})
