import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getReportBySlug } from '@/lib/performance-reports'
import { signAccessToken, CONTENT_ACCESS_MAX_AGE } from '@/lib/content-access'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rl = await rateLimit(request, { windowMs: 60_000, max: 10, prefix: 'rpt-access' })
  if (rl) return rl

  try {
    const { slug, password } = await request.json()

    if (!slug || typeof password !== 'string') {
      return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
    }

    const report = await getReportBySlug(slug)
    if (!report || report.status === 'draft') {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 })
    }

    if (!report.password) {
      return NextResponse.json({ ok: true })
    }

    let valid = false
    if (report.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, report.password)
    } else {
      valid = password === report.password
    }

    if (!valid) {
      return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
    }

    const token = await signAccessToken(report.id, report.password)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(`rpt_${report.id}`, token, {
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
