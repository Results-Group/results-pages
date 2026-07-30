import { describe, it, expect } from 'vitest'
import {
  resolvePercents,
  totalBudget,
  hasVisibleContent,
  percentWarning,
  buildTimeline,
  parsePlanText,
  normalizePlan,
  newDistributionPlan,
  type DistributionPlan,
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

    expect(nodes[0]).toEqual({ kind: 'heading', text: 'Meta' })
    expect(nodes[1]).toEqual({ kind: 'paragraph', text: 'חלוקה ל-3 סגמנטים:' })
    expect(nodes[2].kind).toBe('list')
    const list = nodes[2] as { kind: 'list'; items: { text: string; depth: number }[] }
    expect(list.items.map(i => i.depth)).toEqual([0, 1, 0])
    expect(list.items[1].text).toBe('החרגות: מי שכבר ביצע מעורבות.')
    expect(nodes[3].kind).toBe('paragraph')
  })

  it('treats a short line with no sentence-ending punctuation as a heading', () => {
    expect(parsePlanText('יעדי רבעון ראשון')).toEqual([{ kind: 'heading', text: 'יעדי רבעון ראשון' }])
    // Ends with a colon → prose, not a heading
    expect(parsePlanText('הנה הנוסח המעודכן:')[0].kind).toBe('paragraph')
    // Long enough to be a sentence even without a full stop
    expect(parsePlanText('בשבועיים הראשונים התקציב יתחלק שווה בשווה בין שתי הפלטפורמות')[0].kind).toBe('paragraph')
  })

  it('honours explicit ## headings and numbered bullets', () => {
    expect(parsePlanText('## חלוקת תקציב ואופטימיזציה שנתית מפורטת מאוד')[0])
      .toEqual({ kind: 'heading', text: 'חלוקת תקציב ואופטימיזציה שנתית מפורטת מאוד' })
    const list = parsePlanText('1. שלב ראשון\n2. שלב שני')[0] as { kind: 'list'; items: unknown[] }
    expect(list.kind).toBe('list')
    expect(list.items.length).toBe(2)
  })

  it('returns nothing for empty input', () => {
    expect(parsePlanText('')).toEqual([])
    expect(parsePlanText('   \n\n  ')).toEqual([])
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
