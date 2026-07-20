import type { CampaignSection, CampaignAsset } from './campaigns'

export interface SlideData {
  type: 'cover' | 'concept' | 'divider' | 'creatives' | 'closing'
  key?: string
  title: string
  subtitle?: string
  content?: string
  /** Campaign-level copy variations to show on this slide (only when section.useCopies is true) */
  copies?: string[]
  logoUrl?: string | null
  date?: string
  mockupType?: string
  assets?: CampaignAsset[]
  clientLogoUrl?: string | null
  clientName?: string
}

export function buildCampaignSlides(opts: {
  client: string
  campaignName: string
  concept: string | null
  copies?: string[]
  clientLogoUrl: string | null
  date: string
  sections: CampaignSection[]
}): SlideData[] {
  const { client, campaignName, concept, copies, clientLogoUrl, date, sections } = opts
  const slides: SlideData[] = []

  slides.push({ type: 'cover', title: client, subtitle: campaignName, logoUrl: clientLogoUrl, date })

  if (concept) {
    slides.push({ type: 'concept', title: 'קונספט הקמפיין', content: concept })
  }

  for (const section of sections) {
    if (section.mockup_type === 'divider') {
      slides.push({ type: 'divider', key: section.id, title: section.title, content: section.description })
    } else if ((section.assets || []).length > 0) {
      slides.push({
        type: 'creatives',
        key: section.id,
        title: section.title,
        content: section.description,
        // Only forward copies to slides where the editor enabled them
        copies: section.useCopies && copies?.length ? copies : [],
        mockupType: section.mockup_type,
        assets: section.assets || [],
        clientLogoUrl,
        clientName: client,
      })
    }
  }

  slides.push({ type: 'closing', title: 'בהצלחה!', subtitle: client })
  return slides
}
