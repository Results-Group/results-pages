import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAssetPublicUrl } from '@/lib/campaigns'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  Vary: 'Accept',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const rl = await rateLimit(request, { windowMs: 60_000, max: 200, prefix: 'asset' })
  if (rl) return rl

  const { path } = await params
  const filePath = (path || []).map(decodeURIComponent).join('/')

  const hasAllowedPrefix = filePath.startsWith('campaigns/') || filePath.startsWith('clients/')
  if (!filePath || !hasAllowedPrefix || filePath.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const forceJpeg = request.nextUrl.searchParams.get('format') === 'jpeg'
  const accept = request.headers.get('accept') || ''
  const supportsWebp = accept.includes('image/webp')
  const wantsJpeg = forceJpeg || !supportsWebp

  try {
    if (wantsJpeg) {
      // Try the pre-generated JPEG first to avoid runtime sharp conversion
      const jpegPath = filePath.replace(/\.webp$/, '.jpeg')
      const jpegRes = await fetch(getAssetPublicUrl(jpegPath))
      if (jpegRes.ok) {
        const buf = new Uint8Array(await jpegRes.arrayBuffer())
        return new NextResponse(buf, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', ...CACHE_HEADERS },
        })
      }
    }

    const upstream = await fetch(getAssetPublicUrl(filePath))
    if (!upstream.ok) {
      return new NextResponse('Not found', { status: 404 })
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())

    if (wantsJpeg) {
      const jpeg = await sharp(buffer).jpeg({ quality: 88 }).toBuffer()
      return new NextResponse(new Uint8Array(jpeg), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', ...CACHE_HEADERS },
      })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/webp',
        ...CACHE_HEADERS,
      },
    })
  } catch {
    return new NextResponse('Error', { status: 502 })
  }
}
