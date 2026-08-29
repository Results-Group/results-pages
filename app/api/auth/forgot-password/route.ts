import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { createResetToken } from '@/lib/reset-token'
import { sendEmail, passwordResetEmail } from '@/lib/email'
import { captureException } from '@/lib/logger'
import { parseJson } from '@/lib/http'

export async function POST(req: NextRequest) {
  // Generous per-IP cap: the whole team shares one office NAT address, so a
  // tight per-IP limit here locked everyone out after one person's reset.
  // The meaningful bucket is per-account, below.
  const rl = await rateLimit(req, { windowMs: 60_000, max: 30, prefix: 'forgot-pw' })
  if (rl) return rl

  try {
    const { data: body, error: parseError } = await parseJson<{ email?: string }>(req)
    if (parseError) return parseError
    const { email } = body
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'יש להזין אימייל' }, { status: 400 })
    }

    // Caps reset mails to one address — a mailbox-flood guard, and it also
    // stops one account's token being ground down by repeated issuance.
    const emailRl = await rateLimit(req, {
      windowMs: 60_000, max: 3, prefix: 'forgot-pw-acct', key: email.toLowerCase().trim(),
    })
    if (emailRl) return emailRl

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
