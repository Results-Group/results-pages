import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { verifyAccessToken } from '@/lib/content-access'
import { supabase } from '@/lib/supabase'
import {
  exchangeCode,
  accessTokenFor,
  listAccounts,
  listLocations,
  formatAddress,
  saveConnection,
  isGbpConfigured,
} from '@/lib/google-business'
import { captureException } from '@/lib/logger'

/**
 * GET /api/google-business/callback
 *
 * Google sends the user back here with a code. We trade it for a refresh
 * token, seal it, and record the accounts and locations the grant covers so
 * the branches can be mapped.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function page(title: string, body: string, ok = true): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
<title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#090c0e;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="max-width:620px;padding:32px;text-align:center">
<h1 style="color:${ok ? '#40e1d3' : '#f87171'};font-size:1.3rem">${title}</h1>
<div style="color:#94a3b0;line-height:1.9;font-size:0.95rem">${body}</div>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !(session.isOwner || session.role === 'admin')) {
    return page('אין הרשאה', 'צריך להיות מחובר כמנהל כדי לחבר חשבון Google.', false)
  }
  if (!isGbpConfigured()) {
    return page('Google לא מוגדר', 'חסרים משתני הסביבה של OAuth.', false)
  }

  const url = req.nextUrl
  const error = url.searchParams.get('error')
  if (error) {
    return page('החיבור בוטל', `Google החזיר: ${error}`, false)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('gbp_oauth_state')?.value
  if (!code || !state || !cookieState || state !== cookieState) {
    return page('בקשה לא תקינה', 'הבקשה לא תואמת את מה שהתחלנו. נסה להתחבר שוב.', false)
  }
  // The state is signed, so a matching cookie alone isn't enough.
  if (!(await verifyAccessToken(state, `gbp:${session.userId}`))) {
    return page('בקשה לא תקינה', 'החתימה של הבקשה לא אומתה.', false)
  }

  try {
    const origin = `${url.protocol}//${url.host}`
    const tokens = await exchangeCode(code, origin)
    if (!tokens.refresh_token) {
      return page(
        'לא התקבל refresh token',
        'Google מחזיר אותו רק באישור מפורש. נתק את ההרשאה בחשבון ונסה שוב.',
        false
      )
    }

    const accessToken = await accessTokenFor(tokens.refresh_token)
    const accounts = await listAccounts(accessToken)
    const primary = accounts[0]

    // Identify the granting account for display only.
    const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
    const email = profile?.email || primary?.accountName || 'unknown'

    await saveConnection({
      account_email: email,
      refresh_token: tokens.refresh_token,
      account_resource: primary?.name ?? null,
      scopes: tokens.scope,
      connected_by: session.userId,
    })

    const { data: conn } = await supabase
      .from('gbp_connections')
      .select('id')
      .eq('account_email', email)
      .single()

    // Record every location the grant covers. branch_id stays null until it is
    // mapped, so an unmapped listing shows up instead of vanishing.
    let locationRows = 0
    if (conn && primary) {
      const locations = await listLocations(primary.name, accessToken)
      if (locations.length > 0) {
        const { error: locErr } = await supabase.from('gbp_locations').upsert(
          locations.map(l => ({
            connection_id: conn.id,
            location_resource: l.name,
            title: l.title ?? null,
            address: formatAddress(l),
          })),
          { onConflict: 'location_resource' }
        )
        if (locErr) throw locErr
        locationRows = locations.length
      }
    }

    const res = page(
      'החיבור הושלם',
      `חשבון <strong>${email}</strong> חובר בהצלחה.<br>נמצאו <strong>${locationRows}</strong> סניפים ב-Business Profile.<br><br>
       אפשר לסגור את החלון — הסנכרון הלילי יתחיל מעצמו.`
    )
    res.cookies.delete('gbp_oauth_state')
    return res
  } catch (err) {
    captureException(err, { route: 'GET /api/google-business/callback' })
    return page(
      'החיבור נכשל',
      `אירעה שגיאה מול Google: ${err instanceof Error ? err.message.slice(0, 200) : 'לא ידוע'}`,
      false
    )
  }
}
