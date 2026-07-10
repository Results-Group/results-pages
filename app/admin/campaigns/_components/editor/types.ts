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
  | 'video'
  | 'general'
  | 'divider'

export interface EditorSection {
  id: string
  title: string
  mockup_type: MockupType
  description: string
  useCopies: boolean
  assets: EditorAsset[]
}

export interface CampaignMeta {
  client: string
  clientId: string | null
  campaignName: string
  concept: string
  copies: string[]
  password: string
  /** Whether the campaign currently has a password stored server-side (hash never leaves the server). */
  hasPassword: boolean
  logoPath: string | null
  logoUrl: string | null
  workspaceId: string | null
  publishAt: string | null
}

export interface CampaignDocument {
  meta: CampaignMeta
  sections: EditorSection[]
}

export const MOCKUP_TYPES: Record<MockupType, string> = {
  instagram_feed: 'פיד אינסטגרם',
  instagram_story: 'סטוריז אינסטגרם',
  facebook_feed: 'פיד פייסבוק',
  video: 'סרטונים',
  general: 'כללי',
  divider: 'חוצץ / שקף ביניים',
}

export function newSection(): EditorSection {
  return {
    id: crypto.randomUUID(),
    title: '',
    mockup_type: 'general',
    description: '',
    useCopies: false,
    assets: [],
  }
}
