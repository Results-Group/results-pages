# Pizza House — בסיס לקוחות לפי טלפון (client_delivery.last_deal_*)

**תאריך:** 2026-09-26 · **סטטוס:** מאושר, בביצוע

## רקע

עד ספטמבר 2026 קופת Aviv לא חשפה שום מזהה אישי של לקוח: `deals.client_id` ריק,
מועדון הלקוחות (`clients`) ריק. הדשבורד מזהה לקוחות לפי טביעת כרטיס אשראי בלבד,
והקרון הלילי (`/api/cron/pizza-ledger`) שומר את הזהויות האלה ב-`pizza_customer_ledger`
כי הקופה מוחקת היסטוריה אחרי ~5 שבועות.

ב-15.9.2026 הופיעה בשני הסניפים טבלה `client_delivery` (לקוחות משלוחים: טלפון, שם, מייל).
ב-24.9.2026 אביב הוסיפו **במבשרת בלבד** שלוש עמודות: `last_deal_id`, `last_deal_date`,
`last_deal_sum` — ההזמנה האחרונה של כל לקוח. נבדק (`/api/pizza-house/phone-audit`):
193/193 הזמנות תואמות לקופה בתאריך ובסכום; העמודות שרדו בנייה לילית של הטבלה (25.9 00:08).
גבעת זאב: 7,512 לקוחות עם טלפון, **בלי** העמודות — נשלחה בקשה לאביב.

מה שהקופה נותנת: **רק ההזמנה האחרונה** של כל לקוח. כדי לדעת "כמה פעמים הזמין" חייבים
לצבור בעצמנו, לילה אחרי לילה.

עובדות מהבדיקה במבשרת (ספירות בלבד): 98.8% מהטלפונים ניידים נקיים בני 10 ספרות;
`phone_solar` כמעט זהה ל-`phone` (6 שורות שבהן רק `phone_solar` מלא); 122 טלפונים מופיעים
ביותר מרשומת לקוח אחת (אותו אדם, כתובות שונות) — זיהוי לפי טלפון מאחד אותם.

## מה בונים

1. **יומן הזמנות לפי טלפון** — טבלה `pizza_phone_orders` ושלב שלישי בקרון הלילי.
2. **בלוק חדש בדשבורד** — "בסיס הלקוחות (לפי טלפון)": גודל הבסיס, פעילים, נרדמים, פס recency.
3. **המספרים הקיימים עוברים לטלפון** בסניף שיש בו נתון — עם כלל בטיחות שמונע מספרים שקריים.

לא בגרסה הזו (במודע): רשימת VIP לפי טלפון, ייצוא טלפונים לקמפיין, שמות בדשבורד.

## 1. נתונים

### טבלה `pizza_phone_orders` (`supabase/migration-pizza-phone-orders.sql`)

| עמודה | טיפוס | הערה |
|---|---|---|
| `branch_id` | TEXT | |
| `phone_hash` | TEXT | HMAC-SHA256(`phone:` + טלפון מנורמל) עם `PIZZAHOUSE_PHONE_KEY` |
| `deal_id` | BIGINT | `client_delivery.last_deal_id` |
| `deal_date` | TIMESTAMP (naive, שעון ישראל כמו הקופה) | `last_deal_date` |
| `deal_sum` | NUMERIC(12,2) | `last_deal_sum` |
| `captured_at` | TIMESTAMPTZ DEFAULT now() | מתי נקלט אצלנו |

PK `(branch_id, deal_id)`. אינדקסים: `(branch_id, phone_hash, deal_date)`, `(branch_id, deal_date)`.
RLS + policy של service-role כמו שאר הטבלאות. רישום ב-`scripts/run-migrations.mjs`.

לא נשמר שם, מייל, כתובת או טלפון גלוי. השאילתה לקופה לא בוחרת אותם.

### מפתח

