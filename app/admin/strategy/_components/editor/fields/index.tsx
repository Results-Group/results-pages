'use client'

import type { SectionKind, SectionOfKind, AnySection } from '@/lib/strategy/types'
import StatementFields from './StatementFields'
import InfoFields from './InfoFields'
import MatrixTableFields from './MatrixTableFields'
import BoxesFields from './BoxesFields'
import PositioningMapFields from './PositioningMapFields'
import QuestionFields from './QuestionFields'
import SplitMediaFields from './SplitMediaFields'
import BrandLanguageFields from './BrandLanguageFields'
import HeatGaugesFields from './HeatGaugesFields'

/**
 * The Inspector panel for each section kind.
 *
 * Keyed by kind like SLIDE_RENDERERS, and typed the same way — adding a kind to
 * the union makes this object fail to compile until its editor exists. That is
 * the whole point of the registry: the compiler keeps the parallel lists in
 * step instead of a checklist in someone's head.
 */

export interface FieldProps<S extends AnySection = AnySection> {
  section: S
  /** Patches the section. The document store merges, so send only what changed. */
  onChange: (patch: Record<string, unknown>) => void
  /** Document id — needed by the panels that upload images. */
  docId: string | null
  /** Creates the document if it doesn't exist yet, so an upload has a folder. */
  ensureDoc: () => Promise<string | null>
}

type FieldComponents = { [K in SectionKind]: React.ComponentType<FieldProps<SectionOfKind<K>>> }

export const FIELD_COMPONENTS: FieldComponents = {
  statement: StatementFields,
  info: InfoFields,
  matrix_table: MatrixTableFields,
  boxes: BoxesFields,
  positioning_map: PositioningMapFields,
  question: QuestionFields,
  split_media: SplitMediaFields,
  brand_language: BrandLanguageFields,
  heat_gauges: HeatGaugesFields,
}

export function SectionFields(props: FieldProps) {
  if (props.section.kind === '__unknown__') {
    return (
      <p className="text-xs leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
        שקף מסוג שאינו מוכר לגרסה הזו. הוא נשמר כפי שהוא ולא ייפגע — רעננו את הדף
        או עדכנו את המערכת כדי לערוך אותו.
      </p>
    )
  }
  const Fields = FIELD_COMPONENTS[props.section.kind] as React.ComponentType<FieldProps>
  return <Fields {...props} />
}
