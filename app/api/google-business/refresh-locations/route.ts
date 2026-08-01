import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  getConnections,
  openToken,
  accessTokenFor,
  listAccounts,
  listLocations,
  formatAddress,
  isGbpConfigured,
} from '@/lib/google-business'
import { captureException } from '@/lib/logger'

/**
 * GET /api/google-business/refresh-locations
 *
 * Re-runs account and location discovery for every stored connection, without
 * touching the consent flow. Discovery is the part that fails for reasons that
 * have nothing to do with the grant — an API not yet enabled, quota not yet
 * granted, Google being slow — and re-authorising a human to retry an API call
 * is the wrong shape. Owner/admin only.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isGbpConfigured()) {
    return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 503 })
  }

  const connections = await getConnections()
  if (connections.length === 0) {
    return NextResponse.json({ error: 'אין חיבור שמור — צריך לאשר גישה קודם' }, { status: 404 })
  }

  const results: Record<string, unknown>[] = []
  for (const conn of connections) {
    try {
      const accessToken = await accessTokenFor(openToken(conn.refresh_token_enc))
      const accounts = await listAccounts(accessToken)

      const perAccount: Record<string, unknown>[] = []
      for (const account of accounts) {
        const locations = await listLocations(account.name, accessToken)
        if (locations.length > 0) {
          const { error } = await supabase.from('gbp_locations').upsert(
            locations.map(l => ({
              connection_id: conn.id,
              location_resource: l.name,
              title: l.title ?? null,
              address: formatAddress(l),
            })),
            { onConflict: 'location_resource' }
          )
          if (error) throw error
        }
        perAccount.push({
          account: account.name,
          name: account.accountName ?? null,
          locations: locations.map(l => ({ resource: l.name, title: l.title ?? null, address: formatAddress(l) })),
        })
      }

      // Remember the first account so the nightly sync has a starting point.
      if (accounts[0]) {
        await supabase
          .from('gbp_connections')
          .update({ account_resource: accounts[0].name, last_sync_error: null })
          .eq('id', conn.id)
      }

      results.push({ account_email: conn.account_email, ok: true, accounts: perAccount })
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 300) : 'unknown'
      captureException(err, { route: 'GET /api/google-business/refresh-locations', account: conn.account_email })
      await supabase
        .from('gbp_connections')
        .update({ last_sync_error: message })
        .eq('id', conn.id)
      results.push({ account_email: conn.account_email, ok: false, error: message })
    }
  }

  return NextResponse.json({ ok: results.every(r => r.ok), results })
}
