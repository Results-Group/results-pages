// PDF export of a campaign deck, for the client (deck header) and the team
// (editor). Headless Chrome opens the deck in its stacked PDF render
// (/c/<slug>?pdf=<token> → app/_deck/PdfDeck), every slide is screenshotted on
// its own at DPR 2, and pdf-lib binds the shots into one page per slide — so
// the file looks exactly like the deck on screen, whatever browser or phone
// asked for it. window.print() could not promise that: each browser lays out
// print differently, and mockups sized to the window broke across pages.
//
// The file is cached in Storage under a fingerprint of everything the reader
// sees (lib/deck-pdf.ts:deckPdfFingerprint): a second download of the same
// version is instant, and any edit renders afresh.
// Rules and arithmetic: lib/deck-pdf.ts. Browser launch: lib/pdf-browser.

import { NextRequest, NextResponse } from 'next/server'
import type { Browser } from 'puppeteer-core'
import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { launchBrowser } from '@/lib/pdf-browser'
import { getCampaignById, downloadAsset, saveDeckPdf, pruneDeckPdfs } from '@/lib/campaigns'
import { buildDeckForCampaign } from '@/lib/campaign-deck'
import { deckSnapshot } from '@/lib/deck-changes'
import { canStaffViewResource } from '@/lib/auth'
import { verifyAccessToken, signRenderToken } from '@/lib/content-access'
import { rateLimit } from '@/lib/rate-limit'
import { captureException, logger } from '@/lib/logger'
import {
  PDF_DPR, PDF_VIEWPORT, deckExportAccess, deckPdfFingerprint, deckPdfPath,
  deckPdfFileName, pdfContentDisposition, pageSizePt, linkRectToPdf, type LinkBox,
} from '@/lib/deck-pdf'

export const runtime = 'nodejs'
// A cold start pays ~5s for the Chromium pack, then the deck loads once and
// each slide takes a fraction of a second to capture. Measured locally: a
// 61-slide deck (Helga, 27 ads) took 22s — Vercel's CPU is slower, so the
// limit leaves twice that and more.
export const maxDuration = 120

/** Give up before Vercel kills the function, so the user gets a message, not a dropped connection. */
const RENDER_BUDGET_MS = 110_000
/** A third-party landing page that never loads must not hold the whole export. */
const IFRAME_WAIT_MS = 8_000
// 85 at DPR 2 is indistinguishable from 90 on screen and in print, and keeps a
// 60-slide deck near 25MB instead of 31.
const JPEG_QUALITY = 85

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
    await page.setViewport({ ...PDF_VIEWPORT, deviceScaleFactor: PDF_DPR })
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

    // Every page's link areas, in CSS px from that page's top-left.
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-slide]')).map(section => {
        const s = section.getBoundingClientRect()
        return Array.from(section.querySelectorAll<HTMLAnchorElement>('a[data-pdf-link]'))
          .filter(a => /^https?:\/\//i.test(a.href))
          .map(a => {
            const r = a.getBoundingClientRect()
            return { href: a.href, box: { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height } }
          })
      })
    }) as { href: string; box: LinkBox }[][]

    const sections = await page.$$('[data-pdf-slide]')
    if (sections.length === 0) throw new Error('Deck rendered no slides')

    const pdf = await PDFDocument.create()
    pdf.setTitle(`${campaign.client} - ${campaign.campaign_name}`)
    pdf.setAuthor('Results Digital')
    pdf.setCreator('Results Digital')

    for (let i = 0; i < sections.length; i++) {
      if (Date.now() - started > RENDER_BUDGET_MS) {
        throw new Error(`Deck PDF over budget at slide ${i + 1}/${sections.length} (${JSON.stringify(marks)})`)
      }
      // Only this slide on the page while it is shot. A shot of an element
      // below the fold makes Chrome rasterise the whole document, and on
      // Vercel — software rendering, no GPU — a 21-slide deck's page took
      // ~9s a shot and ran out of time at slide 12 (2026-10-08). Two frames
      // let the mockups' resize observers settle after the swap.
      await page.evaluate((idx: number) => new Promise<void>(resolve => {
        document.querySelectorAll<HTMLElement>('[data-pdf-slide]').forEach((el, k) => {
          el.style.display = k === idx ? '' : 'none'
        })
        window.scrollTo(0, 0)
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50)))
      }), i)
      const shot = await sections[i].screenshot({ type: 'jpeg', quality: JPEG_QUALITY })
      const image = await pdf.embedJpg(shot)
      const size = pageSizePt(image.width, image.height)
      const pdfPage = pdf.addPage([size.width, size.height])
      pdfPage.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height })

      const annots = (links[i] || []).flatMap(({ href, box }) => {
        const rect = linkRectToPdf(box, size)
        if (!rect) return []
        return [pdf.context.register(pdf.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: rect,
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(href) },
        }))]
      })
      if (annots.length) pdfPage.node.set(PDFName.of('Annots'), pdf.context.obj(annots))
    }

    mark('shots')
    const bytes = await pdf.save()
    logger.info('deck pdf rendered', {
      campaignId: campaign.id, pages: sections.length, bytes: bytes.length, ms: Date.now() - started, ...marks,
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
