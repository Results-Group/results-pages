/**
 * Publish-window rules. Client-safe, pure — shared by the editor and tests.
 *
 * A published campaign must carry an end date at least MIN_CAMPAIGN_MS after
 * its publish date; the campaign auto-archives once it passes.
 */

/** Minimum campaign lifetime before it auto-archives. */
export const MIN_CAMPAIGN_MS = 28 * 24 * 60 * 60 * 1000 // 4 weeks

/**
 * Tolerance matters: with no publish date the base is `now`, which advances
 * between calls. Comparing strictly against it rejected the very value the
 * caller had just auto-filled, so publishing could never succeed.
 */
export const GRACE_MS = 10 * 60_000

/** One day past the minimum — the value auto-filled when no end date exists. */
export const DEFAULT_EXPIRY_PAD_MS = 24 * 60 * 60 * 1000

export type PublishWindow =
  /** The dates as given are fine — publish. */
  | { ok: true }
  /** No usable end date: publish may proceed with `suggestedExpiry` filled in. */
  | { ok: false; reason: 'missing'; suggestedExpiry: number }
  /** The operator set an end date that is too early — a real mistake to fix. */
  | { ok: false; reason: 'tooEarly'; suggestedExpiry: number; minExpiry: number }

export function validatePublishWindow(
  publishAt: string | null | undefined,
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): PublishWindow {
  const base = publishAt ? new Date(publishAt).getTime() : now
  const minExpiry = base + MIN_CAMPAIGN_MS
  const suggestedExpiry = minExpiry + DEFAULT_EXPIRY_PAD_MS
  const exp = expiresAt ? new Date(expiresAt).getTime() : NaN

  if (!expiresAt || Number.isNaN(exp)) return { ok: false, reason: 'missing', suggestedExpiry }
  if (exp < minExpiry - GRACE_MS) return { ok: false, reason: 'tooEarly', suggestedExpiry, minExpiry }
  return { ok: true }
}
