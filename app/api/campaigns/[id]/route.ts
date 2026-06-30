import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth'
import { getCampaignById, updateCampaign, deleteCampaign, enrichCampaignUrls } from '@/lib/campaigns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { id } = await params

  try {
    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }
    return NextResponse.json(enrichCampaignUrls(campaign))
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה בטעינת קמפיין' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleErr = requireRole(request, 'editor')
  if (roleErr) return roleErr

  const { id } = await params

  try {
    const existing = await getCampaignById(id)
    if (!existing) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const body = await request.json()
    const campaign = await updateCampaign(id, body)
    return NextResponse.json(campaign)
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה בעדכון קמפיין' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleErr = requireRole(request, 'admin')
  if (roleErr) return roleErr

  const { id } = await params

  try {
    const existing = await getCampaignById(id)
    if (!existing) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    await deleteCampaign(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה במחיקת קמפיין' },
      { status: 500 }
    )
  }
}
