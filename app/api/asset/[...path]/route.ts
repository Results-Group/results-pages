import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAssetPublicUrl } from '@/lib/campaigns'

export const runtime = 'nodejs'

// Streams campaign assets through our own domain so the browser never needs to
// reach the Supabase storage domain directly. It also serves a universally
// compatible JPEG to browsers that don't support WebP (older Safari / webviews),
// while modern browsers keep getting the smaller WebP.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const filePath = (path || []).map(decodeURIComponent).join('/')

  if (!filePath || !filePath.startsWith('campaigns/') || filePath.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const forceJpeg = request.nextUrl.searchParams.get('format') === 'jpeg'
  const accept = request.headers.get('accept') || ''
  const supportsWebp = accept.includes('image/webp')
  const wantsJpeg = forceJpeg || !supportsWebp

  try {
    const upstream = await fetch(getAssetPublicUrl(filePath))
    if (!upstream.ok) {
      return new NextResponse('Not found', { status: 404 })
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())

    const cacheHeaders = {
      'Cache-Control': 'public, max-age=31536000, immutable',
      Vary: 'Accept',
    }

    if (wantsJpeg) {
      const jpeg = await sharp(buffer).jpeg({ quality: 88 }).toBuffer()
      return new NextResponse(new Uint8Array(jpeg), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', ...cacheHeaders },
      })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/webp',
        ...cacheHeaders,
      },
    })
  } catch {
    return new NextResponse('Error', { status: 502 })
  }
}
