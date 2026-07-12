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
