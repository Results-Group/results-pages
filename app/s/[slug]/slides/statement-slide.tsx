'use client'

import { RichText, type RichTextClasses } from '@/app/_deck/rich-text'
import { docIsEmpty } from '@/lib/rich-doc'
import type { StatementSection } from '@/lib/strategy/types'
import { EmptyHint, type SlideProps } from './index'

/**
 * One centred statement. Serves six slides in the spec — the plan's purpose,
 * both transition slides, the negative positioning, the brand values, and the
 * positioning itself.
 *
 * The `hero` variant is the המיצוב slide: the conclusion the whole document
 * builds toward, and the one the client will screenshot. It gets its own
 * treatment — framed, vertically centred, with the statement set as a pull
 * quote — rather than being the plain variant at a larger font size.
 */

const CLASSES: RichTextClasses = {
  heading: level => `dist-text-h lvl-${level}`,
  paragraph: 'dist-text-p',
  list: ordered => `dist-text-list${ordered ? ' is-ordered' : ''}`,
}

export default function StatementSlide({ section, edit }: SlideProps<StatementSection>) {
  const empty = docIsEmpty(section.body)

  if (section.variant === 'hero') {
    return (
      <div className="pos-hero">
        {/* Inset frame and glow, echoing the cover — this slide is the other
            bookend of the document. */}
        <div className="pos-hero-frame" aria-hidden="true" />
        <div className="pos-hero-glow" aria-hidden="true" />
        <div className="pos-hero-corner tr" aria-hidden="true" />
        <div className="pos-hero-corner bl" aria-hidden="true" />

        <div className="pos-hero-inner">
          {section.title ? <span className="pos-hero-kicker rp-anim rp-in rp-d1">{section.title}</span> : null}
          {section.subtitle ? <p className="pos-hero-sub rp-anim rp-up rp-d2">{section.subtitle}</p> : null}

          <div className="pos-hero-quote rp-anim rp-up rp-d3">
            {empty
              ? <EmptyHint edit={edit}>נסחו כאן את המיצוב</EmptyHint>
              : <RichText doc={section.body} classes={CLASSES} />}
          </div>

          <div className="pos-hero-rule rp-anim rp-wipe rp-d4" aria-hidden="true" />
        </div>
      </div>
    )
  }

  const isTransition = section.variant === 'transition'

  return (
    <div className={`pos-statement${isTransition ? ' is-transition' : ''}`}>
      {section.title ? (
        isTransition
          ? <h2 className="pos-statement-title rp-anim rp-scale rp-d1">{section.title}</h2>
          : <h2 className="slide-title rp-anim rp-in rp-d1" style={{ justifyContent: 'center' }}>{section.title}</h2>
      ) : null}

      {section.subtitle ? <p className="pos-sub rp-anim rp-up rp-d2">{section.subtitle}</p> : null}

      <div className="pos-statement-body rp-anim rp-up rp-d3">
        {empty
          ? <EmptyHint edit={edit}>הזינו את הטקסט של השקף</EmptyHint>
          : <RichText doc={section.body} classes={CLASSES} />}
      </div>
    </div>
  )
}
