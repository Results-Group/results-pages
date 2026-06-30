import { NextRequest, NextResponse } from 'next/server'
import { getCampaignBySlug } from '@/lib/campaigns'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { slug, password } = await request.json()

    if (!slug || typeof password !== 'string') {
      return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
    }

    const campaign = await getCampaignBySlug(slug)
    if (!campaign || campaign.status === 'draft') {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    // No password set → nothing to verify
    if (!campaign.password) {
      return NextResponse.json({ ok: true })
    }

    if (password !== campaign.password) {
      return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(`cmp_${campaign.id}`, campaign.password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 })
  }
}
