/**
 * Lightweight structured logger with optional Sentry forwarding.
 *
 * Emits single-line JSON to stdout/stderr (easy to grep and to ingest by log
 * drains), and forwards errors to Sentry when the SDK is initialised. All
 * Sentry access is dynamic so the app builds and runs even when Sentry is not
 * installed or no DSN is configured.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

type Meta = Record<string, unknown>

interface SentryLike {
  captureException: (err: unknown, ctx?: { extra?: Meta }) => void
  captureMessage: (msg: string, level?: string) => void
}

let sentry: SentryLike | null = null
try {
  // Only wire Sentry when a DSN is present to avoid noisy no-op init.
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/nextjs') as SentryLike
  }
} catch {
  sentry = null
}

function emit(level: Level, message: string, meta?: Meta) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, meta?: Meta) => emit('debug', message, meta),
  info: (message: string, meta?: Meta) => emit('info', message, meta),
  warn: (message: string, meta?: Meta) => emit('warn', message, meta),
  error: (message: string, meta?: Meta) => emit('error', message, meta),
}

/**
 * Log an error and forward it to Sentry (when available).
 * Use in catch blocks instead of bare `console.error` / silent `catch {}`.
 */
export function captureException(error: unknown, context?: Meta) {
  const message = error instanceof Error ? error.message : String(error)
  emit('error', message, {
    ...context,
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  })
  try {
    sentry?.captureException(error, context ? { extra: context } : undefined)
  } catch {
    // never let logging throw
  }
}
