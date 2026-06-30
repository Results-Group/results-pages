import { supabase } from './supabase'
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
  mockup_type: 'instagram_feed' | 'instagram_story' | 'facebook_feed' | 'video' | 'general' | 'divider'
  description?: string
  assets: CampaignAsset[]
}

export interface Campaign {
  id: string
  client: string
  campaign_name: string
  slug: string
  concept: string | null
  logo_path: string | null
  logo_url?: string
  sections: CampaignSection[]
  status: 'draft' | 'published' | 'archived'
  password: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Queries ──

export async function getCampaigns(filters?: { search?: string; status?: string }) {
  let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false })

  if (filters?.search) {
    query = query.or(`campaign_name.ilike.%${filters.search}%,client.ilike.%${filters.search}%`)
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
  password?: string
  created_by?: string
}): Promise<Campaign> {
  const insertData: Record<string, unknown> = {
    client: data.client,
    campaign_name: data.campaign_name,
    slug: data.slug,
    concept: data.concept || null,
    logo_path: data.logo_path || null,
    sections: data.sections || [],
    status: data.status || 'draft',
    password: data.password || null,
  }
  if (data.created_by) insertData.created_by = data.created_by

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert(insertData)
    .select()
    .single()
  if (error) throw error
  return campaign as Campaign
}

export async function updateCampaign(
  id: string,
  data: Partial<Omit<Campaign, 'id' | 'created_at'>>
): Promise<Campaign> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.client !== undefined) updateData.client = data.client
  if (data.campaign_name !== undefined) updateData.campaign_name = data.campaign_name
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.concept !== undefined) updateData.concept = data.concept
  if (data.logo_path !== undefined) updateData.logo_path = data.logo_path
  if (data.sections !== undefined) updateData.sections = data.sections
  if (data.status !== undefined) updateData.status = data.status
  if (data.password !== undefined) updateData.password = data.password

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return campaign as Campaign
}

export async function deleteCampaign(id: string) {
  // Remove the entire campaign storage folder (logo + all assets)
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

  const compressed = await sharp(buffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer()

  const finalPath = storagePath.replace(/\.[^.]+$/, '.webp')

  // Wrap the binary in a Blob so supabase-js uploads it via the multipart
  // (FormData) path. Passing a raw Node Buffer makes supabase-js send it as a
  // plain request body, which Vercel's runtime mangles through UTF-8 encoding
  // (corrupting the bytes with U+FFFD). A Blob is binary-safe everywhere.
  const blob = new Blob([new Uint8Array(compressed)], { type: 'image/webp' })

  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(finalPath, blob, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
  if (error) throw error
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

export async function deleteCampaignAssets(campaignId: string) {
  const prefix = `campaigns/${campaignId}`
  const { data } = await supabase.storage.from(ASSETS_BUCKET).list(prefix)
  if (data && data.length > 0) {
    const paths = data.map(f => `${prefix}/${f.name}`)
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

// ── Video URL helpers ──

export function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'other'; videoId?: string; embedUrl?: string } {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    return { platform: 'youtube', videoId: ytMatch[1], embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` }
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return { platform: 'vimeo', videoId: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` }
  }

  return { platform: 'other' }
}

// ── Table bootstrap ──

export async function ensureCampaignsTable(): Promise<boolean> {
  const { error } = await supabase.from('campaigns').select('id').limit(1)
  return !error
}
