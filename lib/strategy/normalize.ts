import { SECTION_KINDS, isSectionKind, uid } from './registry'
import type { AnySection, SectionKind, SectionOfKind, StrategySection, UnknownSection } from './types'

/**
 * Turns one stored section into something safe to render.
 *
 * Two rules, and both exist because of a real production incident in the
 * campaign builder (a distribution plan that saved fine, vanished on reload and
 * was wiped on the next publish):
 *
 * 1. **Never drop a key.** Normalization is a spread over the kind's factory,
 *    so a field this deploy has never heard of survives the round-trip instead
 *    of being erased by the next autosave. The campaign builder's mapper listed
 *    fields by hand; a field missing from the list was silently deleted.
 *
 * 2. **Never drop a section.** A `kind` written by a newer deploy is parked in
 *    an UnknownSection that carries the original object, and serialization puts
 *    it back byte-for-byte. An older tab open on a newer document is then
 *    harmless rather than destructive.
 */
export function normalizeSection(raw: unknown): AnySection {
  const input = (raw ?? {}) as { kind?: unknown; id?: unknown }

  if (!isSectionKind(input.kind)) {
    return { kind: '__unknown__', id: typeof input.id === 'string' ? input.id : uid(), raw }
  }

  const kind = input.kind as SectionKind
  const meta = SECTION_KINDS[kind] as { create(): StrategySection; normalize(s: never): StrategySection }
  const merged = {
    ...meta.create(),
    ...(raw as object),
    id: typeof input.id === 'string' && input.id ? input.id : uid(),
  } as never

  return meta.normalize(merged)
}

export function normalizeSections(raw: unknown): AnySection[] {
  return Array.isArray(raw) ? raw.map(normalizeSection) : []
}

/** The value to persist. Unknown sections give back exactly what they came in as. */
export function serializeSection(section: AnySection): unknown {
  return isUnknownSection(section) ? section.raw : section
}

export function serializeSections(sections: AnySection[]): unknown[] {
  return sections.map(serializeSection)
}

export function isUnknownSection(section: AnySection): section is UnknownSection {
  return section.kind === '__unknown__'
}

/** Type guard for narrowing a section to one kind inside a renderer. */
export function isKind<K extends SectionKind>(section: AnySection, kind: K): section is SectionOfKind<K> {
  return section.kind === kind
}
