import { docFromLines } from '@/lib/rich-doc'
import {
  SECTION_KINDS, INFO_TITLE_PRESETS, createPresetMatrix, uid,
} from './registry'
import type { StrategySection } from './types'

/**
 * The brand-positioning deck, as specified.
 *
 * A new document opens with the whole thing already laid out — titles, fixed
 * copy and empty structure — and the operator edits, reorders or deletes.
 * Nothing here is enforced after creation; it is a starting point, not a schema.
 *
 * Client-safe (no server-only imports) so the API route, the admin "new" page
 * and the tests can all call it. Same split as lib/report-template.ts.
 */

/** Cover and closing are derived from document metadata, not stored sections. */
export const SYSTEM_SLIDES = 2

const statement = (
  title: string,
  variant: 'plain' | 'transition' | 'hero',
  ...lines: string[]
): StrategySection => ({
  ...SECTION_KINDS.statement.create(),
  id: uid(),
  title,
  variant,
  body: docFromLines(...lines),
})

const info = (title: string): StrategySection => ({
  ...SECTION_KINDS.info.create(),
  id: uid(),
  title,
})

const boxes = (
  title: string,
  subtitle: string,
  variant: 'plain' | 'proscons',
): StrategySection => ({
  ...SECTION_KINDS.boxes.create(),
  id: uid(),
  title,
  subtitle,
  variant,
  ...(variant === 'proscons'
    ? { boxes: [1, 2, 3].map(() => ({ id: uid(), title: '', subtitle: '', pros: [''], cons: [''] })) }
    : {}),
})

const matrix = (title: string, subtitle: string): StrategySection => ({
  ...SECTION_KINDS.matrix_table.create(),
  id: uid(),
  title,
  subtitle,
})

const presetMatrix = (
  title: string,
  subtitle: string,
  preset: 'checks' | 'twocol',
): StrategySection => ({
  ...createPresetMatrix(preset),
  title,
  subtitle,
})

const FACING_SUBTITLE = 'מיצוב מדויק ובולט = יתרונות המותג + מרווח בשוק הקיים'

export function createBrandPositioningTemplate(): StrategySection[] {
  return [
    // 2 — מטרת התכנית
    statement(
      'מטרת התכנית',
      'plain',
      'מיצוב המותג הינו בסיס לפעילות בכלל הערוצים ומטרתו להוות שלד לכל ההחלטות בהמשך.',
      'חלקו הראשון מציג בעיקרו מידע טכני מפורט, שעל בסיסו נוסח וגובש מיצוב המותג (משלבי המיצוב ואילך).',
    ),

    // 3 — the nine technical-information slides
    ...INFO_TITLE_PRESETS.map(info),

    // 4 — רמת מודעות
    presetMatrix('רמת מודעות', 'מה הקהל יודע, ומה עדיין לא', 'checks'),

    // 5 — transition
    statement(
      'פרופיל להובלת שוק',
      'transition',
      'על מנת לבנות פרופיל מדויק להובלת שוק, יש לבחון את מפת המתחרים ועל בסיס המרווחים – להגדיר מיצוב אפקטיבי.',
    ),

    // 6 — מפת ברירות
    boxes('מפת ברירות', 'מהן הברירות העומדות כיום בפני לקוחות המותג', 'proscons'),

    // 7 + 8 — the two Facing tables
    matrix('המתחרים ע״פ Facing', FACING_SUBTITLE),
    matrix('פרופיל להובלת שוק', FACING_SUBTITLE),

    // 9 — מפת המיצוב בשוק
    {
      ...SECTION_KINDS.positioning_map.create(),
      id: uid(),
      title: 'מפת המיצוב בשוק',
      subtitle: 'ע״ב יתרונות ב-Facing (הנפוצים ע״י מתחרים)',
    },

    // 10 — השאלה
    {
      ...SECTION_KINDS.question.create(),
      id: uid(),
      title: 'השאלה',
      subtitle: 'השאלה שמנחה את הלקוח בבחירת המותג האידיאלי',
      leadIn: 'לכן יש לשים דגש על היתרונות התחרותיים שמתמקדים בפרמטרים המרכזיים בשאלה:',
    },

    // 11 — המיצוב (the most important slide in the deck)
    statement('מיצוב', 'hero'),

    // 12 — ערכים מכוננים
    boxes('ערכים מכוננים', 'אילו ערכים באים לידי ביטוי במוצר?', 'plain'),

    // 13 — זוויות תקיפה
    presetMatrix('זוויות תקיפה', 'כך נתקוף את שלושת הגורמים העיקריים שמניעים לקוח בבחירת מותג', 'twocol'),

    // 14 — מיצוב שלילי
    statement('מיצוב שלילי', 'plain'),

    // 15 — זוויות תקיפה (against the negative positioning)
    presetMatrix('זוויות תקיפה', 'כך נמנע אסטרטגית את התפתחותו של המיצוב השלילי', 'twocol'),

    // 16 — ערכי המותג
    statement('ערכי המותג', 'plain'),

    // 17 — Tone Of Voice
    boxes('Tone Of Voice', 'באיזה טון המותג מדבר?', 'plain'),

    // 18 — דמות המותג
    {
      ...SECTION_KINDS.split_media.create(),
      id: uid(),
      title: 'דמות המותג',
      subtitle: 'אם המותג היה דמות אנושית, מה היו הקווים לדמותה?',
      mediaSide: 'start',
    },

    // 19 — שפת מותג
    {
      ...SECTION_KINDS.brand_language.create(),
      id: uid(),
      title: 'שפת מותג',
      subtitle: 'באילו מינוחים המותג משתמש, ומאילו הוא נמנע?',
    },

    // 20 — סקירת מותג
    {
      ...SECTION_KINDS.heat_gauges.create(),
      id: uid(),
      title: 'סקירת מותג',
      subtitle: 'באמצעות מדדי חום',
    },

    // 20b — transition
    statement(
      'קונספטים',
      'transition',
      'מטרתם לבנות עטיפה רעיונית המעצימה את המיצוב דרך הפרסום.',
    ),

    // 21 — the concept slide
    {
      ...SECTION_KINDS.split_media.create(),
      id: uid(),
      title: 'קונספט',
      mediaSide: 'end',
    },
  ]
}

/** Sections in a fresh document. Asserted in tests so the spec can't drift silently. */
export const TEMPLATE_SECTION_COUNT = 29
