import { NextRequest, NextResponse } from 'next/server'
import { getPageByClientSlug, createPageView, downloadFile } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Ctx { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { path } = await params

  if (path.length < 2) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const client = path[0]
  const slug = path.slice(1).join('/')

  const page = await getPageByClientSlug(client, slug)

  if (!page) {
    return new NextResponse(expiredPage('הדף לא נמצא'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (!page.active) {
    return new NextResponse(expiredPage('הדף אינו זמין כרגע'), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (page.expires_at && new Date(page.expires_at) < new Date()) {
    return new NextResponse(expiredPage('תוקף הדף פג'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const html = await downloadFile(page.file_path)
  if (!html) {
    return new NextResponse(expiredPage('הקובץ לא נמצא'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Track view (fire and forget)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const userAgent = req.headers.get('user-agent') || ''
  createPageView({ page_id: page.id, ip, user_agent: userAgent }).catch(() => {})

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const pageUrl = `${baseUrl}/pages/${client}/${slug}`
  const ogImageUrl = `${baseUrl}/og-image.png`

  const ogTags = `
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="Results Group" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="Results Group" />
    <meta name="twitter:image" content="${ogImageUrl}" />
  `

  const enrichedHtml = injectOgTags(html, ogTags, page.title)

  return new NextResponse(enrichedHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function injectOgTags(html: string, ogTags: string, title: string): string {
  const headClose = html.indexOf('</head>')
  if (headClose !== -1) {
    return html.slice(0, headClose) + ogTags + html.slice(headClose)
  }
  const htmlTag = html.indexOf('<html')
  if (htmlTag !== -1) {
    const afterHtmlTag = html.indexOf('>', htmlTag)
    if (afterHtmlTag !== -1) {
      const head = `<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>${ogTags}</head>`
      return html.slice(0, afterHtmlTag + 1) + head + html.slice(afterHtmlTag + 1)
    }
  }
  return `<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>${ogTags}</head>` + html
}

function expiredPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Results Group</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;background:#f9f9f9;margin:0">
<div style="text-align:center;padding:40px">
<h1 style="font-size:1.3rem;color:#333;margin-bottom:8px">${message}</h1>
<p style="color:#888;font-size:0.9rem">Results Group</p>
</div>
</body></html>`
}
