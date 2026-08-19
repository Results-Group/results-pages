import { NextResponse } from 'next/server'

/**
 * TEMPORARY diagnostics — added during the 2026-08-19 production incident
 * (every Supabase-touching route 500s while the same DB answers externally).
 * Returns error shapes only, never data. DELETE after the incident.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const out: Record<string, unknown> = {
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      urlHost: (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host } catch { return 'INVALID' } })(),
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceKeyLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
      hasSessionSecret: !!process.env.SESSION_SECRET,
    },
  }

  try {
    const { supabase } = await import('@/lib/supabase')
    const { error, count } = await supabase.from('landing_pages').select('id', { count: 'exact', head: true })
    out.query = { ok: !error, count, error: error ? { message: error.message, code: error.code, details: error.details } : null }
  } catch (err) {
    out.importOrQueryThrow = err instanceof Error ? { name: err.name, message: err.message, stack: (err.stack || '').split('\n').slice(0, 6) } : String(err)
  }

  return NextResponse.json(out)
}
