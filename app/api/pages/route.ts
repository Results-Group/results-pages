import { NextRequest, NextResponse } from 'next/server'
import { getPages, createPage } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const client = searchParams.get('client') || undefined
  const search = searchParams.get('search') || undefined

  const pages = await getPages({ client, search })
  return NextResponse.json(pages)
}

export async function POST(req: NextRequest) {
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