`PIZZAHOUSE_PHONE_KEY` — משתנה סביבה חדש, אופציונלי ב-`lib/env.ts` (מינימום 32 תווים כשקיים).
**לא** `SESSION_SECRET`: הוא כבר משמש את יומן הכרטיסים, וסיבוב שלו מוחק היסטוריה. מפתח נפרד
מאפשר להחליף סיסמאות במערכת בלי לאבד את הזיכרון הזה. אותו מפתח בכל הסניפים → אותו אדם
מקבל אותו hash בשני הסניפים, ותצוגת "כל הסניפים" סופרת אותו פעם אחת.

### נרמול טלפון (`lib/pizza-house-phone-pure.ts`, טהור, נבדק)

`normalizePhone(phone, phoneSolar)`:
- ספרות בלבד. `+972…` / `972…` באורך 12 → `0` + 9 הספרות.
- מעדיפים `phone`; אם אחרי הנרמול יש פחות מ-9 ספרות — מנסים `phone_solar`.
- פחות מ-9 ספרות בשניהם → `null` (השורה נזרקת).

`phoneOrderRows(branchId, raw[], key)` → שורות ל-upsert. נזרקות: טלפון `null`, `last_deal_id ≤ 0`,
תאריך לא תקין או לפני 2000-01-01.

## 2. איסוף — שלב 3 בקרון `/api/cron/pizza-ledger`

מבודד משני השלבים הקיימים (ledger, daily-stats): `try/catch` פר סניף, כשל באחד לא עוצר את השאר.

לכל סניף (`lib/pizza-house-phone.ts`, `server-only`):
1. אין `PIZZAHOUSE_PHONE_KEY` → `{ skipped: 'no_key' }` + `logger.error` (בקול, כל לילה, עד שיוגדר).
2. `information_schema.columns` — אין `last_deal_id` ב-`client_delivery` → `{ skipped: 'no_link_columns' }`,
   **בלי** Sentry (מצב ידוע; גבעת זאב היום).
3. `SELECT phone, phone_solar, last_deal_id, last_deal_date, last_deal_sum FROM client_delivery WHERE last_deal_id > 0`.
4. נרמול + גיבוב + upsert ב-batches של 500, `onConflict: 'branch_id,deal_id'`.
5. תשובת הקרון: `phones: [{ branch, rows, dropped } | { branch, skipped } | { branch, error: true }]`.

**כל לילה נשלח כל הצילום** (≤ ~7,500 שורות לסניף) — idempotent. לילה שנפל (קופה לא זמינה,
טבלה באמצע בנייה מחדש ב-00:08–00:21) מתוקן למחרת. הריצה הראשונה = backfill אוטומטי
(ההזמנה האחרונה של כל לקוח, אחורה עד יוני 2025). אין צעד ידני מלבד הרצה ראשונה מוקדמת
מהדפדפן (owner/admin, כמו היום).

הזמנה של אותו `deal_id` שמופיעה עם טלפון אחר (הלקוח תוקן בקופה) — הגיבוב החדש דורס.

## 3. שאילתת הדשבורד — פונקציית Postgres `pizza_phone_customers`

חתימה: `pizza_phone_customers(p_branches TEXT[], p_from TIMESTAMP, p_to TIMESTAMP) RETURNS JSONB`
(`p_to` אקסקלוסיבי, naive כמו `deal_date`). קריאה אחת, שורה אחת — עוקף את תקרת 1,000 השורות
של PostgREST ומאפשר `COUNT(DISTINCT phone_hash)` על פני כמה סניפים.

מחזירה:
- `base` — לקוחות שונים (distinct `phone_hash`) עם הזמנה אחת לפחות.
- `active_30d`, `active_90d` — ההזמנה האחרונה בתוך 30/90 יום מ-`now() AT TIME ZONE 'Asia/Jerusalem'`.
- `dormant_180d` — ההזמנה האחרונה לפני 180+ יום.
- `recency` — `{ up_to_30d, d30_90, d90_180, d180_365, over_365 }` לפי ההזמנה האחרונה (סכום = `base`).
- `in_range` — `{ customers, orders, revenue }` — הזמנות ב-`[p_from, p_to)`.
- `new_vs_returning` — `{ new, returning, new_revenue, returning_revenue }` בין הלקוחות שהזמינו בטווח:
  returning = יש הזמנה לפני `p_from`.
