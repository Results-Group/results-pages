// A campaign URL nobody typed by hand follows the campaign's name until the
// campaign goes live. A duplicate used to keep its source's address forever:
// a copy renamed "Billboards" went on living at rosh-hashana-2026-…, because
// only a brand-new campaign took its URL from its name.
//
// Pure, so the editor and the tests can share it; the route owns the
// uniqueness check against the table.

import { slugifyPath } from './slug'

/** The duplicate route's own suffixes — not part of the name a URL should carry. */
const COPY_SUFFIX = /\s*\((?:עותק|תבנית)\)\s*$/

/** Every generated slug ends in a 6-character random tail (create + duplicate routes). */
const TAIL = /(?:^|-)([a-z0-9]{6})$/

/** The URL base a campaign name produces; '' when nothing usable remains. */
export function slugBaseFor(name: string): string {
  return slugifyPath(name.replace(COPY_SUFFIX, ''), '')
}

/**
 * Whether this save may move the URL: it is still automatic, the campaign is
 * still a draft (a published link may already be with the client), and the
 * save is not itself setting a URL by hand.
 */
export function urlFollowsName(
  existing: { slug_auto?: boolean | null; status: string },
  body: { slug?: unknown; campaign_name?: unknown },
): boolean {
  return !!existing.slug_auto
    && existing.status === 'draft'
    && typeof body.slug !== 'string'
    && typeof body.campaign_name === 'string'
}

/**
 * The URL a still-automatic campaign should have under `name`: the name's base
 * plus the existing random tail, so only the part that came from the name
 * changes. null = leave it (same name, or a name with nothing usable in it).
 */
export function slugForName(currentSlug: string, name: string, randomTail: () => string): string | null {
  const base = slugBaseFor(name)
  if (!base) return null
  const tail = currentSlug.match(TAIL)?.[1] ?? randomTail()
  const next = `${base}-${tail}`
  return next === currentSlug ? null : next
}
