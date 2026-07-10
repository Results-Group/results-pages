/**
 * Stateless, single-use-ish password reset tokens (HMAC-SHA256).
 *
 * The token binds to the user id, an expiry, and a fingerprint of the current
 * password hash — so the token stops working once the password changes or the
 * window elapses. No extra DB table required.
 */

const RESET_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET env var is required')
  return s
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Constant-time string comparison (Web Crypto context — no node:crypto timingSafeEqual). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return b64url(new Uint8Array(sig))
}

/** fingerprint = short HMAC of the password hash, so old tokens die on reset */
async function fingerprint(passwordHash: string): Promise<string> {
  return (await hmac(`pw:${passwordHash}`)).slice(0, 16)
}

export async function createResetToken(userId: string, passwordHash: string): Promise<string> {
  const fp = await fingerprint(passwordHash)
  const payload = btoa(JSON.stringify({ id: userId, fp, t: Date.now() }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const sig = await hmac(payload)
  return `${payload}.${sig}`
}

export async function verifyResetToken(
  token: string,
  lookupPasswordHash: (userId: string) => Promise<string | null>,
): Promise<{ userId: string } | null> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 1) return null
    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    if (!timingSafeEqual(await hmac(payload), sig)) return null

    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(atob(b64)) as { id: string; fp: string; t: number }
    if (Date.now() - parsed.t > RESET_MAX_AGE_MS) return null

    const currentHash = await lookupPasswordHash(parsed.id)
    if (!currentHash) return null
    if (!timingSafeEqual(await fingerprint(currentHash), parsed.fp)) return null

    return { userId: parsed.id }
  } catch {
    return null
  }
}
