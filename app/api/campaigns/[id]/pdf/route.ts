// PDF export of a campaign deck, for the client (deck header) and the team
// (editor). Headless Chrome opens the deck in its stacked PDF render
// (/c/<slug>?pdf=<token> → app/_deck/PdfDeck) and prints it — one page per
// slide, each page as tall as its slide, so nothing is cut or shrunk. The file
// looks like the deck on screen whatever browser or phone asked for it, which
// window.print() could not promise: each browser lays out print its own way,
// and mockups sized to the window broke across pages.
//
// Printed, not screenshotted: text stays vector (sharp at any zoom, selectable)
// and links stay clickable on their own. Screenshots were tried first and were
// sharp locally, but on Vercel — software rendering, no GPU — each one took
// ~9s, and a 21-slide deck ran out of time at slide 12 (2026-10-08).
//
// The file is cached in Storage under a fingerprint of everything the reader
// sees (lib/deck-pdf.ts:deckPdfFingerprint): a second download of the same
// version is instant, and any edit renders afresh.
// Rules and arithmetic: lib/deck-pdf.ts. Browser launch: lib/pdf-browser.

import { NextRequest, NextResponse } from 'next/server'
import type { Browser } from 'puppeteer-core'
import { launchBrowser } from '@/lib/pdf-browser'
import { getCampaignById, downloadAsset, saveDeckPdf, pruneDeckPdfs } from '@/lib/campaigns'
import { buildDeckForCampaign } from '@/lib/campaign-deck'
import { deckSnapshot } from '@/lib/deck-changes'
import { canStaffViewResource } from '@/lib/auth'
import { verifyAccessToken, signRenderToken } from '@/lib/content-access'
import { rateLimit } from '@/lib/rate-limit'
import { captureException, logger } from '@/lib/logger'
import {
  PDF_VIEWPORT, PDF_IMAGE_SCALE, PDF_JPEG_QUALITY, deckExportAccess, deckPdfFingerprint,
  deckPdfPath, deckPdfFileName, pdfContentDisposition, printPageCss,
} from '@/lib/deck-pdf'

export const runtime = 'nodejs'
// Measured locally with Vercel's software rendering: a 61-slide deck (Helga,
// 27 ads) in 23s. Vercel's CPU is slower than a laptop's, so the limit leaves
// several times that.
export const maxDuration = 120

/** Give up before Vercel kills the function, so the user gets a message, not a dropped connection. */
const RENDER_BUDGET_MS = 110_000
/** A third-party landing page that never loads must not hold the whole export. */
const IFRAME_WAIT_MS = 8_000
const EMOJI_FONT_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block'

interface Ctx { params: Promise<{ id: string }> }

