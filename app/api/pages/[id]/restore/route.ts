import { NextRequest, NextResponse } from 'next/server'
import { getPageById, restorePage } from '@/lib/db'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (page.workspace_id) {
    const permErr = await requireWorkspacePermission(req, page.workspace_id, 'delete')
    if (permErr) return permErr
  }

  try {
    await restorePage(id)
    await logAudit({ actor: session, action: 'restore', entity_type: 'page', entity_id: id, entity_label: page.title, workspace_id: page.workspace_id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/pages/[id]/restore', id })
    return NextResponse.json({ error: 'שגיאה בשחזור הדף' }, { status: 500 })
  }
}
