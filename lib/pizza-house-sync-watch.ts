import 'server-only'
import { supabase } from './supabase'
import { sendEmail } from './email'
import { logger } from './logger'
import { syncAlerts, type DayCount, type SyncAlert } from './pizza-house-sync-watch-pure'

/**
 * Server half of the quiet-day watch: read our stored daily counts, record
 * every quiet branch-day, email the new branch-level ones. The rule itself
 * is in pizza-house-sync-watch-pure.ts.
 */

/** Checked every night. Wide on purpose: a gap found late is still worth chasing while the till holds it. */
const WINDOW_DAYS = 35
/** Only gaps this recent are emailed — the first run, or a late discovery, must not mail a month of history. */
const EMAIL_RECENT_DAYS = 3

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const DOW_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const dmy = (day: string) => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`

function alertEmail(a: SyncAlert, label: (id: string) => string): { subject: string; html: string } {
  const dow = DOW_HE[new Date(`${a.day}T00:00:00Z`).getUTCDay()]
  const others = a.others.map(o => `בסניף ${label(o.branch_id)} נרשמו ${o.orders} הזמנות באותו יום.`).join(' ')
  return {
    subject: `פיצה האוס — לא התקבלו הזמנות מ${label(a.branch_id)} ב-${dmy(a.day)}`,
    html: `<!doctype html><html dir="rtl" lang="he"><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;padding:24px;color:#1a1a1a">
      <p style="font-size:15px;line-height:1.6">ביום ${dow} ${dmy(a.day)} נרשמו <b>${a.orders}</b> הזמנות בקופה של <b>${label(a.branch_id)}</b>.
      ב${dow} רגיל יש שם כ-${a.usual_orders}. ${others}</p>
      <p style="font-size:15px;line-height:1.6">כנראה הקופה לא שלחה את הנתונים של היום הזה. כדאי לבקש מאביב לשלוח אותו מחדש — הקופה שומרת היסטוריה כ-5 שבועות בלבד, ואחרי זה היום אובד.</p>
      <p style="font-size:12px;color:#777">Results Creative · בדיקה לילית אוטומטית</p></body></html>`,
  }
}

export async function watchQuietDays(branches: { id: string; label: string }[]): Promise<{ checked: number; recorded: number; emailed: number }> {
  if (!branches.length) return { checked: 0, recorded: 0, emailed: 0 }
  const from = isoDaysAgo(WINDOW_DAYS + 7 * 4) // + four weeks of lookback for the oldest checked day
  const { data, error } = await supabase
    .from('pizza_daily_stats')
    .select('branch_id,day,orders')
    .eq('source', 'pos')
    .in('branch_id', branches.map(b => b.id))
    .gte('day', from)
  if (error) throw new Error(`pizza_daily_stats read failed: ${error.message}`)

  const counts: Record<string, DayCount[]> = Object.fromEntries(branches.map(b => [b.id, [] as DayCount[]]))
  for (const r of data || []) counts[r.branch_id]?.push({ day: String(r.day), orders: Number(r.orders) || 0 })

  // Yesterday back to WINDOW_DAYS ago. Today is still trading and never stored.
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => isoDaysAgo(i + 1))
  const alerts = syncAlerts(counts, days)
  if (!alerts.length) return { checked: days.length, recorded: 0, emailed: 0 }

  // ignoreDuplicates → ON CONFLICT DO NOTHING, and the returned rows are only
  // the ones actually inserted: exactly the gaps nobody has been told about.
  const { data: inserted, error: insErr } = await supabase
    .from('pizza_sync_alerts')
    .upsert(alerts, { onConflict: 'branch_id,day', ignoreDuplicates: true })
    .select('branch_id,day,kind,orders,usual_orders,others')
  if (insErr) throw new Error(`pizza_sync_alerts insert failed: ${insErr.message}`)

  const fresh = (inserted || []) as SyncAlert[]
  const recentCutoff = isoDaysAgo(EMAIL_RECENT_DAYS)
  const toEmail = fresh.filter(a => a.kind === 'branch' && String(a.day) >= recentCutoff)
  if (!toEmail.length) return { checked: days.length, recorded: fresh.length, emailed: 0 }

  const { data: owners } = await supabase.from('admin_users').select('email').eq('is_owner', true)
  const recipients = (owners || []).map(o => o.email).filter(Boolean) as string[]
  const label = (id: string) => branches.find(b => b.id === id)?.label ?? id

  let emailed = 0
  for (const a of toEmail) {
    logger.warn('Pizza House quiet day', { branch: a.branch_id, day: a.day, orders: a.orders, usual: a.usual_orders })
    const msg = alertEmail(a, label)
    let sent = false
    for (const to of recipients) sent = (await sendEmail({ to, ...msg })) || sent
    if (sent) {
      emailed++
      await supabase.from('pizza_sync_alerts').update({ emailed_at: new Date().toISOString() })
        .eq('branch_id', a.branch_id).eq('day', a.day)
    }
  }
  return { checked: days.length, recorded: fresh.length, emailed }
}

export interface SyncAlertView extends SyncAlert {
  created_at: string
  emailed_at: string | null
  /** What the day holds now — Aviv may have re-sent it since. */
  orders_now: number
}

/** Recent alerts with the day's current count, for the admin status strip. */
export async function recentSyncAlerts(days = 35): Promise<SyncAlertView[]> {
  const since = isoDaysAgo(days)
  const { data, error } = await supabase
    .from('pizza_sync_alerts')
    .select('branch_id,day,kind,orders,usual_orders,others,created_at,emailed_at')
    .gte('day', since)
    .order('day', { ascending: false })
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []
  const { data: now } = await supabase
    .from('pizza_daily_stats')
    .select('branch_id,day,orders')
    .eq('source', 'pos')
    .gte('day', since)
  const current = new Map((now || []).map(r => [`${r.branch_id}|${r.day}`, Number(r.orders) || 0]))
  return rows.map(r => ({ ...(r as unknown as SyncAlert), created_at: r.created_at, emailed_at: r.emailed_at, orders_now: current.get(`${r.branch_id}|${r.day}`) ?? 0 }))
}
