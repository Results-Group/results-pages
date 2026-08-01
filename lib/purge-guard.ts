import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from './auth'

/**
 * Guard for permanent deletion.
 *
 * Soft-delete is reversible and rightly available to anyone with delete
 * permission. Purge is not: it drops the row AND the stored files, with no
 * backup behind it. It sat one query parameter away from a normal delete, and
 * any workspace member with delete rights could reach it.
 *
 * Two conditions now: the caller must be a global admin or the owner, and must
 * echo back the exact name of the thing being destroyed. The echo is what makes
 * it hard to do by accident — an operator who mistypes a name gets a 400
 * instead of an irreversible deletion.
 */
export async function requirePurgeConfirmation(
  req: NextRequest,
  entityLabel: string
): Promise<NextResponse | null> {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!session.isOwner && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'מחיקה סופית מותרת למנהל בלבד. אפשר להעביר לסל מיחזור במקום.' },
      { status: 403 }
    )
  }

  const confirm = new URL(req.url).searchParams.get('confirm')
  if (!confirm) {
    return NextResponse.json(
      { error: 'מחיקה סופית דורשת אישור בשם הפריט', requiredConfirmation: entityLabel },
      { status: 400 }
    )
  }
  // Trim only — matching loosely would defeat the point of typing it out.
  if (confirm.trim() !== (entityLabel || '').trim()) {
    return NextResponse.json(
      { error: 'השם שהוזן אינו תואם לפריט שמנסים למחוק', requiredConfirmation: entityLabel },
      { status: 400 }
    )
  }
  return null
}
