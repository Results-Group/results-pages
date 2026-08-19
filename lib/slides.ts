import { resolveSectionCopies, type Copy } from './copies'
import { hasVisibleContent, normalizePlan, type DistributionPlan } from './distribution'
import { hasStatsContent, normalizeStats, hasProfileContent, normalizeProfile, type StatsBlock, type ProfileBlock } from './launch-stats'
import type { CampaignSection, CampaignAsset } from './campaigns'

export interface SlideData {
  type: 'cover' | 'concept' | 'divider' | 'creatives' | 'distribution' | 'stats' | 'cover_mockup' | 'closing'
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
  /** Only on 'distribution' slides. */
  plan?: DistributionPlan
  /** Only on 'stats' slides. */
  stats?: StatsBlock
  /** Only on 'cover_mockup' slides. */
  profile?: ProfileBlock
  /** Only on 'divider' slides heading a report group: overrides the first
   *  sub-tab's "סקירה כללית" label. */
  overviewLabel?: string
}

/** Creatives shown on one screen before the section pages onto the next.
 *  Exported so the admin editor can preview the same split — otherwise the
 *  operator uploads 4 images, sees a 2×2 grid in the editor, and gets
 *  confused when the client view splits it into two screens of 2. */
export const CREATIVES_PER_SCREEN = 2

/** How many client-facing slides a section will produce. Mirrors the paging
 *  logic in buildCampaignSlides — carousel = one slide, landing_page = one
 *  slide per URL, everything else = ceil(assets / CREATIVES_PER_SCREEN).
 *  Divider always renders as one slide; empty sections render zero. */
// Accept either the CampaignSection shape (from lib) or the EditorSection
// shape (from the admin editor) — both have mockup_type + assets, which is
// all this helper reads. Loose typing here beats a Pick<> that both callers
// have to maintain in lockstep.
type SectionLike = { mockup_type: string; assets?: unknown[]; plan?: DistributionPlan | null; stats?: StatsBlock | null; profile?: ProfileBlock | null }

/** Creatives on one client screen, for this section's mockup type.
 *
 *  A carousel is a single post containing all its frames, so it never splits.
 *  A landing_page mockup is a wide MacBook + iPhone pair — two of them side by
 *  side overflow the slide, so it gets a screen each. Everything else shows at
 *  most two: three or four on one screen pushed the reader past the fold.
 *
 *  Every consumer of the split reads it from here — buildCampaignSlides, the
 *  sidebar count and the editor's page breaks. The video and landing-page
 *  branches of the editor canvas used to page by their own (missing) rules,
 *  so five video links looked like one screen and became three for the client. */
/**
 * A deck holding stats slides is a launch report, and the hand-built reports
 * page creatives differently: every VIDEO gets its own sub-tab (named after
 * its caption), and ALL of a section's graphics share one pane. Derived from
 * the sections themselves so the editor and deck can never disagree.
 */
export function isReportSections(sections: SectionLike[]): boolean {
  return sections.some(s => s.mockup_type === 'stats')
}

export function creativesPerScreen(section: SectionLike, opts?: { report?: boolean }): number {
  if (section.mockup_type === 'carousel') return Math.max(1, (section.assets || []).length)
  if (opts?.report) {
    // Report paging, matching the source reports: one film per pane; a whole
    // graphics set on one pane.
    if (section.mockup_type === 'video' || section.mockup_type === 'instagram_reels') return 1
    if (section.mockup_type === 'landing_page') return 1
    return Math.max(1, (section.assets || []).length)
  }
  if (section.mockup_type === 'landing_page') return 1
  return CREATIVES_PER_SCREEN
}

/** Split a section's assets into the screens the client will scroll through. */
export function pageAssets<T>(assets: T[], perScreen: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < assets.length; i += Math.max(1, perScreen)) {
    pages.push(assets.slice(i, i + Math.max(1, perScreen)))
  }
  return pages
}

