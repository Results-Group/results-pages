import { supabase } from './supabase'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'

// ── Types ──

export interface CampaignAsset {
  id: string
  type: 'image' | 'video'
  file_path?: string
  public_url?: string
  url?: string
  caption?: string
}

export interface CampaignSection {
  id: string
  title: string
  mockup_type: 'instagram_feed' | 'instagram_story' | 'facebook_feed' | 'carousel' | 'video' | 'general' | 'divider'
  description?: string
  useCopies?: boolean
  assets: CampaignAsset[]
}

export interface CampaignCopies {
  copies?: string[]
}

export interface Campaign {
  id: string
  client: string
  client_id: string | null
  campaign_name: string
  slug: string
  concept: string | null
  copies?: string[]
  logo_path: string | null
  logo_url?: string
  sections: CampaignSection[]
  status: 'draft' | 'published' | 'archived'
  publish_at: string | null
  expires_at: string | null
  password: string | null
  created_by: string | null
  workspace_id: string | null
  deleted_at: string | null
  is_template?: boolean
  monday_feedback_item_id?: string | null
  created_at: string
  updated_at: string
}

// ── Queries ──

export async function getCampaigns(filters?: { search?: string; status?: string; workspace_id?: string; deleted?: boolean; templates?: boolean }) {
  let query = supabase.from('campaigns')
    .select('id,client,client_id,campaign_name,slug,concept,logo_path,status,publish_at,expires_at,password,created_by,workspace_id,deleted_at,is_template,created_at,updated_at')
    .order('created_at', { ascending: false })

  // Templates are a separate list; the normal list never shows them.
  query = query.eq('is_template', !!filters?.templates)

  if (filters?.deleted) query = query.not('deleted_at', 'is', null)
  else query = query.is('deleted_at', null)

  if (filters?.workspace_id) {
    query = query.eq('workspace_id', filters.workspace_id)
  }

  if (filters?.search) {
    const s = filters.search.replace(/[%_\\]/g, c => `\\${c}`)
    query = query.or(`campaign_name.ilike.%${s}%,client.ilike.%${s}%`)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as Campaign[]
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as Campaign
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .eq('is_template', false) // templates are never served publicly
    .single()
  if (error || !data) return null
  return data as Campaign
}

export async function createCampaign(data: {
  client: string
  campaign_name: string
  slug: string
  concept?: string
  logo_path?: string
  sections?: CampaignSection[]
  status?: string
  publish_at?: string | null
  expires_at?: string | null
  password?: string
  created_by?: string
  workspace_id?: string
  client_id?: string | null
  is_template?: boolean
}): Promise<Campaign> {
  const hashedPw = data.password ? await bcrypt.hash(data.password, 12) : null
  const insertData: Record<string, unknown> = {
    client: data.client,
    campaign_name: data.campaign_name,
    slug: data.slug,
    concept: data.concept || null,
    logo_path: data.logo_path || null,
    sections: data.sections || [],
    status: data.status || 'draft',
    publish_at: data.publish_at || null,
    expires_at: data.expires_at || null,
    password: hashedPw,
  }
  if (data.is_template) insertData.is_template = true
  if (data.created_by) insertData.created_by = data.created_by
  if (data.workspace_id) insertData.workspace_id = data.workspace_id
  if (data.client_id !== undefined) insertData.client_id = data.client_id

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert(insertData)
    .select()
    .single()
  if (error) throw error
  return campaign as Campaign
}

/** Thrown by updateCampaign when an optimistic-concurrency check fails. */
export class CampaignConflictError extends Error {
  code = 'CONFLICT' as const
  constructor() { super('Campaign was modified by someone else') }
}

export async function updateCampaign(
  id: string,
  data: Partial<Omit<Campaign, 'id' | 'created_at'>>,
  opts?: { baseUpdatedAt?: string }
): Promise<Campaign> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.client !== undefined) updateData.client = data.client
  if (data.client_id !== undefined) updateData.client_id = data.client_id
  if (data.campaign_name !== undefined) updateData.campaign_name = data.campaign_name
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.concept !== undefined) updateData.concept = data.concept
  if (data.logo_path !== undefined) updateData.logo_path = data.logo_path
  if (data.sections !== undefined) updateData.sections = data.sections
  if (data.status !== undefined) updateData.status = data.status
  if (data.publish_at !== undefined) updateData.publish_at = data.publish_at
  if (data.expires_at !== undefined) updateData.expires_at = data.expires_at
  if (data.password !== undefined) {
    updateData.password = data.password ? await bcrypt.hash(data.password, 12) : null
  }
  if (data.workspace_id !== undefined) updateData.workspace_id = data.workspace_id
  if (data.copies !== undefined) updateData.copies = data.copies
  if (data.is_template !== undefined) updateData.is_template = data.is_template

  // Optimistic concurrency: when the caller passes the updated_at it loaded,
  // only write if the row hasn't changed since — otherwise a second editor's
  // save would silently clobber the first.
  let query = supabase.from('campaigns').update(updateData).eq('id', id)
  if (opts?.baseUpdatedAt) query = query.eq('updated_at', opts.baseUpdatedAt)

  const { data: campaign, error } = await query.select().maybeSingle()
  if (error) throw error
  if (!campaign) {
    if (opts?.baseUpdatedAt) throw new CampaignConflictError()
    throw new Error('Campaign not found')
  }
  return campaign as Campaign
}

