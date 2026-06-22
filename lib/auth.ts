import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'crypto'

const SESSION_COOKIE = 'rp_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(input: string): boolean {
  const stored = process.env.ADMIN_PASSWORD
  if (!stored) return false
  return input === stored
}

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return token
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
