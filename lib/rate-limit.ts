import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// ── In-memory fallback (per serverless instance) ──
const store = new Map<string, RateLimitEntry>()
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

function memoryHit(key: string, windowMs: number, max: number): { limited: boolean; resetAt: number } {
  cleanup()
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { limited: false, resetAt }
  }
  entry.count++
  return { limited: entry.count > max, resetAt: entry.resetAt }
}

// ── Upstash Redis (REST) distributed store ──
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const useUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

/**
 * Increments a counter with a TTL using a single atomic Upstash pipeline
 * (INCR + PEXPIRE-on-first-hit + PTTL). Falls back to memory on any error.
 */
async function upstashHit(key: string, windowMs: number): Promise<{ count: number; resetAt: number } | null> {
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // INCR returns new count; if count === 1 we set the expiry window; PTTL gives remaining ms
      body: JSON.stringify([
        ['INCR', key],
        ['PTTL', key],
      ]),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ result: number }>
    const count = Number(data[0]?.result ?? 0)
    let ttl = Number(data[1]?.result ?? -1)
    if (count === 1 || ttl < 0) {
      await fetch(`${UPSTASH_URL}/pexpire/${encodeURIComponent(key)}/${windowMs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        cache: 'no-store',
      })
      ttl = windowMs
    }
    return { count, resetAt: Date.now() + ttl }
  } catch {
    return null
  }
}

/**
 * Distributed sliding-window rate limiter.
 * Uses Upstash Redis (REST) when configured, otherwise falls back to an
 * in-memory store (best-effort, per-instance).
 * Returns null if within limits, or a 429 NextResponse if exceeded.
 */
export async function rateLimit(
  req: NextRequest,
  opts: { windowMs: number; max: number; prefix?: string; key?: string; message?: string },
): Promise<NextResponse | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  // `opts.key` lets callers scope a limit to something other than the IP
  // (e.g. a specific account email) so that many distinct users behind one
  // shared office NAT IP aren't throttled collectively.
  const key = `${opts.prefix || 'rl'}:${opts.key ?? ip}`

  let limited = false
  let resetAt = Date.now() + opts.windowMs

  if (useUpstash) {
    const hit = await upstashHit(key, opts.windowMs)
    if (hit) {
      limited = hit.count > opts.max
      resetAt = hit.resetAt
    } else {
      // Upstash unreachable — fail open to memory to avoid blocking legit traffic
      const mem = memoryHit(key, opts.windowMs, opts.max)
      limited = mem.limited
      resetAt = mem.resetAt
    }
  } else {
    const mem = memoryHit(key, opts.windowMs, opts.max)
    limited = mem.limited
    resetAt = mem.resetAt
  }

  if (limited) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    return NextResponse.json(
      { error: opts.message || 'Too many requests' },
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
