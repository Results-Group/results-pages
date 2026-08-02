import { describe, it, expect } from 'vitest'
import { clientNameKey } from '@/lib/client-name'

/**
 * Every pair below is a real duplicate found in production on 2026-08-02:
 * a client synced from Monday sitting beside one created from an upload's
 * slug. They must collapse to one key, or the duplicates grow back.
 */
describe('clientNameKey — the pairs that actually duplicated', () => {
  const duplicates: [string, string][] = [
    ['Pizza House', 'pizza-house'],
    ['Cycles Trading', 'cycles-trading'],
    ['Lafayette italy', 'Lafayette-italy'],
    ['Har’ela Yishai', 'harela-yishai'],
    ['Co-Impact', 'co-impact'],
    ['My Studios', 'my-studios'],
    ['Xtra', 'xtra'],
    ['Relax', 'relax'],
    ['Pophy', 'pophy'],
    ['Dor2dor', 'dor2dor'],
  ]

  it.each(duplicates)('collapses "%s" and "%s"', (a, b) => {
    expect(clientNameKey(a)).toBe(clientNameKey(b))
  })

  it('ignores case, spaces and punctuation alike', () => {
    expect(clientNameKey('pizza house')).toBe(clientNameKey('PIZZA-HOUSE'))
    expect(clientNameKey('Dr. Oksana')).toBe(clientNameKey('dr-oksana'))
  })
})

describe('clientNameKey — what must stay distinct', () => {
  it('keeps genuinely different clients apart', () => {
    expect(clientNameKey('Pizza House')).not.toBe(clientNameKey('Pizza Italiano'))
    expect(clientNameKey('Hod Clinic')).not.toBe(clientNameKey('Hot Clinic'))
  })

  it('keeps Hebrew names, rather than collapsing them to nothing', () => {
    expect(clientNameKey('פיצה האוס')).toBe('פיצההאוס')
    expect(clientNameKey('הלגה')).not.toBe(clientNameKey('נסיה'))
    // Two Hebrew names must not both become the empty key and match each other
    expect(clientNameKey('צמיחה')).not.toBe('')
  })

  it('distinguishes branches of the same brand', () => {
    expect(clientNameKey('Helga Rekanaty - הלגה רקנטי - Netanya'))
      .not.toBe(clientNameKey('Helga Rekanaty - הלגה רקנטי - Jerusalem'))
  })

  it('returns an empty key for input with nothing matchable, so it never matches', () => {
    expect(clientNameKey('')).toBe('')
    expect(clientNameKey('---')).toBe('')
  })
})
