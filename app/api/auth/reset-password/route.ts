import { NextRequest, NextResponse } from 'next/server'
import { invalidateAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyResetToken } from '@/lib/reset-token'
import { hashPassword } from '@/lib/hash'
import { captureException } from '@/lib/logger'
import { parseJson } from '@/lib/http'

async function lookupPasswordHash(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('admin_users')
    .select('password_hash')
    .eq('id', userId)
    .single()
  return data?.password_hash || null
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'reset-pw' })
  if (rl) return rl

  try {
    const { data: body, error: parseError } = await parseJson<{ token?: string; password?: string }>(req)
    if (parseError) return parseError
    const { token, password } = body
    if (!token || !password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'הסיסמה חייבת להכיל לפחות 8 תווים' }, { status: 400 })
    }

    const result = await verifyResetToken(token, lookupPasswordHash)
    if (!result) {
      return NextResponse.json({ error: 'הקישור אינו תקף או פג תוקפו' }, { status: 400 })
    }

    const password_hash = await hashPassword(password)
    const { error } = await supabase
      .from('admin_users')
      .update({ password_hash })
      .eq('id', result.userId)
    if (error) throw error
    // The new hash gives a new fingerprint, so every outstanding session for
    // this account is already dead — drop the cache so it happens now, not in
    // 30 seconds.
    invalidateAuthState(result.userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/auth/reset-password' })
    return NextResponse.json({ error: 'שגיאה באיפוס הסיסמה' }, { status: 500 })
  }
}
