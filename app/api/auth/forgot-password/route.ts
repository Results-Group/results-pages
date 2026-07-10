import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { createResetToken } from '@/lib/reset-token'
import { sendEmail, passwordResetEmail } from '@/lib/email'
import { captureException } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 5, prefix: 'forgot-pw' })
  if (rl) return rl

  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'יש להזין אימייל' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('admin_users')
      .select('id, email, password_hash')
      .eq('email', email.toLowerCase().trim())
      .single()

    // Always respond OK to avoid leaking which emails exist
    if (user?.password_hash) {
      const token = await createResetToken(user.id, user.password_hash)
      // Never derive the origin from request headers (Origin/Referer are
      // attacker-controlled → reset-link poisoning). Env var or server-derived only.
      const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      const link = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`
      const { subject, html } = passwordResetEmail(link)
      await sendEmail({ to: user.email, subject, html })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/auth/forgot-password' })
    return NextResponse.json({ ok: true })
  }
}
