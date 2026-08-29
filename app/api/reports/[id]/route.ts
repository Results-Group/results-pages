import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { requirePurgeConfirmation } from '@/lib/purge-guard'
import { getReportById, updateReport, deleteReport, purgeReport, type PerformanceReport } from '@/lib/performance-reports'
import { findOrCreateClient, validateClientForWorkspace } from '@/lib/clients'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'
import { parseJson } from '@/lib/http'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const report = await getReportById(id)
    if (!report) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 })
    }
    const permErr = await requireResourcePermission(request, report.workspace_id, 'view')
    if (permErr) return permErr
    return NextResponse.json({ ...report, has_password: !!report.password, password: undefined })
  } catch {
    return NextResponse.json({ error: 'שגיאה בטעינת דוח' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await getReportById(id)
    if (!existing) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 })
    }

    const permErr = await requireResourcePermission(request, existing.workspace_id, 'edit')
    if (permErr) return permErr

    const { data: body, error: parseError } = await parseJson<Partial<Omit<PerformanceReport, 'id' | 'created_at'>>>(request)
    if (parseError) return parseError

    // `!== undefined`, not truthiness: `workspace_id: null` is falsy, so the
    // old guard let any editor detach a record from its workspace with no check
    // on the target — the row then vanished from every teammate's filtered list
    // and became owner/admin-only. requireResourcePermission covers the null
    // case properly. app/api/pages/[id] already did it this way.
    if (body.workspace_id !== undefined && body.workspace_id !== existing.workspace_id) {
      const permErr = await requireResourcePermission(request, body.workspace_id, 'edit')
      if (permErr) return permErr
    }

    const targetWorkspaceId = body.workspace_id !== undefined ? body.workspace_id : existing.workspace_id
    // A client_id from the body must belong to the target workspace, or an
    // editor can attach another workspace's client and read its positioning
    // back through generate-copy. The create route already checked this.
    const clientErr = await validateClientForWorkspace(body.client_id, targetWorkspaceId)
    if (clientErr) return NextResponse.json({ error: clientErr }, { status: 400 })
    if (typeof body.client === 'string' && body.client.trim() && (body.client_id === undefined || body.client_id === null)) {
      try {
        const c = await findOrCreateClient(body.client, targetWorkspaceId)
        body.client_id = c.id
      } catch { /* non-fatal */ }
    }

    const report = await updateReport(id, body)
    const action = body.status === 'published' && existing.status !== 'published' ? 'publish' : 'update'
    await logAudit({ actor: session, action, entity_type: 'report', entity_id: id, entity_label: report.report_name, workspace_id: existing.workspace_id })
    return NextResponse.json({ ...report, has_password: !!report.password, password: undefined })
  } catch {
    return NextResponse.json({ error: 'שגיאה בעדכון דוח' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await getReportById(id)
    if (!existing) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 })
    }

    const permErr = await requireResourcePermission(request, existing.workspace_id, 'delete')
    if (permErr) return permErr

    const purge = new URL(request.url).searchParams.get('purge') === '1'
    if (purge) {
      const guardErr = await requirePurgeConfirmation(request, existing.report_name)
      if (guardErr) return guardErr
      await purgeReport(id)
    } else {
      await deleteReport(id)
    }
    await logAudit({ actor: session, action: purge ? 'purge' : 'delete', entity_type: 'report', entity_id: id, entity_label: existing.report_name, workspace_id: existing.workspace_id })
    return NextResponse.json({ success: true, purged: purge })
  } catch (err) {
    captureException(err, { route: 'DELETE /api/reports/[id]', id })
    return NextResponse.json({ error: 'שגיאה במחיקת דוח' }, { status: 500 })
  }
}
