import { NextRequest, NextResponse } from 'next/server'
import { getPageByShortUrl } from '@/lib/db'

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const page = await getPageByShortUrl(slug)

  if (!page) {
    return new NextResponse('Page not found', { status: 404 })
  }

  const destination = new URL(`/pages/${page.client}/${page.slug}`, req.url)
  return NextResponse.redirect(destination, 302)
}
