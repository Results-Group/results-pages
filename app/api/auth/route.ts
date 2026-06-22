import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, generateSessionToken, destroySession, SESSION_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  const token = generateSessionToken()
  const response = NextResponse.json({ ok: true })
  response.cookies.set('rp_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return response
}

export async function DELETE() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
