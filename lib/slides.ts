import type { CampaignSection, CampaignAsset } from './campaigns'

export interface SlideData {
  type: 'cover' | 'concept' | 'divider' | 'creatives' | 'closing'
  key?: string
  title: string
  subtitle?: string
  content?: string
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
  clientLogoUrl: string | null
  date: string
  sections: CampaignSection[]
}): SlideData[] {
  const { client, campaignName, concept, clientLogoUrl, date, sections } = opts
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
        mockupType: section.mockup_type,
        assets: section.assets || [],
        clientLogoUrl,
        clientName: client,
      })
    }
  }

  slides.push({ type: 'closing', title: 'תודה רבה!', subtitle: client })
  return slides
}
