import { supabase } from './supabase'
import { deleteAsset } from './campaigns'
import { assetProxyUrl } from './asset-url'
import { normalizeSections, serializeSections } from './strategy/normalize'
import type { AnySection } from './strategy/types'

/**
 * Strategy documents — server-side data access.
 *
 * Server-only by way of `./supabase`. Anything the browser also needs (types,
 * the section registry, the template) lives under lib/strategy/, which imports
 * nothing from here.
 */

export const STRATEGY_BUCKET = 'campaign-assets'

export interface StrategyDoc {
  id: string
  doc_type: 'brand_positioning'
  client: string
  client_id: string | null
  doc_name: string
  slug: string
  sections: AnySection[]
  logo_path: string | null
  logo_url?: string
  status: 'draft' | 'published' | 'archived'
  workspace_id: string | null
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** Thrown by updateStrategyDoc when the optimistic-concurrency check fails. */
export class StrategyDocConflictError extends Error {
  code = 'CONFLICT' as const
  constructor() { super('Strategy document was modified by someone else') }
}

type Row = Omit<StrategyDoc, 'sections'> & { sections: unknown }

function enrich(row: Row): StrategyDoc {
  return {
    ...row,
    // Every read goes through the normalizer, so a renderer never meets a
    // half-written section — and a section from a newer deploy survives.
    sections: normalizeSections(row.sections),
    logo_url: row.logo_path ? assetProxyUrl(row.logo_path) : undefined,
  }
}

export async function getStrategyDocs(filters?: {
  workspaceId?: string | null
  deleted?: boolean
  search?: string
}): Promise<StrategyDoc[]> {
  let query = supabase.from('strategy_docs').select('*').order('updated_at', { ascending: false })
  query = filters?.deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (filters?.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters?.search) query = query.or(`doc_name.ilike.%${filters.search}%,client.ilike.%${filters.search}%`)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(r => enrich(r as Row))
}

export async function getStrategyDocById(id: string): Promise<StrategyDoc | null> {
  const { data, error } = await supabase.from('strategy_docs').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return enrich(data as Row)
}

export async function getStrategyDocBySlug(slug: string): Promise<StrategyDoc | null> {
  const { data, error } = await supabase
    .from('strategy_docs')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return null
  return enrich(data as Row)
}

export async function createStrategyDoc(data: {
  client: string
  doc_name: string
  slug: string
  sections?: AnySection[]
  client_id?: string | null
  workspace_id?: string | null
  created_by?: string
}): Promise<StrategyDoc> {
  const insert: Record<string, unknown> = {
    client: data.client,
    doc_name: data.doc_name,
    slug: data.slug,
    sections: serializeSections(data.sections || []),
  }
  if (data.client_id) insert.client_id = data.client_id
  if (data.workspace_id) insert.workspace_id = data.workspace_id
  if (data.created_by) insert.created_by = data.created_by

  const { data: row, error } = await supabase.from('strategy_docs').insert(insert).select().single()
  if (error) throw error
  return enrich(row as Row)
}

/**
 * Optimistic concurrency by compare-and-swap on `updated_at` itself, matching
 * updateCampaign. The editor holds the timestamp it loaded and sends it back;
 * if the row moved underneath it, the update matches nothing and we raise a
 * conflict rather than overwriting someone else's work.
 */
export async function updateStrategyDoc(
  id: string,
  data: Partial<Pick<StrategyDoc, 'client' | 'client_id' | 'doc_name' | 'slug' | 'sections' | 'logo_path' | 'status' | 'workspace_id'>>,
  opts?: { baseUpdatedAt?: string },
): Promise<StrategyDoc> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.client !== undefined) update.client = data.client
  if (data.client_id !== undefined) update.client_id = data.client_id
  if (data.doc_name !== undefined) update.doc_name = data.doc_name
  if (data.slug !== undefined) update.slug = data.slug
  if (data.sections !== undefined) update.sections = serializeSections(data.sections)
  if (data.logo_path !== undefined) update.logo_path = data.logo_path
  if (data.status !== undefined) update.status = data.status
  if (data.workspace_id !== undefined) update.workspace_id = data.workspace_id

  let query = supabase.from('strategy_docs').update(update).eq('id', id)
  if (opts?.baseUpdatedAt) query = query.eq('updated_at', opts.baseUpdatedAt)

  const { data: row, error } = await query.select().maybeSingle()
  if (error) throw error
  if (!row) {
    if (opts?.baseUpdatedAt) throw new StrategyDocConflictError()
    throw new Error('Strategy document not found')
  }
  return enrich(row as Row)
}

/**
 * Persist an uploaded logo path.
 *
 * Deliberately does NOT touch updated_at: the editor holds the last-known value
 * for optimistic concurrency, and bumping it behind their back made the next
 * autosave 409 and lock the campaign editor into "changed elsewhere — reload",
 * losing everything typed after the upload. The same trap applies here.
 */
export async function setStrategyDocLogoPath(id: string, logoPath: string): Promise<void> {
  const { error } = await supabase.from('strategy_docs').update({ logo_path: logoPath }).eq('id', id)
  if (error) throw error
}

export async function deleteStrategyDoc(id: string): Promise<void> {
  const { error } = await supabase
    .from('strategy_docs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function restoreStrategyDoc(id: string): Promise<void> {
  const { error } = await supabase.from('strategy_docs').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

/** Hard delete, including the document's uploaded images. */
export async function purgeStrategyDoc(id: string): Promise<void> {
  await deleteStrategyAssets(id)
  const { error } = await supabase.from('strategy_docs').delete().eq('id', id)
  if (error) throw error
}

/** Removes every file under the document's storage folder. */
export async function deleteStrategyAssets(id: string): Promise<void> {
  const prefix = `strategy/${id}`
  // Storage lists 100 at a time; page until it runs dry.
  for (;;) {
    const { data, error } = await supabase.storage.from(STRATEGY_BUCKET).list(prefix, { limit: 100 })
    if (error || !data || data.length === 0) return
    await Promise.all(data.map(f => deleteAsset(`${prefix}/${f.name}`).catch(() => {})))
    if (data.length < 100) return
  }
}
