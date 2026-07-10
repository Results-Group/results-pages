import { supabase } from './supabase'
import type { UserRole } from './auth'

export type WorkspaceAction = 'view' | 'create' | 'edit' | 'delete' | 'manage_users'

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: UserRole
  permissions: Record<string, boolean>
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  created_at: string
}

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Record<WorkspaceAction, boolean>> = {
  admin:  { view: true, create: true, edit: true, delete: true, manage_users: true },
  editor: { view: true, create: true, edit: true, delete: false, manage_users: false },
  viewer: { view: true, create: false, edit: false, delete: false, manage_users: false },
}

export function resolvePermission(
  role: UserRole,
  overrides: Record<string, boolean>,
  action: WorkspaceAction,
): boolean {
  if (action in overrides) return overrides[action]
  return ROLE_DEFAULT_PERMISSIONS[role]?.[action] ?? false
}

export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMember | null> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single()
  if (error || !data) return null
  return data as WorkspaceMember
}

export async function getUserWorkspaces(userId: string): Promise<(Workspace & { role: UserRole; permissions: Record<string, boolean> })[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, permissions, workspaces(*)')
    .eq('user_id', userId)

  if (error || !data) return []

  return data
    .filter((m: Record<string, unknown>) => m.workspaces)
    .map((m: Record<string, unknown>) => ({
      ...(m.workspaces as Workspace),
      role: m.role as UserRole,
      permissions: (m.permissions || {}) as Record<string, boolean>,
    }))
}

export async function getAllWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return []
  return data as Workspace[]
}

export async function createWorkspace(name: string, slug: string, color?: string, icon?: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, slug, color: color || '#40e1d3', icon: icon || 'folder' })
    .select()
    .single()
  if (error) throw error
  return data as Workspace
}

export async function updateWorkspace(id: string, updates: Partial<Pick<Workspace, 'name' | 'slug' | 'color' | 'icon'>>): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Workspace
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) throw error
}

export async function getWorkspaceMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, admin_users(id, email, name, role, is_owner)')
    .eq('workspace_id', workspaceId)
  if (error) return []
  return data
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: UserRole,
  permissions: Record<string, boolean> = {},
): Promise<WorkspaceMember> {
  const { data, error } = await supabase
    .from('workspace_members')
    .upsert({ workspace_id: workspaceId, user_id: userId, role, permissions }, { onConflict: 'workspace_id,user_id' })
    .select()
    .single()
  if (error) throw error
  return data as WorkspaceMember
}

export async function updateWorkspaceMember(
  workspaceId: string,
  userId: string,
  updates: { role?: UserRole; permissions?: Record<string, boolean> },
): Promise<WorkspaceMember> {
  const { data, error } = await supabase
    .from('workspace_members')
    .update(updates)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as WorkspaceMember
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Ensure every global admin/owner is a member of every workspace */
export async function syncAdminsToAllWorkspaces(): Promise<void> {
  const [{ data: admins }, { data: workspaces }] = await Promise.all([
    supabase.from('admin_users').select('id').or('role.eq.admin,is_owner.eq.true'),
    supabase.from('workspaces').select('id'),
  ])
  if (!admins?.length || !workspaces?.length) return

  const rows = workspaces.flatMap(ws =>
    admins.map(admin => ({
      workspace_id: ws.id,
      user_id: admin.id,
      role: 'admin' as const,
      permissions: {},
    }))
  )

  await supabase
    .from('workspace_members')
    .upsert(rows, { onConflict: 'workspace_id,user_id' })
}

/** Add a specific admin user to all existing workspaces */
export async function addAdminToAllWorkspaces(userId: string): Promise<void> {
  const { data: workspaces } = await supabase.from('workspaces').select('id')
  if (!workspaces?.length) return

  const rows = workspaces.map(ws => ({
    workspace_id: ws.id,
    user_id: userId,
    role: 'admin' as const,
    permissions: {},
  }))

  await supabase
    .from('workspace_members')
    .upsert(rows, { onConflict: 'workspace_id,user_id' })
}

/** Add all admins/owners as members of a newly created workspace */
export async function addAllAdminsToWorkspace(workspaceId: string): Promise<void> {
  const { data: admins } = await supabase
    .from('admin_users')
    .select('id')
    .or('role.eq.admin,is_owner.eq.true')
  if (!admins?.length) return

  const rows = admins.map(admin => ({
    workspace_id: workspaceId,
    user_id: admin.id,
    role: 'admin' as const,
    permissions: {},
  }))

  await supabase
    .from('workspace_members')
    .upsert(rows, { onConflict: 'workspace_id,user_id' })
}
