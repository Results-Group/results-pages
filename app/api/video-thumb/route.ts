import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/video-thumb?id=<googleDriveFileId>
 *
 * Server-side proxy for Google Drive video posters. Requesting the Drive
 * thumbnail straight from the browser fails on mobile — Safari and in-app
 * browsers block the cross-site request (tracking prevention / third-party
 * cookies), so the card rendered empty. Fetching it from our own origin
 * sidesteps that entirely and lets us cache the result.
 *
 * Only a Drive file id is accepted and the upstream URL is built here, so this
 * can't be used to fetch arbitrary URLs (no SSRF).
 */
const DRIVE_ID = /^[a-zA-Z0-9_-]{10,128}$/

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!DRIVE_ID.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  const upstream = `https://drive.google.com/thumbnail?id=${id}&sz=w1280`

  try {
    const res = await fetch(upstream, {
      // Drive serves the poster only for link-shared files; follow its redirect
      // to googleusercontent.
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResultsPages/1.0)' },
    })

    const contentType = res.headers.get('content-type') || ''
    // A non-image response means the file isn't shared publicly (Drive answers
    // with an HTML sign-in page) — report it as missing so the card falls back
    // to its placeholder instead of rendering a broken image.
    if (!res.ok || !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'thumbnail unavailable' }, { status: 404 })
    }

    const buf = new Uint8Array(await res.arrayBuffer())
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'thumbnail fetch failed' }, { status: 502 })
  }
}
