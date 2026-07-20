import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('rp_session')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    const session = await verifySessionToken(token)
    // A surface-scoped token (e.g. the Pizza House dashboard password) is not a
    // platform login and must never open the admin panel.
    if (!session || session.scope) {
      const res = NextResponse.redirect(new URL('/admin/login', req.url))
      res.cookies.delete('rp_session')
      return res
    }
  }

  if (pathname.startsWith('/pizza-house') && !pathname.startsWith('/pizza-house/login')) {
    const phToken = req.cookies.get('ph_session')?.value
    const rpToken = req.cookies.get('rp_session')?.value

    let valid = false
    // Mirror the dashboard API's rules, so a token it would reject sends the
    // viewer to the login screen instead of a page that then fails to load its
    // data. Sessions minted before the scope claim existed land here and simply
    // re-authenticate once.
    if (phToken) {
      const phSession = await verifySessionToken(phToken)
      valid = phSession?.scope === 'pizza-house'
    }
    if (!valid && rpToken) {
      const rpSession = await verifySessionToken(rpToken)
      valid = !!rpSession && !rpSession.scope && (!!rpSession.isOwner || rpSession.role === 'admin')
    }

    if (!valid) {
      return NextResponse.redirect(new URL('/pizza-house/login', req.url))
    }
  }

  if (pathname.startsWith('/r/')) {
    const shortSlug = pathname.slice(3)
    if (shortSlug) {
      return NextResponse.rewrite(new URL(`/api/serve/short/${shortSlug}`, req.url))
    }
  }

  if (pathname.startsWith('/pages/')) {
    return NextResponse.rewrite(new URL(`/api/serve${pathname}`, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/pages/:path*', '/r/:path*', '/pizza-house/:path*', '/pizza-house'],
}
