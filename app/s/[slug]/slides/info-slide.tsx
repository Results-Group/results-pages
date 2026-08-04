'use client'

import type { InfoSection } from '@/lib/strategy/types'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/**
 * A technical-information slide: description, then bullet groups.
 *
 * A group whose heading is empty renders as a bare list, so one shape covers
 * both "just bullets" and "sub-headings with bullets" without a second type.
 */
export default function InfoSlide({ section, edit }: SlideProps<InfoSection>) {
  const groups = section.groups.filter(g => g.heading.trim() || g.bullets.some(b => b.trim()))

  return (
    <div className="pos-info">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      {section.description ? (
        <p className="slide-intro rp-anim rp-up rp-d2">{section.description}</p>
      ) : null}

      {groups.length === 0 ? (
        <EmptyHint edit={edit}>הוסיפו בולטים או כותרות משנה</EmptyHint>
      ) : (
        <div className="pos-info-groups rp-anim rp-up rp-d3">
          {groups.map(group => {
            const bullets = group.bullets.filter(b => b.trim())
            return (
              <div key={group.id}>
                {group.heading.trim() ? (
                  <h3 className="pos-info-group-heading">{group.heading}</h3>
                ) : null}
                {bullets.length > 0 && (
                  <ul className="pos-bullets">
                    {bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
