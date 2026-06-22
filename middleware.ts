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

  // For public page requests: rewrite to the page-serve API which handles
  // status checks, expiration, and view tracking
  if (pathname.startsWith('/pages/')) {
    const rewriteUrl = new URL(`/api/serve${pathname}`, req.url)
    return NextResponse.rewrite(rewriteUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/pages/:path*'],
}
