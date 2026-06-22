import { NextRequest, NextResponse } from 'next/server'
import { getPages, createPage } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { searchParams } = req.nextUrl
  const client = searchParams.get('client') || undefined
  const search = searchParams.get('search') || undefined

  const pages = await getPages({ client, search })
  return NextResponse.json(pages)
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { client, slug, title, filePath, expiresAt } = body

  const page = await createPage({
    client,
    slug,
    title,
    file_path: filePath,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  })

  return NextResponse.json(page, { status: 201 })
}
