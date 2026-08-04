'use client'

import type { QuestionSection } from '@/lib/strategy/types'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/** The guiding question, set large, followed by the competitive advantages. */
export default function QuestionSlide({ section, edit }: SlideProps<QuestionSection>) {
  const bullets = section.bullets.filter(b => b.trim())

  return (
    <div className="pos-question">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      {section.quote.trim()
        ? <blockquote className="pos-question-quote rp-anim rp-up rp-d3">{section.quote}</blockquote>
        : <EmptyHint edit={edit}>הזינו את השאלה המנחה</EmptyHint>}

      {section.leadIn.trim() ? <p className="pos-question-lead rp-anim rp-up rp-d4">{section.leadIn}</p> : null}

      {bullets.length > 0 && (
        <ul className="pos-bullets rp-anim rp-up rp-d5">
          {bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}
        </ul>
      )}
    </div>
  )
}
