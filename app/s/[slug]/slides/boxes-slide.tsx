'use client'

import type { BoxesSection } from '@/lib/strategy/types'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/**
 * Three numbered cards. Serves the alternatives map (with pros/cons lists),
 * the founding values and the tone of voice (title + description).
 *
 * The numbers are rendered, never stored — reordering the boxes in the editor
 * renumbers them for free, and there is no field to get out of step. In an RTL
 * deck the grid already places box 1 on the right, so the numbering follows the
 * reading order without any special casing.
 */
export default function BoxesSlide({ section, edit }: SlideProps<BoxesSection>) {
  const hasAny = section.boxes.some(b =>
    b.title.trim() || b.description?.trim() ||
    b.pros?.some(p => p.trim()) || b.cons?.some(c => c.trim()),
  )

  return (
    <div className="pos-boxes-slide">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      {!hasAny && <EmptyHint edit={edit}>מלאו את שלוש התיבות</EmptyHint>}

      <div className="pos-boxes rp-anim rp-up rp-d3">
        {section.boxes.map((box, i) => {
          const pros = (box.pros || []).filter(p => p.trim())
          const cons = (box.cons || []).filter(c => c.trim())
          return (
            <div className="pos-box" key={box.id}>
              <span className="pos-box-num" aria-hidden="true">{i + 1}</span>
              {box.title ? <h3 className="pos-box-title">{box.title}</h3> : null}
              {box.subtitle ? <p className="pos-box-sub">{box.subtitle}</p> : null}
              {box.description ? <p className="pos-box-desc">{box.description}</p> : null}

              {section.variant === 'proscons' && (
                <>
                  {pros.length > 0 && (
                    <ul className="pos-box-list is-pros">
                      {pros.map((p, j) => <li key={j}>{p}</li>)}
                    </ul>
                  )}
                  {cons.length > 0 && (
                    <ul className="pos-box-list is-cons">
                      {cons.map((c, j) => <li key={j}>{c}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
