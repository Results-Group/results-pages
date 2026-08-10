/**
 * "סיכום נתונים" slide (mockup_type 'stats'): types + pure helpers.
 *
 * Client-safe (no `server-only`, no supabase/sharp imports) — both the admin
 * editor and the public presentation import this module, same as
 * lib/distribution.ts, which is the pattern this file mirrors.
 *
 * Every value is a free-text string the operator pastes from the ad platforms
 * ("8,457,214", "₪59,182", "4.30"). Nothing here parses or computes — the
 * numbers on the slide are exactly the numbers the operator typed, so the deck
 * can never disagree with the source report.
 */

export interface StatsKpi {
  id: string
  /** "חשיפות", "השקעה כוללת" */
  label: string
  /** Free text, never parsed: "8,457,214", "₪59,182". */
  value: string
  /** Small print under the value: "בכל הפלטפורמות", "Meta + Google". */
  sublabel?: string
  /** Accent-colored tile — the number the slide is really about (רכישות, ROAS). */
  highlight?: boolean
}

/** A per-platform card: "Meta" / "Google" / "TikTok" with its own KPI list. */
export interface StatsGroup {
  id: string
  title: string
  kpis: StatsKpi[]
}

/** Cross-channel comparison table. Plain string grid — headers drive columns. */
export interface StatsTable {
  headers: string[]
  rows: string[][]
}

/** One step of a video-retention funnel: "25% מהסרטון · 83,960 · 38.04%". */
export interface StatsFunnelStage {
  id: string
  label: string
  value: string
  /** Share of the starting audience, as the operator typed it ("38.04%"). */
  percent?: string
}

export interface StatsFunnel {
  title: string
  stages: StatsFunnelStage[]
}

export interface StatsBlock {
  /** Top KPI grid. */
  kpis: StatsKpi[]
  /** Video-retention funnel (YouTube / TikTok view-through). */
  funnel?: StatsFunnel
  /** Per-platform cards, side by side. */
  groups: StatsGroup[]
  table?: StatsTable
  /** Small print under the slide ("נתונים ממערכות הפרסום, נכון ל-26.06"). */
  note?: string
}

/**
 * A social profile header — the Facebook page / YouTube channel mockups.
 *
 * Lives here rather than in its own module because it is the same kind of
 * thing: a small typed block a section carries alongside its assets, so the
 * editor and the deck agree on the shape.
 *
 * Images are stored as Supabase paths and rendered through assetProxyUrl(),
 * the same as every other campaign asset.
 */
export interface ProfileBlock {
  /** Page / channel name. */
  name: string
  /** "@medera" — YouTube handle or Facebook vanity. */
  handle?: string
  /** Free text under the name: "12.4K עוקבים · 87 סרטונים". */
  meta?: string
  /** Wide cover photo / channel banner. */
  coverPath?: string
  /** Square avatar; rendered as a circle. */
  avatarPath?: string
  /** Short bio line, shown under the name on YouTube. */
  bio?: string
}

export function newProfileBlock(name = ''): ProfileBlock {
  return { name }
}

export function normalizeProfile(p?: ProfileBlock | null): ProfileBlock {
  if (!p || typeof p !== 'object') return newProfileBlock()
  return {
    name: str(p.name),
    ...(p.handle !== undefined ? { handle: str(p.handle) } : {}),
    ...(p.meta !== undefined ? { meta: str(p.meta) } : {}),
    ...(p.coverPath ? { coverPath: str(p.coverPath) } : {}),
    ...(p.avatarPath ? { avatarPath: str(p.avatarPath) } : {}),
    ...(p.bio !== undefined ? { bio: str(p.bio) } : {}),
  }
}

/** A cover slide renders as soon as there is anything to show. */
export function hasProfileContent(p?: ProfileBlock | null): boolean {
  if (!p) return false
  const x = normalizeProfile(p)
  return !!(x.name.trim() || x.coverPath || x.avatarPath)
}

export function newStatsKpi(label = ''): StatsKpi {
  return { id: crypto.randomUUID(), label, value: '' }
}

export function newStatsGroup(title = ''): StatsGroup {
  return { id: crypto.randomUUID(), title, kpis: [] }
}

export function newStatsBlock(): StatsBlock {
  return { kpis: [], groups: [] }
}

export function newFunnelStage(label = ''): StatsFunnelStage {
  return { id: crypto.randomUUID(), label, value: '' }
}

/** The four quartiles both YouTube and TikTok report. */
export const VIEW_FUNNEL_LABELS = ['25% מהסרטון', '50% מהסרטון', '75% מהסרטון', '100% מהסרטון']

