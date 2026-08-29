import { NextRequest, NextResponse } from 'next/server'
import { downloadAsset } from '@/lib/campaigns'
import { CLIENT_DOCS_BUCKET } from '@/lib/clients'
import { rateLimit } from '@/lib/rate-limit'
import { getSessionFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  Vary: 'Accept',
}

// A response that only got through because the caller held a staff session must
// never sit in a shared cache — `public, max-age` would let an edge or proxy
// serve it to the next anonymous requester without re-running the check.
const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
}

const POSITIONING_RE = /(^|\/)positioning\.[a-z0-9]+$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const rl = await rateLimit(request, { windowMs: 60_000, max: 200, prefix: 'asset' })
  if (rl) return rl

  const { path } = await params
  const filePath = (path || []).map(decodeURIComponent).join('/')

  // Every product that stores images in the campaign-assets bucket has to be
  // listed here. A missing prefix doesn't fail loudly — it 404s every image in
  // that product with no error anywhere to explain why.
  const ALLOWED_PREFIXES = ['campaigns/', 'clients/', 'strategy/']
  const hasAllowedPrefix = ALLOWED_PREFIXES.some(p => filePath.startsWith(p))
  if (!filePath || !hasAllowedPrefix || filePath.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Client logos live under clients/ and must stay reachable — the client-facing
  // deck renders them. The positioning PDF sits under the same prefix at a
  // guessable path (clients/<uuid>/positioning.pdf) but is a confidential brand
  // document: it requires a staff session AND lives in a private bucket, so the
  // check below is the only door rather than one of two. 404 rather than 401 so
  // the response doesn't confirm the file exists.
  const isPositioning = POSITIONING_RE.test(filePath)
  if (isPositioning) {
    const session = await getSessionFromRequest(request)
    if (!session) return new NextResponse('Not found', { status: 404 })

    const doc = await downloadAsset(filePath, CLIENT_DOCS_BUCKET)
    if (!doc) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(new Uint8Array(doc.buffer), {
      status: 200,
      headers: { 'Content-Type': doc.contentType || 'application/pdf', ...PRIVATE_CACHE_HEADERS },
    })
  }

  const forceJpeg = request.nextUrl.searchParams.get('format') === 'jpeg'
  const accept = request.headers.get('accept') || ''
  const supportsWebp = accept.includes('image/webp')
  const wantsJpeg = forceJpeg || !supportsWebp

  try {
    if (wantsJpeg) {
      // Try the pre-generated JPEG first to avoid runtime sharp conversion
      const jpegPath = filePath.replace(/\.webp$/, '.jpeg')
      const jpeg = await downloadAsset(jpegPath)
      if (jpeg) {
        return new NextResponse(new Uint8Array(jpeg.buffer), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', ...CACHE_HEADERS },
        })
      }
    }

    const asset = await downloadAsset(filePath)
    if (!asset) {
      return new NextResponse('Not found', { status: 404 })
    }

    if (wantsJpeg) {
      // Lazy: a broken sharp binary must degrade this route to serving the
      // original format, not 500 every asset on the deck.
      try {
        const sharp = (await import('sharp')).default
        const converted = await sharp(asset.buffer).jpeg({ quality: 88 }).toBuffer()
        return new NextResponse(new Uint8Array(converted), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', ...CACHE_HEADERS },
        })
      } catch {
        // fall through to the original bytes below
      }
    }

    return new NextResponse(new Uint8Array(asset.buffer), {
      status: 200,
      headers: {
        'Content-Type': asset.contentType || 'image/webp',
        ...CACHE_HEADERS,
      },
    })
  } catch {
    return new NextResponse('Error', { status: 502 })
  }
}
