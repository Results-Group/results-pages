import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { getClientById, deleteClient } from '@/lib/clients'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

/**
 * POST /api/clients/[id]/merge
 * Body: { merge_into_id: string }
 *
 * Reassigns all campaigns and landing pages from client `id` (the duplicate)
 * to `merge_into_id` (the one to keep), then deletes the duplicate.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { merge_into_id?: string }
  const mergeIntoId = body.merge_into_id?.trim()

  if (!mergeIntoId) return NextResponse.json({ error: 'merge_into_id is required' }, { status: 400 })
  if (mergeIntoId === id) return NextResponse.json({ error: 'Cannot merge a client into itself' }, { status: 400 })

  const [source, target] = await Promise.all([getClientById(id), getClientById(mergeIntoId)])
  if (!source) return NextResponse.json({ error: 'לקוח מקור לא נמצא' }, { status: 404 })
  if (!target) return NextResponse.json({ error: 'לקוח יעד לא נמצא' }, { status: 404 })

  // Require edit permission on both clients' workspaces
  for (const wsId of [source.workspace_id, target.workspace_id]) {
    if (wsId) {
      const permErr = await requireWorkspacePermission(req, wsId, 'edit')
      if (permErr) return permErr
    }
  }

  try {
    // Reassign campaigns
    const { error: campErr } = await supabase
      .from('campaigns')
      .update({ client_id: mergeIntoId, client: target.name })
      .eq('client_id', id)
    if (campErr) throw campErr

    // Reassign landing pages
    const { error: pageErr } = await supabase
      .from('landing_pages')
      .update({ client_id: mergeIntoId, client: target.name })
      .eq('client_id', id)
    if (pageErr) throw pageErr

    // Reassign performance reports
    const { error: reportErr } = await supabase
      .from('performance_reports')
      .update({ client_id: mergeIntoId, client: target.name })
      .eq('client_id', id)
    if (reportErr) throw reportErr

    // Delete the duplicate
    await deleteClient(id)

    await logAudit({
      actor: session,
      action: 'delete',
      entity_type: 'client',
      entity_id: id,
      entity_label: `מיזוג: "${source.name}" → "${target.name}"`,
      workspace_id: target.workspace_id,
      meta: { merged_from: id, merged_from_name: source.name, merged_into: mergeIntoId, merged_into_name: target.name },
    })

    return NextResponse.json({ ok: true, merged_into: target })
  } catch (err) {
    captureException(err, { route: 'POST /api/clients/[id]/merge', id, mergeIntoId })
    return NextResponse.json({ error: 'שגיאה במיזוג הלקוחות' }, { status: 500 })
  }
}
