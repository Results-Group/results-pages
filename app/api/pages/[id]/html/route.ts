import { NextRequest, NextResponse } from 'next/server'
import { getPageById, downloadFile, uploadFile, createVersion, markPageTranslationStale } from '@/lib/db'
import { requireResourcePermission } from '@/lib/auth'
import { minifyHtml } from '@/lib/minify'
import { parseJson, parseForm } from '@/lib/http'
import { readStructure, describeStructureLoss } from '@/lib/html-structure'

interface Ctx { params: Promise<{ id: string }> }

function sourcePath(filePath: string): string {
  return filePath.replace(/\.html$/, '.source.html')
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const permErr = await requireResourcePermission(req, page.workspace_id, 'view')
  if (permErr) return permErr

  // Prefer the un-minified source; fall back to the served file for older pages
  let html = await downloadFile(sourcePath(page.file_path))
  if (html === null) {
    html = await downloadFile(page.file_path)
  }
  if (html === null) {
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
  }

  return NextResponse.json({ html, filePath: page.file_path })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const permErr = await requireResourcePermission(req, page.workspace_id, 'edit')
  if (permErr) return permErr

  const contentType = req.headers.get('content-type') || ''

  let htmlContent: string

  if (contentType.includes('multipart/form-data')) {
    const { data: formData, error: formError } = await parseForm(req)
    if (formError) return formError
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!file.name.endsWith('.html') && !file.type.includes('html')) {
      return NextResponse.json({ error: 'ניתן להעלות קבצי HTML בלבד' }, { status: 400 })
    }
    htmlContent = await file.text()
  } else {
    const { data: body, error: parseError } = await parseJson<{ html?: string; guardStructure?: boolean }>(req)
    if (parseError) return parseError
    if (!body.html || typeof body.html !== 'string') {
      return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 })
    }
    htmlContent = body.html

    // The visual editor asks for this; the code editor and the file-replace
    // path deliberately do not. designMode makes the whole document editable,
    // so a caret beside a slider arrow deletes the arrow as readily as a
    // letter — and the page still renders, so nothing says anything is wrong.
    // A save that would drop part of the page's machinery is refused here
    // rather than discovered by the client weeks later.
    if (body.guardStructure) {
      const current = (await downloadFile(sourcePath(page.file_path)))
        ?? (await downloadFile(page.file_path))
      if (current) {
        const lost = describeStructureLoss(readStructure(current), readStructure(htmlContent))
        if (lost.length) {
          return NextResponse.json(
            { error: 'השמירה נעצרה — העריכה הייתה מוחקת חלקים מהדף', lost },
            { status: 409 },
          )
        }
      }
    }
  }

  // Save current served file as a version before overwriting
  try {
    const currentHtml = await downloadFile(page.file_path)
    if (currentHtml) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const pathParts = page.file_path.replace('.html', '')
      const versionPath = `${pathParts}/versions/${timestamp}.html`
      await uploadFile(versionPath, Buffer.from(currentHtml, 'utf-8'))
      await createVersion(page.id, versionPath)
    }
  } catch {
    // Version save failed — continue with the update anyway
  }

  await Promise.all([
    uploadFile(page.file_path, Buffer.from(minifyHtml(htmlContent), 'utf-8')),
    uploadFile(sourcePath(page.file_path), Buffer.from(htmlContent, 'utf-8')),
  ])

  // The Hebrew source just changed — an existing English render is now behind.
  if (page.en_file_path) {
    await markPageTranslationStale(page.id).catch(() => {})
  }

  return NextResponse.json({ ok: true, filePath: page.file_path })
}
