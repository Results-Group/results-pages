import { NextRequest, NextResponse } from 'next/server'
import { requireResourcePermission } from '@/lib/auth'
import { compressAndUploadImage, deleteAsset } from '@/lib/campaigns'
import { assetProxyUrl } from '@/lib/asset-url'
import { getStrategyDocById, setStrategyDocLogoPath } from '@/lib/strategy-docs'
import { parseForm, parseJson } from '@/lib/http'
import { captureException } from '@/lib/logger'

/**
 * Images used inside a strategy document: competitor logos in a Facing table,
 * the brand-persona illustration, the concept visual, and the document logo.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const ACCEPTED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif', 'image/avif',
  'image/tiff', 'image/bmp',
])
const ACCEPTED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tiff', 'bmp'])
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB — the client compresses first; this is the safety net

interface Ctx { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params

  try {
    const doc = await getStrategyDocById(id)
    if (!doc) return NextResponse.json({ error: 'המסמך לא נמצא' }, { status: 404 })

    const permErr = await requireResourcePermission(request, doc.workspace_id, 'edit')
    if (permErr) return permErr

    const { data: formData, error: formError } = await parseForm(request)
    if (formError) return formError

    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'asset'
    if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 50 MB)' }, { status: 413 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_MIME.has(file.type.toLowerCase()) && !ACCEPTED_EXT.has(ext)) {
      return NextResponse.json({ error: 'ניתן להעלות תמונות בלבד' }, { status: 400 })
    }

    // The document UUID is the folder: Supabase Storage rejects non-ASCII keys,
    // and client names are routinely Hebrew. A fresh filename every upload,
    // because these are served with a one-year immutable cache header — a fixed
    // name meant a replaced logo kept showing the old image and read as "the
    // save didn't work".
    const suffix = crypto.randomUUID().slice(0, 8)
    const storagePath = type === 'logo'
      ? `strategy/${id}/logo-${suffix}.webp`
      : `strategy/${id}/${crypto.randomUUID()}.webp`

    const filePath = await compressAndUploadImage(file, storagePath)
    // Logo writes bypass updated_at on purpose — see setStrategyDocLogoPath.
    if (type === 'logo') await setStrategyDocLogoPath(id, filePath)

    return NextResponse.json({ file_path: filePath, public_url: assetProxyUrl(filePath) }, { status: 201 })
  } catch (err) {
    captureException(err, { route: 'POST /api/strategy-docs/[id]/assets', id })
    return NextResponse.json({ error: 'שגיאה בהעלאת הקובץ' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params

  try {
    const doc = await getStrategyDocById(id)
    if (!doc) return NextResponse.json({ error: 'המסמך לא נמצא' }, { status: 404 })

    const permErr = await requireResourcePermission(request, doc.workspace_id, 'edit')
    if (permErr) return permErr

    const { data: body, error: parseError } = await parseJson<{ file_path?: string }>(request)
    if (parseError) return parseError

    const filePath = body.file_path || ''
    // Confine the delete to this document's own folder, so a crafted path can't
    // reach another document's images (or another product's).
    if (!filePath.startsWith(`strategy/${id}/`) || filePath.includes('..')) {
      return NextResponse.json({ error: 'נתיב לא חוקי' }, { status: 400 })
    }

    await deleteAsset(filePath)
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'DELETE /api/strategy-docs/[id]/assets', id })
    return NextResponse.json({ error: 'שגיאה במחיקת הקובץ' }, { status: 500 })
  }
}
