'use client'

import InstagramFeedMockup from '@/app/c/[slug]/mockups/instagram-feed'
import InstagramStoryMockup from '@/app/c/[slug]/mockups/instagram-story'
import InstagramReelsMockup from '@/app/c/[slug]/mockups/instagram-reels'
import LandingPageMockup from '@/app/c/[slug]/mockups/landing-page-mockup'
import FacebookFeedMockup from '@/app/c/[slug]/mockups/facebook-feed'
import VideoPlayer from '@/app/c/[slug]/mockups/VideoPlayer'
import GeneralCard from '@/app/c/[slug]/mockups/general-card'
import { parseVideoUrl } from '@/lib/video-utils'
import { assetProxyUrl } from '@/lib/asset-url'
import type { EditorAsset, MockupType } from './types'

/**
 * Renders a single asset with the exact same mockup components used by the
 * public presentation — so the editor canvas is true WYSIWYG.
 */
export default function CanvasAsset({ asset, mockupType, clientName, clientLogoUrl, captionOverride }: {
  asset: EditorAsset
  mockupType: MockupType
  clientName: string
  clientLogoUrl: string | null
  captionOverride?: string
}) {
  const imageUrl = asset.file_path
    ? assetProxyUrl(asset.file_path)
    : (asset.public_url || '')
  const videoInfo = asset.url ? parseVideoUrl(asset.url) : null
  const caption = captionOverride !== undefined ? captionOverride : (asset.caption || '')

  switch (mockupType) {
    case 'instagram_feed':
      return <InstagramFeedMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} caption={caption} />
    case 'instagram_story':
      return <InstagramStoryMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} />
    case 'instagram_reels':
      // Same URL-driven flow as `video`: asset.url is the pasted video link.
      // posterUrl only used when no video URL is set yet (still-image fallback).
      return (
        <InstagramReelsMockup
          videoUrl={asset.url || undefined}
          embedUrl={videoInfo?.embedUrl}
          platform={videoInfo?.platform}
          posterUrl={imageUrl || undefined}
          clientName={clientName}
          logoUrl={clientLogoUrl ?? undefined}
          caption={caption}
        />
      )
    case 'facebook_feed':
      return <FacebookFeedMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} caption={caption} />
    case 'video':
      // Matches the public deck: a video ad shown inside the Facebook feed.
      return (
        <FacebookFeedMockup
          imageUrl=""
          clientName={clientName}
          logoUrl={clientLogoUrl ?? undefined}
          caption={caption}
          media={<VideoPlayer url={asset.url || ''} embedUrl={videoInfo?.embedUrl} platform={videoInfo?.platform || 'other'} />}
        />
      )
    case 'landing_page':
      // MacBook + iPhone frames wrapping live iframes of the pasted URL.
      // `asset.url` may be an external URL or a same-origin path.
      return <LandingPageMockup url={asset.url || undefined} caption={caption} />
    case 'carousel':
      // Each frame stays individually editable here (reorder = carousel order);
      // the assembled carousel is what the deck and full preview render.
      return <GeneralCard imageUrl={imageUrl} caption={caption} />
    case 'general':
    default:
      return <GeneralCard imageUrl={imageUrl} caption={caption} />
  }
}
