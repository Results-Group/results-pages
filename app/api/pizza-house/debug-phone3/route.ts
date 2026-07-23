// TEMPORARY — the phone IS entered on the POS according to the operator,
// so it must land in a column I haven't checked. This one:
// 1) samples the `payment` table (4281 rows, never inspected)
// 2) widens the regex to catch phones stored with dashes, spaces, +972 etc.
// 3) also scans int/bigint columns (some POS systems store phone as number)
// 4) scans EVERY table in the DB, not just the 5 main ones.
// DELETE after we find the column.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { pizzaHouseQuery, runWithBranch, isPizzaBranch } from '@/lib/pizza-house-db'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 })
  }

  const url = new URL(req.url)
  const branch = url.searchParams.get('branch') || 'main'
  if (!isPizzaBranch(branch)) {
    return NextResponse.json({ error: `Unknown branch: ${branch}` }, { status: 400 })
  }

  try {
    return await runWithBranch(branch, async () => {
      // 1. Full schema + sample of `payment` (biggest unchecked table).
      const paymentCols = await pizzaHouseQuery<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment' ORDER BY ORDINAL_POSITION`,
      )
      const paymentSample = await pizzaHouseQuery(`SELECT * FROM payment ORDER BY date DESC LIMIT 5`)

      // 2. Widened phone hunt — across EVERY table, on every char/varchar/text column.
      //    Loose regex: any string with at least 9 consecutive-or-hyphenated digits.
      const stringMatches: Record<string, { hits: number; sample: string }> = {}
      const allStringCols = await pizzaHouseQuery<{ TABLE_NAME: string; COLUMN_NAME: string }>(
        `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND DATA_TYPE IN ('char', 'varchar', 'text')`,
      )
      for (const c of allStringCols) {
        try {
          const [r] = await pizzaHouseQuery<{ hits: number; sample: string }>(
            `SELECT COUNT(*) as hits, MAX(\`${c.COLUMN_NAME}\`) as sample
             FROM \`${c.TABLE_NAME}\`
             WHERE \`${c.COLUMN_NAME}\` REGEXP '[0-9]{9,}'
                OR \`${c.COLUMN_NAME}\` REGEXP '05[0-9][- ]?[0-9]{3}[- ]?[0-9]{4}'`,
          )
          if (r?.hits && r.hits > 5) { // skip singletons (the 1 clients.phone)
            stringMatches[`${c.TABLE_NAME}.${c.COLUMN_NAME}`] = { hits: r.hits, sample: r.sample }
          }
        } catch { /* skip */ }
      }

      // 3. Numeric columns — Israeli mobile fits in int/bigint (~5xxxxxxxx).
      const numericMatches: Record<string, { hits: number; sample: number }> = {}
      const numericCols = await pizzaHouseQuery<{ TABLE_NAME: string; COLUMN_NAME: string }>(
        `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND DATA_TYPE IN ('int', 'bigint', 'mediumint')`,
      )
      for (const c of numericCols) {
        try {
          const [r] = await pizzaHouseQuery<{ hits: number; sample: number }>(
            `SELECT COUNT(*) as hits, MAX(\`${c.COLUMN_NAME}\`) as sample
             FROM \`${c.TABLE_NAME}\`
             WHERE \`${c.COLUMN_NAME}\` BETWEEN 500000000 AND 599999999
                OR \`${c.COLUMN_NAME}\` BETWEEN 5000000000 AND 5999999999`,
          )
          if (r?.hits && r.hits > 5) {
            numericMatches[`${c.TABLE_NAME}.${c.COLUMN_NAME}`] = { hits: r.hits, sample: r.sample }
          }
        } catch { /* skip */ }
      }

      // 4. Aviv-POS convention often stores customer info on a separate ticket
      //    header. Check for any table with `phone` in a name we may have skipped.
      const anyPhoneCol = await pizzaHouseQuery<{ TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND (COLUMN_NAME LIKE '%phon%' OR COLUMN_NAME LIKE '%tel%' OR COLUMN_NAME LIKE '%mobile%')`,
      )

      // 5. Look inside `dc_deals` for a wider sample — maybe some rows aren't BigApps.
      const dcTypes = await pizzaHouseQuery<{ type: number; name: string; count: number }>(
        `SELECT type, name, COUNT(*) as count
         FROM dc_deals GROUP BY type, name ORDER BY count DESC LIMIT 10`,
      )

      return NextResponse.json({
        branch,
        payment_columns: paymentCols,
        payment_sample: paymentSample,
        columns_with_phone_shaped_strings: stringMatches,
        columns_with_phone_shaped_numbers: numericMatches,
        every_phone_named_column: anyPhoneCol,
        dc_deals_types_breakdown: dcTypes,
      })
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'query failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
