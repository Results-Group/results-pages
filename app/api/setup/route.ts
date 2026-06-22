import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashPassword } from '@/lib/hash'

export async function POST() {
  try {
    const { count, error: countErr } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })

    if (countErr) {
      return NextResponse.json({
        error: 'טבלת admin_users לא קיימת. יש להריץ את הסקריפט של המיגרציה.',
        details: countErr.message,
      }, { status: 500 })
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json({ message: 'המערכת כבר אותחלה. משתמש אדמין קיים.' })
    }

    const passwordHash = await hashPassword('Results2026!')

    const { error: insertErr } = await supabase.from('admin_users').insert({
      email: 'admin@results.co.il',
      password_hash: passwordHash,
      name: 'Admin',
      role: 'admin',
    })

    if (insertErr) {
      return NextResponse.json({ error: 'שגיאה ביצירת המשתמש', details: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'משתמש אדמין נוצר בהצלחה!',
      email: 'admin@results.co.il',
      password: 'Results2026!',
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'שגיאה באתחול המערכת' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({ initialized: false, error: 'טבלת admin_users לא קיימת' })
    }

    return NextResponse.json({ initialized: (count ?? 0) > 0, userCount: count })
  } catch {
    return NextResponse.json({ initialized: false })
  }
}
