'use client'

import DeckShell from '@/app/_deck/DeckShell'
import { CoverSlide, ClosingSlide } from '@/app/_deck/cover-slide'
import { SectionSlide } from './slides'
import { SECTION_KINDS } from '@/lib/strategy/registry'
import type { StrategySlide } from '@/lib/strategy/slides'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

/**
 * The client-facing brand-positioning deck.
 *
 * Thin by design: DeckShell owns navigation and chrome, and the slide bodies
 * are the same components the admin canvas renders. What is left here is the
 * cover, the closing and the slide labels.
 *
 * No brand-colour injection, deliberately — this is an agency-authored strategy
 * document, and its green/red/yellow carry fixed meaning. A client with a red
 * brand must not end up with red "correct" boxes.
 */

export default function StrategyPresentation({
  slides,
  clientName,
  docName,
  lang = 'he',
}: {
  slides: StrategySlide[]
  clientName: string
  docName: string
  lang?: 'he' | 'en'
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key

  function labelFor(index: number): string {
    const slide = slides[index]
    if (slide.type === 'cover') return t('public.cover')
    if (slide.type === 'closing') return t('public.closing')
    const { section } = slide
    if (section.kind === '__unknown__') return `${t('public.section')} ${index}`
    return section.title || SECTION_KINDS[section.kind].labelKey
  }

  return (
    <DeckShell
      count={slides.length}
      labelFor={labelFor}
      headerTitle={`${clientName} — ${docName}`}
      variantClass="pos-deck"
      lang={lang}
      hideFooterOn={i => slides[i].type === 'closing'}
      renderSlide={i => {
        const slide = slides[i]
        if (slide.type === 'cover') {
          return (
            <CoverSlide
              clientName={slide.clientName}
              headline={slide.docName}
              eyebrow={slide.date}
              logoUrl={slide.logoUrl}
            />
          )
        }
        if (slide.type === 'closing') return <ClosingSlide title="בהצלחה!" clientName={slide.clientName} />
        return <SectionSlide section={slide.section} />
      }}
    />
  )
}
