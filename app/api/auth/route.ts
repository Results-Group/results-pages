import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPassword, hashPassword, isLegacyHash } from '@/lib/hash'
import { destroySession, createSessionCookie, type SessionUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { parseJson } from '@/lib/http'

const TOO_MANY = 'יותר מדי ניסיונות התחברות. המתינו כדקה ונסו שוב.'

export async function POST(req: NextRequest) {
  // Generous per-IP cap: a whole office often shares one NAT IP, so this only
  // guards infra from abuse — the real per-account brute-force guard is below.
  const ipRl = await rateLimit(req, { windowMs: 60_000, max: 60, prefix: 'auth-ip', message: TOO_MANY })
  if (ipRl) return ipRl

  const { data: body, error: parseError } = await parseJson<{ email?: string; password?: string }>(req)
  if (parseError) return parseError
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'יש להזין אימייל וסיסמה' }, { status: 400 })
  }

  // Per-account cap: keyed on email so multiple distinct employees behind the
  // same office IP each get their own budget, while a single account still
  // can't be brute-forced.
  const emailKey = String(email).toLowerCase().trim()
  const emailRl = await rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'auth-email', key: emailKey, message: TOO_MANY })
  if (emailRl) return emailRl

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
