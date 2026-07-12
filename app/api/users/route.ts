import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSessionFromRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/hash'
import { addAdminToAllWorkspaces } from '@/lib/workspaces'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.isOwner) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { data: users, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, is_owner, created_at, last_login')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'שגיאה בטעינת משתמשים' }, { status: 500 })
  }

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('user_id, workspace_id, role, permissions, workspaces(id, name, slug, color, icon)')

  const membershipsByUser: Record<string, unknown[]> = {}
  for (const m of memberships || []) {
    if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = []
    membershipsByUser[m.user_id].push(m)
  }

  const enriched = (users || []).map(u => ({
    ...u,
    workspace_memberships: membershipsByUser[u.id] || [],
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.isOwner) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { email, password, name, role } = await req.json()

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'יש למלא אימייל, שם וסיסמה' }, { status: 400 })
  }

  if (role && !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'תפקיד לא חוקי' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  const { data: user, error } = await supabase
    .from('admin_users')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: name.trim(),
      role: role || 'editor',
    })
    .select('id, email, name, role, is_owner, created_at, last_login')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'אימייל זה כבר קיים במערכת' }, { status: 409 })
    }
    return NextResponse.json({ error: 'שגיאה ביצירת משתמש' }, { status: 500 })
  }

  if (user.role === 'admin' || user.is_owner) {
    await addAdminToAllWorkspaces(user.id).catch(() => {})
  }

  return NextResponse.json(user, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.isOwner) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { id, name, role, password, is_owner } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
  }

  if (role && !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'תפקיד לא חוקי' }, { status: 400 })
  }

  // Only the owner may change the role or reset the password of another
  // admin/owner — otherwise any admin could take over another admin's account.
  const { data: target } = await supabase
    .from('admin_users')
    .select('role, is_owner')
    .eq('id', id)
    .single()
  const targetIsPrivileged = !!target && (target.is_owner || target.role === 'admin')
  if (targetIsPrivileged && !session.isOwner && session.userId !== id && (role !== undefined || password !== undefined)) {
    return NextResponse.json({ error: 'רק הבעלים יכול לשנות תפקיד או סיסמה של מנהל אחר' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name.trim()
  if (role) updateData.role = role
  if (is_owner !== undefined && session.isOwner) updateData.is_owner = is_owner
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 })
    }
    updateData.password_hash = await hashPassword(password)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 })
  }

  const { data: user, error } = await supabase
    .from('admin_users')
    .update(updateData)
    .eq('id', id)
    .select('id, email, name, role, is_owner, created_at, last_login')
    .single()

  if (error) {
    return NextResponse.json({ error: 'שגיאה בעדכון משתמש' }, { status: 500 })
  }

  if (user.role === 'admin' || user.is_owner) {
    await addAdminToAllWorkspaces(user.id).catch(() => {})
  }

  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.isOwner) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
  }

  if (session.userId === id) {
    return NextResponse.json({ error: 'לא ניתן למחוק את עצמך' }, { status: 400 })
  }

  // Only the owner may delete another admin/owner
  const { data: target } = await supabase
    .from('admin_users')
    .select('role, is_owner')
    .eq('id', id)
    .single()
  if (target && (target.is_owner || target.role === 'admin') && !session.isOwner) {
    return NextResponse.json({ error: 'רק הבעלים יכול למחוק מנהל אחר' }, { status: 403 })
  }

  const { error } = await supabase
    .from('admin_users')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'שגיאה במחיקת משתמש' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
