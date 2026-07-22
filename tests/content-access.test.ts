import { describe, it, expect } from 'vitest'
import { signAccessToken, verifyAccessToken } from '@/lib/content-access'

const REPORT = 'report-123'
const OTHER = 'report-456'

describe('content access tokens', () => {
  it('lets the holder back into the resource it was issued for', async () => {
    const token = await signAccessToken(REPORT, 'hunter2')
    expect(await verifyAccessToken(token, REPORT, 'hunter2')).toBe(true)
  })

  it('does not unlock a different resource', async () => {
    // Otherwise one client's report password would open every other report.
    const token = await signAccessToken(REPORT, 'hunter2')
    expect(await verifyAccessToken(token, OTHER, 'hunter2')).toBe(false)
  })

  it('is revoked when the password is rotated', async () => {
    // The fingerprint is the whole point of storing `fp` in the payload:
    // changing the password must lock out links already handed out.
    const token = await signAccessToken(REPORT, 'old-password')
    expect(await verifyAccessToken(token, REPORT, 'new-password')).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const token = await signAccessToken(REPORT, 'hunter2')
    const dot = token.lastIndexOf('.')
    const sig = token.slice(dot + 1)
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
    expect(await verifyAccessToken(`${token.slice(0, dot)}.${flipped}`, REPORT, 'hunter2')).toBe(false)
  })

  it('rejects malformed tokens instead of throwing', async () => {
    expect(await verifyAccessToken('garbage', REPORT, 'hunter2')).toBe(false)
    expect(await verifyAccessToken('', REPORT, 'hunter2')).toBe(false)
  })

  it('works for resources that have no password', async () => {
    const token = await signAccessToken(REPORT, null)
    expect(await verifyAccessToken(token, REPORT, null)).toBe(true)
  })
})