export function newViewFunnel(title: string): StatsFunnel {
  return { title, stages: VIEW_FUNNEL_LABELS.map(newFunnelStage) }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function normalizeKpi(raw: unknown): StatsKpi {
  const k = (raw ?? {}) as Partial<StatsKpi>
  return {
    id: str(k.id) || crypto.randomUUID(),
    label: str(k.label),
    value: str(k.value),
    ...(k.sublabel !== undefined ? { sublabel: str(k.sublabel) } : {}),
    ...(k.highlight ? { highlight: true } : {}),
  }
}

/** Tolerates blocks loaded from JSONB that predate a field, or were hand-edited. */
export function normalizeStats(block?: StatsBlock | null): StatsBlock {
  if (!block || typeof block !== 'object') return newStatsBlock()
  const table = block.table
  const funnel = block.funnel
  return {
    kpis: Array.isArray(block.kpis) ? block.kpis.map(normalizeKpi) : [],
    ...(funnel && typeof funnel === 'object'
      ? {
          funnel: {
            title: str(funnel.title),
            stages: Array.isArray(funnel.stages)
              ? funnel.stages.map(s => {
                  const st = (s ?? {}) as Partial<StatsFunnelStage>
                  return {
                    id: str(st.id) || crypto.randomUUID(),
                    label: str(st.label),
                    value: str(st.value),
                    ...(st.percent !== undefined ? { percent: str(st.percent) } : {}),
                  }
                })
              : [],
          },
        }
      : {}),
    groups: Array.isArray(block.groups)
      ? block.groups.map(g => ({
          id: str((g as Partial<StatsGroup>)?.id) || crypto.randomUUID(),
          title: str((g as Partial<StatsGroup>)?.title),
          kpis: Array.isArray((g as Partial<StatsGroup>)?.kpis) ? (g as StatsGroup).kpis.map(normalizeKpi) : [],
        }))
      : [],
    ...(table && typeof table === 'object'
      ? {
          table: {
            headers: Array.isArray(table.headers) ? table.headers.map(str) : [],
            rows: Array.isArray(table.rows) ? table.rows.map(r => (Array.isArray(r) ? r.map(str) : [])) : [],
          },
        }
      : {}),
    ...(block.note !== undefined ? { note: str(block.note) } : {}),
  }
}

const kpiHasContent = (k: StatsKpi) => !!(k.label.trim() || k.value.trim())

/**
 * Whether the slide produces anything at all. Same contract as the
 * distribution slide's hasVisibleContent: an empty stats section renders zero
 * slides, so the client never lands on a blank screen and the editor's slide
 * counter says the same number.
 *
 * Pre-labeled template KPIs with empty values DO count as content — the
 * operator opened the template to fill them, and hiding the slide until a
 * value exists would make the template look broken in the preview.
 */
export function hasStatsContent(block?: StatsBlock | null): boolean {
  if (!block) return false
  const b = normalizeStats(block)
  if (b.kpis.some(kpiHasContent)) return true
  if (b.groups.some(g => g.title.trim() && g.kpis.some(kpiHasContent))) return true
  if (b.funnel && b.funnel.stages.some(s => s.label.trim() || s.value.trim())) return true
  if (b.table && b.table.rows.some(r => r.some(c => c.trim()))) return true
  return false
}

/**
 * Bar widths (percent of the track) for a funnel's stages.
 *
 * Derived from the stage VALUES when every stage parses as a number — the bar
 * is the quantity, so the funnel keeps its true shape even when the `percent`
 * strings carry step-to-step conversion ("66.9% מהמגיעים") rather than
 * share-of-total. Falls back to the percent strings, then to a fixed
 * positional taper. Only the BAR geometry is computed — the text on screen is
 * always the string that was typed.
 *
 * Why not always taper positionally: a retention funnel that really drops
 * 38% → 15% → 11% → 9% drawn as four evenly-shrinking bars reads as a gentle
 * decline, which is the opposite of what the data says. When the numbers are
 * there, the picture should tell the truth.
 */
export function funnelWidths(stages: StatsFunnelStage[]): number[] {
  const n = stages.length
  if (n === 0) return []
  const parseNum = (raw: string) => {
    const v = Number.parseFloat(raw.replace(/[^\d.]/g, ''))
    return Number.isFinite(v) && v > 0 ? v : null
  }
  // All-or-nothing at each level: a half-parsed funnel mixing real and
  // invented proportions would be less honest than an obviously schematic one.
  const scaled = (nums: (number | null)[]) => {
    const max = Math.max(...(nums as number[]))
    // Scaled to the widest stage, floored at 6% so a tiny tail stays visible.
    return (nums as number[]).map(v => Math.max((v / max) * 100, 6))
  }
  const values = stages.map(s => parseNum(s.value || ''))
  if (values.every(v => v !== null)) return scaled(values)
  const percents = stages.map(s => parseNum(s.percent || ''))
  if (percents.every(v => v !== null)) return scaled(percents)
  return stages.map((_, i) => 100 - i * (60 / Math.max(n - 1, 1)))
}
