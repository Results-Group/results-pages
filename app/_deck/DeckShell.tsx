'use client'

import '@/app/c/[slug]/presentation.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { readableAccent, hexToRgba, hexToRgbTriplet } from '@/lib/brand-color'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

/**
 * The chrome every Results deck shares: slide state, keyboard/swipe/parallax,
 * the story progress bars, header, slide index, footer nav and sign-off.
 *
 * Extracted from the campaign presentation so the strategy deck reuses it
 * rather than copying it. The rules below are not stylistic — each one is a
 * production incident, and they must survive any refactor of this file.
 *
 * The caller owns the slides themselves: it says how many there are, how to
 * label one, and how to render one. Everything product-specific (approval
 * bars, lightboxes, banners) arrives through the slot props.
 */

export interface DeckShellProps {
  /** Number of slides. */
  count: number
  /** Human label for slide `i`, used by the progress bars and the index dialog. */
  labelFor: (index: number) => string
  /** Shown top-right, e.g. "Client — Campaign". */
  headerTitle: string
  /**
   * Client brand colour. Lifted for legibility and injected over the theme
   * variables. Pass null/undefined to keep the Results palette — which is what
   * strategy documents do, because their green/red carry fixed meaning.
   */
  brandColor?: string | null
  lang?: 'he' | 'en'
  /** Extra class on the root, e.g. 'pos-deck' for the strategy stylesheet. */
  variantClass?: string
  renderSlide: (index: number) => React.ReactNode
  /** Rendered inside <main> under the slide (campaign: the approval bar). */
  renderBelowSlide?: (index: number) => React.ReactNode
  /** Rendered in the header beside the badge (campaign: approval progress). */
  headerExtra?: React.ReactNode
  /** Rendered last, outside the layout (lightboxes, banners). */
  overlays?: React.ReactNode
  /** Suppress the sign-off footer on some slides (the closing slide has its own). */
  hideFooterOn?: (index: number) => boolean
  /** True while a modal owns the interaction; suppresses keys and swipe. */
  navLocked?: boolean
  onSlideChange?: (index: number) => void
}

/** A drag shorter than this is a tap, not a swipe. */
const SWIPE_MIN_PX = 60

