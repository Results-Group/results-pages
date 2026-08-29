import * as Sentry from '@sentry/nextjs'
import { validateEnv } from '@/lib/env'

export async function register() {
  // lib/env.ts has described the required variables since it was written but
  // nothing ever called it, so a missing one surfaced as a 500 on whichever
  // request happened to need it first. Logged, not thrown: a boot-time throw
  // would take the whole deployment down over a variable most of the app
  // never touches, and lib/auth.ts already refuses to sign without
  // SESSION_SECRET. Node runtime only — Edge sees a partial process.env.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      validateEnv()
    } catch (err) {
      console.error('[env]', err instanceof Error ? err.message : err)
    }
  }

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
