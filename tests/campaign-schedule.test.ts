import { describe, it, expect } from 'vitest'
import { validatePublishWindow, MIN_CAMPAIGN_MS, GRACE_MS, DEFAULT_EXPIRY_PAD_MS } from '@/lib/campaign-schedule'

/**
 * The publish-window rule, with its documented past bug: with no publish date
 * the base is `now`, which advances between calls — a strict comparison
 * rejected the very expiry the previous call had just suggested, so
 * publishing could never succeed. The grace window is the fix.
 */
describe('validatePublishWindow', () => {
  const NOW = Date.parse('2026-08-19T12:00:00Z')

  it('missing end date → not ok, with a suggested expiry a day past the minimum', () => {
    const r = validatePublishWindow(null, null, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('missing')
      expect(r.suggestedExpiry).toBe(NOW + MIN_CAMPAIGN_MS + DEFAULT_EXPIRY_PAD_MS)
    }
  })

  it('accepts the expiry it itself suggested moments earlier (the grace regression)', () => {
    const first = validatePublishWindow(null, null, NOW)
    if (first.ok) throw new Error('expected missing')
    // The operator clicks publish again a few minutes later — base moved on.
    const later = NOW + GRACE_MS - 60_000
    const second = validatePublishWindow(null, new Date(first.suggestedExpiry).toISOString(), later)
    expect(second.ok).toBe(true)
  })

  it('an operator-set end date shorter than 4 weeks blocks', () => {
    const tooEarly = new Date(NOW + MIN_CAMPAIGN_MS - 2 * 24 * 60 * 60 * 1000).toISOString()
    const r = validatePublishWindow(null, tooEarly, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('tooEarly')
  })

  it('measures from the scheduled publish date when one exists', () => {
    const publishAt = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString()
    // 4 weeks past NOW is not enough when publish is a week out
    const exp = new Date(NOW + MIN_CAMPAIGN_MS + 24 * 60 * 60 * 1000).toISOString()
    expect(validatePublishWindow(publishAt, exp, NOW).ok).toBe(false)
    const farEnough = new Date(NOW + 7 * 24 * 60 * 60 * 1000 + MIN_CAMPAIGN_MS + 1000).toISOString()
    expect(validatePublishWindow(publishAt, farEnough, NOW).ok).toBe(true)
  })

  it('garbage dates count as missing, not as valid', () => {
    const r = validatePublishWindow(null, 'not-a-date', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('missing')
  })
})
