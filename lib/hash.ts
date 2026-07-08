import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // bcrypt hashes always start with "$2"
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash)
  }
  // Legacy SHA-256 fallback — verify against old format
  return (await legacySha256(password)) === hash
}

// Returns true if the hash is the old SHA-256 format and should be upgraded
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('$2')
}

const LEGACY_SALT = 'results-salt-2026'

async function legacySha256(password: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(password + LEGACY_SALT)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