export function slidesPerSection(section: SectionLike, opts?: { report?: boolean }): number {
  if (section.mockup_type === 'divider') return 1
  // A distribution plan carries no assets — it renders from `plan`, and an
  // empty one renders nothing at all rather than a blank screen.
  if (section.mockup_type === 'distribution') return hasVisibleContent(section.plan) ? 1 : 0
  // Same contract for the KPI summary: renders from `stats`, empty = no slide.
  if (section.mockup_type === 'stats') return hasStatsContent(section.stats) ? 1 : 0
  // The cover mockups are assetless too — they render from `profile`.
  if (section.mockup_type === 'facebook_cover' || section.mockup_type === 'youtube_cover') {
    return hasProfileContent(section.profile) ? 1 : 0
  }
  const assets = section.assets || []
  if (!assets.length) return 0
  return Math.ceil(assets.length / creativesPerScreen(section, opts))
}

/** Total client-facing slide count — cover + optional concept + sum over
 *  sections + closing. Used by the editor's sidebar total badge so the
 *  number the operator sees matches the number of screens the client will
 *  scroll through. */
export function countClientSlides(sections: SectionLike[], opts: { hasConcept: boolean }): number {
  const report = isReportSections(sections)
  let n = 1 // cover
  if (opts.hasConcept) n += 1 // concept
  for (const s of sections) n += slidesPerSection(s, { report })
  n += 1 // closing
  return n
}

export function buildCampaignSlides(opts: {
  client: string
  campaignName: string
  concept: string | null
  copies?: Copy[]
  clientLogoUrl: string | null
  date: string
  sections: CampaignSection[]
  /** Closing-slide title override; empty falls back to the default. */
  closingTitle?: string | null
}): SlideData[] {
  const { client, campaignName, concept, copies, clientLogoUrl, date, sections, closingTitle } = opts
  const allCopies = copies || []
  const report = isReportSections(sections)
  const slides: SlideData[] = []

  slides.push({ type: 'cover', title: client, subtitle: campaignName, logoUrl: clientLogoUrl, date })

  if (concept) {
    slides.push({ type: 'concept', title: 'קונספט הקמפיין', content: concept })
  }

  for (const section of sections) {
    if (section.mockup_type === 'divider') {
      slides.push({
        type: 'divider', key: section.id, title: section.title, content: section.description,
        ...(section.overviewLabel ? { overviewLabel: section.overviewLabel } : {}),
      })
    } else if (section.mockup_type === 'distribution') {
      // Assetless like the divider, so it needs its own branch — the creatives
      // branch below skips any section with an empty assets array.
      if (hasVisibleContent(section.plan)) {
        slides.push({
          type: 'distribution',
          key: section.id,
          title: section.title,
          content: section.description,
          plan: normalizePlan(section.plan),
        })
      }
    } else if (section.mockup_type === 'stats') {
      // Assetless like distribution — needs its own branch for the same reason.
      if (hasStatsContent(section.stats)) {
        slides.push({
          type: 'stats',
          key: section.id,
          title: section.title,
          content: section.description,
          stats: normalizeStats(section.stats),
        })
      }
    } else if (section.mockup_type === 'facebook_cover' || section.mockup_type === 'youtube_cover') {
      if (hasProfileContent(section.profile)) {
        slides.push({
          type: 'cover_mockup',
          key: section.id,
          title: section.title,
          content: section.description,
          mockupType: section.mockup_type,
          profile: normalizeProfile(section.profile),
        })
      }
    } else if ((section.assets || []).length > 0) {
      const assets = section.assets || []
      const perScreen = creativesPerScreen(section, { report })
      const partsTotal = Math.ceil(assets.length / perScreen)
      for (let i = 0; i < assets.length; i += perScreen) {
        // In a report, a lone film's pane is named after the film — the source
        // reports' sub-tabs read "One liner A", not "וריאציות · 1 מתוך 2".
        const soloCaption = report && perScreen === 1 && partsTotal > 1
          ? (assets[i]?.caption || '').trim()
          : ''
        slides.push({
          type: 'creatives',
          key: section.id,
          title: soloCaption || section.title,
          // Numbered only when the section actually spans several screens, so a
          // one-screen section stays clean — and never when the pane already
          // carries the film's own name.
          ...(partsTotal > 1 && !soloCaption ? { part: i / perScreen + 1, partsTotal } : {}),
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

  slides.push({ type: 'closing', title: closingTitle?.trim() || 'בהצלחה!', subtitle: client })
  return slides
}
