import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { updateWorkspace, deleteWorkspace } from '@/lib/workspaces'
import { parseJson } from '@/lib/http'

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
  if (!session?.isOwner && session?.role !== 'admin') {
    return NextResponse.json({ error: 'אין הרשאה למחוק סביבת עבודה' }, { status: 403 })
  }

  const { id } = await params
  try {
    await deleteWorkspace(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'שגיאה במחיקת סביבת עבודה' }, { status: 500 })
  }
}
