import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getAllWorkspaces, getUserWorkspaces, createWorkspace, syncAdminsToAllWorkspaces, addAllAdminsToWorkspace } from '@/lib/workspaces'
import { parseJson } from '@/lib/http'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.isOwner || session.role === 'admin') {
    // Keep admins synced as members of every workspace
    await syncAdminsToAllWorkspaces().catch(() => {})
    const workspaces = await getAllWorkspaces()
    return NextResponse.json(workspaces)
  }

  const workspaces = await getUserWorkspaces(session.userId)
  return NextResponse.json(workspaces)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session?.isOwner && session?.role !== 'admin') {
    return NextResponse.json({ error: 'רק בעלים או אדמין יכולים ליצור סביבת עבודה' }, { status: 403 })
  }

  const { data: body, error: parseError } = await parseJson<{ name?: string; slug?: string; color?: string; icon?: string }>(req)
  if (parseError) return parseError
  const { name, slug, color, icon } = body
  if (!name || !slug) {
    return NextResponse.json({ error: 'שם וסלאג הם שדות חובה' }, { status: 400 })
  }

  const safeSlug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  try {
    const workspace = await createWorkspace(name, safeSlug, color, icon)
    await addAllAdminsToWorkspace(workspace.id).catch(() => {})
    return NextResponse.json(workspace, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'שגיאה ביצירת סביבת עבודה'
    if (msg.includes('duplicate') || msg.includes('23505')) {
      return NextResponse.json({ error: 'סלאג זה כבר קיים' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
