import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { updateWorkspace, deleteWorkspace } from '@/lib/workspaces'
import { parseJson } from '@/lib/http'
import { supabase } from '@/lib/supabase'

interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session?.isOwner && session?.role !== 'admin') {
    return NextResponse.json({ error: 'אין הרשאה לערוך סביבת עבודה' }, { status: 403 })
  }

  const { id } = await params
  const { data: body, error: parseError } = await parseJson<Partial<{ name: string; slug: string; color: string; icon: string }>>(req)
  if (parseError) return parseError

  try {
    const workspace = await updateWorkspace(id, body)
    return NextResponse.json(workspace)
  } catch {
    return NextResponse.json({ error: 'שגיאה בעדכון סביבת עבודה' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  // Owner only: the FK is ON DELETE SET NULL, so this silently detaches content
  // rather than failing, and the association can't be restored.
  if (!session?.isOwner) {
    return NextResponse.json({ error: 'רק הבעלים יכול למחוק סביבת עבודה' }, { status: 403 })
  }

  const { id } = await params
  try {
    // Refuse while anything still points at it. Deleting would set every
    // page/campaign/report/client to workspace_id NULL, dropping them out of
    // every workspace-scoped list with no way to recover the link.
    const [pages, campaigns, reports, clients] = await Promise.all([
      supabase.from('landing_pages').select('id', { count: 'exact', head: true }).eq('workspace_id', id),
      supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', id),
      supabase.from('performance_reports').select('id', { count: 'exact', head: true }).eq('workspace_id', id),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('workspace_id', id),
    ])
    const inUse =
      (pages.count ?? 0) + (campaigns.count ?? 0) + (reports.count ?? 0) + (clients.count ?? 0)
    if (inUse > 0) {
      return NextResponse.json(
        { error: `לא ניתן למחוק — ${inUse} פריטים עדיין משויכים לסביבה זו. העבירו אותם קודם.` },
        { status: 409 },
      )
    }
    await deleteWorkspace(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'שגיאה במחיקת סביבת עבודה' }, { status: 500 })
  }
}
