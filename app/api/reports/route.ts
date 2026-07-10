import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { getReports, createReport } from '@/lib/performance-reports'
import { findOrCreateClient, getClientById } from '@/lib/clients'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const authErr = await requireAuth(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined
  const deleted = searchParams.get('deleted') === '1'
  const workspaceId = searchParams.get('workspace_id') || await getActiveWorkspaceId(request) || undefined

  try {
    const reports = await getReports({ search, status, workspace_id: workspaceId, deleted })
    const safe = reports.map(r => ({ ...r, has_password: !!r.password, password: undefined }))
    return NextResponse.json(safe)
  } catch (err) {
    captureException(err, { route: 'GET /api/reports', workspaceId })
    return NextResponse.json({ error: 'שגיאה בטעינת דוחות' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { client, report_name, period_label, status, password, tabs, tabs_en, logo_path, publish_at, brand_color } = body

    const workspaceId: string | null = body.workspace_id ?? await getActiveWorkspaceId(request)
    if (workspaceId) {
      const permErr = await requireWorkspacePermission(request, workspaceId, 'create')
      if (permErr) return permErr
    }

    if (!client || !report_name) {
      return NextResponse.json({ error: 'שם לקוח ושם דוח הם שדות חובה' }, { status: 400 })
    }

    const baseSlug = (body.slug || report_name)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = crypto.randomUUID().slice(0, 6)
    const slug = baseSlug ? `${baseSlug}-${suffix}` : suffix

    const { data: slugTaken } = await supabase
      .from('performance_reports')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (slugTaken) {
      return NextResponse.json({ error: `דוח עם הסלאג "${slug}" כבר קיים` }, { status: 409 })
    }

    let clientId: string | null = body.client_id || null
    if (clientId) {
      const clientRow = await getClientById(clientId)
      if (!clientRow) {
        return NextResponse.json({ error: 'הלקוח שנבחר לא נמצא' }, { status: 400 })
      }
    } else if (client) {
      try {
        const c = await findOrCreateClient(client, workspaceId)
        clientId = c.id
      } catch { /* non-fatal */ }
    }

    const report = await createReport({
      client,
      report_name,
      slug,
      period_label: period_label || undefined,
      tabs: tabs || undefined,
      tabs_en: tabs_en || undefined,
      status: status || 'draft',
      publish_at: publish_at || null,
      password: password || undefined,
      logo_path: logo_path || undefined,
      brand_color: brand_color || undefined,
      created_by: session.userId,
      workspace_id: workspaceId || undefined,
      client_id: clientId,
    })

    await logAudit({ actor: session, action: 'create', entity_type: 'report', entity_id: report.id, entity_label: report.report_name, workspace_id: workspaceId })
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    captureException(err, { route: 'POST /api/reports' })
    return NextResponse.json({ error: 'שגיאה ביצירת דוח' }, { status: 500 })
  }
}
