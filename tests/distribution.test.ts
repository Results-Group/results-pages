import { describe, it, expect } from 'vitest'
import {
  resolvePercents,
  totalBudget,
  hasVisibleContent,
  percentWarning,
  buildTimeline,
  parsePlanText,
  planTextToDoc,
  docIsEmpty,
  docPlainText,
  resolvePlanDoc,
  normalizePlan,
  newDistributionPlan,
  type DistributionPlan,
  type PlanDoc,
} from '@/lib/distribution'
import { slidesPerSection, countClientSlides } from '@/lib/slides'

function plan(over: Partial<DistributionPlan> = {}): DistributionPlan {
  return { ...newDistributionPlan(), ...over }
}

describe('resolvePercents', () => {
  it('derives the share from budgets', () => {
    const channels = [
      { id: 'a', name: 'Meta', budget: 6000 },
      { id: 'b', name: 'Google', budget: 4000 },
    ]
    const p = resolvePercents(channels)
    expect(p.get('a')).toBe(60)
    expect(p.get('b')).toBe(40)
    expect(totalBudget(channels)).toBe(10000)
  })

  it('lets a manual percent win over the derived one', () => {
    const p = resolvePercents([
      { id: 'a', name: 'Meta', budget: 6000, percent: 70 },
      { id: 'b', name: 'Google', budget: 4000 },
    ])
    expect(p.get('a')).toBe(70)
    expect(p.get('b')).toBe(40)
  })

  it('returns 0 rather than NaN when there is no budget at all', () => {
    const p = resolvePercents([{ id: 'a', name: 'Meta' }])
    expect(p.get('a')).toBe(0)
  })
})

describe('hasVisibleContent', () => {
  it('is false for an untouched plan', () => {
    expect(hasVisibleContent(plan())).toBe(false)
    expect(hasVisibleContent(null)).toBe(false)
    expect(hasVisibleContent(undefined)).toBe(false)
  })

  it('is false when the only filled block is switched off', () => {
    expect(hasVisibleContent(plan({
      bullets: ['אסטרטגיה'],
      show: { bullets: false, channels: true, budget: true, timeline: false, paragraph: true },
    }))).toBe(false)
  })

  it('ignores blank bullets and unnamed channels', () => {
    expect(hasVisibleContent(plan({ bullets: ['   '] }))).toBe(false)
    expect(hasVisibleContent(plan({ channels: [{ id: 'a', name: '  ' }] }))).toBe(false)
  })

  it('is true once a named channel exists', () => {
    expect(hasVisibleContent(plan({ channels: [{ id: 'a', name: 'Meta' }] }))).toBe(true)
  })

  it('counts a free paragraph on its own, and ignores a blank one', () => {
    expect(hasVisibleContent(plan({ paragraph: 'התקציב ייבחן מחדש בתום החודש הראשון.' }))).toBe(true)
    expect(hasVisibleContent(plan({ paragraph: '   ' }))).toBe(false)
    expect(hasVisibleContent(plan({
      paragraph: 'טקסט',
      show: { bullets: true, channels: true, budget: true, timeline: false, paragraph: false },
    }))).toBe(false)
  })
})

describe('percentWarning', () => {
  it('stays quiet on a full allocation', () => {
    expect(percentWarning([
      { id: 'a', name: 'Meta', budget: 5000 },
      { id: 'b', name: 'Google', budget: 5000 },
    ])).toBeNull()
  })

  it('reports a short allocation', () => {
    expect(percentWarning([
      { id: 'a', name: 'Meta', percent: 60 },
      { id: 'b', name: 'Google', percent: 30 },
    ])).toContain('90')
  })

  it('stays quiet when no budget or percent was entered yet', () => {
    expect(percentWarning([{ id: 'a', name: 'Meta' }])).toBeNull()
  })
})

