import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from './supabase'
import { verifyPassword as verifyHash } from './hash'

const SESSION_COOKIE = 'rp_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface SessionUser {
  userId: string
  email: string
  role: UserRole
  name: string
}

function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64')
}

function decodeSession(token: string): SessionUser | null {
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8')
    const parsed = JSON.parse(json)
    if (parsed.userId && parsed.email && parsed.role) return parsed as SessionUser
    return null
  } catch {
    return null
  }
}

// Legacy single-password check (fallback when admin_users table is empty/missing)
export function verifyLegacyPassword(input: string): boolean {
  const stored = process.env.ADMIN_PASSWORD
  if (!stored) return false
  return input === stored
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const user = decodeSession(token)
  if (user) return user

  // Legacy session — any non-empty value means logged in with old system
  return { userId: 'legacy', email: 'admin', role: 'admin', name: 'Admin' }
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return !!session
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export function getSessionFromRequest(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null

  const user = decodeSession(token)
  if (user) return user

  // Legacy fallback
  return { userId: 'legacy', email: 'admin', role: 'admin', name: 'Admin' }
}

export function requireAuth(request: NextRequest): NextResponse | null {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

const ROLE_LEVEL: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 }

export function requireRole(request: NextRequest, minimumRole: UserRole): NextResponse | null {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (ROLE_LEVEL[session.role] < ROLE_LEVEL[minimumRole]) {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }
  return null
}

export function createSessionCookie(user: SessionUser): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: SESSION_COOKIE,
    value: encodeSession(user),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: SESSION_MAX_AGE,
      path: '/',
    },
  }
}

export async function hasAdminUsers(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
    if (error) return false
    return (count ?? 0) > 0
  } catch {
    return false
  }
}
