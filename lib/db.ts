import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export interface LandingPage {
  id: string
  client: string
  slug: string
  title: string
  file_path: string
  active: boolean
  expires_at: string | null
  password: string | null
  short_url: string | null
  created_at: string
  updated_at: string
}

export interface LandingPageView {
  id: string
  page_id: string
  viewed_at: string
  ip: string | null
  user_agent: string | null
}

export interface PageWithViews extends LandingPage {
  _count: { views: number }
}

function toApiFormat(row: LandingPage, viewCount: number): PageWithViews {
  return {
    ...row,
    _count: { views: viewCount },
  }
}

// ── Queries ──

export async function getPages(filters?: { client?: string; search?: string }) {
  let query = supabase.from('landing_pages').select('*').order('created_at', { ascending: false })

  if (filters?.client) query = query.eq('client', filters.client)
  if (filters?.search) {
    const s = filters.search.replace(/[%_\\]/g, c => `\\${c}`)
    query = query.ilike('title', `%${s}%`)
  }

  const { data: pages, error } = await query
  if (error) throw error

  const pageIds = pages.map((p: LandingPage) => p.id)
  let viewCounts: Record<string, number> = {}

  if (pageIds.length > 0) {
    const { data: views, error: viewErr } = await supabase
      .rpc('count_landing_page_views', { page_ids: pageIds })
    if (!viewErr && views) {
      for (const v of views) {
        viewCounts[v.page_id] = Number(v.count)
      }
    }
  }

  return pages.map((p: LandingPage) => toApiFormat(p, viewCounts[p.id] || 0))
}

export async function getPageById(id: string) {
  const { data: page, error } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !page) return null

  const { count } = await supabase
    .from('landing_page_views')
    .select('*', { count: 'exact', head: true })
    .eq('page_id', id)

  return toApiFormat(page, count || 0)
}

export async function getPageByClientSlug(client: string, slug: string) {
  const { data: page, error } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('client', client)
    .eq('slug', slug)
    .single()

  if (error || !page) return null
  return page as LandingPage
}

export async function createPage(data: {
  client: string
  slug: string
  title: string
  file_path: string
  expires_at?: string | null
  password?: string | null
  short_url?: string | null
  created_by?: string
}) {
  const hashedPw = data.password ? await bcrypt.hash(data.password, 12) : null
  const insertData: Record<string, unknown> = {
    client: data.client,
    slug: data.slug,
    title: data.title,
    file_path: data.file_path,
    expires_at: data.expires_at || null,
    password: hashedPw,
    short_url: data.short_url || null,
  }
  if (data.created_by) insertData.created_by = data.created_by

  const { data: page, error } = await supabase
    .from('landing_pages')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return page as LandingPage
}

export async function updatePage(
  id: string,
  data: Partial<Pick<LandingPage, 'title' | 'client' | 'slug' | 'active' | 'expires_at' | 'file_path' | 'password' | 'short_url'>> & { updated_by?: string }
) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updateData.title = data.title
  if (data.client !== undefined) updateData.client = data.client
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.active !== undefined) updateData.active = data.active
  if (data.expires_at !== undefined) updateData.expires_at = data.expires_at
  if (data.file_path !== undefined) updateData.file_path = data.file_path
  if (data.password !== undefined) {
    updateData.password = data.password ? await bcrypt.hash(data.password, 12) : null
  }
  if (data.short_url !== undefined) updateData.short_url = data.short_url || null
  if (data.updated_by) updateData.updated_by = data.updated_by

  const { data: page, error } = await supabase
    .from('landing_pages')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return page as LandingPage
}

export async function getPageByShortUrl(shortUrl: string) {
  const { data: page, error } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('short_url', shortUrl)
    .single()

  if (error || !page) return null
  return page as LandingPage
}

export async function deletePage(id: string) {
  const { error } = await supabase
    .from('landing_pages')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function createPageView(data: {
  page_id: string
  ip?: string
  user_agent?: string
}) {
  await supabase.from('landing_page_views').insert(data)
}

export async function resetPageViews(pageId: string) {
  const { error } = await supabase
    .from('landing_page_views')
    .delete()
    .eq('page_id', pageId)
  if (error) throw error
}

// ── Versions ──

export interface LandingPageVersion {
  id: string
  page_id: string
  file_path: string
  created_at: string
  label: string | null
}


export async function createVersion(pageId: string, filePath: string, label?: string) {
  const { error } = await supabase
    .from('landing_page_versions')
    .insert({ page_id: pageId, file_path: filePath, label: label || null })
  if (error) throw error
}

export async function getVersions(pageId: string): Promise<LandingPageVersion[]> {
  const { data, error } = await supabase
    .from('landing_page_versions')
    .select('*')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as LandingPageVersion[]
}

export async function getVersion(versionId: string): Promise<LandingPageVersion | null> {
  const { data, error } = await supabase
    .from('landing_page_versions')
    .select('*')
    .eq('id', versionId)
    .single()
  if (error || !data) return null
  return data as LandingPageVersion
}

export async function deleteVersion(versionId: string) {
  const version = await getVersion(versionId)
  if (version) {
    await deleteFile(version.file_path)
    await supabase.from('landing_page_versions').delete().eq('id', versionId)
  }
}

// ── Storage ──

const BUCKET = 'landing-pages'

export async function uploadFile(filePath: string, buffer: Buffer, contentType = 'text/html') {
  // Wrap in a Blob so supabase-js uploads via the binary-safe multipart path.
  // A raw Node Buffer gets sent as a plain body which Vercel's runtime mangles
  // through UTF-8 encoding (corrupting bytes, including non-ASCII Hebrew text).
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType })
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, blob, { contentType, upsert: true, cacheControl: 'no-cache' })
  if (error) throw error
}

export async function downloadFile(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath)
  if (error || !data) return null
  return await data.text()
}

export async function deleteFile(filePath: string) {
  await supabase.storage.from(BUCKET).remove([filePath])
}

export async function moveFile(oldPath: string, newPath: string) {
  await supabase.storage.from(BUCKET).move(oldPath, newPath)
}
