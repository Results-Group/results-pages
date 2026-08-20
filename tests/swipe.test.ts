import { describe, it, expect } from 'vitest'
import { resolveSwipe, SWIPE_MIN_PX } from '@/lib/swipe'

describe('resolveSwipe', () => {
  it('ignores drags under the threshold', () => {
    expect(resolveSwipe(-(SWIPE_MIN_PX - 1), 0, 'rtl')).toBeNull()
    expect(resolveSwipe(SWIPE_MIN_PX - 1, 0, 'rtl')).toBeNull()
  })

  it('fires exactly at the threshold', () => {
    expect(resolveSwipe(-SWIPE_MIN_PX, 0, 'rtl')).toBe('next')
  })

  it('a mostly-vertical drag is a scroll, not a swipe', () => {
    // |dx| must beat |dy| * 1.5
    expect(resolveSwipe(-90, 61, 'rtl')).toBeNull()
    expect(resolveSwipe(-90, 59, 'rtl')).toBe('next')
  })

  it('RTL: leftward advances, rightward goes back', () => {
    expect(resolveSwipe(-100, 0, 'rtl')).toBe('next')
    expect(resolveSwipe(100, 0, 'rtl')).toBe('prev')
  })

  it('LTR mirrors the direction', () => {
    expect(resolveSwipe(-100, 0, 'ltr')).toBe('prev')
    expect(resolveSwipe(100, 0, 'ltr')).toBe('next')
  })
})
