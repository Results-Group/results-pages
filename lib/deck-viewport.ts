// Height a mockup may use, measured from where it sits on its slide.
//
// The landing-page and Reels mockups size themselves to the screen height left
// below them, so a slide fits one screen. On the live deck that is the window
// height minus the element's top. In the PDF render every slide is stacked on
// one long page, so the window-relative top of the tenth slide's mockup is ten
// screens down and the budget collapsed to its minimum; measured from the
// mockup's own slide instead, every slide gets the same screen.

/** Pure: the budget left under an element `elTop` px below its slide's top. */
export function remainingHeight(opts: { viewportH: number; elTop: number; slideTop?: number; reserve: number }): number {
  return opts.viewportH - (opts.elTop - (opts.slideTop ?? 0)) - opts.reserve
}

/** The top of the slide `el` sits on, when it sits in a stacked PDF render; 0 on the live deck. */
export function stackedSlideTop(el: Element): number {
  const slide = el.closest('[data-pdf-slide]')
  return slide ? slide.getBoundingClientRect().top : 0
}
