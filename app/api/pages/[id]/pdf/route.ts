// PDF export for landing pages: render the page's HTML in headless Chrome
// and return the printed PDF. We read the HTML straight from storage instead
// of navigating to the public serve URL so password-protected pages work and
// no expiry check gets in the way — the admin is already authenticated.
//
// Local dev falls back to the user's system Chrome (avoiding the 50 MB
// chromium-min download for every hot reload); Vercel loads a pack of
// Chromium tarball on first invocation. Cold starts pay ~5s for that
// download; subsequent invocations are ~1-2s.

import { NextRequest, NextResponse } from 'next/server'
import puppeteer, { type Browser } from 'puppeteer-core'
import { getPageById, downloadFile } from '@/lib/db'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { captureException } from '@/lib/logger'

export const runtime = 'nodejs'
// PDF rendering can spike past the default 10s on cold start; give it a full
// minute so Vercel Pro doesn't kill Chromium mid-render.
export const maxDuration = 60

// Sparticuz publishes matched Chromium tarballs per release; this URL must
// stay in lockstep with the @sparticuz/chromium-min version pinned in
// package.json (currently 131.0.1) — mismatches cause silent segfaults.
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    // Dynamic import so the local `npm run dev` process doesn't try to unpack
    // the 50 MB chromium tarball just to boot.
    const chromium = (await import('@sparticuz/chromium-min')).default
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    })
  }
  // Local: point at whichever Chrome the developer has installed. Override
  // via CHROME_EXECUTABLE_PATH if the default macOS path doesn't match.
  const executablePath =
    process.env.CHROME_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return puppeteer.launch({ executablePath, headless: true })
}

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await getPageById(id)
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const permErr = await requireResourcePermission(req, record.workspace_id, 'view')
  if (permErr) return permErr

  const html = await downloadFile(record.file_path)
  if (!html) return NextResponse.json({ error: 'שגיאה בטעינת הדף' }, { status: 500 })

  // Uploaded HTML often references assets with relative paths ("assets/logo.png").
  // Without a base, Chromium would treat those as file:// and fail to load them,
  // yielding a broken-image PDF. Anchor the doc to the deployment origin so
  // relative URLs resolve against Vercel like they do for a real visitor.
  const origin = new URL(req.url).origin
  const baseTag = `<base href="${origin}/pages/${record.client}/">`
  const htmlWithBase = /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
    : `<head>${baseTag}</head>${html}`

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    // Desktop viewport at 2x DPR so the PDF looks crisp even on retina prints.
    await page.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 2 })
    // Force screen media so any @media print rules in the user's landing page
    // don't strip colours or hide elements the client wanted preserved.
    await page.emulateMediaType('screen')

    // setContent only accepts 'load' / 'domcontentloaded' — no networkidle0.
    // So instead of relying on the resource-flush signal, we hand-check the
    // two things that actually matter for a landing-page snapshot: webfonts
    // finished downloading (otherwise text renders with the fallback face and
    // swaps in a frame too late), and every <img> resolved (otherwise the PDF
    // is peppered with broken placeholders).
    await page.setContent(htmlWithBase, { waitUntil: 'load', timeout: 45_000 })
    await page.evaluate(async () => {
      await document.fonts.ready
      const pending = Array.from(document.images).filter(img => !img.complete)
      await Promise.all(pending.map(img => new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })))
    })

    const pdf = await page.pdf({
      format: 'A4',
      // The user explicitly asked to keep the background; without this Chrome
      // strips gradients/hero images from the printed output.
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    const safeName = (record.title || record.slug).replace(/[^\w֐-׿\s-]/g, '').trim() || record.slug
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // RFC 5987 encoding preserves Hebrew filenames in every browser.
        'Content-Disposition': `attachment; filename="${record.slug}.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}.pdf`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    captureException(err, { route: 'GET /api/pages/[id]/pdf', id })
    return NextResponse.json({ error: 'שגיאה ביצירת ה-PDF' }, { status: 500 })
  } finally {
    // Chromium doesn't idle cheaply; always kill it or the function warm pool
    // holds a dead process and the next invocation stalls.
    await browser?.close().catch(() => {})
  }
}
