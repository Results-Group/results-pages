export interface EditorAsset {
  id: string
  type: 'image' | 'video'
  file_path: string
  public_url: string
  url: string
  caption: string
}

export type MockupType =
  | 'instagram_feed'
  | 'instagram_story'
  | 'facebook_feed'
  | 'carousel'
  | 'video'
  | 'general'
  | 'divider'

export interface EditorSection {
  id: string
  title: string
  mockup_type: MockupType
  description: string
  /** IDs of campaign copies to show on this slide. Empty array = show none. */
  copyIds: string[]
  assets: EditorAsset[]
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
}

export interface CampaignDocument {
  meta: CampaignMeta
  sections: EditorSection[]
}

export const MOCKUP_TYPES: Record<MockupType, string> = {
  instagram_feed: 'פיד אינסטגרם',
  instagram_story: 'סטוריז אינסטגרם',
  facebook_feed: 'פיד פייסבוק',
  carousel: 'קרוסלה',
  video: 'סרטונים',
  general: 'כללי',
  divider: 'חוצץ / שקף ביניים',
}

/** A carousel is a single post with many frames — the platforms cap it at 10. */
export const MAX_ASSETS_CAROUSEL = 10
/** Other mockups show one creative per card, laid out four to a slide. */
export const MAX_ASSETS_DEFAULT = 4

export function maxAssetsFor(mockupType: MockupType): number {
  return mockupType === 'carousel' ? MAX_ASSETS_CAROUSEL : MAX_ASSETS_DEFAULT
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
