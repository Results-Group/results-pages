import { NextRequest, NextResponse } from 'next/server'
import { getAssetPublicUrl } from '@/lib/campaigns'

export const runtime = 'nodejs'

// Streams campaign assets through our own domain so the browser never needs to
// reach the Supabase storage domain directly. This avoids client-side network
// blocks (corporate firewalls, DNS, privacy extensions) that prevented images
// from loading even though the underlying objects are publicly accessible.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const filePath = (path || []).map(decodeURIComponent).join('/')

  // Only allow serving campaign assets.
  if (!filePath || !filePath.startsWith('campaigns/') || filePath.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const upstreamUrl = getAssetPublicUrl(filePath)
    const upstream = await fetch(upstreamUrl)
    if (!upstream.ok || !upstream.body) {
      return new NextResponse('Not found', { status: 404 })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Error', { status: 502 })
  }
}
