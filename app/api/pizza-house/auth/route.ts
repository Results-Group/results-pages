import { NextRequest, NextResponse } from 'next/server'
import { createSessionCookie, type SessionUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { parseJson } from '@/lib/http'

const PH_COOKIE = 'ph_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'ph-auth' })
  if (rl) return rl

  const { data: body, error: parseError } = await parseJson<{ password?: string }>(req)
  if (parseError) return parseError
  const { password } = body
  const expected = process.env.PIZZAHOUSE_DASHBOARD_PASSWORD

  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  const phUser: SessionUser = {
    userId: 'pizza-house',
    email: 'pizza-house@client',
    role: 'viewer',
    name: 'Pizza House',
    // Marks the token as valid only for this dashboard. Without it the shared
    // restaurant password mints a token that also passes the /admin gate.
    scope: 'pizza-house',
  }

  const cookie = await createSessionCookie(phUser, MAX_AGE)
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
