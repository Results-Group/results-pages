# שקף "תוכנית הפצה" — מסמך עיצוב

**תאריך:** 2026-07-30
**סטטוס:** מאושר, בביצוע

## מטרה

להוסיף למצגת הקמפיין שקף שמציג ללקוח את תוכנית ההפצה של הקמפיין — אסטרטגיה,
ערוצים, חלוקת תקציב ותזמון — כחלק מהדק שהוא כבר מאשר.

## החלטות

1. **סוג section חדש**, לא עמודה חדשה בקמפיין. `mockup_type: 'distribution'` נכנס
   לרשימת הסוגים הקיימת ו-`CampaignSection` מקבל שדה אופציונלי `plan`. כך השקף
   יורש בחינם מיקום חופשי בדק, גרירה, filmstrip, אישור והערות של הלקוח, מונה
   שקפים, שכפול ותבניות — ואין מיגרציית DB (`sections` הוא JSONB).
2. **שתי מערכות נתונים, ארבע תצוגות.** העובד מזין בולטים + ערוצים פעם אחת;
   בלוק התקציב וציר הזמן נגזרים משדות של אותם ערוצים. אין הזנה כפולה ואין
   סיכון שהגרף והטבלה יסתרו זה את זה.
3. **בלוקים נדלקים וכבים לכל שקף בנפרד.** לא כל תוכנית הפצה צריכה את כל ארבעת
   החלקים.
4. **בלי recharts בשקף הציבורי.** הבר הוא `div` ברוחב אחוזים. recharts שוקל
   ~100KB בבאנדל של דף שהלקוח פותח בנייד, בשביל בר אופקי. בדוחות הביצועים
   recharts מוצדק; כאן לא.
5. **תאריכים בשדה `date` בלבד**, לא תוויות חופשיות — ציר זמן פרופורציונלי דורש
   תאריכים שנפרסים.

## מודל הנתונים

`lib/distribution.ts` — מודול client-safe (בלי `server-only`), כמו `lib/copies.ts`,
כי גם העורך וגם תצוגת הלקוח מייבאים אותו.

```ts
export interface DistributionChannel {
  id: string
  name: string        // "Meta", "Google Search", "TikTok"
  budget?: number     // ₪
  percent?: number    // דריסה ידנית; אחרת נגזר מ-budget
  formats?: string    // "פוסטים, סטוריז, רילס"
  audience?: string   // "נשים 25-45, מרכז"
  start?: string      // ISO date
  end?: string        // ISO date
}

export interface DistributionPlan {
  bullets: string[]
  channels: DistributionChannel[]
  budgetDisplay: 'amount' | 'percent' | 'both'
  show: { bullets: boolean; channels: boolean; budget: boolean; timeline: boolean }
  totalLabel?: string  // ברירת מחדל: 'סה"כ חודשי'
}
```

פונקציות טהורות באותו מודול:

| פונקציה | תפקיד |
|---|---|
| `resolvePercents(channels)` | אחוז לכל ערוץ — `percent` ידני אם הוזן, אחרת `budget/total` |
| `totalBudget(channels)` | סכום התקציבים |
| `hasVisibleContent(plan)` | האם השקף מייצר בכלל תוכן |
| `percentWarning(channels)` | טקסט אזהרה לעורך אם האחוזים לא מסתכמים ל-100, אחרת `null` |

`lib/campaigns.ts`: `'distribution'` נוסף ל-union של `mockup_type`;
`CampaignSection` מקבל `plan?: DistributionPlan`.

## פריסת השקף

מסך אחד, שלושה בלוקים מלמעלה למטה. כל בלוק נרנדר רק אם הוא מודלק **ויש לו תוכן**.

1. **אסטרטגיה** — בולטים.
2. **ערוצים + תקציב** — טבלה: ערוץ / פורמטים / קהל / תקציב. כששני הבלוקים
   מודלקים הבר יושב **בתוך שורת הטבלה**; כשרק "תקציב" מודלק מתקבלת רשימת ברים
   עצמאית (שם + בר + ערך). שורת סה"כ בתחתית עם `totalLabel`.
3. **ציר זמן** — נתיב אופקי לכל ערוץ, פרופורציונלי ל-`start`/`end`. ערוץ בלי
   תאריכים לא מופיע בציר.

במובייל הטבלה הופכת לכרטיסיות — ערוץ אחד לכרטיס. טבלה של ארבע עמודות ב-375px
אינה קריאה.

## קומפוננטה אחת, שני צרכנים

`app/c/[slug]/distribution-slide.tsx` — קומפוננטה עצמאית שמקבלת `plan`.
**גם תצוגת הלקוח וגם הפריוויו בעורך מרנדרים אותה.** זה הלקח מהבאג שתוקן ב-84ba63b:
כשהעורך מחזיק לוגיקת רינדור משלו, מה שהעובד רואה מתחיל להיפרד ממה שהלקוח מקבל.

- `presentation.tsx` — `'distribution'` נוסף לסוויץ' סוגי השקפים ולתוויות הניווט.
  הקומפוננטה עצמה בקובץ נפרד; `presentation.tsx` כבר 970 שורות.
