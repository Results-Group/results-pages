# results-pages — הוראות עבודה בקוד

פלטפורמת התוכן־ללקוחות של Results Digital. Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4,
מתארח ב-Vercel, נתונים ב-Supabase (Postgres + Storage). הממשק בעברית ו-RTL.

## פקודות

```bash
npm run dev        # next dev (פורט 3000)
npm run build      # next build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (flat config, eslint-config-next 16)
npm run test       # vitest run
npm run migrate    # מריץ את supabase/migration*.sql
```

לפני commit: `npm run typecheck` + `npm run lint` + `npm run test`.
להרצת האפליקציה בתצוגה מקדימה יש `.claude/launch.json` (הקונפיגורציה `dev`).

## ארבעה מוצרים תחת גג אחד

| מוצר | Admin | ציבורי | Lib |
|---|---|---|---|
| דפי נחיתה (HTML מועלה) | `/admin/pages`, `/admin/upload` | `/pages/*`, `/r/<short>` | `lib/db.ts` |
| Campaign Creative Builder | `/admin/campaigns` | `/c/<slug>` | `lib/campaigns.ts`, `lib/slides.ts`, `lib/copies.ts` |
| דוחות ביצועים | `/admin/reports` | `/report/<slug>` | `lib/performance-reports.ts` |
| דשבורד Pizza House | — | `/pizza-house` | `lib/pizza-house-*.ts` |

מסביב: לקוחות (`/admin/clients`), משתמשים, סביבות עבודה, יומן פעילות, סל מיחזור.

### Campaign Builder — הליבה
העורך: `app/admin/campaigns/_components/editor/` (CampaignEditor / SlideCanvas / Inspector / SlideFilmstrip
ו-`useCampaignDocument.ts`). הקמפיין הוא רשומה אחת עם `sections: JSONB` — כל section הוא מוקאפ
(`instagram_feed | instagram_story | instagram_reels | facebook_feed | carousel | video | landing_page | general | divider`)
עם נכסים ווריאציות קופי. תצוגת הלקוח: `app/c/[slug]/presentation.tsx` + `app/c/[slug]/mockups/`.

**`lib/slides.ts` הוא מקור האמת לפריסה** — `buildCampaignSlides` בונה את השקפים שהלקוח רואה,
ו-`slidesPerSection` / `countClientSlides` הם אותו חישוב שהעורך מציג. שינוי בלוגיקת הפיצול
(`CREATIVES_PER_SCREEN = 2`, carousel = שקף אחד, landing_page = שקף לכל URL) חייב להיות בשני המקומות —
אחרת המונה בעורך משקר ללקוח. זה כבר נשבר ותוקן פעמיים.

## אבטחה — לא לעקוף את השכבות האלה

- **סשן**: קוקי `rp_session`, payload חתום ב-HMAC-SHA256 דרך Web Crypto (עובד גם ב-Edge/middleware).
  `lib/auth.ts`. base64 חייב לעבור דרך `b64EncodeUtf8` — `btoa()` גולמי קורס על שמות בעברית.
  טוקן בלי `exp` תקף נדחה.
- **scope claim**: לדשבורד Pizza House יש סיסמה משותפת שמנפיקה סשן באותו פורמט. `scope: 'pizza-house'`
  מונע ממנו לפתוח `/admin`, ומונע מסשן פלטפורמה להתחזות ל-`ph_session`. `platformSession()` מסנן זאת.
  אל תסיר את הבדיקה הזאת מ-`middleware.ts` או מ-`lib/auth.ts`.
- **הרשאות**: `admin | editor | viewer` + `is_owner` גלובלי + Workspaces עם overrides פר־משתמש
  (`lib/workspaces.ts:resolvePermission`). ב-route handlers השתמש ב-`requireAuth` / `requireRole` /
  `requireWorkspacePermission` / **`requireResourcePermission`** — האחרון גם מגן על רשומות בלי
  `workspace_id` (owner/admin בלבד), במקום לדלג על הבדיקה.
- **תוכן מוגן בסיסמה**: bcrypt(12) על הסיסמה + טוקן גישה חתום ב-`lib/content-access.ts`.
  הטוקן כולל fingerprint של הסיסמה, כך שהחלפת סיסמה מבטלת טוקנים קיימים.
- **rate limiting**: `lib/rate-limit.ts` — Upstash Redis אם מוגדר, אחרת in-memory פר-instance.
  הצוות יושב מאחורי IP משרדי אחד — מגבלות אימות חייבות להיות **פר־חשבון, לא פר־IP**.
