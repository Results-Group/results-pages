import { NextRequest, NextResponse } from 'next/server'
import { getPageById, getVersions, getVersion, downloadFile, uploadFile, createVersion, deleteVersion } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const versions = await getVersions(id)
  return NextResponse.json({ versions })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const roleErr = requireRole(req, 'editor')
  if (roleErr) return roleErr

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { versionId } = body

  if (!versionId) {
    return NextResponse.json({ error: 'Missing versionId' }, { status: 400 })
  }

  const version = await getVersion(versionId)
  if (!version || version.page_id !== id) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  const versionHtml = await downloadFile(version.file_path)
  if (!versionHtml) {
    return NextResponse.json({ error: 'Version file not found in storage' }, { status: 404 })
  }

  // Save current as a new version before rollback
  try {
    const currentHtml = await downloadFile(page.file_path)
    if (currentHtml) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const pathParts = page.file_path.replace('.html', '')
      const versionPath = `${pathParts}/versions/${timestamp}.html`
      await uploadFile(versionPath, Buffer.from(currentHtml, 'utf-8'))
      await createVersion(id, versionPath, 'לפני שחזור')
    }
  } catch {
    // Continue with rollback even if version save fails
  }

  // Overwrite main file with the version content
  await uploadFile(page.file_path, Buffer.from(versionHtml, 'utf-8'))

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const roleErr = requireRole(req, 'admin')
  if (roleErr) return roleErr

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const versionId = url.searchParams.get('versionId')
  if (!versionId) {
    return NextResponse.json({ error: 'Missing versionId' }, { status: 400 })
  }

  const version = await getVersion(versionId)
  if (!version || version.page_id !== id) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  await deleteVersion(versionId)
  return NextResponse.json({ ok: true })
}