/** Persist an uploaded logo path. Deliberately does NOT touch updated_at: the
 * editor holds the last-known value for optimistic concurrency, and bumping it
 * behind their back made the next autosave 409 and lock the editor into the
 * "changed elsewhere — reload" state, losing everything typed after the upload. */
export async function setCampaignLogoPath(id: string, logoPath: string) {
  const { error } = await supabase.from('campaigns').update({ logo_path: logoPath }).eq('id', id)
  if (error) throw error
}

/** Persist the campaign's Monday feedback-board item id. Does not touch updated_at
 * (avoids spurious optimistic-concurrency conflicts for an editor with it open). */
export async function setCampaignMondayFeedbackItem(id: string, itemId: string) {
  await supabase.from('campaigns').update({ monday_feedback_item_id: itemId }).eq('id', id)
}

/** Soft-delete: move a campaign to the recycle bin (reversible, keeps assets). */
export async function deleteCampaign(id: string) {
  const { error } = await supabase
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Restore a campaign from the recycle bin. */
export async function restoreCampaign(id: string) {
  const { error } = await supabase
    .from('campaigns')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw error
}

/** Permanently delete a campaign and remove its entire storage folder. */
export async function purgeCampaign(id: string) {
  await deleteCampaignAssets(id)
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}

// ── Storage ──

const ASSETS_BUCKET = 'campaign-assets'

export function getAssetPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export async function compressAndUploadImage(
  file: File | Blob,
  storagePath: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  const resized = sharp(buffer).resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })

  const [webpBuf, jpegBuf] = await Promise.all([
    // WebP keeps the alpha channel (transparent logos stay transparent).
    resized.clone().webp({ quality: 90 }).toBuffer(),
    // JPEG can't carry alpha — composite over white rather than sharp's default
    // black, so the fallback variant never shows a black box behind a logo.
    resized.clone().flatten({ background: '#ffffff' }).jpeg({ quality: 85, progressive: true }).toBuffer(),
  ])

  const finalPath = storagePath.replace(/\.[^.]+$/, '.webp')
  const jpegPath = finalPath.replace(/\.webp$/, '.jpeg')

  const webpBlob = new Blob([new Uint8Array(webpBuf)], { type: 'image/webp' })
  const jpegBlob = new Blob([new Uint8Array(jpegBuf)], { type: 'image/jpeg' })

  const uploads = [
    supabase.storage.from(ASSETS_BUCKET).upload(finalPath, webpBlob, {
      contentType: 'image/webp', upsert: true, cacheControl: '31536000',
    }),
    supabase.storage.from(ASSETS_BUCKET).upload(jpegPath, jpegBlob, {
      contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
    }),
  ]

  const results = await Promise.all(uploads)
  if (results[0].error) throw results[0].error
  // JPEG variant failure is non-critical — fall back to runtime conversion
  return finalPath
}

export async function uploadLogoImage(
  file: File | Blob,
  campaignId: string
): Promise<string> {
  // Storage keys must be ASCII-safe — use the campaign UUID as the folder
  // (client names may contain Hebrew/spaces which Supabase rejects).
  const storagePath = `campaigns/${campaignId}/logo.webp`
  return compressAndUploadImage(file, storagePath)
}

export async function deleteAsset(filePath: string) {
  await supabase.storage.from(ASSETS_BUCKET).remove([filePath])
}

/**
 * Copy a stored asset (and its .jpeg sibling variant, if any) to a new path.
 * Returns the new primary path. Best-effort on the sibling variant.
 */
export async function copyAsset(fromPath: string, toPath: string): Promise<string> {
  const { error } = await supabase.storage.from(ASSETS_BUCKET).copy(fromPath, toPath)
  if (error) throw error
  if (fromPath.endsWith('.webp') && toPath.endsWith('.webp')) {
    const fromJpeg = fromPath.replace(/\.webp$/, '.jpeg')
    const toJpeg = toPath.replace(/\.webp$/, '.jpeg')
    await supabase.storage.from(ASSETS_BUCKET).copy(fromJpeg, toJpeg).catch(() => {})
  }
  return toPath
}

export async function deleteCampaignAssets(campaignId: string) {
  const prefix = `campaigns/${campaignId}`
  // list() caps at 100 objects per call — paginate until the prefix is exhausted
  const pageSize = 100
  const paths: string[] = []
  let offset = 0
  for (;;) {
    const { data } = await supabase.storage.from(ASSETS_BUCKET).list(prefix, { limit: pageSize, offset })
    if (!data || data.length === 0) break
    paths.push(...data.map(f => `${prefix}/${f.name}`))
    if (data.length < pageSize) break
    offset += pageSize
  }
  if (paths.length > 0) {
    await supabase.storage.from(ASSETS_BUCKET).remove(paths)
  }
}

// ── Enrich campaign with public URLs ──

export function enrichCampaignUrls(campaign: Campaign): Campaign {
  const sections = (typeof campaign.sections === 'string'
    ? JSON.parse(campaign.sections)
    : campaign.sections || []) as CampaignSection[]

  return {
    ...campaign,
    logo_url: campaign.logo_path ? getAssetPublicUrl(campaign.logo_path) : undefined,
    sections: sections.map(s => ({
      ...s,
      assets: (s.assets || []).map(a => ({
        ...a,
        public_url: a.file_path ? getAssetPublicUrl(a.file_path) : undefined,
      })),
    })),
  } as Campaign
}

