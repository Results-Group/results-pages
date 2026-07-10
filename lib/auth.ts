import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'rp_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface SessionUser {
  userId: string
  email: string
  role: UserRole
  name: string
  isOwner?: boolean
}

// ── HMAC signing (Web Crypto — works in Edge + Node) ──

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET env var is required')
  return s
}

async function hmacSign(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload)
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

async function encodeSession(user: SessionUser): Promise<string> {
  const payload = btoa(JSON.stringify(user))
  const sig = await hmacSign(payload)
  return `${payload}.${sig}`
}

async function decodeSession(token: string): Promise<SessionUser | null> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 1) return null
    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    if (!(await hmacVerify(payload, sig))) return null
    const json = atob(payload)
    const parsed = JSON.parse(json)
    if (parsed.userId && parsed.email && parsed.role) return parsed as SessionUser
    return null
  } catch {
    return null
  }
}

// ── Public API ──

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return decodeSession(token)
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getSession())
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return decodeSession(token)
}

export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

const ROLE_LEVEL: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 }

export async function requireRole(request: NextRequest, minimumRole: UserRole): Promise<NextResponse | null> {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (ROLE_LEVEL[session.role] < ROLE_LEVEL[minimumRole]) {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }
  return null
}

export async function createSessionCookie(user: SessionUser): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  return {
    name: SESSION_COOKIE,
    value: await encodeSession(user),
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
  const { supabase } = await import('./supabase')
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

// Verify a signed session token (for middleware — Edge compatible)
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  return decodeSession(token)
}

// ── Workspace-aware permission check ──

export async function requireWorkspacePermission(
  request: NextRequest,
  workspaceId: string,
  action: import('./workspaces').WorkspaceAction,
): Promise<NextResponse | null> {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Owners and global admins have full access to every workspace
  if (session.isOwner || session.role === 'admin') return null

  const { getWorkspaceMembership, resolvePermission } = await import('./workspaces')
  const membership = await getWorkspaceMembership(session.userId, workspaceId)
  if (!membership) {
    return NextResponse.json({ error: 'אין הרשאה לסביבת עבודה זו' }, { status: 403 })
  }
  if (!resolvePermission(membership.role, membership.permissions, action)) {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }
  return null
}

export async function getActiveWorkspaceId(request: NextRequest): Promise<string | null> {
  return request.cookies.get('rp_workspace')?.value || null
}
