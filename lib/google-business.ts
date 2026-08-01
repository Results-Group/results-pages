import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { supabase } from './supabase'

/**
 * Google Business Profile client.
 *
 * Plain fetch rather than googleapis — we need four endpoints, and the SDK
 * would add megabytes to a serverless bundle for them. Same shape as
 * lib/monday.ts: one request helper, typed wrappers, no key in client code.
 *
 * Access is OAuth, not an API key: a human grants it once, we keep the refresh
 * token and mint short-lived access tokens from it.
 */

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ACCOUNTS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const PERFORMANCE_API = 'https://businessprofileperformance.googleapis.com/v1'

/**
 * business.manage is what the Performance and Information APIs require.
 * openid + email is added only so a stored connection can say which account
 * granted it — without them the callback has no way to read the address and
 * every connection records as "unknown". Deliberately nothing beyond these.
 */
export const GBP_SCOPE = [
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/**
 * The daily metrics we chart. Names are Google's DailyMetric enum.
 *
 * Split deliberately into impressions (how many saw the listing) and actions
 * (what they did next), because Business Profile's own two headline numbers are
 * the sums of these two groups — verified against Givat Ze'ev, Mar–Jul 2026:
 *   impressions 5,624 + 4,806 + 1,286 + 208            = 11,924 profile views
 *   actions     7,020 + 337 + 2,203 + 63               =  9,623 interactions
 */
export const GBP_IMPRESSION_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
] as const

export const GBP_ACTION_METRICS = [
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'WEBSITE_CLICKS',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_BOOKINGS',
  'BUSINESS_FOOD_ORDERS',
  'BUSINESS_FOOD_MENU_CLICKS',
] as const

export const GBP_METRICS = [...GBP_IMPRESSION_METRICS, ...GBP_ACTION_METRICS] as const

export function isGbpConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
}

function clientCredentials() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!id || !secret) throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are required')
  return { id, secret }
}

export function redirectUri(origin: string): string {
  return `${origin}/api/google-business/callback`
}

// ── Refresh-token encryption ──
// A refresh token is a standing credential to a client's business listing.
// Service-role RLS keeps it off the public API, but anything that can read the
// table would otherwise read the token in the clear, so it is sealed with a key
// derived from SESSION_SECRET.

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is required to seal Google credentials')
  return createHash('sha256').update(`gbp:${secret}`).digest()
}

export function sealToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export function openToken(sealed: string): string {
  const [iv, tag, payload] = sealed.split('.')
  if (!iv || !tag || !payload) throw new Error('Malformed sealed token')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8')
}

// ── OAuth ──

export function authorizeUrl(origin: string, state: string): string {
  const { id } = clientCredentials()
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: GBP_SCOPE,
    // offline + consent is what actually yields a refresh token; without
    // prompt=consent Google withholds it on re-authorisation.
    access_type: 'offline',
    prompt: 'consent',
    // NOT include_granted_scopes: that folds every scope this OAuth client was
    // ever granted into our token. Reusing an existing client meant the first
    // grant came back carrying Gmail and Calendar access alongside the one
    // scope we asked for — far more damage than this integration is worth if
    // the token ever leaks.
    state,
  })
  return `${OAUTH_AUTH_URL}?${params}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

export async function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  const { id, secret } = clientCredentials()
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Google token exchange ${res.status}: ${body.slice(0, 300)}`)
  return JSON.parse(body) as TokenResponse
}

export async function accessTokenFor(refreshToken: string): Promise<string> {
  const { id, secret } = clientCredentials()
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Google token refresh ${res.status}: ${body.slice(0, 300)}`)
  return (JSON.parse(body) as TokenResponse).access_token
}

async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const body = await res.text()
  if (!res.ok) throw new Error(`Google API ${res.status} on ${url.split('?')[0]}: ${body.slice(0, 300)}`)
  return JSON.parse(body) as T
}

// ── Accounts and locations ──

export interface GbpAccount { name: string; accountName?: string; type?: string }
export interface GbpLocation { name: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string } }

export async function listAccounts(accessToken: string): Promise<GbpAccount[]> {
  const data = await googleGet<{ accounts?: GbpAccount[] }>(`${ACCOUNTS_API}/accounts`, accessToken)
  return data.accounts ?? []
}

export async function listLocations(accountResource: string, accessToken: string): Promise<GbpLocation[]> {
  const params = new URLSearchParams({
    readMask: 'name,title,storefrontAddress',
    pageSize: '100',
  })
  const data = await googleGet<{ locations?: GbpLocation[] }>(
    `${INFO_API}/${accountResource}/locations?${params}`,
    accessToken
  )
  return data.locations ?? []
}

export function formatAddress(loc: GbpLocation): string {
  const lines = loc.storefrontAddress?.addressLines ?? []
  return [...lines, loc.storefrontAddress?.locality].filter(Boolean).join(', ')
}

// ── Daily metrics ──

interface DatedValue { date: { year: number; month: number; day: number }; value?: string }

/**
 * Daily values per metric for one location. Google returns a sparse series —
 * days with no activity are simply absent — so callers must not assume a dense
 * range.
 */
export async function fetchDailyMetrics(
  locationResource: string,
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number },
  accessToken: string
): Promise<{ metric: string; day: string; value: number }[]> {
  const params = new URLSearchParams()
  for (const m of GBP_METRICS) params.append('dailyMetrics', m)
  params.set('dailyRange.start_date.year', String(from.year))
  params.set('dailyRange.start_date.month', String(from.month))
  params.set('dailyRange.start_date.day', String(from.day))
  params.set('dailyRange.end_date.year', String(to.year))
  params.set('dailyRange.end_date.month', String(to.month))
  params.set('dailyRange.end_date.day', String(to.day))

  const data = await googleGet<{
    multiDailyMetricTimeSeries?: {
      dailyMetricTimeSeries?: {
        dailyMetric: string
        timeSeries?: { datedValues?: DatedValue[] }
      }[]
    }[]
  }>(`${PERFORMANCE_API}/${locationResource}:fetchMultiDailyMetricsTimeSeries?${params}`, accessToken)

  const out: { metric: string; day: string; value: number }[] = []
  for (const multi of data.multiDailyMetricTimeSeries ?? []) {
    for (const series of multi.dailyMetricTimeSeries ?? []) {
      for (const dv of series.timeSeries?.datedValues ?? []) {
        const { year, month, day } = dv.date
        out.push({
          metric: series.dailyMetric,
          day: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          value: Number(dv.value ?? 0),
        })
      }
    }
  }
  return out
}

// ── Stored connection ──

export interface GbpConnection {
  id: string
  account_email: string
  refresh_token_enc: string
  account_resource: string | null
  last_sync_at: string | null
  last_sync_error: string | null
}

export async function getConnections(): Promise<GbpConnection[]> {
  const { data, error } = await supabase.from('gbp_connections').select('*')
  if (error) throw error
  return (data || []) as GbpConnection[]
}

export async function saveConnection(input: {
  account_email: string
  refresh_token: string
  account_resource?: string | null
  scopes?: string
  connected_by?: string
}) {
  const { error } = await supabase.from('gbp_connections').upsert(
    {
      account_email: input.account_email,
      refresh_token_enc: sealToken(input.refresh_token),
      account_resource: input.account_resource ?? null,
      scopes: input.scopes ?? GBP_SCOPE,
      ...(input.connected_by ? { connected_by: input.connected_by } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_email' }
  )
  if (error) throw error
}
