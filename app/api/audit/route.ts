import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getAuditLog, type AuditAction, type AuditEntity } from '@/lib/audit'
import { captureException } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  try {
    const entries = await getAuditLog({
      user_id: searchParams.get('user_id') || undefined,
      entity_type: (searchParams.get('entity_type') as AuditEntity) || undefined,
      action: (searchParams.get('action') as AuditAction) || undefined,
      limit: Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 200)),
    })
    return NextResponse.json(entries)
  } catch (err) {
    captureException(err, { route: 'GET /api/audit' })
    return NextResponse.json([], { status: 200 })
  }
}
