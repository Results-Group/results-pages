import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPassword } from '@/lib/hash'
import {
  verifyLegacyPassword,
  destroySession,
  createSessionCookie,
  hasAdminUsers,
  type SessionUser,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password } = body

  // Legacy fallback: single-password mode
  if (!email && password) {
    const hasUsers = await hasAdminUsers()
    if (!hasUsers && verifyLegacyPassword(password)) {
      const cookie = createSessionCookie({
        userId: 'legacy',
        email: 'admin',
        role: 'admin',
        name: 'Admin',
      })
      const response = NextResponse.json({ ok: true })
      response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2])
      return response
    }
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'יש להזין אימייל וסיסמה' }, { status: 400 })
  }

  const { data: user, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !user) {
    // Fallback: if no admin_users exist, try legacy password
    const hasUsers = await hasAdminUsers()
    if (!hasUsers && verifyLegacyPassword(password)) {
      const cookie = createSessionCookie({
        userId: 'legacy',
        email: 'admin',
        role: 'admin',
        name: 'Admin',
      })
      const response = NextResponse.json({ ok: true })
      response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2])
      return response
    }
    return NextResponse.json({ error: 'אימייל או סיסמה שגויים' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'אימייל או סיסמה שגויים' }, { status: 401 })
  }

  await supabase
    .from('admin_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id)

  const sessionUser: SessionUser = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  }

  const cookie = createSessionCookie(sessionUser)
  const response = NextResponse.json({ ok: true, user: { name: user.name, role: user.role } })
  response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2])
  return response
}

export async function DELETE() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
