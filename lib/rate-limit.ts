import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent unbounded growth
const CLEANUP_INTERVAL_MS = 60_000
let lastCleanup = Date.now()
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

/**
 * In-memory sliding-window rate limiter.
 * Returns null if within limits, or a 429 NextResponse if exceeded.
 */
export function rateLimit(
  req: NextRequest,
  opts: { windowMs: number; max: number; prefix?: string },
): NextResponse | null {
  cleanup()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${opts.prefix || 'rl'}:${ip}`
  const now = Date.now()

  const entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs })
    return null
  }

  entry.count++
  if (entry.count > opts.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(opts.max),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  return null
}
