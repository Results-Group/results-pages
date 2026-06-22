import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

interface Ctx { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { path } = await params

  if (path.length < 2) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const client = path[0]
  const slug = path.slice(1).join('/')

  // Look up in database
  const page = await prisma.page.findUnique({
    where: { client_slug: { client, slug } },
  })

  if (!page) {
    return new NextResponse(expiredPage('הדף לא נמצא'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Check if disabled
  if (!page.active) {
    return new NextResponse(expiredPage('הדף אינו זמין כרגע'), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Check expiration
  if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
    return new NextResponse(expiredPage('תוקף הדף פג'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Serve the file
  const filePath = join(process.cwd(), 'public', page.filePath)
  if (!existsSync(filePath)) {
    return new NextResponse(expiredPage('הקובץ לא נמצא'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Track view (fire and forget)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const userAgent = req.headers.get('user-agent') || ''
  prisma.pageView.create({
    data: { pageId: page.id, ip, userAgent },
  }).catch(() => {})

  const html = await readFile(filePath, 'utf-8')
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