- `SlideCanvas.tsx` — `isDistribution` מחליף את אזור העלאת הנכסים באותה קומפוננטה.
- **אישור הלקוח** — `isApprovable` היא `!!s.key && s.type !== 'divider'`, כך ששקף
  ההפצה בר-אישור והערות אוטומטית. זו התנהגות רצויה: תוכנית מדיה היא בדיוק מה
  שלקוח צריך לאשר.

## חישוב השקפים

`lib/slides.ts` — הנקודה העדינה. הקוד הנוכחי מדלג על section בלי נכסים
(`else if (assets.length > 0)`), ולכן נדרש ענף מפורש. שתי הפונקציות חייבות להסכים:

- `slidesPerSection`: `distribution` → `hasVisibleContent(plan) ? 1 : 0`
- `buildCampaignSlides`: ענף מפורש שדוחף `{ type: 'distribution', key: section.id, title, plan }`

שקף הפצה ריק מייצר **0 שקפים** — הלקוח לא רואה מסך ריק, והמונה בעורך מראה אותו דבר.

`SlideData` מקבל `type: 'distribution'` ושדה `plan?: DistributionPlan`.

## Inspector

בטאב "שקף", כשהסוג הוא "תוכנית הפצה":

- **בולטים** — repeater של שורות טקסט (הוספה, מחיקה, גרירה).
- **ערוצים** — repeater עם כל שדות `DistributionChannel`, גרירה לסידור (dnd-kit,
  כבר בשימוש למיון נכסים).
- **תצוגת תקציב** — select: שקלים / אחוזים / שניהם.
- **מה להציג** — ארבעה צ׳קבוקסים.
- **תווית סה"כ** — טקסט חופשי.
- **אזהרה רכה** מ-`percentWarning`. אזהרה בלבד, לא חסימה — לפעמים יש 90% ורזרבה.

`types.ts`: `'distribution'` ל-`MockupType` ותווית `תוכנית הפצה` ב-`MOCKUP_TYPES`.
`SmartUploadModal` מדלג עליו כמו על `divider`. ה-filmstrip מציג "N ערוצים" במקום
"N פריטים".

## AI — "הצע תוכנית" (שלב ב')

`POST /api/campaigns/[id]/generate-plan`, מבנה זהה ל-`generate-copy`: אימות סשן →
`requireWorkspacePermission(edit)` → `rateLimit` (60 שניות, 10 בקשות, prefix
`ai-plan`) → `isAiConfigured` → Gemini JSON. הפרומפט מבוסס על הקונספט, שם הקמפיין
ו-`client.positioning`.

שני הבדלים מכוונים מ-`generate-copy`:

- **`parseJson` מ-`lib/http.ts`** ולא `req.json().catch()`, לפי הקונבנציה.
- **ולידציית zod על תשובת המודל** לפני שהיא חוזרת לעורך; שורות לא תקינות נזרקות.
  תוכנית הפצה היא נתונים מובנים עם מספרים, לא מערך סטרינגים.

התוצאה מוצגת כהצעה שהעובד מאשר, לא ככתיבה מעל מה שהזין — כמו הצעות הקופי הקיימות.

**זהו שלב ב'.** שלב א' נשלח בלי הכפתור הזה, עם הזנה ידנית בלבד.

## טיפול בשגיאות ותאימות לאחור

| מצב | התנהגות |
|---|---|
| `plan` חסר / `undefined` | 0 שקפים, אין קריסה |
| כל הבלוקים כבויים | 0 שקפים |
| ערוץ בלי תקציב ובלי אחוז | מופיע בטבלה, לא בגרף |
| כל התקציבים 0 | בלוק התקציב לא נרנדר (אין חלוקה באפס) |
| AI נכשל או חסר מפתח | toast; ההזנה הידנית ממשיכה לעבוד |
| רשומות קיימות | אין `distribution` בשום שורה קיימת — אפס השפעה |

## בדיקות

`tests/distribution.test.ts` והרחבת הבדיקות ל-`lib/slides.ts` — פונקציות טהורות
בלי DB, בסטייל ארבעת קבצי הבדיקה הקיימים:

- `resolvePercents` — מתקציבים, עם דריסה ידנית, ובחלוקה באפס
- `hasVisibleContent` — בלוקים כבויים, plan ריק
- `slidesPerSection` + `countClientSlides` — 0 לריק, 1 למלא, וההסכמה ביניהן

## היקף

**קבצים חדשים:** `lib/distribution.ts`, `app/c/[slug]/distribution-slide.tsx`,
`tests/distribution.test.ts` (+ `app/api/campaigns/[id]/generate-plan/route.ts` בשלב ב').

**קבצים בשינוי:** `lib/campaigns.ts`, `lib/slides.ts`, `app/c/[slug]/presentation.tsx`,
`SlideCanvas.tsx`, `Inspector.tsx`, `types.ts`, `lib/i18n/{he,en}.ts`.

**אין מיגרציית DB.**
