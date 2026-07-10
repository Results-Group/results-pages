import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { syncClientsFromMonday, isMondayConfigured } from '@/lib/monday'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

/**
 * GET /api/clients/sync
 * Returns whether the Monday.com integration is configured and available
 * for the current workspace. Used by the admin UI to conditionally show
 * the sync button.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configured = isMondayConfigured()
  const workspaceId = await getActiveWorkspaceId(req)
  const syncWorkspaceId = process.env.MONDAY_SYNC_WORKSPACE_ID

  return NextResponse.json({
    configured,
    available: configured && !!syncWorkspaceId && workspaceId === syncWorkspaceId,
  })
}

/**
 * POST /api/clients/sync
 * Triggers a manual sync of clients from Monday.com.
 * Only works when the active workspace is the Results Digital workspace.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isMondayConfigured()) {
    return NextResponse.json({ error: 'Monday.com integration is not configured' }, { status: 503 })
  }

  const syncWorkspaceId = process.env.MONDAY_SYNC_WORKSPACE_ID
  const workspaceId = await getActiveWorkspaceId(req)

  if (!syncWorkspaceId || workspaceId !== syncWorkspaceId) {
    return NextResponse.json(
      { error: 'סנכרון Monday.com זמין רק עבור סביבת העבודה Results Digital' },
      { status: 403 },
    )
  }

  const permErr = await requireWorkspacePermission(req, syncWorkspaceId, 'create')
  if (permErr) return permErr

  try {
    const result = await syncClientsFromMonday()

    await logAudit({
      actor: session,
      action: 'create',
      entity_type: 'client',
      entity_label: `Monday sync: ${result.created} created, ${result.skipped} skipped`,
      workspace_id: syncWorkspaceId,
      meta: { created: result.created, skipped: result.skipped, total: result.total },
    })

    return NextResponse.json(result)
  } catch (err) {
    captureException(err, { route: 'POST /api/clients/sync' })
    const message = err instanceof Error ? err.message : 'שגיאה בסנכרון מ-Monday.com'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
