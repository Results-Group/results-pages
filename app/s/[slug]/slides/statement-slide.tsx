'use client'

import { RichText, type RichTextClasses } from '@/app/_deck/rich-text'
import { docIsEmpty } from '@/lib/rich-doc'
import type { StatementSection } from '@/lib/strategy/types'
import { EmptyHint, type SlideProps } from './index'

/**
 * One centred statement. Serves six slides in the spec — the plan's purpose,
 * both transition slides, the negative positioning, the brand values, and the
 * positioning itself, which is the conclusion the whole document builds to and
 * the only place the deck sets type this large.
 */

const CLASSES: RichTextClasses = {
  heading: level => `dist-text-h lvl-${level}`,
  paragraph: 'dist-text-p',
  list: ordered => `dist-text-list${ordered ? ' is-ordered' : ''}`,
}

export default function StatementSlide({ section, edit }: SlideProps<StatementSection>) {
  const isTransition = section.variant === 'transition'
  const empty = docIsEmpty(section.body)

  return (
    <div className={`pos-statement${isTransition ? ' is-transition' : ''}${section.variant === 'hero' ? ' is-hero' : ''}`}>
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
