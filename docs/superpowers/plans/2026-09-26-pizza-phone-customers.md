# Pizza House — בסיס לקוחות לפי טלפון: תכנית ביצוע

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לצבור אצלנו, לילה אחרי לילה, את ההזמנות המשויכות ללקוח (לפי טלפון מגובב) מ-`client_delivery.last_deal_*`, ולהציג בדשבורד בסיס לקוחות, פעילים, נרדמים, ו"חדשים מול חוזרים" אמינים.

**Architecture:** טבלה `pizza_phone_orders` (PK סניף+הזמנה) שמתמלאת בשלב שלישי של הקרון הלילי הקיים, ופונקציית Postgres אחת שמחזירה את כל המספרים לדשבורד ב-JSON אחד. לוגיקה שניתן לטעות בה (נרמול טלפון, סינון שורות, כלל האמינות, מיזוג לתוך ה-payload) יושבת במודול טהור עם טסטים.

**Tech Stack:** Next.js 16 route handlers · mysql2 (`dateStrings: true`) · Supabase (service role, RPC) · vitest.

## Global Constraints

- הספק: `docs/superpowers/specs/2026-09-26-pizza-phone-customers-design.md`.
- לא נבחר/נשמר שם, מייל, כתובת או טלפון גלוי. רק `phone, phone_solar, last_deal_id, last_deal_date, last_deal_sum` נקראים, והטלפון נשמר כ-HMAC בלבד.
- מפתח: `PIZZAHOUSE_PHONE_KEY` (≥32 תווים). לא `SESSION_SECRET`.
- כל קומיט: `npm run typecheck && npm run lint && npm run test` → commit → push → deploy ירוק → בדיקת עשן. לא ממשיכים לפני.
- כשל בכל דבר שקשור לטלפונים לא משנה את מה שכבר עובד (קרון, דשבורד).
- מיגרציות אידמפוטנטיות (`IF NOT EXISTS` / `CREATE OR REPLACE`), רשומות ב-`scripts/run-migrations.mjs`.

---

### Task 1: טבלה + RPC + env + מודול טהור + טסטים

**Files:**
- Create: `supabase/migration-pizza-phone-orders.sql`
- Create: `lib/pizza-house-phone-pure.ts`
- Create: `tests/pizza-phone.test.ts`
- Modify: `scripts/run-migrations.mjs` (רשימת `MIGRATIONS`, אחרי `migration-view-ip-purge.sql`)
- Modify: `lib/env.ts` (אחרי `PIZZAHOUSE_DASHBOARD_PASSWORD`)
- Modify: `.env.example` (אחרי `PIZZAHOUSE_DASHBOARD_PASSWORD=`)

**Interfaces (Produces):**
```ts
normalizePhone(phone: string|null|undefined, phoneSolar?: string|null): string|null
hashPhone(normalized: string, key: string): string
phoneOrderRows(branchId: string, raw: RawPhoneOrder[], key: string, capturedAt?: string): { rows: PhoneOrderRow[]; dropped: number }
phoneRangeIsTrustworthy(fromDate: string, collectionStart: string|null): boolean
derivePhoneCustomers(current: PhoneCustomersRpc, prev: PhoneCustomersRpc, fromDate: string, prevFromDate: string): PhoneCustomers|null
mergePhoneIntoPayload<T extends MergeablePayload>(payload: T, phone: PhoneCustomers|null, requiredBranches: string[]): { payload: T; identity_source: 'phone'|'card' }
```
RPC: `pizza_phone_customers(p_branches TEXT[], p_from TIMESTAMP, p_to TIMESTAMP) RETURNS JSONB` — מבנה `PhoneCustomersRpc`.

