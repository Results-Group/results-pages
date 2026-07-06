import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Protect admin routes (except login page and API)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const session = req.cookies.get('rp_session')?.value
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  // Protect Pizza House dashboard (separate client password, admin session also accepted)
  if (pathname.startsWith('/pizza-house') && !pathname.startsWith('/pizza-house/login')) {
    const clientSession = req.cookies.get('ph_session')?.value
    const adminSession = req.cookies.get('rp_session')?.value
    if (!clientSession && !adminSession) {
      return NextResponse.redirect(new URL('/pizza-house/login', req.url))
    }
  }

  // Short URL redirect: /r/{shortUrl} → API lookup
  if (pathname.startsWith('/r/')) {
    const shortSlug = pathname.slice(3)
    if (shortSlug) {
      const rewriteUrl = new URL(`/api/serve/short/${shortSlug}`, req.url)
      return NextResponse.rewrite(rewriteUrl)
    }
  }

  // For public page requests: rewrite to the page-serve API which handles
  // status checks, expiration, and view tracking
  if (pathname.startsWith('/pages/')) {
    const rewriteUrl = new URL(`/api/serve${pathname}`, req.url)
    return NextResponse.rewrite(rewriteUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/pages/:path*', '/r/:path*', '/pizza-house/:path*', '/pizza-house'],
}
