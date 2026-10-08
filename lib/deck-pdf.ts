// PDF export of a campaign deck (app/api/campaigns/[id]/pdf). The rules and
// the arithmetic live here, free of browser and storage code, so the tests can
// hold them: who may export, when a cached file is still the deck, and how a
// screenshot becomes a page.

import { createHash } from 'crypto'

/**
 * Bump whenever the PDF render changes (pdf-mode CSS, PdfDeck, capture
 * settings) so cached files of the old render stop being served. The deploy's
 * commit is folded into the fingerprint too, so this is for local runs and for
 * an explicit "regenerate everything".
 */
export const PDF_FORMAT_VERSION = 2

/** CSS viewport the deck is rendered at. A page is this wide, at least this tall. */
export const PDF_VIEWPORT = { width: 1600, height: 900 } as const
/** Device pixel ratio of the capture: 2 = retina-sharp text and images. */
export const PDF_DPR = 2

export type ExportAccess =
  | { ok: true; staff: boolean }
  | { ok: false; status: 403 | 404; error: string }

/**
 * Who may download a deck as PDF — exactly who may open it.
 *
 * Staff with view rights on the workspace export anything, drafts included,
 * like their ?preview=1. Everyone else gets the PDF of a deck that is live for
 * them: published, inside its window, and past the password gate. A draft or an
 * expired deck answers 404, the way /api/campaign-access does — no hint that it
 * exists.
 */
export function deckExportAccess(input: {
  status: string
  publishAt: string | null
  expiresAt: string | null
  hasPassword: boolean
  staff: boolean
  accessTokenValid: boolean
  now?: number
}): ExportAccess {
  if (input.staff) return { ok: true, staff: true }
  const now = input.now ?? Date.now()
  const notFound = { ok: false as const, status: 404 as const, error: 'המצגת לא נמצאה' }
  if (input.status !== 'published') return notFound
  if (input.publishAt && new Date(input.publishAt).getTime() > now) return notFound
  if (input.expiresAt && new Date(input.expiresAt).getTime() < now) return notFound
  if (input.hasPassword && !input.accessTokenValid) {
    return { ok: false, status: 403, error: 'נדרשת סיסמה לצפייה במצגת' }
  }
  return { ok: true, staff: false }
}

/**
 * Identifies one rendering of the deck. A cached PDF is served only while this
 * matches, so anything the reader would see differently must be in it:
 * the campaign's own save stamp, the client's brand colour and logo (they live
 * on the client record and don't bump the campaign), the slides themselves, and
 * the render code (format version + deploy commit).
 */
export function deckPdfFingerprint(parts: {
  campaignId: string
  updatedAt: string
  brandColor: string | null
  logoPath: string | null
  snapshot: Record<string, string>
  commit?: string | null
}): string {
  const material = JSON.stringify([
    PDF_FORMAT_VERSION,
    parts.commit || '',
    parts.campaignId,
    parts.updatedAt,
    parts.brandColor || '',
    parts.logoPath || '',
    Object.entries(parts.snapshot).sort(([a], [b]) => a.localeCompare(b)),
  ])
  return createHash('sha256').update(material).digest('hex').slice(0, 16)
}

/**
 * Where a deck's PDF is cached: flat beside the campaign's other files, NOT in
 * a subfolder — deleteCampaignAssets lists `campaigns/<id>` one level deep, so a
 * subfolder would survive purging the campaign.
 */
export function deckPdfPath(campaignId: string, fingerprint: string): string {
  return `campaigns/${campaignId}/deck-${fingerprint}.pdf`
}

/** True for a cached deck PDF — regenerated on demand, so the backup skips it. */
export function isDeckPdfCachePath(path: string): boolean {
  return /^campaigns\/[^/]+\/deck-[0-9a-f]{16}\.pdf$/.test(path)
}

/** "Client - Campaign.pdf", with the characters a filename can't hold dropped. */
export function deckPdfFileName(client: string, campaignName: string, slug: string): string {
  const clean = (s: string) => s.replace(/[^\w֐-׿\s-]/g, '').replace(/\s+/g, ' ').trim()
  const name = [clean(client), clean(campaignName)].filter(Boolean).join(' - ')
  return `${name || slug}.pdf`
}

/**
 * Content-Disposition with an ASCII fallback and the real (Hebrew) name in
 * RFC 5987 form — the same header the landing-page PDF route sends.
 */
export function pdfContentDisposition(fileName: string, slug: string): string {
  const ascii = `${slug.replace(/[^\w-]/g, '') || 'deck'}.pdf`
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/**
 * A page is the screenshot at its CSS size: one PDF point per CSS pixel, so the
 * deck prints at the size it is read on screen and the DPR-2 pixels make it
 * sharp when zoomed.
 */
export function pageSizePt(imageWidthPx: number, imageHeightPx: number, dpr = PDF_DPR): { width: number; height: number } {
  return { width: imageWidthPx / dpr, height: imageHeightPx / dpr }
}

export interface LinkBox { x: number; y: number; w: number; h: number }

/**
 * A link's box, measured in CSS pixels from the slide's top-left, as a PDF
 * annotation rectangle [x1, y1, x2, y2] — PDF's origin is bottom-left, so y
 * flips. `scale` converts CSS px to points (page width ÷ slide width). Clamped
 * to the page; null when nothing of it is left.
 */
export function linkRectToPdf(
  box: LinkBox,
  page: { width: number; height: number },
  scale = 1,
): [number, number, number, number] | null {
  const x1 = Math.max(0, box.x * scale)
  const x2 = Math.min(page.width, (box.x + box.w) * scale)
  const top = Math.max(0, box.y * scale)
  const bottom = Math.min(page.height, (box.y + box.h) * scale)
  if (x2 - x1 < 1 || bottom - top < 1) return null
  return [x1, page.height - bottom, x2, page.height - top]
}
