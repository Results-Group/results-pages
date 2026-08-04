'use client'

import type { HeatGaugesSection } from '@/lib/strategy/types'
import { SlideHeader, type SlideProps } from './index'

/**
 * Five 0–10 gauges describing the brand's stance.
 *
 * In the editor each one is a native <input type="range">, restyled — not a
 * hand-rolled pointer drag. A gauge *is* a slider, so the native control brings
 * keyboard support (arrows, Home/End, PageUp/Down), the correct ARIA role and
 * screen-reader value announcement for free. (The positioning map is the
 * opposite call, for the opposite reason: a scatter plot is not a slider.)
 *
 * For the client it is a plain div with role="meter" — not role="slider", which
 * a screen-reader user could focus but not operate.
 */
/** 0–10, rendered under every track. */
const SCALE = Array.from({ length: 11 }, (_, i) => i)

export default function HeatGaugesSlide({ section, edit }: SlideProps<HeatGaugesSection>) {
  const setValue = (id: string, value: number, commit: boolean) => {
    const gauges = section.gauges.map(g => (g.id === id ? { ...g, value } : g))
    // While dragging, only preview. Writing to the document on every frame
    // would hammer the autosave and trip its 409 conflict latch, which locks
    // the editor until the operator reloads.
    if (commit) edit?.onChange({ gauges })
    else edit?.onPreview?.({ gauges })
  }

  return (
    <div className="pos-gauges-slide">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      <div className="pos-gauges rp-anim rp-up rp-d3">
        {section.gauges.map(gauge => {
          const pct = (gauge.value / 10) * 100
          return (
            <div className="pos-gauge" key={gauge.id}>
              <h3 className="pos-gauge-heading">{gauge.heading}</h3>

              <div className="pos-gauge-body">
                {edit ? (
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={gauge.value}
                    aria-label={gauge.heading}
                    className="pos-gauge-range"
                    style={{ ['--fill' as string]: `${pct}%` }}
                    onInput={e => setValue(gauge.id, Number(e.currentTarget.value), false)}
                    onChange={e => setValue(gauge.id, Number(e.currentTarget.value), false)}
                    onPointerUp={e => setValue(gauge.id, Number(e.currentTarget.value), true)}
                    onBlur={e => setValue(gauge.id, Number(e.currentTarget.value), true)}
                    onKeyUp={e => setValue(gauge.id, Number(e.currentTarget.value), true)}
                  />
                ) : (
                  <div
                    className="pos-gauge-track"
                    role="meter"
                    aria-valuenow={gauge.value}
                    aria-valuemin={0}
                    aria-valuemax={10}
                    aria-label={`${gauge.heading}: ${gauge.minLabel} עד ${gauge.maxLabel}`}
                  >
                    <div className="pos-gauge-fill" style={{ width: `${pct}%` }} />
                    <div className="pos-gauge-thumb" style={{ left: `${pct}%` }} />
                  </div>
                )}

                {/* The 0–10 scale, so a reader can name the value rather than
                    only compare bar lengths. */}
                <div className="pos-gauge-scale" aria-hidden="true">
                  {SCALE.map(n => (
                    <span key={n} className={n <= gauge.value ? 'is-passed' : undefined}>{n}</span>
                  ))}
                </div>

                <div className="pos-gauge-ends">
                  <span>{gauge.minLabel}</span>
                  <span>{gauge.maxLabel}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
