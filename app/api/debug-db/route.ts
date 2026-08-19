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

  // Import every module the broken routes share, one at a time — whichever
  // throws at load is the culprit the 500s are hiding.
  const suspects = ['@/lib/logger', '@/lib/db', '@/lib/campaigns', '@/lib/clients', '@/lib/audit', '@/lib/monday', '@/lib/db-health', '@/lib/workspaces'] as const
  const imports: Record<string, string> = {}
  for (const m of suspects) {
    try {
      // Literal switch: turbopack can't bundle a fully dynamic specifier.
      if (m === '@/lib/logger') await import('@/lib/logger')
      else if (m === '@/lib/db') await import('@/lib/db')
      else if (m === '@/lib/campaigns') await import('@/lib/campaigns')
      else if (m === '@/lib/clients') await import('@/lib/clients')
      else if (m === '@/lib/audit') await import('@/lib/audit')
      else if (m === '@/lib/monday') await import('@/lib/monday')
      else if (m === '@/lib/db-health') await import('@/lib/db-health')
      else await import('@/lib/workspaces')
      imports[m] = 'ok'
    } catch (err) {
      imports[m] = err instanceof Error ? `${err.name}: ${err.message} | ${(err.stack || '').split('\n').slice(1, 4).join(' ~ ')}` : String(err)
    }
  }
  out.imports = imports

  try {
    const { getPages } = await import('@/lib/db')
    const pages = await getPages()
    out.getPages = { ok: true, count: Array.isArray(pages) ? pages.length : -1 }
  } catch (err) {
    out.getPages = { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
  }

  return NextResponse.json(out)
}
