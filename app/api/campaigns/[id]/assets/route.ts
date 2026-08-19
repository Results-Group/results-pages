import { NextRequest, NextResponse } from 'next/server'
import { requireResourcePermission } from '@/lib/auth'
import {
  getCampaignById,
  setCampaignLogoPath,
  compressAndUploadImage,
  uploadLogoImage,
  getAssetPublicUrl,
  deleteAsset,
} from '@/lib/campaigns'
import { captureException } from '@/lib/logger'
import { rejectUpload } from '@/lib/image-accept'

export const runtime = 'nodejs'
export const maxDuration = 60


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const permErr = await requireResourcePermission(request, campaign.workspace_id, 'edit')
    if (permErr) return permErr

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'asset'

    if (!file) {
      return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })
    }

    // Acceptance rules live in lib/image-accept so tests hold the exact rule.
    const rejection = rejectUpload(file.name, file.type, file.size)
    if (rejection === 'too-large') {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 50 MB)' }, { status: 413 })
    }
    if (rejection) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך — ניתן להעלות תמונות בלבד' }, { status: 415 })
    }

    let filePath: string

    if (type === 'logo') {
      filePath = await uploadLogoImage(file, id)
      await setCampaignLogoPath(id, filePath)
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
  const { id } = await params

  try {
    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const permErr = await requireResourcePermission(request, campaign.workspace_id, 'edit')
    if (permErr) return permErr

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
