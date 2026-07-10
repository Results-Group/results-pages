import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({
    user: {
      userId: session.userId,
      email: session.email,
      role: session.role,
      name: session.name,
      isOwner: session.isOwner || false,
    },
  })
}
