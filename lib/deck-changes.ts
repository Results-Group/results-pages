/**
 * "Updated since your last visit" for a campaign deck. Client-safe, pure.
 *
 * Clients open a campaign within minutes of it being published — and in 54
 * of the 122 opened by 2026-09-27 the team kept changing it afterwards, 33
 * of them more than an hour later. A client who came back had no way to
 * tell what was new. The deck now remembers, in the viewer's own browser,
 * a fingerprint of every slide it showed, and marks the ones that differ on
 * the next visit.
 *
 * The fingerprint covers what the client reads and sees — title, text,
 * copy, the creatives — and nothing that can change on its own (a date, a
 * logo URL, the client name), or every visit would mark slides for nothing.
 */

export interface FingerprintableSlide {
  type: string
  key?: string
  title?: string
  subtitle?: string
  content?: string
  mockupType?: string
  part?: number
  copies?: { label?: string; body?: string }[]
  assets?: { type?: string; file_path?: string; url?: string; caption?: string }[]
  plan?: unknown
  stats?: unknown
  profile?: unknown
}

/** Stable across edits of other slides and reorders: the section id, plus the part when a section spans screens. */
export function slideIdentity(s: FingerprintableSlide, index: number): string {
  return `${s.type}:${s.key ?? (s.type === 'cover' || s.type === 'closing' || s.type === 'concept' ? s.type : `i${index}`)}#${s.part ?? 1}`
}

/** JSON with sorted keys, so the same content always serialises the same way. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** FNV-1a, 32-bit. Collisions only cost a missed "updated" badge. */
function hash(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function slideFingerprint(s: FingerprintableSlide): string {
  return hash(stable({
    type: s.type,
    title: s.title ?? '',
    subtitle: s.subtitle ?? '',
    content: s.content ?? '',
    mockupType: s.mockupType ?? '',
    copies: (s.copies ?? []).map(c => ({ label: c.label ?? '', body: c.body ?? '' })),
    assets: (s.assets ?? []).map(a => ({ type: a.type ?? '', file_path: a.file_path ?? '', url: a.url ?? '', caption: a.caption ?? '' })),
    plan: s.plan ?? null,
    stats: s.stats ?? null,
    profile: s.profile ?? null,
  }))
}

export type DeckSnapshot = Record<string, string>

export function deckSnapshot(slides: FingerprintableSlide[]): DeckSnapshot {
  return Object.fromEntries(slides.map((s, i) => [slideIdentity(s, i), slideFingerprint(s)]))
}

/**
 * Slide identities that are new or different since `previous`. A first visit
 * (no previous snapshot) marks nothing — everything is new to this viewer,
 * which is not what "updated" means.
 */
export function changedSlides(previous: DeckSnapshot | null, current: DeckSnapshot): Set<string> {
  if (!previous) return new Set()
  return new Set(Object.keys(current).filter(id => previous[id] !== current[id]))
}

export const seenStorageKey = (campaignId: string) => `rp_seen:v1:${campaignId}`

/** Parses a stored snapshot, or null for anything that is not one. */
export function parseSnapshot(raw: string | null): DeckSnapshot | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { slides?: unknown }
    if (!v || typeof v.slides !== 'object' || v.slides === null || Array.isArray(v.slides)) return null
    const out: DeckSnapshot = {}
    for (const [k, h] of Object.entries(v.slides as Record<string, unknown>)) if (typeof h === 'string') out[k] = h
    return out
  } catch {
    return null
  }
}
