import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, getSessionFromRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/hash'

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin')
  if (roleErr) return roleErr

  const { data: users, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, created_at, last_login')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'שגיאה בטעינת משתמשים' }, { status: 500 })
  }

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin')
  if (roleErr) return roleErr

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
    .select('id, email, name, role, created_at, last_login')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'אימייל זה כבר קיים במערכת' }, { status: 409 })
    }
    return NextResponse.json({ error: 'שגיאה ביצירת משתמש' }, { status: 500 })
  }

  return NextResponse.json(user, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const roleErr = requireRole(req, 'admin')
  if (roleErr) return roleErr

  const { id, name, role, password } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
  }

  if (role && !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'תפקיד לא חוקי' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name.trim()
  if (role) updateData.role = role
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
    .select('id, email, name, role, created_at, last_login')
    .single()

  if (error) {
    return NextResponse.json({ error: 'שגיאה בעדכון משתמש' }, { status: 500 })
  }

  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const roleErr = requireRole(req, 'admin')
  if (roleErr) return roleErr

  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
  }

  const session = getSessionFromRequest(req)
  if (session?.userId === id) {
    return NextResponse.json({ error: 'לא ניתן למחוק את עצמך' }, { status: 400 })
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
