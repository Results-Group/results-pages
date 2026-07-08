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
    if (!session) {
      const res = NextResponse.redirect(new URL('/admin/login', req.url))
      res.cookies.delete('rp_session')
      return res
    }
  }

  if (pathname.startsWith('/pizza-house') && !pathname.startsWith('/pizza-house/login')) {
    const phToken = req.cookies.get('ph_session')?.value
    const rpToken = req.cookies.get('rp_session')?.value

    let valid = false
    if (phToken) valid = !!(await verifySessionToken(phToken))
    if (!valid && rpToken) valid = !!(await verifySessionToken(rpToken))

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
