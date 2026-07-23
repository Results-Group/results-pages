// TEMPORARY endpoint — samples the actual shape of creditcard.phone so we
// can understand why the phone-based unique-customer query collapsed to 2.
// DELETE THIS FILE once the query is fixed.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { pizzaHouseQuery, runWithBranch, isPizzaBranch } from '@/lib/pizza-house-db'

export const runtime = 'nodejs'

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
      // Row-level breakdown of what `phone` actually holds.
      const [breakdown] = await pizzaHouseQuery<Record<string, number>>(
        `SELECT
          COUNT(*) as total_rows,
          SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END) as null_phone,
          SUM(CASE WHEN phone = '' THEN 1 ELSE 0 END) as empty_phone,
          SUM(CASE WHEN phone REGEXP '^0+$' THEN 1 ELSE 0 END) as all_zero_phone,
          SUM(CASE WHEN phone REGEXP '^[[:space:]]+$' THEN 1 ELSE 0 END) as whitespace_only,
          SUM(CASE WHEN LENGTH(TRIM(phone)) BETWEEN 9 AND 10 THEN 1 ELSE 0 END) as looks_like_phone,
          SUM(CASE WHEN id_card IS NULL OR id_card = '' THEN 1 ELSE 0 END) as no_id_card
        FROM creditcard`,
      )

      // Top-10 most common phone values (so we can spot dummy defaults).
      const topPhones = await pizzaHouseQuery<{ phone: string | null; occurrences: number }>(
        `SELECT phone, COUNT(*) as occurrences
         FROM creditcard
         GROUP BY phone
         ORDER BY occurrences DESC
         LIMIT 10`,
      )

      // Sample of 5 rows whose phone looks like a real Israeli phone.
      const realPhoneSample = await pizzaHouseQuery<{
        phone: string; id_card: string; date: string; sum: number
      }>(
        `SELECT phone, id_card, date, sum
         FROM creditcard
         WHERE phone IS NOT NULL AND phone != '' AND LENGTH(TRIM(phone)) BETWEEN 9 AND 10
         ORDER BY date DESC
         LIMIT 5`,
      )

      // What the new query actually returns for July (matching user's screenshot).
      const [july] = await pizzaHouseQuery<{ unique_customers: number }>(
        `SELECT COUNT(DISTINCT COALESCE(NULLIF(phone, ''), CONCAT(id_card, '|', validto))) as unique_customers
         FROM creditcard
         WHERE date >= '2026-07-01' AND date < '2026-08-01' AND sum > 0
           AND (phone != '' OR id_card != '')`,
      )

      // For comparison: the old card-based count for the same range.
      const [julyOld] = await pizzaHouseQuery<{ unique_by_card: number }>(
        `SELECT COUNT(DISTINCT CONCAT(id_card, '|', validto)) as unique_by_card
         FROM creditcard
         WHERE date >= '2026-07-01' AND date < '2026-08-01' AND id_card != '' AND sum > 0`,
      )

      return NextResponse.json({
        branch,
        breakdown,
        top_phones: topPhones,
        real_phone_sample: realPhoneSample,
        july_unique_new: july?.unique_customers,
        july_unique_old_by_card: julyOld?.unique_by_card,
      })
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'query failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