describe('buildTimeline', () => {
  it('skips channels without a parseable date pair', () => {
    expect(buildTimeline([{ id: 'a', name: 'Meta' }])).toBeNull()
    expect(buildTimeline([{ id: 'a', name: 'Meta', start: '2026-08-01' }])).toBeNull()
  })

  it('positions lanes proportionally across the span', () => {
    // Two back-to-back 30-day windows, so the second lane starts at the
    // midpoint exactly — calendar months differ in length and would not.
    const tl = buildTimeline([
      { id: 'a', name: 'Meta', start: '2026-08-01', end: '2026-08-31' },
      { id: 'b', name: 'Google', start: '2026-08-31', end: '2026-09-30' },
    ])
    expect(tl).not.toBeNull()
    expect(tl!.lanes[0].offset).toBe(0)
    expect(tl!.lanes[1].offset).toBe(50)
    expect(tl!.lanes[0].width).toBe(50)
    expect(tl!.lanes.length).toBe(2)
  })

  it('gives full-width bars when every channel shares one window', () => {
    const tl = buildTimeline([
      { id: 'a', name: 'Meta', start: '2026-08-01', end: '2026-08-01' },
    ])
    expect(tl!.lanes[0].width).toBe(100)
  })
})

describe('parsePlanText', () => {
  it('reads a pasted plan into headings, lists and prose', () => {
    const nodes = parsePlanText(`Meta
חלוקה ל-3 סגמנטים:

* קהל חדש: פנייה לאנשים שלא מכירים את המותג.
   * החרגות: מי שכבר ביצע מעורבות.
* ריטרגטינג: פנייה חמה למי שיצר מגע.

לכל סגמנט יוקצה תקציב נפרד ותתבצע מדידה ייעודית ברמת הקמפיין.`)

    expect(nodes[0]).toEqual({ kind: 'heading', text: 'Meta', level: 2 })
    expect(nodes[1]).toEqual({ kind: 'paragraph', text: 'חלוקה ל-3 סגמנטים:' })
    expect(nodes[2].kind).toBe('list')
    const list = nodes[2] as { kind: 'list'; items: { text: string; depth: number }[] }
    expect(list.items.map(i => i.depth)).toEqual([0, 1, 0])
    expect(list.items[1].text).toBe('החרגות: מי שכבר ביצע מעורבות.')
    expect(nodes[3].kind).toBe('paragraph')
  })

  it('promotes a short line to a heading only when a bullet list follows it', () => {
    expect(parsePlanText('יעדי רבעון ראשון\n* עלות גיוס לקוח: מתחת ל-3,500 ₪')[0])
      .toEqual({ kind: 'heading', text: 'יעדי רבעון ראשון', level: 2 })
    // Ends with a colon → prose, not a heading
    expect(parsePlanText('הנה הנוסח המעודכן:\n* בולט')[0].kind).toBe('paragraph')
  })

  it('leaves a plain list of KPIs as prose — no bullets, no headings', () => {
    // The regression that made a whole pasted block render bold.
    const nodes = parsePlanText(`עלות לליד
אחוז המרה מליד לעסקה
עלות גיוס לקוח
יעדי רבעון ראשון
עלות גיוס לקוח: מתחת ל-3,500 ₪
אחוז המרה (מליד לעסקה): מעל 3.2%`)
    expect(nodes.every(n => n.kind === 'paragraph')).toBe(true)
  })

  it('honours explicit heading levels, small text and numbered bullets', () => {
    expect(parsePlanText('# ראשי')[0]).toEqual({ kind: 'heading', text: 'ראשי', level: 1 })
    expect(parsePlanText('## משנה')[0]).toEqual({ kind: 'heading', text: 'משנה', level: 2 })
    expect(parsePlanText('### קטנה')[0]).toEqual({ kind: 'heading', text: 'קטנה', level: 3 })
    expect(parsePlanText('> הערת שוליים')[0]).toEqual({ kind: 'paragraph', text: 'הערת שוליים', small: true })
    const list = parsePlanText('1. שלב ראשון\n2. שלב שני')[0] as { kind: 'list'; items: unknown[] }
    expect(list.kind).toBe('list')
    expect(list.items.length).toBe(2)
  })

  it('returns nothing for empty input', () => {
    expect(parsePlanText('')).toEqual([])
    expect(parsePlanText('   \n\n  ')).toEqual([])
  })
})

