'use client'

import type { BrandLanguageSection } from '@/lib/strategy/types'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/** The fixed title of the red box. Kept here, never in stored data. */
const NEGATIVE_TITLE = 'מינוחים לא נכונים:'

/** The green boxes' title template. Same reasoning. */
const positiveTitle = (phrase: string) => `איך המותג אומר ״${phrase}״?`

/**
 * Five green boxes for the phrasings the brand uses, and one red box for the
 * ones it avoids.
 *
 * The border colours come from --results-green and a literal red, not from
 * --brand-green: the client's brand colour overwrites that variable at runtime,
 * and a client with a red brand would get five red "correct" boxes sitting next
 * to a red "incorrect" one.
 */
export default function BrandLanguageSlide({ section, edit }: SlideProps<BrandLanguageSection>) {
  const positives = section.positives.filter(p => p.phrase.trim() || p.description.trim())
  const hasNegative = section.negative.description.trim().length > 0

  return (
    <div className="pos-lang-slide">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      {positives.length === 0 && !hasNegative && (
        <EmptyHint edit={edit}>מלאו את המינוחים של המותג</EmptyHint>
      )}

      <div className="pos-lang rp-anim rp-up rp-d3">
        {positives.map(item => (
          <div className="pos-lang-box" key={item.id}>
            {item.phrase.trim() ? <h3 className="pos-lang-title">{positiveTitle(item.phrase)}</h3> : null}
            {item.description.trim() ? <p className="pos-lang-desc">{item.description}</p> : null}
          </div>
        ))}

        {hasNegative && (
          <div className="pos-lang-box is-negative">
            <h3 className="pos-lang-title">{NEGATIVE_TITLE}</h3>
            <p className="pos-lang-desc">{section.negative.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
