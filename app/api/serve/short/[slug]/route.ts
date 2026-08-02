import { NextRequest, NextResponse } from 'next/server'
import { getPageByShortUrl } from '@/lib/db'
import { databaseReachable, rebuildHold } from '@/lib/db-health'

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const page = await getPageByShortUrl(slug)

  if (!page) {
    // Outage/rebuild, not absence: clients hold these short links too.
    if (rebuildHold() || !(await databaseReachable())) {
      return new NextResponse('המערכת בתחזוקה קצרה — נסו שוב בעוד מספר דקות', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '600' },
      })
    }
    return new NextResponse('Page not found', { status: 404 })
  }

  const destination = new URL(`/pages/${page.client}/${page.slug}`, req.url)
  return NextResponse.redirect(destination, 302)
}