describe('planTextToDoc — migrating legacy slides', () => {
  it('turns headings, bullets and prose into document nodes', () => {
    const doc = planTextToDoc(`Meta
חלוקה ל-3 סגמנטים:

* קהל חדש
   * החרגות
* ריטרגטינג`)

    expect(doc.type).toBe('doc')
    expect(doc.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
    expect(doc.content?.[1]?.type).toBe('paragraph')
    const list = doc.content?.[2]
    expect(list?.type).toBe('bulletList')
    // The indented line becomes a nested list inside the item above it
    expect(list?.content?.length).toBe(2)
    expect(list?.content?.[0].content?.some(c => c.type === 'bulletList')).toBe(true)
  })

  it('gives every prose line its own block, so styling one leaves the rest alone', () => {
    const doc = planTextToDoc(`יעדי רבעון ראשון
עלות גיוס לקוח: מתחת ל-3,500 ₪
אחוז המרה: מעל 3.2%`)
    expect(doc.content?.length).toBe(3)
    expect(doc.content?.every(n => n.type === 'paragraph')).toBe(true)
    expect(doc.content?.[0].content?.[0].text).toBe('יעדי רבעון ראשון')
  })

  it('carries **bold** through as a mark, not as asterisks', () => {
    const doc = planTextToDoc('שיעור ההמרה **מעל 3.2%** ברבעון')
    const text = doc.content?.[0].content || []
    expect(text.some(n => n.marks?.some(m => m.type === 'bold') && n.text === 'מעל 3.2%')).toBe(true)
    expect(docPlainText(doc)).not.toContain('**')
  })
})

describe('docIsEmpty / resolvePlanDoc', () => {
  it('treats a document with no text as empty', () => {
    expect(docIsEmpty({ type: 'doc', content: [] })).toBe(true)
    expect(docIsEmpty({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    expect(docIsEmpty({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }] })).toBe(true)
    expect(docIsEmpty(null)).toBe(true)
  })

  it('prefers the document, and falls back to the legacy text', () => {
    const rich: PlanDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'חדש' }] }] }
    expect(resolvePlanDoc({ doc: rich, paragraph: 'ישן' })).toBe(rich)
    expect(docPlainText(resolvePlanDoc({ paragraph: 'ישן' }))).toBe('ישן')
    expect(resolvePlanDoc({})).toBeNull()
  })

  it('counts a document as visible content for the slide', () => {
    expect(hasVisibleContent(plan({
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'תוכנית' }] }] },
    }))).toBe(true)
  })
})

describe('normalizePlan', () => {
  it('fills in defaults for a row written before a field existed', () => {
    const p = normalizePlan({ channels: [{ id: 'a', name: 'Meta' }] } as DistributionPlan)
    expect(p.budgetDisplay).toBe('both')
    expect(p.bullets).toEqual([])
    expect(p.show.channels).toBe(true)
  })
})

describe('slide counting agrees with the built deck', () => {
  const section = (over: Record<string, unknown> = {}) =>
    ({ mockup_type: 'distribution', assets: [], ...over })

  it('counts an empty distribution slide as zero', () => {
    expect(slidesPerSection(section())).toBe(0)
    expect(slidesPerSection(section({ plan: plan() }))).toBe(0)
  })

  it('counts a filled distribution slide as one', () => {
    expect(slidesPerSection(section({ plan: plan({ channels: [{ id: 'a', name: 'Meta' }] }) }))).toBe(1)
  })

  it('includes it in the deck total, cover and closing aside', () => {
    const sections = [section({ plan: plan({ channels: [{ id: 'a', name: 'Meta' }] }) })]
    // cover + distribution + closing
    expect(countClientSlides(sections, { hasConcept: false })).toBe(3)
    expect(countClientSlides([section()], { hasConcept: false })).toBe(2)
  })
})
