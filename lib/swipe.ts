/**
 * Swipe resolution, extracted pure from DeckShell's proven touch logic
 * (app/_deck/DeckShell.tsx) so the report presentation can share it and tests
 * can hold it. DeckShell itself is untouched — its handlers carry carve-outs
 * (carousels, maps) that don't belong here.
 */
export const SWIPE_MIN_PX = 60

/**
 * dx/dy are end-minus-start in px. A drag more vertical than horizontal (with
 * a 1.5 tolerance) is a scroll, not a swipe. In RTL, swiping leftward (dx<0)
 * advances; LTR mirrors.
 */
export function resolveSwipe(dx: number, dy: number, dir: 'rtl' | 'ltr'): 'next' | 'prev' | null {
  if (Math.abs(dx) < SWIPE_MIN_PX) return null
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null
  const leftward = dx < 0
  if (dir === 'rtl') return leftward ? 'next' : 'prev'
  return leftward ? 'prev' : 'next'
}
