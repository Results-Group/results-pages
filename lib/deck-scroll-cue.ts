/**
 * "Ad 1 of 2 · more below" — the state behind the phone-only cue on a
 * creatives slide. Pure, so the threshold can be tested.
 *
 * On a phone the creatives stack vertically and one feed mockup is taller
 * than the screen, so the second ad sat below the fixed footer nav with
 * nothing on screen to say it existed. Clients reported "there was only one
 * ad". The cue names how many there are and jumps to the next one.
 */

export interface ScrollCueState {
  /** How many stacked cards the reader has reached, counting from the top. */
  reached: number
  showCue: boolean
  /** Index of the first card not yet reached — the jump target. */
  nextIndex: number | null
}

/**
 * A card counts as reached once its top edge sits in the upper 60% of the
 * viewport. Merely peeking in at the bottom is not "reached": the tighter
 * phone stack deliberately lets the next card's top edge show, and the cue
 * must stay up until the reader actually gets there.
 */
export const REACHED_FRACTION = 0.6

export function scrollCueState(cardTops: number[], viewportHeight: number): ScrollCueState {
  const limit = viewportHeight * REACHED_FRACTION
  // Cards are stacked in order, so the reached ones are always a prefix.
  let reached = 0
  for (const top of cardTops) {
    if (top < limit) reached++
    else break
  }
  const showCue = cardTops.length > 1 && reached < cardTops.length
  return { reached, showCue, nextIndex: showCue ? reached : null }
}
