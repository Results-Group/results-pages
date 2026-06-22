import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

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
