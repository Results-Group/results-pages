import { emptyDoc } from '@/lib/rich-doc'
import type {
  SectionKind, SectionOfKind, StrategySection,
  MatrixCell, MatrixColumn, MatrixRow, CellTint,
  MapPoint, MapZone,
  InfoSection, BoxesSection, BrandLanguageSection, HeatGaugesSection,
} from './types'

/**
 * One registry per section kind — the single place a kind is described.
 *
 * The campaign builder spreads this across eight parallel lists (MOCKUP_TYPES,
 * mockupLabels, typeIcon, maxAssetsFor, slidesPerSection, two switches and a
 * conditional in the Inspector) that must be updated in lockstep. Here the
 * `satisfies` clause at the bottom makes the compiler enforce completeness:
 * add a kind to the union and every consumer fails to typecheck until filled in.
 *
 * Client-safe. Must NEVER import lib/strategy-docs.ts (which pulls in
 * lib/supabase and is server-only) — the public deck imports this module.
 * Icons are named as strings and resolved to components in the UI layer, so
 * this file stays free of React and can be used from a route handler.
 */

export const uid = () => crypto.randomUUID()

export type IconName =
  | 'Type' | 'List' | 'Table2' | 'Boxes' | 'ScatterChart'
  | 'Quote' | 'Image' | 'Languages' | 'Gauge'

export interface SectionKindMeta<K extends SectionKind = SectionKind> {
  kind: K
  /** i18n key — never a literal string. */
  labelKey: string
  icon: IconName
  /** Offered in the "add slide" menu. Fixed template slides are not. */
  repeatable: boolean
  create(): SectionOfKind<K>
  /**
   * Defensive coercion only — types that would crash a renderer. It must never
   * DROP a key: unknown fields (written by a newer deploy) have to survive.
   */
  normalize(section: SectionOfKind<K>): SectionOfKind<K>
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const TINTS: CellTint[] = ['none', 'white', 'green', 'light', 'alert']

export function emptyCell(): MatrixCell {
  return { text: '', checks: 0, tint: 'none' }
}

function normalizeCell(raw: unknown): MatrixCell {
  const c = (raw ?? {}) as Partial<MatrixCell>
  return {
    ...(raw as object),
    text: str(c.text),
    checks: clamp(Math.round(num(c.checks, 0)), 0, 5),
    tint: TINTS.includes(c.tint as CellTint) ? (c.tint as CellTint) : 'none',
  }
}

/** Columns are the source of truth; every row is padded to match them. */
function normalizeRows(columns: MatrixColumn[], rows: MatrixRow[]): MatrixRow[] {
  const ids = columns.map(c => c.id)
  return rows.map(row => {
    const cells: Record<string, MatrixCell> = {}
    for (const id of ids) cells[id] = normalizeCell(row.cells?.[id])
    return { ...row, id: str(row.id) || uid(), header: str(row.header), cells }
  })
}

export const MATRIX_PRESETS = {
  /** רמת מודעות — parameter + two ✓/empty columns. */
  checks: ['פרמטרים', 'יודע', 'לא יודע'],
  /** זוויות תקיפה — cause + angle. */
  twocol: ['גורם', 'זווית תקיפה'],
} as const

function matrixColumns(labels: readonly string[]): MatrixColumn[] {
  return labels.slice(1).map(label => ({ id: uid(), label }))
}

export function newMatrixRow(columns: MatrixColumn[]): MatrixRow {
  const cells: Record<string, MatrixCell> = {}
  for (const c of columns) cells[c.id] = emptyCell()
  return { id: uid(), header: '', cells }
}

export const SECTION_KINDS = {
  statement: {
    kind: 'statement',
    labelKey: 'strategy.kind.statement',
    icon: 'Type',
    repeatable: true,
    create: () => ({ kind: 'statement' as const, id: uid(), title: '', variant: 'plain' as const, body: emptyDoc() }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      variant: (['plain', 'transition', 'hero'] as const).includes(s.variant) ? s.variant : 'plain',
      body: s.body && typeof s.body === 'object' ? s.body : emptyDoc(),
    }),
  },

