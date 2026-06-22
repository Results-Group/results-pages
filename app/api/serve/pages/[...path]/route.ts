import { NextRequest, NextResponse } from 'next/server'
import { getPageByClientSlug, createPageView, downloadFile } from '@/lib/db'

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

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
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
