import { describe, it, expect } from 'vitest'
import { scrollCueState } from '@/lib/deck-scroll-cue'

const VH = 800

describe('scrollCueState', () => {
  it('at the top of a two-ad slide: ad 1 reached, cue up, jump target is ad 2', () => {
    expect(scrollCueState([80, 900], VH)).toEqual({ reached: 1, showCue: true, nextIndex: 1 })
  })

  it('the peek does not count: the second card showing its top edge keeps the cue up', () => {
    expect(scrollCueState([-200, 700], VH)).toMatchObject({ reached: 1, showCue: true })
  })

  it('once the second card is well into view the cue goes away', () => {
    expect(scrollCueState([-600, 300], VH)).toEqual({ reached: 2, showCue: false, nextIndex: null })
  })

  it('never shows for a single creative or an empty grid', () => {
    expect(scrollCueState([80], VH).showCue).toBe(false)
    expect(scrollCueState([], VH).showCue).toBe(false)
  })

  it('counts a prefix only — an out-of-order measurement cannot skip a card', () => {
    // Card 2 not reached, card 3 somehow above the line: still "1 reached".
    expect(scrollCueState([-100, 700, 100], VH).reached).toBe(1)
  })
})
