import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const client = searchParams.get('client')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}
  if (client) where.client = client
  if (search) where.title = { contains: search }

  const pages = await prisma.page.findMany({
    where,
    include: { _count: { select: { views: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(pages)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client, slug, title, filePath, expiresAt } = body

  const page = await prisma.page.create({
    data: {
      client,
      slug,
      title,
      filePath,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })

  return NextResponse.json(page, { status: 201 })
}
