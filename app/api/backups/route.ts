import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/logger'

/**
 * GET /api/backups — recent backup runs, for the status strip in the admin.
 *
 * The whole point is visibility: a backup that stops running without anyone
 * noticing is the failure mode this system exists to avoid.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase
      .from('backup_runs')
      .select('id,started_at,finished_at,ok,table_rows,files_total,files_copied,bytes_copied,snapshot_path,error')
      .order('started_at', { ascending: false })
      .limit(14)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err) {
    captureException(err, { route: 'GET /api/backups' })
    return NextResponse.json({ error: 'שגיאה בטעינת הנתונים' }, { status: 500 })
  }
}
