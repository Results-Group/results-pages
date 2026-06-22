import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'rp_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function verifyPassword(input: string): boolean {
  const stored = process.env.ADMIN_PASSWORD
  if (!stored) return false
  return input === stored
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value || null
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return !!session
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export function requireAuth(request: NextRequest): NextResponse | null {
  const session = request.cookies.get(SESSION_COOKIE)?.value
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
