import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { getStrategyDocById, restoreStrategyDoc } from '@/lib/strategy-docs'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

/** Lifts a document out of the recycle bin. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getStrategyDocById(id)
  if (!existing) return NextResponse.json({ error: 'המסמך לא נמצא' }, { status: 404 })

  const permErr = await requireResourcePermission(request, existing.workspace_id, 'edit')
  if (permErr) return permErr

  try {
    await restoreStrategyDoc(id)
    await logAudit({
      actor: session, action: 'restore', entity_type: 'strategy_doc',
      entity_id: id, entity_label: existing.doc_name, workspace_id: existing.workspace_id || undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/strategy-docs/[id]/restore', id })
    return NextResponse.json({ error: 'שגיאה בשחזור המסמך' }, { status: 500 })
  }
}
