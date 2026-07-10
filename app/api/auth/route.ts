import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPassword, hashPassword, isLegacyHash } from '@/lib/hash'
import { destroySession, createSessionCookie, type SessionUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'auth' })
  if (rl) return rl

  const body = await req.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'יש להזין אימייל וסיסמה' }, { status: 400 })
  }

  const { data: user, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'אימייל או סיסמה שגויים' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'אימייל או סיסמה שגויים' }, { status: 401 })
  }

  // Upgrade legacy SHA-256 hash to bcrypt on successful login
  if (isLegacyHash(user.password_hash)) {
    const newHash = await hashPassword(password)
    await supabase.from('admin_users').update({ password_hash: newHash }).eq('id', user.id)
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
    isOwner: user.is_owner || false,
  }

  const cookie = await createSessionCookie(sessionUser)
  const response = NextResponse.json({ ok: true, user: { name: user.name, role: user.role } })
  response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2])
  return response
}

export async function DELETE() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