- [ ] **Step 1:** לכתוב את `tests/pizza-phone.test.ts` (הקוד המלא בקובץ). להריץ `npx vitest run tests/pizza-phone.test.ts` — נכשל: המודול לא קיים.
- [ ] **Step 2:** לכתוב `lib/pizza-house-phone-pure.ts`. להריץ שוב — עובר.
- [ ] **Step 3:** לכתוב את המיגרציה (טבלה, אינדקסים, RLS, פונקציה), לרשום אותה, להוסיף את המפתח ל-`lib/env.ts` ול-`.env.example`.
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm run test`.
- [ ] **Step 5:** commit `feat(pizza-house): phone-order ledger schema and pure logic` + push. deploy ירוק (הקוד עדיין לא נקרא משום מקום).
- [ ] **Step 6:** `npm run migrate` מול פרוד. בדיקה: `select count(*) from pizza_phone_orders` = 0, ו-`select pizza_phone_customers(array['mevaseret'], '2026-09-01', '2026-09-27')` מחזיר `base: 0`, `branches_with_data: []`.

### Task 2: שלב 3 בקרון

**Files:**
- Create: `lib/pizza-house-phone.ts` (`server-only`)
- Modify: `app/api/cron/pizza-ledger/route.ts` (אחרי לולאת ה-daily-stats, לפני החישוב של `failed`)

**Interfaces (Produces):**
```ts
snapshotPhoneOrders(branchId: string): Promise<{ rows: number; dropped: number } | { skipped: 'no_key' | 'no_link_columns' }>  // inside runWithBranch
fetchPhoneCustomers(branchIds: string[], range: DateRange, prevRange: DateRange, fromDate: string, prevFromDate: string): Promise<PhoneCustomers|null>
```

- [ ] **Step 1:** `lib/pizza-house-phone.ts`: `snapshotPhoneOrders` — מפתח חסר → `{skipped:'no_key'}`; `information_schema.columns` בלי `last_deal_id` → `{skipped:'no_link_columns'}`; אחרת SELECT חמשת השדות `WHERE last_deal_id > 0` → `phoneOrderRows` → upsert ב-500 עם `onConflict: 'branch_id,deal_id'`, שגיאה זורקת. `fetchPhoneCustomers` — שתי קריאות `supabase.rpc('pizza_phone_customers', …)` במקביל → `derivePhoneCustomers`.
- [ ] **Step 2:** בקרון: `logger.error` פעם אחת אם אין מפתח; לולאה פר סניף ב-`try/catch` עם `captureException(..., { phase: 'phone-orders' })`; `phones` בתשובה; `ok` כולל `phoneFailed === 0`.
- [ ] **Step 3:** typecheck + lint + test → commit `feat(pizza-house): nightly snapshot of phone-linked orders` → push → deploy ירוק.
- [ ] **Step 4 (משתמש):** `PIZZAHOUSE_PHONE_KEY` ב-Vercel; פתיחת `/api/cron/pizza-ledger` כ-owner. בדיקה: התשובה מכילה `phones: [{branch:'main', skipped:'no_link_columns'}, {branch:'mevaseret', rows:≈2275, dropped:≤10}]`; ב-Supabase `count(*)` ≈ 2,275; `pizza_phone_customers(array['mevaseret'], …)` → `recency` ≈ 165/317/418/849/526 ו-`base` ≈ 2,136.

### Task 3: ה-API

**Files:**
- Modify: `app/api/pizza-house/dashboard/route.ts` (אחרי בניית `payload`, לפני `const data`)
- Modify: `lib/pizza-house-queries.ts:138-164` (ההערה המיושנת)

- [ ] **Step 1:** `const branchIds = branch === 'all' ? available.map(b => b.id) : [branch]`; `fetchPhoneCustomers(...).catch(→ captureException + null)`; `mergePhoneIntoPayload(payload, phoneCustomers, branchIds)`; ב-`data`: `...merged.payload, phoneCustomers, identity_source`.
- [ ] **Step 2:** להחליף את ההערה "This POS holds no phone to use…" בהערה שמתארת את המצב מ-24.9.2026 ומפנה ל-`lib/pizza-house-phone.ts`.
- [ ] **Step 3:** typecheck + lint + test → commit `feat(pizza-house): dashboard API returns phone-based customer figures` → push → deploy ירוק.
- [ ] **Step 4:** `curl` (עם קוקי owner, או מהדפדפן) `/api/pizza-house/dashboard?from=…&to=…&branch=mevaseret` → יש `phoneCustomers` עם `base > 0`, `identity_source: 'card'` (יום האיסוף). `branch=main` → `phoneCustomers: null`. הדף עצמו ללא שינוי.

### Task 4: הדשבורד

**Files:**
- Modify: `app/pizza-house/page.tsx` — טיפוסים (`Summary.identity_source?`, `DashboardData.phoneCustomers`, `identity_source`), בלוק חדש לפני `{/* ── Customers ── */}`, הערות הכרטיסים "לקוחות מזוהים"/"לקוחות חוזרים", כותרת הסקשן והטקסט הצהוב.

- [ ] **Step 1:** טיפוסים + בלוק "בסיס הלקוחות (לפי טלפון)": 4 כרטיסים, פס recency מ-divs, שורת תחתית (coverage + עודכן + סניפים עם נתונים ב-`all`).
- [ ] **Step 2:** תוויות מותנות ב-`data.identity_source === 'phone'`.
- [ ] **Step 3:** typecheck + lint + test → commit `feat(pizza-house): customer-base block and phone-based labels` → push → deploy ירוק.
- [ ] **Step 4:** בדפדפן: מבשרת — בלוק חדש, מספרים תואמים ל-RPC; גבעת זאב — ללא בלוק, כל המספרים זהים ללפני; כל הסניפים — הערה "נתוני טלפון קיימים כרגע ב: מבשרת ציון"; מובייל (375px) — הכרטיסים בשתי עמודות, הפס לא גולש.
- [ ] **Step 5 (למחרת):** `MAX(captured_at)` התקדם אחרי 02:30; טווח "היום" במבשרת מציג `identity_source: 'phone'`.
