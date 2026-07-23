import 'server-only'

/**
 * Base44 REST client for the digital-business-cards app (Results Digital).
 *
 * Uses plain fetch rather than `@base44/sdk` — the SDK is built around the
 * browser auth flow, while server-side access here is a static app id + api
 * key. Same shape as `lib/monday.ts`: one low-level request helper, typed
 * wrappers on top, and never a key in client code.
 */

const BASE44_API_URL = 'https://base44.app/api'

/** Entity names exposed by the app's REST API. */
export type Base44Entity =
  | 'User'
  | 'DigitalCard'
  | 'TeamMember'
  | 'Subscription'
  | 'Plan'
  | 'Coupon'
  | 'Partner'
  | 'Referral'
  | 'Segment'
  | 'ContactExchange'
  | 'CardAnalytics'
  | 'WebsiteAnalytics'
  | 'BenchmarkStats'
  | 'CustomerHistory'
  | 'SupportConversation'
  | 'SupportMessage'
  | 'SupportTicket'
  | 'StaffNotification'
  | 'Notification'
  | 'EmailLog'
  | 'WebhookLog'
  | 'AdminAuditLog'
  | 'ConsentLog'
  | 'RateLimit'
  | 'NewsletterSubscriber'
  | 'EnterpriseLeads'
  | 'LearningContent'
  | 'ContentBrief'
  | 'ProfessionTemplate'
  | 'SiteContent'

/** Fields every Base44 record carries. */
export interface Base44Record {
  id: string
  created_date?: string
  updated_date?: string
  created_by_id?: string
}

export interface Base44ListOptions {
  /** Mongo-style filter, e.g. `{ status: 'active' }`. */
  q?: Record<string, unknown>
  limit?: number
  skip?: number
  /** Field name; prefix with `-` for descending, e.g. `-created_date`. */
  sortBy?: string
}

function credentials(): { appId: string; apiKey: string } {
  const appId = process.env.BASE44_APP_ID
  const apiKey = process.env.BASE44_API_KEY
  if (!appId || !apiKey) {
    throw new Error('BASE44_APP_ID / BASE44_API_KEY are not configured')
  }
  return { appId, apiKey }
}

/** True when the integration is configured — callers can degrade gracefully. */
export function isBase44Configured(): boolean {
  return Boolean(process.env.BASE44_APP_ID && process.env.BASE44_API_KEY)
}

async function base44Request<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const { appId, apiKey } = credentials()

  const url = new URL(`${BASE44_API_URL}/apps/${appId}${path}`)
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      api_key: apiKey,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) {
    // Base44 returns {message} or {detail} on errors; fall back to the raw body.
    let detail = text
    try {
      const parsed = JSON.parse(text) as { message?: string; detail?: string }
      detail = parsed.message || parsed.detail || text
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Base44 API error ${res.status}: ${detail}`)
  }

  return (text ? JSON.parse(text) : null) as T
}

/** List records of an entity. */
export function listRecords<T extends Base44Record>(
  entity: Base44Entity,
  options: Base44ListOptions = {},
): Promise<T[]> {
  return base44Request<T[]>(`/entities/${entity}`, {
    query: {
      q: options.q ? JSON.stringify(options.q) : undefined,
      limit: options.limit?.toString(),
      skip: options.skip?.toString(),
      sort_by: options.sortBy,
    },
  })
}

/** Fetch a single record by id. */
export function getRecord<T extends Base44Record>(entity: Base44Entity, id: string): Promise<T> {
  return base44Request<T>(`/entities/${entity}/${id}`)
}

/** Create a record. */
export function createRecord<T extends Base44Record>(
  entity: Base44Entity,
  data: Record<string, unknown>,
): Promise<T> {
  return base44Request<T>(`/entities/${entity}`, { method: 'POST', body: data })
}

/** Update a record by id (partial). */
export function updateRecord<T extends Base44Record>(
  entity: Base44Entity,
  id: string,
  data: Record<string, unknown>,
): Promise<T> {
  return base44Request<T>(`/entities/${entity}/${id}`, { method: 'PUT', body: data })
}

/**
 * Page through an entity in `pageSize` chunks until exhausted.
 * Base44 caps a single `list` call, so anything analytical needs this.
 */
export async function listAllRecords<T extends Base44Record>(
  entity: Base44Entity,
  options: Base44ListOptions & { pageSize?: number; maxRecords?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 500
  const maxRecords = options.maxRecords ?? 20_000
  const all: T[] = []

  for (let skip = 0; all.length < maxRecords; skip += pageSize) {
    const page = await listRecords<T>(entity, { ...options, limit: pageSize, skip })
    all.push(...page)
    if (page.length < pageSize) break
  }

  return all.slice(0, maxRecords)
}

/** Invoke a Base44 backend function by name. */
export function callFunction<T = unknown>(
  name: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return base44Request<T>(`/functions/${name}`, { method: 'POST', body: payload })
}

/** Smoke test: resolves with the record counts the key can actually read. */
export async function pingBase44(): Promise<{ users: number; cards: number }> {
  const [users, cards] = await Promise.all([
    listRecords('User', { limit: 1 }),
    listRecords('DigitalCard', { limit: 1 }),
  ])
  return { users: users.length, cards: cards.length }
}
