/**
 * Names for untitled creative slides in a campaign deck. Client-safe, pure.
 *
 * Most sections are never given a title, so the slide list read "שקף 3",
 * "שקף 4" … "שקף 16" — sixteen rows a client cannot tell apart. The deck
 * deliberately never invents a name (see getSlideLabel), so this only uses
 * what is true of the slide: the chapter it sits in (the nearest divider
 * before it) and the kind of ad it shows — "CASHBACK · פיד פייסבוק · 1 מתוך 2".
 */

export interface LabelableSlide {
  type: string
  /** The section id — parts of one section share it. */
  key?: string
  title?: string
  mockupType?: string
  part?: number
  partsTotal?: number
}

/**
 * One label per slide; '' where the deck's own rule already names it (a
 * titled slide, a cover, a divider …) or where nothing true can be said.
 */
export function untitledCreativeLabels(
  slides: LabelableSlide[],
  kindName: (mockupType: string) => string,
  partOf: string,
): string[] {
  // Two sections of the same kind in one chapter would read identically, so
  // the second and later ones are numbered: "פיד אינסטגרם (2)".
  const baseOf = (chapter: string, s: LabelableSlide) =>
    [chapter, s.mockupType ? kindName(s.mockupType) : ''].filter(Boolean).join(' · ')
  const sectionsPerBase = new Map<string, string[]>()
  let chapter = ''
  for (const s of slides) {
    if (s.type === 'divider') { chapter = s.title?.trim() || ''; continue }
    if (s.type !== 'creatives' || s.title?.trim()) continue
    const base = baseOf(chapter, s)
    const list = sectionsPerBase.get(base) ?? []
    const id = s.key ?? `${list.length}`
    if (!list.includes(id)) list.push(id)
    sectionsPerBase.set(base, list)
  }
  chapter = ''
  return slides.map(s => {
    if (s.type === 'divider') { chapter = s.title?.trim() || ''; return '' }
    if (s.type !== 'creatives' || s.title?.trim()) return ''
    const base = baseOf(chapter, s)
    if (!base) return ''
    const list = sectionsPerBase.get(base) ?? []
    const nth = s.key ? list.indexOf(s.key) + 1 : 1
    const named = list.length > 1 && nth > 1 ? `${base} (${nth})` : base
    return s.partsTotal ? `${named} · ${s.part} ${partOf} ${s.partsTotal}` : named
  })
}