const RENDER_FAILED = 'שגיאה ביצירת ה-PDF, נסו שוב בעוד רגע'

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const raw = await getCampaignById(id)
  if (!raw || raw.deleted_at || raw.is_template) {
    return NextResponse.json({ error: 'המצגת לא נמצאה' }, { status: 404 })
  }

  // Same gates as opening the deck (app/c/[slug]/page.tsx): staff of the
  // campaign's workspace export anything; anyone else, only a deck that is
  // live for them — past the password gate included.
  const staff = await canStaffViewResource(raw.workspace_id)
  let accessTokenValid = false
  if (!staff && raw.password) {
    const token = req.cookies.get(`cmp_${raw.id}`)?.value
    accessTokenValid = token ? await verifyAccessToken(token, raw.id, raw.password) : false
  }
  const access = deckExportAccess({
    status: raw.status,
    publishAt: raw.publish_at ?? null,
    expiresAt: raw.expires_at ?? null,
    hasPassword: !!raw.password,
    staff,
    accessTokenValid,
  })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { campaign, slides, brandColor, logoPath } = await buildDeckForCampaign(raw)
  const fingerprint = deckPdfFingerprint({
    campaignId: campaign.id,
    updatedAt: campaign.updated_at,
    brandColor,
    logoPath,
    snapshot: deckSnapshot(slides),
    commit: process.env.VERCEL_GIT_COMMIT_SHA,
  })
  const path = deckPdfPath(campaign.id, fingerprint)
  const fileName = deckPdfFileName(campaign.client, campaign.campaign_name, campaign.slug)
  const disposition = pdfContentDisposition(fileName, campaign.slug)

  const cached = await downloadAsset(path)
  if (cached) return pdfResponse(cached.buffer, disposition, 'hit')

  // A render holds a whole Chromium for up to a minute. Per campaign, not per
  // IP — the team shares one office address.
  const limited = await rateLimit(req, {
    prefix: 'deck-pdf', key: campaign.id, windowMs: 60_000, max: 3,
    message: 'יותר מדי בקשות PDF למצגת הזאת, נסו שוב בעוד דקה',
  })
  if (limited) return limited

  const started = Date.now()
  // Where the time went, for the log line — Vercel's CPU is far slower than a laptop's.
  const marks: Record<string, number> = {}
  const mark = (name: string) => { marks[name] = Date.now() - started }
  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    mark('launch')
    const page = await browser.newPage()
    await page.setViewport({ ...PDF_VIEWPORT, deviceScaleFactor: 1 })
    // Screen styles in print: the deck's own look, not a print stylesheet.
    await page.emulateMediaType('screen')
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

    const token = await signRenderToken(campaign.id, { staff: access.staff })
    // encodeURIComponent: the token's base64 carries '+', which a query string reads as a space.
    const origin = new URL(req.url).origin
    const url = `${origin}/c/${encodeURIComponent(campaign.slug)}?pdf=${encodeURIComponent(token)}`
    await page.goto(url, { waitUntil: 'load', timeout: 25_000 })
    await page.waitForSelector('[data-pdf-slide]', { timeout: 15_000 })

    // Ready = what a reader would see once everything settled. Mockups load
    // as their own chunks; everything below the first screen is lazy and
    // would never load in a page nobody scrolls.
    await page.waitForFunction(() => !document.querySelector('[data-mockup-loading]'), { timeout: 15_000 })
    await page.evaluate(async (iframeWaitMs: number) => {
      document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach(el => {
        el.setAttribute('loading', 'eager')
      })
      await document.fonts.ready
      const pending = Array.from(document.images).filter(img => !img.complete)
      await Promise.all(pending.map(img => new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })))
      const deadline = Date.now() + iframeWaitMs
      while (Date.now() < deadline) {
        const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-pdf-iframe]'))
        if (frames.every(f => f.dataset.pdfLoaded === '1')) break
        await new Promise(r => setTimeout(r, 200))
      }
      // Layout that reacts to the images and fonts above (mockup heights) settles.
      await new Promise(r => setTimeout(r, 400))
    }, IFRAME_WAIT_MS)
    mark('ready')

    // Emoji (the Facebook mockups' reactions and Share/Comment/Like icons):
    // the server's Chromium has no emoji font, and installing one into its
    // font path was not picked up (2026-10-08). So each emoji gets a span set
    // in Noto Color Emoji, loaded as a web font — only the glyphs used.
    await page.addStyleTag({ url: EMOJI_FONT_CSS })
    await page.addStyleTag({ content: `.pdf-emoji{font-family:'Noto Color Emoji'!important}` })
    await page.evaluate(async () => {
      const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\uFE0F?/gu
      const root = document.querySelector('.campaign-pres')
      if (!root) return
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      while (walker.nextNode()) {
        const t = walker.currentNode as Text
        EMOJI.lastIndex = 0
        if (EMOJI.test(t.data)) nodes.push(t)
      }
      let used = ''
      for (const t of nodes) {
        const frag = document.createDocumentFragment()
        let last = 0
        for (const m of t.data.matchAll(EMOJI)) {
          if (m.index > last) frag.append(t.data.slice(last, m.index))
          const span = document.createElement('span')
          span.className = 'pdf-emoji'
          span.textContent = m[0]
          frag.append(span)
          used += m[0]
          last = m.index + m[0].length
        }
        if (last < t.data.length) frag.append(t.data.slice(last))
        t.replaceWith(frag)
      }
      if (used) await document.fonts.load(`16px "Noto Color Emoji"`, used).catch(() => [])
      await document.fonts.ready
    })
    mark('emoji')

    // Chrome's PDF writer embeds a JPEG as it is but every other image —
    // our WebP creatives — as raw, losslessly packed pixels: a 21-slide deck
    // came out at 62MB. So each opaque image is re-encoded as JPEG at twice
    // its displayed size (still retina-sharp; 9.7MB). Images with
    // transparency (logos) stay as they are — a JPEG would give them a box.
    const images = await page.evaluate(async (scaleFactor: number, quality: number) => {
      const out = { jpeg: 0, kept: 0 }
      for (const img of Array.from(document.images)) {
        if (!img.naturalWidth || /\.jpe?g(\?|$)/i.test(img.currentSrc)) { out.kept++; continue }
        const r = img.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) { out.kept++; continue }
        const scale = Math.min(1, (r.width * scaleFactor) / img.naturalWidth)
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        try {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { out.kept++; continue }
          ctx.drawImage(img, 0, 0, w, h)
          const px = ctx.getImageData(0, 0, w, h).data
          let opaque = true
          for (let i = 3; i < px.length; i += 16) if (px[i] < 250) { opaque = false; break }
          if (!opaque) { out.kept++; continue }
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
          if (!blob) { out.kept++; continue }
          img.removeAttribute('srcset')
          img.src = URL.createObjectURL(blob)
          await img.decode().catch(() => {})
          out.jpeg++
        } catch {
          // A cross-origin image (no CORS) can't be read back: printed as it is.
          out.kept++
        }
      }
      return out
    }, PDF_IMAGE_SCALE, PDF_JPEG_QUALITY)
    mark('images')

    // A page per slide, sized to the slide (named @page rules), and the slide
    // pinned to that height so a print-time reflow can't spill onto a page of
    // its own.
    const pages = await page.evaluate((title: string) => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-slide]'))
      const heights = sections.map(s => Math.ceil(s.getBoundingClientRect().height))
      sections.forEach((s, i) => {
        s.style.setProperty('page', `slide-${i}`)
        s.style.height = `${heights[i]}px`
        s.style.minHeight = '0'
      })
      document.title = title
      return heights
    }, `${campaign.client} - ${campaign.campaign_name}`)
    if (pages.length === 0) throw new Error('Deck rendered no slides')
    await page.addStyleTag({ content: printPageCss(PDF_VIEWPORT.width, pages) })

    const remaining = RENDER_BUDGET_MS - (Date.now() - started)
    if (remaining < 5_000) throw new Error(`Deck PDF over budget before printing (${JSON.stringify(marks)})`)
    const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true, timeout: remaining })
    mark('print')
    logger.info('deck pdf rendered', {
      campaignId: campaign.id, pages: pages.length, bytes: bytes.length, ...images, ...marks,
    })

    // The cache is an optimisation: a failed upload still hands over the file.
    try {
      await saveDeckPdf(path, bytes)
      await pruneDeckPdfs(campaign.id, path)
    } catch (err) {
      captureException(err, { route: 'GET /api/campaigns/[id]/pdf', step: 'cache', id })
    }

    return pdfResponse(bytes, disposition, 'miss')
  } catch (err) {
    captureException(err, { route: 'GET /api/campaigns/[id]/pdf', id, ms: Date.now() - started, ...marks })
    return NextResponse.json({ error: RENDER_FAILED }, { status: 500 })
  } finally {
    // Chromium doesn't idle cheaply; always kill it (see the landing-page route).
    await browser?.close().catch(() => {})
  }
}

/**
 * Streamed, not one body: Vercel caps a buffered function response at 4.5MB,
 * and a deck of a few dozen retina slides runs well past that. Streamed
 * responses have no such cap.
 */
function pdfResponse(bytes: Uint8Array, disposition: string, cache: 'hit' | 'miss'): Response {
  const CHUNK = 256 * 1024
  let offset = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return }
      controller.enqueue(bytes.subarray(offset, offset + CHUNK))
      offset += CHUNK
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
      'X-Deck-Pdf-Cache': cache,
    },
  })
}
