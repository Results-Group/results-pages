'use client'

import { assetProxyUrl } from '@/lib/asset-url'
import type { SplitMediaSection } from '@/lib/strategy/types'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/**
 * Image on one side, text on the other. Serves the brand persona (image right)
 * and the concept slide (image left).
 *
 * On mobile the image always comes first, whichever side it takes on desktop —
 * alternating sides on a phone reads as random rather than as rhythm. The CSS
 * handles that; nothing here needs to know.
 */
export default function SplitMediaSlide({ section, edit }: SlideProps<SplitMediaSection>) {
  const src = section.image?.file_path ? assetProxyUrl(section.image.file_path) : ''

  return (
    <div className="pos-split-slide">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      <div className={`pos-split rp-anim rp-up rp-d3${section.mediaSide === 'end' ? ' is-media-end' : ''}`}>
        <div className="pos-split-media">
          {src
            /* eslint-disable-next-line @next/next/no-img-element -- served
               through our own /api/asset proxy, which handles format negotiation */
            ? <img src={src} alt={section.image?.alt || section.boxTitle || section.title} />
            : <EmptyHint edit={edit}>העלו תמונה</EmptyHint>}
        </div>

        <div className="pos-split-body">
          {section.boxTitle ? <h3 className="pos-split-title">{section.boxTitle}</h3> : null}
          {section.boxDescription
            ? <p className="pos-split-desc">{section.boxDescription}</p>
            : <EmptyHint edit={edit}>הזינו כותרת ותיאור</EmptyHint>}
        </div>
      </div>
    </div>
  )
}
