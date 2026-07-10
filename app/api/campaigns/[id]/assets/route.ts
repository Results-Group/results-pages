import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  getCampaignById,
  updateCampaign,
  compressAndUploadImage,
  uploadLogoImage,
  getAssetPublicUrl,
  deleteAsset,
} from '@/lib/campaigns'
import { captureException } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

const ACCEPTED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif', 'image/avif',
  'image/tiff', 'image/bmp',
])
const ACCEPTED_EXT = new Set(['jpg','jpeg','png','webp','gif','heic','heif','avif','tiff','bmp'])
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB (client compresses first; this is a safety net)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleErr = await requireRole(request, 'editor')
  if (roleErr) return roleErr

  const { id } = await params

  try {
    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'asset'

    if (!file) {
      return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })
    }

    // Size guard
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 50 MB)' }, { status: 413 })
    }

    // MIME / extension guard
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mime = file.type.toLowerCase()
    if (!ACCEPTED_MIME.has(mime) && !ACCEPTED_EXT.has(ext)) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך — ניתן להעלות תמונות בלבד' }, { status: 415 })
    }

    let filePath: string

    if (type === 'logo') {
      filePath = await uploadLogoImage(file, id)
      await updateCampaign(id, { logo_path: filePath })
    } else {
      const uuid = crypto.randomUUID()
      const storagePath = `campaigns/${id}/${uuid}.webp`
      filePath = await compressAndUploadImage(file, storagePath)
    }

    return NextResponse.json({
      file_path: filePath,
      public_url: getAssetPublicUrl(filePath),
    }, { status: 201 })
  } catch (error) {
    captureException(error, { route: 'POST /api/campaigns/[id]/assets', id })
    return NextResponse.json(
      { error: 'שגיאה בהעלאת קבצים — נסה שוב' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleErr = await requireRole(request, 'editor')
  if (roleErr) return roleErr

  const { id } = await params

  try {
    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const body = await request.json()
    const { file_path } = body

    if (!file_path) {
      return NextResponse.json(
        { error: 'נדרש נתיב קובץ למחיקה' },
        { status: 400 }
      )
    }

    const expectedPrefix = `campaigns/${id}/`
    if (!file_path.startsWith(expectedPrefix) || file_path.includes('..')) {
      return NextResponse.json(
        { error: 'נתיב קובץ לא חוקי' },
        { status: 400 }
      )
    }

    await deleteAsset(file_path)
    return NextResponse.json({ success: true })
  } catch (error) {
    captureException(error, { route: 'DELETE /api/campaigns/[id]/assets', id })
    return NextResponse.json(
      { error: 'שגיאה במחיקת קובץ' },
      { status: 500 }
    )
  }
}