- `frequency` — `{ '1', '2', '3-5', '6+' }` — סה"כ הזמנות ידועות ללקוח, בין הפעילים בטווח
  (אותם דליים כמו הגרף הקיים).
- `collection_start` — `MIN(captured_at)` כתאריך ישראלי; `last_captured_at` — `MAX(captured_at)`.
- `branches_with_data` — הסניפים מתוך `p_branches` שיש להם שורות.

### כלל הבטיחות (ב-TS, נבדק): `phoneRangeIsTrustworthy(from, collectionStart)`

`new_vs_returning` ו-`frequency` נחשבים אמינים רק כאשר `from > collection_start` (יום למחרת ומעלה).
סיבה: לפני תחילת האיסוף ידועה הזמנה אחת ללקוח, ולקוח ותיק שההזמנה הזאת שלו נופלת בטווח
היה נספר "חדש". לטווח שמתחיל אחרי — כל מי שהיה לקוח לפני האיסוף מופיע עם הזמנה קודמת,
והמספר מדויק מהיום הראשון. `base` / `active` / `dormant` / `recency` / `in_range` אמינים תמיד.

## 4. ה-API `/api/pizza-house/dashboard`

אחרי בניית ה-payload הקיים (מהקופה):

```
phoneCustomers = await fetchPhoneCustomers(branchIds, range, prevRange).catch(() => null)
```
- `branchIds` = הסניף הנבחר, או כל הסניפים ב-`all`.
- כשל ב-Supabase → `null` → הדשבורד נטען כרגיל בלי הבלוק. `captureException`.
- `data.phoneCustomers = { ...rpc, trustworthy: boolean, prev: { in_range, new_vs_returning } | null } | null`.
  `null` גם כשאין שורות לסניפים המבוקשים.

**החלפת המספרים הקיימים** — רק כשמתקיימים כולם:
1. יש נתוני טלפון לכל הסניפים שבתצוגה (בסניף בודד — לו; ב-`all` — לכולם. היום `all` נשאר אשראי).
2. הטווח הנוכחי **וגם** הטווח הקודם עומדים בכלל הבטיחות (אחרת ה-Delta מול תקופה קודמת משקר).

כשמתקיימים: `summary.unique_customers` / `prev_summary.unique_customers` ← `in_range.customers`;
`summary.returning_pct` ← `returning / (new+returning)`; `customers.newVsReturning` ו-`customers.frequency`
← מהטלפון (אותם מבנים כמו היום); `summary.identity_source = 'phone'`, אחרת `'card'`.
`identity_coverage_pct` ← `in_range.orders / summary.orders`. VIP ו-mealCards לא נוגעים.

## 5. הדשבורד `app/pizza-house/page.tsx`

**בלוק חדש** מעל "לקוחות", רק כש-`data.phoneCustomers` קיים. כותרת "בסיס הלקוחות (לפי טלפון)".
- 4 כרטיסים: בסיס לקוחות · פעילים 30 יום · פעילים 90 יום · נרדמים (180+ יום) — האחרון עם הערה
  "קהל לקמפיין החזרה".
- פס recency אחד (divs ברוחב יחסי, בלי recharts): עד חודש / 1–3 חודשים / 3–6 / 6–12 / שנה+, עם מקרא ומספרים.
- שורת תחתית: "{coverage}% מההזמנות בטווח משויכות ללקוח · עודכן {last_captured_at}".
  ב-`all` כשלא לכל הסניפים יש נתונים: "נתוני טלפון קיימים כרגע ב: {שמות}".

**כש-`identity_source === 'phone'`:** הערת "לקוחות מזוהים" → "לפי טלפון · {coverage}% מההזמנות";
הערת "לקוחות חוזרים" → "לפי טלפון"; כותרת הסקשן → "לקוחות (זיהוי לפי טלפון)"; הטקסט הצהוב →
"זיהוי לפי טלפון מרשומות המשלוחים בקופה. הזמנות בלי רשומת לקוח (דלפק, חלק מהאיסופים) לא נספרות —
לכן מוצג אחוז השיוך." אחרת — הכל כמו היום, ללא שינוי.