- **service-role key**: `lib/supabase.ts` מסומן `server-only`. אל תייבא אותו (גם לא בעקיפין) מקומפוננטת
  client — הבילד ייכשל. helpers משותפים לקליינט נכנסים למודול נפרד (למשל `lib/report-template.ts`,
  `lib/asset-url.ts`, `lib/copies.ts`).
- כל התוכן הציבורי `robots: noindex` — ה-slug אינו סוד. CSP נפרדת לדפי ה-HTML המוגשים (`next.config.ts`).

## קונבנציות

- **גוף בקשה**: תמיד `parseJson` / `parseForm` מ-`lib/http.ts`. אף פעם לא `await req.json()` גולמי —
  גוף ריק/שבור מחזיר 500 מבלבל במקום 400 עם הודעה בעברית.
- **מחיקה**: soft-delete דרך `deleted_at` → סל מיחזור → `purge*` שמוחק גם קבצים ב-Storage.
  שאילתות ברירת־מחדל מסננות `deleted_at IS NULL`.
- **מחיקה מקבילה בעורך**: `updateCampaign` מקבל `baseUpdatedAt` ל-optimistic concurrency ומזרוק
  `CampaignConflictError` (→ 409). פונקציות שנקראות מחוץ לזרימת ה-autosave (`setCampaignLogoPath`,
  `setCampaignMondayFeedbackItem`) **לא** מעדכנות `updated_at` בכוונה — אחרת ה-autosave הבא נכשל
  ונועל את העורך.
- **מיגרציות**: קבצי SQL ידניים ב-`supabase/` (אין ORM), אידמפוטנטיים (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`).
  RLS פעיל על כל טבלה עם policy של service-role.
- **העלאת קבצים**: `Buffer` צריך להיעטף ב-`Blob` לפני `supabase.storage.upload` — ריצת Vercel הופכת
  body גולמי ל-UTF-8 והורסת בייטים (כולל עברית).
- **תמונות**: `compressAndUploadImage` מייצר webp (שומר alpha) + jpeg fallback עם `flatten({background:'#ffffff'})` —
  ברירת המחדל של sharp שחורה ויצרה ריבוע שחור מאחורי לוגו שקוף. מפתחות Storage חייבים ASCII —
  משתמשים ב-UUID של הקמפיין כתיקייה, לא בשם הלקוח.
- **נכסים בתצוגה**: `assetProxyUrl` (דרך `/api/asset/*`) ולא URL ישיר ל-Supabase — חומות אש ותוספי
  דפדפן חסמו טעינה ישירה. `assetDirectUrl` הוא fallback.
- **i18n**: `lib/i18n/{he,en}.ts` — מפתחות שטוחים. טקסטים חדשים בממשק נכנסים לשני הקבצים.
- **audit**: `logAudit` מ-`lib/audit.ts` — fire-and-forget, לא זורק לעולם.
- הערות ה-WHY בקוד מתעדות באגים אמיתיים בפרודקשן. אל תמחק אותן כשמשנים את הקוד סביבן.

## אינטגרציות חיצוניות

Monday.com (סנכרון לקוחות + לוח פידבק) · Gemini (תרגום דוחות, פירוק Excel, זיקוק PDF מיצוב ללקוח) ·
Resend (מייל) · Sentry · Base44 REST (`lib/base44.ts` — אפליקציית כרטיסי הביקור הדיגיטליים DME) ·
MySQL של קופת Aviv (Pizza House, קריאה בלבד, רב־סניפי — סניף חדש = שורה ב-`BRANCH_REGISTRY` + env vars).
Vercel Crons (`vercel.json`): `sync-clients` ב-03:00, `archive-expired` ב-04:00 — מאומתים מול `CRON_SECRET`.

כל משתני הסביבה מוגדרים ב-`lib/env.ts` (סכימת zod). חובה: `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (32+ תווים). השאר אופציונלי — פיצ'ר בלי מפתח מושבת.

## מסמכים

- [docs/SYSTEM-ROADMAP.md](docs/SYSTEM-ROADMAP.md) — מפת דרכים ועדיפויות.
- `dme-migration/` — מיגרציה בעבודה מ-Base44 לסכימה משלנו. `dme-backup/` מכיל PII של לקוחות
  ונמצא ב-`.gitignore` — לעולם לא לעשות לו commit.