  info: {
    kind: 'info',
    labelKey: 'strategy.kind.info',
    icon: 'List',
    repeatable: true,
    create: () => ({
      kind: 'info' as const, id: uid(), title: '', description: '',
      groups: [{ id: uid(), heading: '', bullets: [''] }],
    }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      description: str(s.description),
      groups: arr<InfoGroup>(s.groups).map(g => ({
        ...g,
        id: str(g?.id) || uid(),
        heading: str(g?.heading),
        bullets: arr<string>(g?.bullets).map(b => str(b)),
      })),
    }),
  },

  matrix_table: {
    kind: 'matrix_table',
    labelKey: 'strategy.kind.matrixTable',
    icon: 'Table2',
    repeatable: true,
    create: () => {
      const columns = matrixColumns(['', 'מתחרה 1', 'מתחרה 2'])
      return {
        kind: 'matrix_table' as const, id: uid(), title: '', preset: 'free' as const,
        columns, rows: [newMatrixRow(columns)],
      }
    },
    normalize: s => {
      const preset = (['free', 'checks', 'twocol'] as const).includes(s.preset) ? s.preset : 'free'
      const columns = arr<MatrixColumn>(s.columns).map(c => ({ ...c, id: str(c?.id) || uid(), label: str(c?.label) }))
      return { ...s, title: str(s.title), preset, columns, rows: normalizeRows(columns, arr<MatrixRow>(s.rows)) }
    },
  },

  boxes: {
    kind: 'boxes',
    labelKey: 'strategy.kind.boxes',
    icon: 'Boxes',
    repeatable: true,
    create: () => ({
      kind: 'boxes' as const, id: uid(), title: '', variant: 'plain' as const,
      boxes: [1, 2, 3].map(() => ({ id: uid(), title: '', description: '' })),
    }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      variant: s.variant === 'proscons' ? 'proscons' : 'plain',
      boxes: arr<BoxItem>(s.boxes).map(b => ({
        ...b,
        id: str(b?.id) || uid(),
        title: str(b?.title),
        ...(b?.pros !== undefined ? { pros: arr<string>(b.pros).map(x => str(x)) } : {}),
        ...(b?.cons !== undefined ? { cons: arr<string>(b.cons).map(x => str(x)) } : {}),
      })),
    }),
  },

  positioning_map: {
    kind: 'positioning_map',
    labelKey: 'strategy.kind.positioningMap',
    icon: 'ScatterChart',
    repeatable: true,
    create: () => ({
      kind: 'positioning_map' as const, id: uid(), title: '',
      axisX: { startLabel: '', endLabel: '' },
      axisY: { startLabel: '', endLabel: '' },
      points: [], zones: [],
    }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      axisX: { startLabel: str(s.axisX?.startLabel), endLabel: str(s.axisX?.endLabel) },
      axisY: { startLabel: str(s.axisY?.startLabel), endLabel: str(s.axisY?.endLabel) },
      points: arr<MapPoint>(s.points).map(p => ({
        ...p,
        id: str(p?.id) || uid(),
        label: str(p?.label),
        // Off-plot coordinates would render a logo outside the frame with no
        // way to drag it back.
        x: clamp(num(p?.x, 0), -1, 1),
        y: clamp(num(p?.y, 0), -1, 1),
      })),
      zones: arr<MapZone>(s.zones).map(z => ({
        ...z,
        id: str(z?.id) || uid(),
        cx: clamp(num(z?.cx, 0), -1, 1),
        cy: clamp(num(z?.cy, 0), -1, 1),
        r: clamp(num(z?.r, 0.25), 0.05, 0.9),
      })),
    }),
  },

  question: {
    kind: 'question',
    labelKey: 'strategy.kind.question',
    icon: 'Quote',
    repeatable: true,
    create: () => ({ kind: 'question' as const, id: uid(), title: '', quote: '', leadIn: '', bullets: [''] }),
    normalize: s => ({
      ...s,
      title: str(s.title), quote: str(s.quote), leadIn: str(s.leadIn),
      bullets: arr<string>(s.bullets).map(b => str(b)),
    }),
  },

  split_media: {
    kind: 'split_media',
    labelKey: 'strategy.kind.splitMedia',
    icon: 'Image',
    repeatable: true,
    create: () => ({
      kind: 'split_media' as const, id: uid(), title: '',
      mediaSide: 'start' as const, boxTitle: '', boxDescription: '',
    }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      mediaSide: s.mediaSide === 'end' ? 'end' : 'start',
      boxTitle: str(s.boxTitle),
      boxDescription: str(s.boxDescription),
    }),
  },

  brand_language: {
    kind: 'brand_language',
    labelKey: 'strategy.kind.brandLanguage',
    icon: 'Languages',
    repeatable: true,
    create: () => ({
      kind: 'brand_language' as const, id: uid(), title: '',
      positives: [1, 2, 3, 4, 5].map(() => ({ id: uid(), phrase: '', description: '' })),
      negative: { description: '' },
    }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      positives: arr<PositiveItem>(s.positives).map(p => ({
        ...p, id: str(p?.id) || uid(), phrase: str(p?.phrase), description: str(p?.description),
      })),
      negative: { ...(s.negative ?? {}), description: str(s.negative?.description) },
    }),
  },

  heat_gauges: {
    kind: 'heat_gauges',
    labelKey: 'strategy.kind.heatGauges',
    icon: 'Gauge',
    repeatable: true,
    create: () => ({
      kind: 'heat_gauges' as const, id: uid(), title: '',
      gauges: HEAT_GAUGE_DEFAULTS.map(g => ({ id: uid(), ...g, value: 5 })),
    }),
    normalize: s => ({
      ...s,
      title: str(s.title),
      gauges: arr<GaugeLike>(s.gauges).map(g => ({
        ...g,
        id: str(g?.id) || uid(),
        heading: str(g?.heading),
        minLabel: str(g?.minLabel),
        maxLabel: str(g?.maxLabel),
        // Half-steps: the editor's slider uses step 0.5, and a value off that
        // grid renders a thumb that can't be reached again by dragging.
        value: clamp(Math.round(num(g?.value, 5) * 2) / 2, 0, 10),
      })),
    }),
  },
} satisfies { [K in SectionKind]: SectionKindMeta<K> }

