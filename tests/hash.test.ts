import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, isLegacyHash } from '@/lib/hash'

// Mirrors the legacy scheme in lib/hash.ts so we can prove old rows still
// authenticate after the move to bcrypt.
const LEGACY_SALT = 'results-salt-2026'
async function legacySha256(password: string) {
  const data = new TextEncoder().encode(password + LEGACY_SALT)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('password hashing', () => {
  it('verifies a password against its own bcrypt hash', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('Correct Horse Battery Staple', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('salts each hash, so identical passwords differ on disk', async () => {
    const [a, b] = [await hashPassword('same'), await hashPassword('same')]
    expect(a).not.toBe(b)
    expect(await verifyPassword('same', a)).toBe(true)
    expect(await verifyPassword('same', b)).toBe(true)
  })

  it('still accepts a legacy SHA-256 hash', async () => {
    // Users created before the bcrypt migration must be able to log in — that
    // login is what triggers the upgrade.
    const legacy = await legacySha256('old-account')
    expect(await verifyPassword('old-account', legacy)).toBe(true)
    expect(await verifyPassword('wrong', legacy)).toBe(false)
  })

  it('flags legacy hashes for upgrade and leaves bcrypt alone', async () => {
    expect(isLegacyHash(await legacySha256('x'))).toBe(true)
    expect(isLegacyHash(await hashPassword('x'))).toBe(false)
  })
})
