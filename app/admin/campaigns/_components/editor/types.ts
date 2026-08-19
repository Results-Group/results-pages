export interface EditorAsset {
  id: string
  type: 'image' | 'video'
  file_path: string
  public_url: string
  url: string
  caption: string
}

import type { DistributionPlan } from '@/lib/distribution'
import type { StatsBlock, ProfileBlock } from '@/lib/launch-stats'

export type MockupType =
  | 'instagram_feed'
  | 'instagram_story'
  | 'instagram_reels'
  | 'facebook_feed'
  | 'carousel'
  | 'video'
  | 'landing_page'
  | 'general'
  | 'distribution'
  | 'stats'
  | 'facebook_cover'
  | 'youtube_cover'
  | 'divider'

export interface EditorSection {
  id: string
  title: string
  mockup_type: MockupType
  description: string
  /** IDs of campaign copies to show on this slide. Empty array = show none. */
  copyIds: string[]
  assets: EditorAsset[]
  /** Only for mockup_type 'distribution'. */
  plan?: DistributionPlan
  /** Only for mockup_type 'stats'. */
  stats?: StatsBlock
  /** Only for the cover mockups (facebook_cover / youtube_cover). */
  profile?: ProfileBlock
  /** Only for 'divider' heading a report group: the first sub-tab's label.
   *  Empty falls back to the i18n default ("סקירה כללית"). */
  overviewLabel?: string
}

/** A single ad-text variation on the campaign. `label` is optional
 *  ("לגברים", "לנשים"); empty means the presentation labels the tab "גרסה N". */
export interface Copy {
  id: string
  label: string
  body: string
}

export interface CampaignMeta {
  client: string
  clientId: string | null
  campaignName: string
  concept: string
  copies: Copy[]
  password: string
  /** Whether the campaign currently has a password stored server-side (hash never leaves the server). */
  hasPassword: boolean
  logoPath: string | null
  logoUrl: string | null
  workspaceId: string | null
  publishAt: string | null
  expiresAt: string | null
  /** Closing-slide title override; null/empty = the default "בהצלחה!". */
  closingTitle: string | null
}

export interface CampaignDocument {
  meta: CampaignMeta
  sections: EditorSection[]
}

export const MOCKUP_TYPES: Record<MockupType, string> = {
  instagram_feed: 'פיד אינסטגרם',
  instagram_story: 'סטוריז אינסטגרם',
  instagram_reels: 'רילס אינסטגרם',
  facebook_feed: 'פיד פייסבוק',
  carousel: 'קרוסלה',
  video: 'סרטונים',
  landing_page: 'הטמעת דף נחיתה',
  general: 'כללי',
  distribution: 'תוכנית הפצה',
  stats: 'סיכום נתונים',
  facebook_cover: 'עמוד פייסבוק',
  youtube_cover: 'ערוץ יוטיוב',
  divider: 'חוצץ / שקף ביניים',
}

/** A carousel is a single post with many frames — the platforms cap it at 10. */
export const MAX_ASSETS_CAROUSEL = 10
/** Other mockups show one creative per card, laid out four to a slide. */
export const MAX_ASSETS_DEFAULT = 4

export function maxAssetsFor(mockupType: MockupType): number {
  return mockupType === 'carousel' ? MAX_ASSETS_CAROUSEL : MAX_ASSETS_DEFAULT
}

/**
 * Maps one raw section from the API into editor state.
 *
 * EVERY editable field must be carried here. A field missing from this mapper
 * doesn't just fail to show up — the editor autosaves the document it loaded,
 * so the next save writes the section back without it and the value is erased
 * from the database. That is exactly how distribution plans were being lost:
 * saved fine, dropped on reload, wiped on publish.
 */
export function sectionFromApi(
  // Assets arrive API-shaped (every field but id optional) — the mapper fills
  // the defaults, so the parameter says so instead of forcing callers to cast.
  raw: Omit<Partial<EditorSection>, 'assets'> & { useCopies?: boolean; assets?: (Partial<EditorAsset> & { id?: string })[] },
  allCopyIds: string[],
): EditorSection {
  // Legacy sections have `useCopies: boolean` and no `copyIds` — map the
  // boolean onto the array (true → every id, false → none).
  const copyIds = Array.isArray(raw.copyIds) ? raw.copyIds : (raw.useCopies ? allCopyIds : [])
  return {
    id: raw.id || crypto.randomUUID(),
    title: raw.title || '',
    mockup_type: (raw.mockup_type || 'general') as MockupType,
    description: raw.description || '',
    copyIds,
    ...(raw.plan ? { plan: raw.plan } : {}),
    ...(raw.stats ? { stats: raw.stats } : {}),
    ...(raw.profile ? { profile: raw.profile } : {}),
    ...(raw.overviewLabel ? { overviewLabel: raw.overviewLabel } : {}),
    assets: (raw.assets || []).map(a => ({
      id: a.id || crypto.randomUUID(),
      type: (a.type || 'image') as 'image' | 'video',
      file_path: a.file_path || '',
      public_url: a.public_url || '',
      url: a.url || '',
      caption: a.caption || '',
    })),
  }
}

/**
 * The write side of the same contract: serializes an editor section back to
 * the API shape. This is THE serializer — buildBody uses it, so a field added
 * to sectionFromApi but forgotten here (or vice versa) fails the round-trip
 * test instead of silently erasing operator data on the next autosave.
 */
export function sectionToApi(s: EditorSection) {
  return {
    id: s.id,
    title: s.title,
    mockup_type: s.mockup_type,
    description: s.description,
    copyIds: s.copyIds ?? [],
    ...(s.plan ? { plan: s.plan } : {}),
    ...(s.stats ? { stats: s.stats } : {}),
    ...(s.profile ? { profile: s.profile } : {}),
    ...(s.overviewLabel ? { overviewLabel: s.overviewLabel } : {}),
    assets: s.assets.map(a => ({ id: a.id, type: a.type, file_path: a.file_path, url: a.url, caption: a.caption })),
  }
}

export function newSection(): EditorSection {
  return {
    id: crypto.randomUUID(),
    title: '',
    mockup_type: 'general',
    description: '',
    copyIds: [],
    assets: [],
  }
}

export function newCopy(): Copy {
  return { id: crypto.randomUUID(), label: '', body: '' }
}
