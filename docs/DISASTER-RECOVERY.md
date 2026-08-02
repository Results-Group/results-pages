# Disaster Recovery — Runbook

נכתב אחרי ליל 02–03.08.2026, שבו פרויקט ה-Supabase של הפרודקשן נמחק בטעות
והמערכת הוקמה מחדש באותו לילה. כל סעיף כאן שולם בדם. אם אתם קוראים את זה
בזמן אמת — לכו לפי הסדר, אל תאלתרו.

## שלב 0 — עצרו את הדימום (5 דקות)

1. **אל תמחקו ואל תיצרו כלום** עד שמבינים מה קרה.
2. אבחון מהיר — מה בדיוק מת:
   ```bash
   curl -s https://reports.resultsdigital.org/api/health
   ```
   `{"ok":true}` = מסד הנתונים חי והבעיה אחרת. `503` = המסד לא נגיש.
3. אם הפרויקט נמחק: **פנייה לתמיכת Supabase מיד** (טופס + תשובה למייל האוטומטי
   עם סיווג Production-Down). התיעוד הרשמי אומר שמחיקה היא סופית — פנו בכל זאת,
   אבל **אל תחכו להם**: המשיכו בשחזור במקביל.
4. ודאו שהלקוחות רואים דף תחזוקה ולא 404:
   ```bash
   printf '1' | npx vercel env add REBUILD_HOLD production
   git commit --allow-empty -m "redeploy" && git push
   ```
   הדגל מחזיק כל לינק ציבורי חסר על דף "המערכת בתחזוקה" הממותג.
   דפים/קמפיינים שכן קיימים ממשיכים להיות מוגשים כרגיל — הסרה רק כשהתוכן חזר.

## שלב 1 — פרויקט Supabase חדש (15 דקות)

1. צרו פרויקט חדש. **Region שונה מהקודם** (פרודקשן הנוכחי: `eu-west-1`).
2. שמרו בצד: Project URL, מפתח `sb_secret_...`, וסיסמת ה-DB.
3. עדכנו **ב-Vercel** (טרמינל, לא דשבורד — הדשבורד גרם לעריכת הפרויקט הלא נכון):
   ```bash
   npx vercel env rm NEXT_PUBLIC_SUPABASE_URL production --yes
   npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
   npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes
   npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```
4. עדכנו **מקומית** את `.env.local`: אותם שניים + `SUPABASE_DB_PASSWORD`.
5. עדכנו את קבצי העזר של הרנר — אחרת הוא ממשיך לדבר עם הפרויקט המת:
   - `supabase/.temp/project-ref` — ה-ref החדש בלבד
   - `supabase/.temp/pooler-url` — למחוק, או לעדכן ל-region הנכון
     (מציאת ה-pooler: `postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432/postgres`)

## שלב 2 — סכימה (10 דקות)

הרצת המיגרציות **קובץ שלם מול pg**, לא דרך הרנר — הרנר מפצל statements
ונשבר על בלוקי `DO $`. הסדר קריטי:

1. `migration.sql` — **קודם כולם** (הסכימה הבסיסית; לא ברשימת הרנר!)
2. כל השאר לפי הסדר שברשימת `MIGRATIONS` שב-`scripts/run-migrations.mjs`
3. `migration-clients-patch.sql` אחרי `migration-clients.sql`
4. `migration-partial-unique.sql` **אחרי** `migration-reports.sql` (תלוי בטבלה שלו)

ואז — **חובה, לא אופציונלי** — טבלאות שנוצרו דרך חיבור pg ישיר לא מקבלות
הרשאות אוטומטית:

```sql
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
```

בלי זה כל קריאת service-role נופלת על "permission denied".

## שלב 3 — נתונים (30 דקות)

| מה | מאיפה | איך |
|---|---|---|
| משתמש בעלים | — | `node -r dotenv/config scripts/create-admin.mjs <email> <pw>` + `UPDATE admin_users SET is_owner=true` |
| צוות | — | דרך מסך המשתמשים |
| לקוחות | Monday | `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/sync-clients` |
| פיצה האוס | קופת Aviv (~40 יום) | `.../api/cron/pizza-ledger?days=40` (שני הסניפים — רק בפרודקשן; מקומית חסרים משתני גבעת זאב) |
| דפי נחיתה | גיבוי; מקורות ב-Drive/מחשב | העלאה תחת **אותם client+slug בדיוק** — כולל מקפים כפולים ואותיות גדולות; אל תתנו ל-slugify לנרמל |
| קמפיינים | גיבוי | שחזור מה-snapshot |
| Google Business | חיבור OAuth מחדש | `/api/google-business/connect` |

**עיקרון ה-slugs:** הלינקים שנשלחו ללקוחות הם הנכס. תוכן שמוקם מחדש תחת
ה-slug המקורי מחייה את הלינק אצל הלקוח בלי לשלוח כלום מחדש.

**טאבים פתוחים הם גיבוי:** דף/קמפיין שפתוח בדפדפן של מישהו — Cmd+S →
"Webpage, Complete" **לפני כל רענון**. ב-`_files/saved_resource.html` יושב
התוכן המלא, כולל עריכות שלא נשמרו.

## שלב 4 — שחזור מהגיבוי הלילי

הגיבוי: `db/YYYY-MM-DD.json.gz` ב-bucket `backups` (בפרויקט הגיבוי הנפרד —
`BACKUP_SUPABASE_URL`). בפנים: `tables` (כל הטבלאות), `storage_manifest`
(רשימת כל הקבצים), והקבצים עצמם תחת `files/<bucket>/<path>`.

```
gunzip → INSERT טבלה-טבלה → העתקת files/* חזרה ל-buckets המקוריים
```

## מניעה — הסטטוס שנקבע אחרי האירוע

1. **גיבוי מחוץ לרדיוס הפיצוץ**: `BACKUP_SUPABASE_URL/KEY` → פרויקט בארגון אחר.
2. **שמות חד-משמעיים**: `PROD-...-DO-NOT-DELETE`; ניסויים בארגון נפרד; 2FA.
3. **ניטור**: `/api/health` + מוניטור חיצוני (התראה תוך דקות, לא במקרה).
4. **תרגיל שחזור רבעוני**: גיבוי שלא שוחזר פעם — לא קיים.
