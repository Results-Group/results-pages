// TEMPORARY — broader search for where the customer phone actually lives.
// The user says phones ARE captured at the POS, so they must be stored
// somewhere — not creditcard.phone (which is "---" for every row).
// DELETE THIS FILE after we find the right column.

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
      // 1. Full sample of clients — only 2 rows total, so let's see them.
      const allClients = await pizzaHouseQuery(`SELECT * FROM clients LIMIT 10`)

      // 2. Deals with a non-zero client_id — see how often it's used.
      const [dealsWithClient] = await pizzaHouseQuery<{ count: number; total: number }>(
        `SELECT
           SUM(CASE WHEN client_id IS NOT NULL AND client_id != 0 THEN 1 ELSE 0 END) as count,
           COUNT(*) as total
         FROM deals`,
      )
      const sampleDealsWithClient = await pizzaHouseQuery(
        `SELECT id_deal, tm_open, sum, client_id FROM deals WHERE client_id IS NOT NULL AND client_id != 0 ORDER BY tm_open DESC LIMIT 5`,
      )

      // 3. Recent dc_deals rows — full column dump (delivery cases).
      const dcSample = await pizzaHouseQuery(`SELECT * FROM dc_deals ORDER BY id_docum DESC LIMIT 5`)

      // 4. Recent deals rows — full column dump.
      const dealsSample = await pizzaHouseQuery(`SELECT * FROM deals ORDER BY id_deal DESC LIMIT 3`)

      // 5. Recent creditcard rows — full dump, in case there's a real phone
      //    in another column we ignored (e.g. nm_card holds phones?).
      const ccSample = await pizzaHouseQuery(`SELECT * FROM creditcard ORDER BY id_docum DESC LIMIT 5`)

      // 6. Wider phone hunt: any string column with values that LOOK like
      //    an Israeli phone (starts with 05 or 972 or has 9-10 digits).
      //    Check across the biggest tables.
      const wideHunt: Record<string, unknown[]> = {}
      const stringishTables = ['deals', 'dc_deals', 'creditcard', 'paymentitm', 'clients']
      for (const t of stringishTables) {
        // Get every char/varchar column on the table
        const cols = await pizzaHouseQuery<{ COLUMN_NAME: string }>(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             AND DATA_TYPE IN ('char', 'varchar', 'text')`,
          [t],
        )
        for (const c of cols) {
          try {
            // How many rows in this column look like a phone (start with 05 or contain 9+ digits)?
            const [r] = await pizzaHouseQuery<{ hits: number; sample: string }>(
              `SELECT COUNT(*) as hits, MAX(\`${c.COLUMN_NAME}\`) as sample
               FROM \`${t}\`
               WHERE \`${c.COLUMN_NAME}\` REGEXP '^0?5[0-9]{8}$'
                  OR \`${c.COLUMN_NAME}\` REGEXP '^0?5[0-9]-?[0-9]{3}-?[0-9]{4}$'`,
            )
            if (r?.hits && r.hits > 0) {
              wideHunt[`${t}.${c.COLUMN_NAME}`] = [{ hits: r.hits, sample_value: r.sample }]
            }
          } catch { /* skip columns that don't support REGEXP */ }
        }
      }

      return NextResponse.json({
        branch,
        clients_all: allClients,
        deals_with_client_stats: dealsWithClient,
        deals_with_client_sample: sampleDealsWithClient,
        dc_deals_sample: dcSample,
        deals_sample: dealsSample,
        creditcard_sample: ccSample,
        columns_that_contain_phone_shaped_values: wideHunt,
      })
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'query failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
