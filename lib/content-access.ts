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

export async function signAccessToken(resourceId: string): Promise<string> {
  const payload = JSON.stringify({ id: resourceId, t: Date.now() })
  const b64 = btoa(payload)
  const sig = await hmacSign(b64)
  return `${b64}.${sig}`
}

export async function verifyAccessToken(token: string, resourceId: string): Promise<boolean> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 1) return false
    const b64 = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    if (!(await hmacVerify(b64, sig))) return false
    const parsed = JSON.parse(atob(b64))
    return parsed.id === resourceId
  } catch {
    return false
  }
}
