/**
 * Brand-positioning deck — the section model.
 *
 * Client-safe: types only, no imports that reach `server-only`. The admin
 * editor, the public deck, the API routes and the tests all read this.
 *
 * A **discriminated union on `kind`**, deliberately, rather than the wide
 * optional-field struct the campaign builder uses. That shape is what made
 * `sectionFromApi` a data-loss trap: the editor autosaves the document it
 * loaded, so a field the loader forgot to copy was erased on the next save.
 * Here a section object *is* the wire shape, so it round-trips untouched and
 * there is no field list to keep in sync.
 */

import type { PlanDoc } from '@/lib/rich-doc'

/** An uploaded image referenced from inside a section payload. */
export interface StrategyImage {
  /** Supabase storage path — rendered through assetProxyUrl(). */
  file_path: string
  /** Alt text. Required in the editor: these carry meaning, not decoration. */
  alt?: string
}

export type SectionKind =
  | 'statement'
  | 'info'
  | 'matrix_table'
  | 'boxes'
  | 'positioning_map'
  | 'question'
  | 'split_media'
  | 'brand_language'
  | 'heat_gauges'

/** Fields every section carries, whatever its kind. */
interface SectionBase {
  id: string
  title: string
  subtitle?: string
}

// ── statement ────────────────────────────────────────────────────────────────
// Spec #2 מטרת התכנית · #5 פרופיל להובלת שוק · #11 המיצוב · #14 מיצוב שלילי
// · #16 ערכי המותג · #20b קונספטים. They all render one centred statement;
// `variant` is the only thing that differs.
export interface StatementSection extends SectionBase {
  kind: 'statement'
  /** 'hero' is the המיצוב slide — the most important one in the deck. */
  variant: 'plain' | 'transition' | 'hero'
  body: PlanDoc
}

// ── info ─────────────────────────────────────────────────────────────────────
// Spec #3, repeatable, nine preset titles.
export interface InfoSection extends SectionBase {
  kind: 'info'
  description: string
  /**
   * A sub-heading with its bullets. A group with an empty heading renders as a
   * bare bullet list, which is the plain case — so one shape covers both
   * "bullets" and "sub-headings with bullets".
   */
  groups: { id: string; heading: string; bullets: string[] }[]
}

// ── matrix_table ─────────────────────────────────────────────────────────────
// Spec #7 המתחרים ע"פ Facing · #8 פרופיל להובלת שוק (free), #4 רמת מודעות
// (checks preset), #13/#15 זוויות תקיפה (twocol preset).
export type CellTint = 'none' | 'white' | 'green' | 'light' | 'alert'

export interface MatrixCell {
  text: string
  /** Number of ✓ marks. The spec allows "one or more". 0 = none. */
  checks: number
  tint: CellTint
}

export interface MatrixColumn {
  id: string
  /** Always set — it is the logo's alt text as well as the visible label. */
  label: string
  logo?: StrategyImage
}

export interface MatrixRow {
  id: string
  header: string
  /**
   * Keyed by column id, never by index. With an index-parallel array, removing
   * or reordering a column silently shifts every row's data by one — the deck
   * still renders, so nobody notices until a client sees a competitor credited
   * with the wrong capability.
   */
  cells: Record<string, MatrixCell>
}

export interface MatrixTableSection extends SectionBase {
  kind: 'matrix_table'
  /**
   * 'free'   — add/remove columns, logos, tints (Facing).
   * 'checks' — three fixed columns: parameter + two ✓/empty (רמת מודעות).
   * 'twocol' — two fixed free-text columns (זוויות תקיפה).
   */
  preset: 'free' | 'checks' | 'twocol'
  columns: MatrixColumn[]
  rows: MatrixRow[]
}

// ── boxes ────────────────────────────────────────────────────────────────────
// Spec #6 מפת ברירות (proscons) · #12 ערכים מכוננים · #17 Tone Of Voice (plain).
export interface BoxesSection extends SectionBase {
  kind: 'boxes'
  variant: 'plain' | 'proscons'
  /** Numbering (1,2,3 right-to-left) is a render concern and never stored. */
  boxes: {
    id: string
    title: string
    subtitle?: string
    description?: string
    pros?: string[]
    cons?: string[]
  }[]
}

