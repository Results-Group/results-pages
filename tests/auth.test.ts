import { describe, it, expect } from 'vitest'
import { createSessionCookie, verifySessionToken, type SessionUser } from '@/lib/auth'

const user: SessionUser = {
  userId: 'u-1',
  email: 'someone@example.com',
  role: 'editor',
  name: 'Some One',
}

async function tokenFor(u: SessionUser, maxAge?: number) {
  const { value } = await createSessionCookie(u, maxAge)
  return value
}

describe('session tokens', () => {
  it('round-trips a signed session', async () => {
    const session = await verifySessionToken(await tokenFor(user))
    expect(session).toMatchObject({ userId: 'u-1', email: 'someone@example.com', role: 'editor' })
  })

  it('rejects a tampered signature', async () => {
    const token = await tokenFor(user)
    const [payload, sig] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)]
    // Flip one character of the signature, keeping the length identical so the
    // constant-time compare is exercised rather than the length short-circuit.
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
    expect(await verifySessionToken(`${payload}.${flipped}`)).toBeNull()
  })

  it('rejects a payload edited to escalate role', async () => {
    const token = await tokenFor(user)
    const sig = token.slice(token.lastIndexOf('.') + 1)
    const forged = Buffer.from(JSON.stringify({ ...user, role: 'admin', exp: 9999999999 })).toString('base64')
    expect(await verifySessionToken(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects an expired token', async () => {
    // Negative max-age puts `exp` in the past.
    expect(await verifySessionToken(await tokenFor(user, -60))).toBeNull()
  })

  it('rejects a token with no signature at all', async () => {
    expect(await verifySessionToken('not-a-token')).toBeNull()
    expect(await verifySessionToken('')).toBeNull()
  })

  it('preserves a non-ASCII name', async () => {
    // Regression guard: plain btoa() throws on Hebrew, which used to break
    // login for users whose display name was not Latin1.
    const hebrew: SessionUser = { ...user, name: 'מתן בר נס' }
    const session = await verifySessionToken(await tokenFor(hebrew))
    expect(session?.name).toBe('מתן בר נס')
  })

  it('keeps the pizza-house scope on the token', async () => {
    // Scope is what stops a shared restaurant password being replayed against
    // the admin gate, so it must survive the round-trip verbatim.
    const scoped: SessionUser = { ...user, scope: 'pizza-house' }
    expect((await verifySessionToken(await tokenFor(scoped)))?.scope).toBe('pizza-house')
    expect((await verifySessionToken(await tokenFor(user)))?.scope).toBeUndefined()
  })
})
