// The slides a client sees for a campaign, with the client's branding resolved.
// One function for the deck page (app/c/[slug]) and the PDF route
// (app/api/campaigns/[id]/pdf): the PDF cache is keyed on these slides, so the
// two must never build them differently.

import 'server-only'
import { enrichCampaignUrls, normalizeCopies, type Campaign, type CampaignSection } from './campaigns'
import { getClientById } from './clients'
import { assetProxyUrl } from './asset-url'
import { buildCampaignSlides, type SlideData } from './slides'

export interface CampaignDeck {
  campaign: Campaign
  slides: SlideData[]
  brandColor: string | null
  /** The logo actually shown: the campaign's own, else the client's. */
  logoPath: string | null
}

export async function buildDeckForCampaign(rawCampaign: Campaign): Promise<CampaignDeck> {
  const campaign = enrichCampaignUrls(rawCampaign)

  // Effective branding: campaign logo overrides, else inherit the client's logo/color
  let logoPath = campaign.logo_path
  let brandColor: string | null = null
  if (campaign.client_id) {
    const client = await getClientById(campaign.client_id)
    if (client) {
      brandColor = client.brand_color
      if (!logoPath) logoPath = client.logo_path
    }
  }
  const clientLogoUrl = logoPath ? assetProxyUrl(logoPath) : null
  // The cover eyebrow reads as an English date line (e.g. "July 20, 2026"),
  // not a Hebrew one — it sits alongside the English brand lockup.
  const formattedDate = new Date(campaign.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const slides = buildCampaignSlides({
    client: campaign.client,
    campaignName: campaign.campaign_name,
    concept: campaign.concept,
    copies: normalizeCopies(campaign.copies),
    clientLogoUrl,
    date: formattedDate,
    sections: (campaign.sections || []) as CampaignSection[],
    closingTitle: campaign.closing_title,
  })

  return { campaign, slides, brandColor, logoPath: logoPath ?? null }
}
