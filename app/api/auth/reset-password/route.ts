import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyResetToken } from '@/lib/reset-token'
import { hashPassword } from '@/lib/hash'
import { captureException } from '@/lib/logger'

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
    const { token, password } = await req.json()
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/auth/reset-password' })
    return NextResponse.json({ error: 'שגיאה באיפוס הסיסמה' }, { status: 500 })
  }
}
