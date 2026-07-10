import { NextRequest, NextResponse } from 'next/server'
import { createSessionCookie, type SessionUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const PH_COOKIE = 'ph_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'ph-auth' })
  if (rl) return rl

  const { password } = await req.json()
  const expected = process.env.PIZZAHOUSE_DASHBOARD_PASSWORD

  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  const phUser: SessionUser = {
    userId: 'pizza-house',
    email: 'pizza-house@client',
    role: 'viewer',
    name: 'Pizza House',
  }

  const cookie = await createSessionCookie(phUser)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(PH_COOKIE, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(PH_COOKIE)
  return response
}