export default function DeckShell({
  count,
  labelFor,
  headerTitle,
  brandColor,
  lang = 'he',
  variantClass,
  renderSlide,
  renderBelowSlide,
  headerExtra,
  overlays,
  hideFooterOn,
  navLocked = false,
  onSlideChange,
}: DeckShellProps) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key

  // A brand colour drives 58 rules here, including the header title and the
  // nav-button hover. Lifted to stay legible on the dark ground — a black brand
  // colour otherwise painted both of them invisible.
  const accent = readableAccent(brandColor)

  const [requestedSlide, setActiveSlide] = useState(0)
  // Clamped during render, not corrected in an effect: the editor's live
  // preview deletes slides underneath this component, and an effect would
  // render one frame pointing past the end of the array first.
  const activeSlide = Math.min(requestedSlide, Math.max(0, count - 1))
  const [showIndex, setShowIndex] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  const goSlide = useCallback((n: number) => {
    setActiveSlide(n)
    onSlideChange?.(n)
    // 'auto', not 'smooth': smooth scrolling is animation-frame driven, so with
    // animations paused the client stayed 1400px down the previous slide.
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [onSlideChange])

  // ── Swipe navigation ──
  // The deck presents like Instagram stories, so a phone user's instinct is to
  // swipe. Direction follows the RTL layout and the on-screen arrows: "next"
  // points left, so a leftward drag advances.
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Never hijack a swipe that belongs to a component's own scroll track
    // (the carousel) or to an interactive slide region (a draggable map).
    if ((e.target as HTMLElement)?.closest?.('.carousel-track, [data-swipe="off"]')) {
      touchStart.current = null
      return
    }
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || navLocked) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Ignore short drags, and anything more vertical than horizontal — that's
    // the reader scrolling a tall slide, not changing slide.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) goSlide(Math.min(count - 1, activeSlide + 1))
    else goSlide(Math.max(0, activeSlide - 1))
  }, [navLocked, activeSlide, count, goSlide])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Interactive slide regions (a draggable positioning map) take the arrow
      // keys for themselves; without this, nudging a logo changes slide.
      if (target?.closest?.('[data-deck-keys="off"]')) return
      if (e.key === 'Escape' && showIndex) { setShowIndex(false); return }
      if (navLocked) return
      // Route through goSlide so keyboard navigation also resets the scroll
      // position — otherwise arrow keys left the reader mid-way down the page.
      if (e.key === 'ArrowLeft') goSlide(Math.min(count - 1, activeSlide + 1))
      if (e.key === 'ArrowRight') goSlide(Math.max(0, activeSlide - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, showIndex, navLocked, activeSlide, goSlide])

  useEffect(() => {
    let rafId = 0
    let pending = false
    function onMove(e: MouseEvent) {
      if (pending) return
      pending = true
      rafId = requestAnimationFrame(() => {
        setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
        pending = false
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafId) }
  }, [])

  const parallaxX = (mousePos.x - 0.5) * -20
  const parallaxY = (mousePos.y - 0.5) * -20

  const indices = Array.from({ length: count }, (_, i) => i)

  /** labelFor may legitimately return '' for an untitled slide. The index
   *  dialog then shows the number alone, but a progress bar still needs
   *  something to announce, so it falls back to "שקף N". */
  const slideName = (i: number) => labelFor(i) || `${t('public.slide')} ${i + 1}`

  return (
    <div
      className={`campaign-pres${variantClass ? ` ${variantClass}` : ''}`}
      style={accent ? ({
        '--brand-cyan': accent,
        '--brand-green': accent,
        '--border-color': `${hexToRgba(accent, 0.14)}`,
        ...(hexToRgbTriplet(accent) ? { '--brand-rgb': hexToRgbTriplet(accent) } : {}),
      } as React.CSSProperties) : undefined}
    >
      {/* Parallax background layers */}
      <div className="bg-noise" />
      <div className="bg-grid" style={{ transform: `translate(${parallaxX * 0.3}px, ${parallaxY * 0.3}px)` }} />
      <div className="ambient-light" style={{ transform: `translate(${parallaxX}px, ${parallaxY}px)` }} />
      <div className="ambient-light-2" style={{ transform: `translate(${parallaxX * -0.6}px, ${parallaxY * -0.6}px)` }} />
      <div className="ambient-light-3" style={{ transform: `translate(${parallaxX * 0.8}px, ${parallaxY * -0.8}px)` }} />

      {/* Story-style progress bars */}
      <div className="story-progress">
        {indices.map(i => (
          <button
            key={i}
            className={`story-bar${i === activeSlide ? ' current' : ''}`}
            onClick={() => goSlide(i)}
            title={slideName(i)}
            aria-label={slideName(i)}
            aria-current={i === activeSlide ? 'step' : undefined}
          >
            <div className={`story-bar-fill ${i < activeSlide ? 'done' : i === activeSlide ? 'active' : ''}`} />
          </button>
        ))}
      </div>

      <header className="pres-header">
        {/* The document takes the prominent slot — it's what the client came to
            read; the agency name sits on the opposite side. */}
        <div className="brand">{headerTitle}</div>
        <div className="header-right">
          {headerExtra}
          <div className="campaign-badge">Results Digital</div>
        </div>
      </header>

      <main className="pres-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Plain section keyed on the slide index: React swaps it immediately
            and the CSS class replays the transition. AnimatePresence with
            mode="wait" held the next slide until the previous one's exit
            animation finished — and when animations are paused (backgrounded
            tab, battery saver) that exit never completed, so the counter
            advanced but the deck never moved. */}
        <section key={activeSlide} className="slide active slide-enter">
          {renderSlide(activeSlide)}
        </section>
        {renderBelowSlide?.(activeSlide)}
      </main>

      {/* Slide index — the practical way to reach a specific slide */}
      {showIndex && (
        <>
          <div className="slide-index-backdrop" onClick={() => setShowIndex(false)} />
          <div className="slide-index" role="dialog" aria-label={t('public.allSlides')}>
            <div className="slide-index-head">{t('public.allSlides')}</div>
            <div className="slide-index-list">
              {indices.map(i => (
                <button
                  key={i}
                  className={`slide-index-item${i === activeSlide ? ' active' : ''}`}
                  onClick={() => { goSlide(i); setShowIndex(false) }}
                >
                  <span className="slide-index-num">{i + 1}</span>
                  {/* Only real titles. A slide the operator never named shows
                      its number alone — an invented "סקציה 4" reads like a
                      name and numbers a different thing than the badge does. */}
                  {labelFor(i) ? <span className="slide-index-name">{labelFor(i)}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom nav arrows */}
      <div className="slide-footer-nav">
        <button onClick={() => goSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className="nav-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          {t('public.previous')}
        </button>
        {/* The counter doubles as the slide index. With 20 slides the header
            bars are ~15px wide each, so jumping to a specific slide by
            tapping a sliver isn't practical at any screen size. */}
        <button
          className="slide-counter"
          onClick={() => setShowIndex(v => !v)}
          aria-expanded={showIndex}
          title={t('public.allSlides')}
        >
          {activeSlide + 1} / {count}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showIndex ? 'rotate(180deg)' : undefined }}>
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button onClick={() => goSlide(Math.min(count - 1, activeSlide + 1))} disabled={activeSlide === count - 1} className="nav-btn">
          {t('public.next')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>

      {/* The closing slide carries its own sign-off, so the global footer
          would just repeat the same contact line underneath it. */}
      {!hideFooterOn?.(activeSlide) && (
        <footer className="pres-footer">
          <a href="https://www.resultsdigital.org" target="_blank" rel="noopener noreferrer">www.resultsdigital.org</a>
          <p>By Results Digital</p>
        </footer>
      )}

      {overlays}
    </div>
  )
}
