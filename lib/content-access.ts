/**
 * Signed access tokens for password-protected campaigns and pages.
 * Uses HMAC-SHA256 so tokens can't be forged without SESSION_SECRET.
 */

export const CONTENT_ACCESS_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

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

/**
 * Short deterministic fingerprint of the resource's current password, so that
 * rotating the password invalidates any previously-issued access tokens.
 */
async function passwordFingerprint(password: string | null | undefined): Promise<string> {
  if (!password) return ''
  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(password))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).slice(0, 12)
}

export async function signAccessToken(resourceId: string, password?: string | null): Promise<string> {
  const fp = await passwordFingerprint(password)
  const payload = JSON.stringify({ id: resourceId, t: Date.now(), fp })
  const b64 = btoa(payload)
  const sig = await hmacSign(b64)
  return `${b64}.${sig}`
}

export async function verifyAccessToken(token: string, resourceId: string, password?: string | null): Promise<boolean> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 1) return false
    const b64 = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    if (!(await hmacVerify(b64, sig))) return false
    const parsed = JSON.parse(atob(b64))
    if (parsed.id !== resourceId) return false
    // Enforce the token's own expiry (was previously only the cookie maxAge)
    if (typeof parsed.t !== 'number' || Date.now() - parsed.t > CONTENT_ACCESS_MAX_AGE * 1000) return false
    // When the caller supplies the current password, rotating it revokes old tokens
    if (password !== undefined) {
      const fp = await passwordFingerprint(password)
      if ((parsed.fp || '') !== fp) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * How long the PDF route's own headless browser has to load the deck. The
 * token never leaves the server — it rides in the URL the route navigates to —
 * so it only has to outlive one render.
 */
const RENDER_TOKEN_TTL_MS = 2 * 60 * 1000

/**
 * A ticket for the server's headless browser to render a deck for PDF export
 * (app/api/campaigns/[id]/pdf): it opens the password gate, keeps the render
 * out of the client's view count, and — only when `staff` — opens a draft too.
 * `purpose` keeps it from doubling as an access token, and an access token
 * (which has no `purpose`) from passing as this.
 */
export async function signRenderToken(resourceId: string, opts: { staff: boolean }): Promise<string> {
  const payload = JSON.stringify({ id: resourceId, purpose: 'pdf', staff: opts.staff, exp: Date.now() + RENDER_TOKEN_TTL_MS })
  const b64 = btoa(payload)
  const sig = await hmacSign(b64)
  return `${b64}.${sig}`
}

export async function verifyRenderToken(token: string, resourceId: string): Promise<{ staff: boolean } | null> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 1) return null
    const b64 = token.slice(0, dotIdx)
    if (!(await hmacVerify(b64, token.slice(dotIdx + 1)))) return null
    const parsed = JSON.parse(atob(b64))
    if (parsed.purpose !== 'pdf' || parsed.id !== resourceId) return null
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null
    return { staff: parsed.staff === true }
  } catch {
    return null
  }
}
