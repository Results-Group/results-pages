import { NextRequest, NextResponse } from 'next/server'
import { getPages, createPage } from '@/lib/db'
import { requireAuth, requireRole, getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const { searchParams } = req.nextUrl
  const client = searchParams.get('client') || undefined
  const search = searchParams.get('search') || undefined

  const pages = await getPages({ client, search })
  const safe = pages.map(p => ({ ...p, has_password: !!p.password, password: undefined }))
  return NextResponse.json(safe)
}

export async function POST(req: NextRequest) {
  const roleErr = await requireRole(req, 'editor')
  if (roleErr) return roleErr

  const session = await getSessionFromRequest(req)
  const body = await req.json()
  const { client, slug, title, filePath, expiresAt } = body

  const page = await createPage({
    client,
    slug,
    title,
    file_path: filePath,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    created_by: session?.userId !== 'legacy' ? session?.userId : undefined,
  })

  return NextResponse.json(page, { status: 201 })
}
