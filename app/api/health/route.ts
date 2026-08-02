import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/health — liveness for external uptime monitoring.
 *
 * Exists because of 2026-08-02: the production database was deleted at ~21:15
 * UTC and nobody knew until 21:41, by luck. An uptime monitor pointed here
 * turns that into an alert within minutes.
 *
 * The check must touch the database — the app itself stays up when the
 * database dies, so a plain page-load monitor sees nothing wrong.
 * No auth: it exposes only "ok" / "db unreachable", nothing else.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    // A permission error still proves the database answered.
    if (error && /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Gone|timed out|tenant/i.test(error.message)) {
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, reason: 'db unreachable' }, { status: 503 })
  }
}
