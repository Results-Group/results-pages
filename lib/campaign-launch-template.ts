/**
 * "תבנית השקת קמפיינים" — the built-in campaign-launch template.
 *
 * Code-defined, like lib/strategy/template.ts and lib/report-template.ts:
 * versioned in git, survives database resets, and evolves together with the
 * section types instead of fossilizing a JSONB snapshot in a template row.
 *
 * Returns API-shaped sections (CampaignSection). The consumer maps them
 * through sectionFromApi() before seeding the editor, so the template can
 * never contain a field the mapper would drop on the next autosave.
 *
 * Client-safe: no server-only imports — the /admin/campaigns/new client page
 * calls this directly.
 *
 * The shape is taken from the launch reports the team hand-builds today
 * (Lafayette Italy — Commercial Launch), tab for tab:
 *
 *   סקירה כללית   → overview stats slide (KPIs + platform cards + summary table)
 *   Meta / Google / TikTok → one full stats slide each, as in the source deck.
 *                    A platform that didn't run is simply deleted; an untouched
 *                    slide still renders its labeled scaffolding, so nothing is
 *                    silently dropped.
 *   הצגת הקמפיין  → divider + creative sections (main film, cuts, graphics)
 *   פריסת התקציב  → divider + distribution plan
 */

import { newDistributionPlan, newDistributionChannel } from './distribution'
import { newStatsKpi, newStatsGroup, newViewFunnel } from './launch-stats'
import type { CampaignSection } from './campaigns'
import type { StatsBlock } from './launch-stats'

const PLATFORMS = ['Meta', 'Google', 'TikTok']

/** Headline numbers every platform reports, for the overview cards. */
const PLATFORM_CARD_LABELS = ['השקעה', 'חשיפות', 'קליקים', 'המרות']

const uid = () => crypto.randomUUID()

function statsSection(title: string, stats: StatsBlock): CampaignSection {
  return { id: uid(), title, mockup_type: 'stats', description: '', copyIds: [], assets: [], stats }
}

function emptySection(title: string, mockup_type: CampaignSection['mockup_type']): CampaignSection {
  return { id: uid(), title, mockup_type, description: '', copyIds: [], assets: [] }
}

/** A per-platform slide: headline KPIs, an engagement card, and a campaign table. */
function platformSlide(
  platform: string,
  kpiLabels: string[],
  engagementLabels: string[],
  tableHeaders: string[],
  funnelTitle?: string,
): CampaignSection {
  return statsSection(platform, {
    kpis: kpiLabels.map(newStatsKpi),
    ...(funnelTitle ? { funnel: newViewFunnel(funnelTitle) } : {}),
    groups: [{ ...newStatsGroup('מעורבות'), kpis: engagementLabels.map(newStatsKpi) }],
    table: { headers: tableHeaders, rows: [] },
  })
}

export function createCampaignLaunchTemplate(): CampaignSection[] {
  return [
    // ── 1. סיכום נתונים ──
    statsSection('סקירה כללית', {
      kpis: [
        newStatsKpi('סה"כ חשיפות'),
        newStatsKpi('סה"כ תפוצה'),
        newStatsKpi('סה"כ צפיות וידאו'),
        newStatsKpi('קליקים'),
        newStatsKpi('סה"כ השקעה'),
        { ...newStatsKpi('המרות'), highlight: true },
      ],
      groups: PLATFORMS.map(name => ({
        ...newStatsGroup(name),
        kpis: PLATFORM_CARD_LABELS.map(newStatsKpi),
      })),
      table: { headers: ['מדד', ...PLATFORMS, 'סה"כ'], rows: [] },
    }),

    platformSlide(
      'Meta Ads',
      ['חשיפות', 'תפוצה', 'צפיות וידאו', 'קליקים על קישור', 'השקעה', 'CPM', 'תדירות', 'המרות'],
      ['רגשות (לייקים)', 'תגובות', 'שיתופים', 'שמירות', 'מעורבות בפוסט', 'עוקבים חדשים'],
      ['קמפיין', 'השקעה', 'חשיפות', 'תפוצה', 'קליקים', 'המרות'],
    ),

    platformSlide(
      'Google Ads',
      ['חשיפות', 'קליקים', 'CTR', 'השקעה', 'צפיות TrueView', 'המרות', 'ROAS'],
      ['לייקים', 'מנויים חדשים', 'זמן צפייה'],
      ['קמפיין', 'השקעה', 'חשיפות', 'קליקים', 'CTR', 'המרות'],
      'YouTube · שימור צפיות',
    ),

    platformSlide(
      'TikTok',
      ['חשיפות', 'תפוצה', 'צפיות ממוקדות', 'קליקים', 'השקעה', 'CPM', 'תדירות', 'עוקבים חדשים'],
      ['לייקים', 'שמירות', 'שיתופים', 'תגובות', 'ביקורי פרופיל'],
      ['קריאייטיב', 'השקעה', 'חשיפות', 'תפוצה', 'צפיות', 'קליקים'],
      'משפך צפיות וידאו',
    ),

    // ── 2. הצגת הקמפיין החדש ──
    emptySection('הצגת הקמפיין החדש', 'divider'),
    emptySection('פרסומת ראשית', 'video'),
    emptySection('וריאציות קצרות', 'video'),
    emptySection('גרפיקות קמפיין', 'instagram_feed'),

    // ── 3. תוכנית השקה ──
    emptySection('תוכנית השקה', 'divider'),
    {
      ...emptySection('פריסת התקציב', 'distribution'),
      plan: {
        ...newDistributionPlan(),
        channels: PLATFORMS.map(name => ({ ...newDistributionChannel(), name })),
      },
    },
  ]
}
