import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession, destroySession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  await createSession()
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
