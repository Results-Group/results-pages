import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getCampaignBySlug } from '@/lib/campaigns'
import { signAccessToken, CONTENT_ACCESS_MAX_AGE } from '@/lib/content-access'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rl = await rateLimit(request, { windowMs: 60_000, max: 10, prefix: 'cmp-access' })
  if (rl) return rl

  try {
    const { slug, password } = await request.json()

    if (!slug || typeof password !== 'string') {
      return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
    }

    const campaign = await getCampaignBySlug(slug)
    if (!campaign || campaign.status === 'draft') {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    if (!campaign.password) {
      return NextResponse.json({ ok: true })
    }

    // Support both bcrypt hashes and legacy plaintext
    let valid = false
    if (campaign.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, campaign.password)
    } else {
      valid = password === campaign.password
    }

    if (!valid) {
      return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
    }

    const token = await signAccessToken(campaign.id)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(`cmp_${campaign.id}`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CONTENT_ACCESS_MAX_AGE,
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 })
  }
}
