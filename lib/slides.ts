import { resolveSectionCopies, type Copy } from './copies'
import type { CampaignSection, CampaignAsset } from './campaigns'

export interface SlideData {
  type: 'cover' | 'concept' | 'divider' | 'creatives' | 'closing'
  key?: string
  title: string
  subtitle?: string
  content?: string
  /** Copy variations selected for this slide (may be a subset of the campaign's copies). */
  copies?: Copy[]
  logoUrl?: string | null
  date?: string
  mockupType?: string
  assets?: CampaignAsset[]
  clientLogoUrl?: string | null
  clientName?: string
  /** Set only when a section spans several screens: which part this is, of how many. */
  part?: number
  partsTotal?: number
}

/** Creatives shown on one screen before the section pages onto the next. */
const CREATIVES_PER_SCREEN = 2

export function buildCampaignSlides(opts: {
  client: string
  campaignName: string
  concept: string | null
  copies?: Copy[]
  clientLogoUrl: string | null
  date: string
  sections: CampaignSection[]
}): SlideData[] {
  const { client, campaignName, concept, copies, clientLogoUrl, date, sections } = opts
  const allCopies = copies || []
  const slides: SlideData[] = []

  slides.push({ type: 'cover', title: client, subtitle: campaignName, logoUrl: clientLogoUrl, date })

  if (concept) {
    slides.push({ type: 'concept', title: 'קונספט הקמפיין', content: concept })
  }

  for (const section of sections) {
    if (section.mockup_type === 'divider') {
      slides.push({ type: 'divider', key: section.id, title: section.title, content: section.description })
    } else if ((section.assets || []).length > 0) {
      const assets = section.assets || []
      // A carousel is a single post containing all its frames, so it never
      // splits. Everything else shows at most two creatives per screen: three
      // or four on one screen forced the reader to scroll past the fold, so the
      // section is paged into consecutive screens instead.
      const perScreen = section.mockup_type === 'carousel' ? assets.length : CREATIVES_PER_SCREEN
      const partsTotal = Math.ceil(assets.length / perScreen)
      for (let i = 0; i < assets.length; i += perScreen) {
        slides.push({
          type: 'creatives',
          key: section.id,
          title: section.title,
          // Numbered only when the section actually spans several screens, so a
          // one-screen section stays clean.
          ...(partsTotal > 1 ? { part: i / perScreen + 1, partsTotal } : {}),
          content: section.description,
          // Per-slide targeting: only copies whose IDs the editor chose here.
          copies: resolveSectionCopies(section, allCopies),
          mockupType: section.mockup_type,
          assets: assets.slice(i, i + perScreen),
          clientLogoUrl,
          clientName: client,
        })
      }
    }
  }

  slides.push({ type: 'closing', title: 'בהצלחה!', subtitle: client })
  return slides
}
