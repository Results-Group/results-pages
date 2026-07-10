import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { getWorkspaceMembers, addWorkspaceMember, updateWorkspaceMember, removeWorkspaceMember } from '@/lib/workspaces'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const permErr = await requireWorkspacePermission(req, id, 'view')
  if (permErr) return permErr

  const members = await getWorkspaceMembers(id)
  return NextResponse.json(members)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const permErr = await requireWorkspacePermission(req, id, 'manage_users')
  if (permErr) return permErr

  const { user_id, role, permissions } = await req.json()
  if (!user_id || !role) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  try {
    const member = await addWorkspaceMember(id, user_id, role, permissions || {})
    return NextResponse.json(member, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'שגיאה בהוספת חבר' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const permErr = await requireWorkspacePermission(req, id, 'manage_users')
  if (permErr) return permErr

  const { user_id, role, permissions } = await req.json()
  if (!user_id) {
    return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
  }

  try {
    const updates: Record<string, unknown> = {}
    if (role) updates.role = role
    if (permissions !== undefined) updates.permissions = permissions
    const member = await updateWorkspaceMember(id, user_id, updates as Parameters<typeof updateWorkspaceMember>[2])
    return NextResponse.json(member)
  } catch {
    return NextResponse.json({ error: 'שגיאה בעדכון חבר' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const permErr = await requireWorkspacePermission(req, id, 'manage_users')
  if (permErr) return permErr

  const { user_id } = await req.json()
  if (!user_id) {
    return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
  }

  try {
    await removeWorkspaceMember(id, user_id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'שגיאה בהסרת חבר' }, { status: 500 })
  }
}