/** The five gauges from the spec. Also used when a gauge slide is added later. */
export const HEAT_GAUGE_DEFAULTS = [
  { heading: 'מיקוד לקוחות', minLabel: 'קיימים', maxLabel: 'חדשים' },
  { heading: 'הצעת מכר', minLabel: 'קרה', maxLabel: 'חמה' },
  { heading: 'ביסוס המותג', minLabel: 'חדש', maxLabel: 'מבוסס' },
  { heading: 'קריאייטיב', minLabel: 'פורמלי', maxLabel: 'משוגע' },
  { heading: 'יעד פרסומי', minLabel: 'Value', maxLabel: 'Volume' },
]

/** The nine technical-information titles offered by the spec. */
export const INFO_TITLE_PRESETS = [
  'מה?',
  'מוצרים / שירותים',
  'תהליך',
  'צרכי הקהל',
  'פחדים',
  'מניעים בבחירת מותג',
  'למה?',
  'למה לא?',
  'מי?',
]

export const ALL_SECTION_KINDS = Object.keys(SECTION_KINDS) as SectionKind[]

export function isSectionKind(v: unknown): v is SectionKind {
  return typeof v === 'string' && v in SECTION_KINDS
}

/** Builds a matrix section locked to one of the fixed-column presets. */
export function createPresetMatrix(preset: 'checks' | 'twocol', rows = 3): StrategySection {
  const labels = MATRIX_PRESETS[preset]
  const columns = matrixColumns(labels)
  return {
    kind: 'matrix_table', id: uid(), title: '', preset, columns,
    rows: Array.from({ length: rows }, () => newMatrixRow(columns)),
  }
}

/** The first column's header label for a preset table. */
export function matrixHeaderLabel(section: { preset: string }): string {
  if (section.preset === 'checks') return MATRIX_PRESETS.checks[0]
  if (section.preset === 'twocol') return MATRIX_PRESETS.twocol[0]
  return ''
}

// Element types of the union's own arrays. Declared here so the normalizers
// map over the real shape — a hand-written loose type would fight the spread
// that keeps unknown (newer-deploy) keys alive.
type InfoGroup = InfoSection['groups'][number]
type BoxItem = BoxesSection['boxes'][number]
type PositiveItem = BrandLanguageSection['positives'][number]
type GaugeLike = HeatGaugesSection['gauges'][number]
