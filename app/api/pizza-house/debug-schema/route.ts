// TEMPORARY endpoint — introspects the Aviv POS schema so we can decide which
// column holds the customer phone (for switching "unique customers" off the
// credit-card identity onto phone). Admin-gated; DELETE THIS FILE once the
// phone-based unique-customer query lands.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { pizzaHouseQuery, runWithBranch, isPizzaBranch } from '@/lib/pizza-house-db'

export const runtime = 'nodejs'

interface ColumnRow { COLUMN_NAME: string; DATA_TYPE: string; TABLE_NAME: string }

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
      // 1. Every column that even hints at a phone/name/customer, anywhere.
      const phoneish = await pizzaHouseQuery<ColumnRow>(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND (
             COLUMN_NAME LIKE '%phon%' OR COLUMN_NAME LIKE '%tel%'
             OR COLUMN_NAME LIKE '%mobile%' OR COLUMN_NAME LIKE '%cell%'
             OR COLUMN_NAME LIKE '%name%' OR COLUMN_NAME LIKE '%client%'
             OR COLUMN_NAME LIKE '%customer%' OR COLUMN_NAME LIKE '%address%'
           )
         ORDER BY TABLE_NAME, COLUMN_NAME`
      )

      // 2. Full column dump for the four tables we already query — so we can see
      //    every field we haven't touched yet.
      const tables: Record<string, ColumnRow[]> = {}
      for (const t of ['deals', 'paymentitm', 'creditcard', 'dc_deals']) {
        tables[t] = await pizzaHouseQuery<ColumnRow>(
          `SELECT COLUMN_NAME, DATA_TYPE, TABLE_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [t],
        )
      }

      // 3. A tiny non-sensitive sample from dc_deals so we see what shape the
      //    values take. We deliberately exclude sums/dates to keep it small.
      let dcDealsSample: Record<string, unknown>[] = []
      if (tables.dc_deals.length > 0) {
        // Pick just the interesting columns (name-ish, phone-ish, id-ish).
        const interesting = tables.dc_deals
          .filter(c => /name|phon|tel|mobile|cell|address|client|customer|id/i.test(c.COLUMN_NAME))
          .map(c => `\`${c.COLUMN_NAME}\``)
          .join(', ')
        if (interesting) {
          try {
            dcDealsSample = await pizzaHouseQuery<Record<string, unknown>>(
              `SELECT ${interesting} FROM dc_deals ORDER BY id_deal DESC LIMIT 3`,
            )
          } catch {
            dcDealsSample = [{ _note: 'sample query failed — probably no id_deal column; column list is still valid' }]
          }
        }
      }

      // 4. Full table list — in case phone lives somewhere unexpected.
      const allTables = await pizzaHouseQuery<{ TABLE_NAME: string; TABLE_ROWS: number }>(
        `SELECT TABLE_NAME, TABLE_ROWS
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         ORDER BY TABLE_NAME`,
      )

      return NextResponse.json({
        branch,
        phoneish_columns: phoneish,
        key_table_columns: tables,
        dc_deals_sample: dcDealsSample,
        all_tables: allTables.map(t => `${t.TABLE_NAME} (~${t.TABLE_ROWS ?? 0} rows)`),
      })
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'query failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
