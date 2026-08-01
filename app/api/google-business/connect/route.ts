import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { authorizeUrl, isGbpConfigured } from '@/lib/google-business'
import { signAccessToken } from '@/lib/content-access'

/**
 * GET /api/google-business/connect
 *
 * Starts the one-time Google consent flow. Owner/admin only: the grant it
 * produces is standing access to a client's business listing.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isGbpConfigured()) {
    return NextResponse.json(
      { error: 'Google לא מוגדר — חסרים GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET' },
      { status: 503 }
    )
  }

  // Signed state, so the callback can prove the round trip started here and
  // wasn't a link someone else handed the browser.
  const state = await signAccessToken(`gbp:${session.userId}`)
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const res = NextResponse.redirect(authorizeUrl(origin, state))
  res.cookies.set('gbp_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
