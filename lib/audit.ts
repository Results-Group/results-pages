import { supabase } from './supabase'
import { captureException } from './logger'
import type { SessionUser } from './auth'

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'publish' | 'purge'
export type AuditEntity = 'campaign' | 'page' | 'client' | 'user' | 'workspace' | 'report'

export interface AuditEntry {
  id: string
  user_id: string | null
  user_email: string | null
  action: AuditAction
  entity_type: AuditEntity
  entity_id: string | null
  entity_label: string | null
  workspace_id: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

/**
 * Fire-and-forget audit record. Never throws — logging must not break the
 * request it's recording.
 */
export async function logAudit(input: {
  actor?: SessionUser | null
  action: AuditAction
  entity_type: AuditEntity
  entity_id?: string | null
  entity_label?: string | null
  workspace_id?: string | null
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      user_id: input.actor?.userId ?? null,
      user_email: input.actor?.email ?? null,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      entity_label: input.entity_label ?? null,
      workspace_id: input.workspace_id ?? null,
      meta: input.meta ?? null,
    })
    if (error) {
      captureException(error, { scope: 'logAudit', action: input.action, entity_type: input.entity_type })
    }
  } catch (err) {
    // swallow — auditing is best-effort, but record the failure
    captureException(err, { scope: 'logAudit', action: input.action, entity_type: input.entity_type })
  }
}

export async function getAuditLog(filters?: {
  user_id?: string
  entity_type?: AuditEntity
  action?: AuditAction
  limit?: number
}): Promise<AuditEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 200)

  if (filters?.user_id) query = query.eq('user_id', filters.user_id)
  if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type)
  if (filters?.action) query = query.eq('action', filters.action)

  const { data, error } = await query
  if (error) return []
  return (data || []) as AuditEntry[]
}