`Summary` מקבל `identity_source?: 'phone' | 'card'`; `DashboardData` מקבל `phoneCustomers`.

## 6. כשלים

| מצב | התנהגות |
|---|---|
| אין מפתח | שלב 3 מדלג, `logger.error` + `skipped: 'no_key'` בתשובה. דשבורד ללא שינוי. |
| אין עמודות חיבור בסניף | דילוג שקט עם ציון. לא Sentry. |
| קופה לא עונה / שאילתה נכשלת | Sentry; הסניף השני ושאר השלבים ממשיכים; למחרת הצילום נשלח שוב. |
| upsert ל-Supabase נכשל | זורק → Sentry; ריפוי עצמי בלילה הבא. |
| RPC נכשל בדשבורד | `phoneCustomers = null`; שאר הדשבורד רגיל. |

## 7. בדיקות

`tests/pizza-phone.test.ts` (vitest, טהור):
- `normalizePhone`: `050-1234567`, `+972501234567`, `972501234567`, קווי `02-1234567` (9 ספרות), ריק → נופל ל-`phone_solar`,
  `---` / קצר / זבל → `null`.
- `phoneOrderRows`: מזהה 0, תאריך `0000-00-00`, תאריך לפני 2000, טלפון `null` — נזרקים; שורה תקינה עוברת עם hash דטרמיניסטי;
  מפתחות שונים → hash שונה; אותו טלפון בשני פורמטים → אותו hash.
- `phoneRangeIsTrustworthy`: יום האיסוף → false; למחרת → true; `collectionStart` null → false.
- `mergePhoneIntoPayload` (הפונקציה שמחליפה את המספרים): לא נוגעת כש-`trustworthy` false או כשחסר סניף ב-`all`;
  מחליפה נכון כשמתקיים; `identity_source` נכון.

בדיקת אינטגרציה ידנית אחרי הריצה הראשונה: `recency` מה-RPC למבשרת חייב להתאים לדליים
מה-`phone-audit` (24–26.9: ‎165 / 317 / 418 / 849 / 526 ± הזמנות של הימים שביניהם), ו-`base` ≈ 2,136.

## 8. סדר ביצוע — כל קומיט: typecheck+lint+test → commit → deploy ירוק → בדיקת עשן

1. **מיגרציה (טבלה + RPC) + env + לוגיקה טהורה + טסטים.** בלתי נראה. הרצת המיגרציה בפרוד (`npm run migrate`).
2. **שלב 3 בקרון.** הרצה ידנית ראשונה מהדפדפן → ב-Supabase: ~2,275 שורות למבשרת, גבעת זאב `skipped`.
   דשבורד ללא שינוי. `PIZZAHOUSE_PHONE_KEY` חייב להיות ב-Vercel לפני ההרצה (אחרת `no_key`, לא נזק).
3. **ה-API.** `phoneCustomers` ב-JSON; `identity_source: 'card'` עדיין (הכלל: יום למחרת האיסוף). הדף ללא שינוי.
4. **הדשבורד.** מבשרת: בלוק חדש. גבעת זאב: בלי בלוק, מספרים זהים להיום. `all`: הערה על מבשרת.
5. למחרת בבוקר: `MAX(captured_at)` התקדם; `identity_source` עובר ל-`phone` בטווחים "היום/אתמול".

בדרך: עדכון ההערה המיושנת ב-`lib/pizza-house-queries.ts` ("This POS holds no phone…") —
היא הייתה נכונה ב-5.8.2026 ואינה נכונה מאז 24.9.2026. `phone-audit` נשאר עד שאביב מסיימים בגבעת זאב.

## צעדים בצד המשתמש

1. Vercel → Production → `PIZZAHOUSE_PHONE_KEY` = `openssl rand -hex 32` (Claude לא רואה את הערך).
2. אחרי קומיט 2: לפתוח פעם אחת `/api/cron/pizza-ledger` כשמחוברים כ-owner — הריצה הראשונה.
