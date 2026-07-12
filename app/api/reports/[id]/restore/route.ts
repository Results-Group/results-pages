import { NextRequest, NextResponse } from 'next/server'
import { getReportById, restoreReport } from '@/lib/performance-reports'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const report = await getReportById(id)
  if (!report) return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 })

  const permErr = await requireResourcePermission(req, report.workspace_id, 'delete')
  if (permErr) return permErr

  try {
    await restoreReport(id)
    await logAudit({ actor: session, action: 'restore', entity_type: 'report', entity_id: id, entity_label: report.report_name, workspace_id: report.workspace_id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/reports/[id]/restore', id })
    return NextResponse.json({ error: 'שגיאה בשחזור הדוח' }, { status: 500 })
  }
}
