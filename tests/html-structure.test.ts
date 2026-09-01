import { describe, it, expect } from 'vitest'
import { readStructure, describeStructureLoss } from '@/lib/html-structure'

/** The real slider that lost its arrows, trimmed to the parts that matter. */
const slider = `<div class="bb-slider">
  <figure class="bb-slide on"><img src="/a/1.jpg" alt="1" onclick="openLB(this.src)"><figcaption>שלט א</figcaption></figure>
  <figure class="bb-slide"><img src="/a/2.jpg" alt="2" onclick="openLB(this.src)"><figcaption>שלט ב</figcaption></figure>
  <figure class="bb-slide"><img src="/a/3.jpg" alt="3" onclick="openLB(this.src)"><figcaption>שלט ג</figcaption></figure>
  <button class="bb-nav prev" onclick="bbGo(-1)" aria-label="הקודם"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
  <button class="bb-nav next" onclick="bbGo(1)" aria-label="הבא"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
</div>
<div class="bb-dots"><button class="bb-dot on" onclick="bbShow(0)"></button><button class="bb-dot" onclick="bbShow(1)"></button><button class="bb-dot" onclick="bbShow(2)"></button><span class="bb-count" id="bbCount">1 / 3</span></div>`

describe('readStructure', () => {
  it('counts the machinery the page depends on', () => {
    const s = readStructure(slider)
    expect(s.tags.button).toBe(5)   // 2 arrows + 3 dots
    expect(s.tags.img).toBe(3)
    expect(s.tags.svg).toBe(2)
    expect(s.ids).toEqual(['bbCount'])
    expect(s.handlers).toBe(8)      // 3 openLB + 2 bbGo + 3 bbShow
  })

  it('does not mistake a tag for one that merely starts the same way', () => {
    const s = readStructure('<article><aside>x</aside></article><a href="/x">link</a>')
    expect(s.tags.a).toBe(1)
  })

  it('ignores aria-label and other attributes that only look like handlers', () => {
    expect(readStructure('<button aria-label="one">x</button>').handlers).toBe(0)
  })
})

describe('describeStructureLoss', () => {
  const before = readStructure(slider)

  it('passes a pure text edit — the only change we want to allow', () => {
    const edited = slider.replace('שלט ג', 'שילוט חוצות — גרסה סופית')
    expect(describeStructureLoss(before, readStructure(edited))).toEqual([])
  })

  it('catches the exact regression that shipped: two arrows and a dot deleted', () => {
    const broken = slider
      .replace(/<button class="bb-nav prev"[\s\S]*?<\/button>\n/, '')
      .replace(/<button class="bb-nav next"[\s\S]*?<\/button>\n/, '')
      .replace('<button class="bb-dot on" onclick="bbShow(0)"></button>', '')
    const loss = describeStructureLoss(before, readStructure(broken))
    expect(loss.length).toBeGreaterThan(0)
    expect(loss.join(' ')).toContain('כפתורים: 3')
    expect(loss.join(' ')).toContain('איקונים: 2')
    expect(loss.join(' ')).toContain('פעולות לחיצה: 3')
  })

  it('names a lost id, because a script looking it up silently gets null', () => {
    const noCount = slider.replace(' id="bbCount"', '')
    expect(describeStructureLoss(before, readStructure(noCount)).join(' '))
      .toContain('bbCount')
  })

  it('allows additions — only losses block a save', () => {
    const richer = slider + '<button onclick="more()">עוד</button><p id="new">טקסט</p>'
    expect(describeStructureLoss(before, readStructure(richer))).toEqual([])
  })

  it('is quiet when nothing changed at all', () => {
    expect(describeStructureLoss(before, before)).toEqual([])
  })
})
