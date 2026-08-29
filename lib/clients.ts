import { supabase } from './supabase'
import { compressAndUploadImage } from './campaigns'
import { assetProxyUrl } from './asset-url'
import { clientNameKey } from './client-name'
export { clientNameKey } from './client-name'

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
    logo_url: row.logo_path ? assetProxyUrl(row.logo_path) : undefined,
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
  const key = clientNameKey(name)
  if (!key) return null

  // Matching happens in JS rather than SQL: the comparison has to ignore case
  // AND separators, which no plain column filter expresses. The table holds
  // tens of clients, so reading the workspace's rows is cheaper than the
  // machinery an equivalent SQL expression would need.
  let query = supabase.from('clients').select('*')
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  else query = query.is('workspace_id', null)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  const rows = data as Client[]
  // An exact hit wins over a loose one, so an existing precise name is never
  // shadowed by a differently-punctuated sibling.
  const exact = rows.find(c => c.name === name)
  if (exact) return enrich(exact)

  const loose = rows.filter(c => clientNameKey(c.name) === key)
  if (loose.length === 0) return null
  // Among loose matches prefer the record linked to Monday — that is the
  // canonical one, and its name is the one that should win.
  return enrich(loose.find(c => c.monday_item_id) ?? loose[0])
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

/**
 * Guards a client_id arriving from a request body. Without it an editor could
 * attach ANY client uuid to a record they own — and generate-copy then feeds
 * that client's confidential positioning document into the prompt and hands
 * the text back as copy. The create routes checked this; the update routes
 * passed the id straight through.
 *
 * Returns an error message (Hebrew, ready to return as 400) or null.
 */
export async function validateClientForWorkspace(
  clientId: string | null | undefined,
  workspaceId: string | null | undefined,
): Promise<string | null> {
  if (!clientId) return null
  const client = await getClientById(clientId)
  if (!client) return 'הלקוח שנבחר לא נמצא'
  if (client.workspace_id && client.workspace_id !== workspaceId) {
    return 'הלקוח שנבחר אינו שייך לסביבת העבודה שנבחרה'
  }
  return null
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

  // Sync the denormalized `client` display name to campaigns + reports (best-effort).
  // NOTE: landing_pages.client is deliberately NOT updated — for pages that column
  // is the ASCII slug in the public URL /pages/<client>/<slug>; rewriting it would
  // 404 every already-shared link (and, for Hebrew names, store an invalid key).
  if (data.name !== undefined && data.name) {
    try {
      await Promise.all([
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
  // Unique per upload — a fixed `logo.webp` under a year-long cache header made
  // a replaced logo look unsaved for as long as anything held the old copy.
  // See the note on uploadLogoImage in lib/campaigns.ts.
  const storagePath = `clients/${clientId}/logo-${crypto.randomUUID().slice(0, 8)}.webp`
  return compressAndUploadImage(file, storagePath)
}

/**
 * The positioning PDF is the client's confidential brand strategy, and its
 * path is fully predictable (`clients/<uuid>/positioning.pdf`) from a client id
 * that every public deck prints in its logo URL. It therefore lives in a
 * PRIVATE bucket — in the public one, the staff-session check on the asset
 * proxy was only one of two doors, and the CDN was the other.
 */
export const CLIENT_DOCS_BUCKET = 'client-docs'

/** Upload the raw positioning source PDF to storage (overwrites any previous one). */
export async function uploadClientPositioningPdf(file: File | Blob, clientId: string): Promise<string> {
  const storagePath = `clients/${clientId}/positioning.pdf`
  const { error } = await supabase.storage
    .from(CLIENT_DOCS_BUCKET)
    .upload(storagePath, file, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return storagePath
}
