/**
 * Structural fingerprint of an uploaded page, used to catch a visual edit that
 * silently removed part of the page's machinery.
 *
 * The visual editor turns designMode on over the whole document, so a caret
 * sitting next to a slider arrow deletes the arrow as readily as a letter.
 * That is exactly how the Netiv HaChesed billboard slider lost both nav
 * buttons and one dot: the page still rendered, still looked finished, and the
 * first of three signs had simply become unreachable. Nothing failed loudly.
 *
 * Pure string work on purpose — no DOM — so it runs identically in the route
 * and in tests. Both sides use the same reader, so any imprecision in the
 * regexes cancels out: what matters is that a thing present before is still
 * present after, not that the count is a perfect parse.
 */

/** Tags that carry behaviour or content a caret should never be able to eat. */
const PROTECTED_TAGS = [
  'button', 'a', 'img', 'iframe', 'video', 'audio', 'canvas', 'svg',
  'form', 'input', 'select', 'textarea', 'source', 'track',
] as const

export type ProtectedTag = (typeof PROTECTED_TAGS)[number]

export interface PageStructure {
  /** Every id in the document, sorted. Scripts reach for these by name. */
  ids: string[]
  /** How many of each protected tag the document opens. */
  tags: Record<string, number>
  /** Inline on* handlers — the slider's arrows and dots are nothing else. */
  handlers: number
}

/** Human label per tag, for the message the operator actually reads. */
const TAG_LABEL: Record<string, string> = {
  button: 'כפתורים',
  a: 'קישורים',
  img: 'תמונות',
  iframe: 'מסגרות מוטמעות',
  video: 'סרטונים',
  audio: 'קטעי שמע',
  canvas: 'אזורי ציור',
  svg: 'איקונים',
  form: 'טפסים',
  input: 'שדות קלט',
  select: 'תפריטי בחירה',
  textarea: 'תיבות טקסט',
  source: 'מקורות מדיה',
  track: 'רצועות כתוביות',
}

export function readStructure(html: string): PageStructure {
  const ids = Array.from(html.matchAll(/\sid="([^"]+)"/gi), m => m[1]).sort()

  const tags: Record<string, number> = {}
  for (const tag of PROTECTED_TAGS) {
    // Opening tags only, and `\b`-style boundary so <a> never counts <article>.
    const re = new RegExp(`<${tag}(?=[\\s/>])`, 'gi')
    tags[tag] = (html.match(re) || []).length
  }

  const handlers = (html.match(/\son[a-z]+\s*=\s*["']/gi) || []).length

  return { ids, tags, handlers }
}

/**
 * What the edit would destroy, in Hebrew, ready to show. Empty array means the
 * page kept everything it had — additions are always fine, only losses are not.
 */
export function describeStructureLoss(
  before: PageStructure,
  after: PageStructure,
): string[] {
  const lost: string[] = []

  const goneIds = before.ids.filter(id => !after.ids.includes(id))
  if (goneIds.length) {
    // ids are the sharpest signal: a script that looks one up gets null.
    lost.push(`אלמנטים שקוד הדף מסתמך עליהם נמחקו: ${goneIds.join(', ')}`)
  }

  for (const tag of Object.keys(before.tags)) {
    const diff = before.tags[tag] - (after.tags[tag] ?? 0)
    if (diff > 0) {
      lost.push(`${TAG_LABEL[tag] || tag}: ${diff} נמחקו`)
    }
  }

  const handlerDiff = before.handlers - after.handlers
  if (handlerDiff > 0) {
    lost.push(`פעולות לחיצה: ${handlerDiff} נמחקו`)
  }

  return lost
}
