import { supabase } from './supabase'
import { compressAndUploadImage, getAssetPublicUrl } from './campaigns'

export interface ClientContact {
  name?: string
  role?: string
  email?: string
  phone?: string
}

export interface Client {
  id: string
  workspace_id: string | null
  name: string
  logo_path: string | null
  logo_url?: string
  brand_color: string | null
  contacts: ClientContact[]
  notes: string | null
  monday_item_id: string | null
  /** Storage path of the uploaded positioning source PDF. */
  positioning_pdf_path: string | null
  /** AI-distilled positioning text, injected into campaign copy generation. */
  positioning: string | null
  created_at: string
  updated_at: string
}

function enrich(row: Client): Client {
  return {
    ...row,
    contacts: Array.isArray(row.contacts) ? row.contacts : [],
    logo_url: row.logo_path ? getAssetPublicUrl(row.logo_path) : undefined,
  }
}

export async function getClients(workspaceId?: string | null): Promise<Client[]> {
  let query = supabase.from('clients').select('*').order('name', { ascending: true })
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(r => enrich(r as Client))
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
  if (error || !data) return null
  return enrich(data as Client)
}

export async function getClientByName(name: string, workspaceId?: string | null): Promise<Client | null> {
  let query = supabase.from('clients').select('*').eq('name', name)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  else query = query.is('workspace_id', null)
  // limit(1) instead of maybeSingle so stray duplicates don't turn into errors
  const { data, error } = await query.limit(1)
  if (error || !data || data.length === 0) return null
  return enrich(data[0] as Client)
}

export async function getClientByMondayItemId(mondayItemId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('monday_item_id', mondayItemId)
    .limit(1)
  if (error || !data || data.length === 0) return null
  return enrich(data[0] as Client)
}

export async function createClient(data: {
  name: string
  workspace_id?: string | null
  logo_path?: string | null
  brand_color?: string | null
  contacts?: ClientContact[]
  notes?: string | null
  monday_item_id?: string | null
}): Promise<Client> {
  const insertData: Record<string, unknown> = {
    name: data.name,
    workspace_id: data.workspace_id || null,
    logo_path: data.logo_path || null,
    brand_color: data.brand_color || '#40e1d3',
    contacts: data.contacts || [],
    notes: data.notes || null,
    monday_item_id: data.monday_item_id || null,
  }
  const { data: row, error } = await supabase.from('clients').insert(insertData).select().single()
  if (error) throw error
  return enrich(row as Client)
}

/**
 * Find an existing client by (workspace, name) or create it.
 * Used by the "add new" flow in the client picker.
 */
export async function findOrCreateClient(name: string, workspaceId?: string | null): Promise<Client> {
  const existing = await getClientByName(name, workspaceId)
  if (existing) return existing
  try {
    return await createClient({ name, workspace_id: workspaceId })
  } catch (err) {
    // Unique violation → another request created it concurrently; re-fetch
    if ((err as { code?: string })?.code === '23505') {
      const raced = await getClientByName(name, workspaceId)
      if (raced) return raced
    }
    throw err
  }
}

export async function updateClient(
  id: string,
  data: Partial<Pick<Client, 'name' | 'logo_path' | 'brand_color' | 'contacts' | 'notes' | 'workspace_id' | 'monday_item_id' | 'positioning_pdf_path' | 'positioning'>>,
): Promise<Client> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) updateData.name = data.name
  if (data.logo_path !== undefined) updateData.logo_path = data.logo_path
  if (data.brand_color !== undefined) updateData.brand_color = data.brand_color
  if (data.contacts !== undefined) updateData.contacts = data.contacts
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.workspace_id !== undefined) updateData.workspace_id = data.workspace_id
  if (data.monday_item_id !== undefined) updateData.monday_item_id = data.monday_item_id
  if (data.positioning_pdf_path !== undefined) updateData.positioning_pdf_path = data.positioning_pdf_path
  if (data.positioning !== undefined) updateData.positioning = data.positioning

  const { data: row, error } = await supabase.from('clients').update(updateData).eq('id', id).select().single()
  if (error) throw error
  const client = enrich(row as Client)

  // Keep the denormalized `client` text on linked pages/campaigns/reports in sync (best-effort)
  if (data.name !== undefined && data.name) {
    try {
      await Promise.all([
        supabase.from('landing_pages').update({ client: data.name }).eq('client_id', id),
        supabase.from('campaigns').update({ client: data.name }).eq('client_id', id),
        supabase.from('performance_reports').update({ client: data.name }).eq('client_id', id),
      ])
    } catch {
      // best-effort — a stale display name must not fail the update
    }
  }

  return client
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

export async function uploadClientLogo(file: File | Blob, clientId: string): Promise<string> {
  const storagePath = `clients/${clientId}/logo.webp`
  return compressAndUploadImage(file, storagePath)
}

/** Upload the raw positioning source PDF to storage (overwrites any previous one). */
export async function uploadClientPositioningPdf(file: File | Blob, clientId: string): Promise<string> {
  const storagePath = `clients/${clientId}/positioning.pdf`
  const { error } = await supabase.storage
    .from('campaign-assets')
    .upload(storagePath, file, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return storagePath
}
