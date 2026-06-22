import { NextRequest, NextResponse } from 'next/server'
import { getPageById, resetPageViews } from '@/lib/db'
import { requireRole } from '@/lib/auth'

interface Ctx { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const roleErr = requireRole(req, 'admin')
  if (roleErr) return roleErr

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await resetPageViews(id)
  return NextResponse.json({ ok: true })
}