// ── positioning_map ──────────────────────────────────────────────────────────
// Spec #9 מפת המיצוב בשוק.
export interface MapPoint {
  id: string
  label: string
  logo?: StrategyImage
  /**
   * Centre-origin normalized space, -1..1. x:+1 is the visual RIGHT edge,
   * y:+1 the TOP. Centre-origin because the axes cross in the middle, so 0
   * must mean "sitting on the axis" at any plot size — and normalized because
   * a pixel coordinate saved on a 1440px screen lands off-canvas on a laptop.
   */
  x: number
  y: number
}

export interface MapZone {
  id: string
  cx: number
  cy: number
  /** Radius as a fraction of the plot's shorter side. */
  r: number
}

export interface PositioningMapSection extends SectionBase {
  kind: 'positioning_map'
  /** `start` is the end a Hebrew reader meets first: the RIGHT edge, the BOTTOM. */
  axisX: { startLabel: string; endLabel: string }
  axisY: { startLabel: string; endLabel: string }
  points: MapPoint[]
  /** The spec asks for one highlight circle; an array costs nothing and
   *  avoids a data migration if a second is ever wanted. */
  zones: MapZone[]
}

// ── question ─────────────────────────────────────────────────────────────────
// Spec #10 השאלה.
export interface QuestionSection extends SectionBase {
  kind: 'question'
  quote: string
  /** The fixed lead-in above the bullets. Stored rather than hard-coded so it
   *  can be corrected without a deploy; the template seeds it. */
  leadIn: string
  bullets: string[]
}

// ── split_media ──────────────────────────────────────────────────────────────
// Spec #18 דמות המותג (media on the right) · #21 קונספט (media on the left).
export interface SplitMediaSection extends SectionBase {
  kind: 'split_media'
  /** RTL deck: 'start' is the visually-right half. */
  mediaSide: 'start' | 'end'
  image?: StrategyImage
  boxTitle: string
  boxDescription: string
}

// ── brand_language ───────────────────────────────────────────────────────────
// Spec #19 שפת מותג.
export interface BrandLanguageSection extends SectionBase {
  kind: 'brand_language'
  /** Rendered as `איך המותג אומר "${phrase}"?` — the template lives in the
   *  renderer, never baked into stored data. */
  positives: { id: string; phrase: string; description: string }[]
  /** The red box. Its fixed title lives in the renderer too. */
  negative: { description: string }
}

// ── heat_gauges ──────────────────────────────────────────────────────────────
// Spec #20 סקירת מותג באמצעות מדדי חום.
export interface HeatGaugesSection extends SectionBase {
  kind: 'heat_gauges'
  gauges: {
    id: string
    heading: string
    /** Label under the 0 end / under the 10 end. */
    minLabel: string
    maxLabel: string
    /** 0..10, step 0.5. */
    value: number
  }[]
}

export type StrategySection =
  | StatementSection
  | InfoSection
  | MatrixTableSection
  | BoxesSection
  | PositioningMapSection
  | QuestionSection
  | SplitMediaSection
  | BrandLanguageSection
  | HeatGaugesSection

/** Narrowing helper: the section type for a given kind. */
export type SectionOfKind<K extends SectionKind> = Extract<StrategySection, { kind: K }>

/**
 * A section written by a newer deploy than the one reading it. Kept verbatim
 * so an old client round-trips it back untouched instead of deleting it — the
 * forward-compatibility guarantee the campaign builder lacked.
 */
export interface UnknownSection {
  kind: '__unknown__'
  id: string
  raw: unknown
}

export type AnySection = StrategySection | UnknownSection

export interface StrategyDocMeta {
  client: string
  clientId: string | null
  docName: string
  logoPath: string | null
  logoUrl: string | null
  workspaceId: string | null
}

export interface StrategyDocument {
  meta: StrategyDocMeta
  sections: AnySection[]
}
