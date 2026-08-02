'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { useLocale } from '@/lib/i18n'

interface BackupRun {
  id: string
  started_at: string
  ok: boolean
  table_rows: number
  files_total: number
  files_copied: number
  snapshot_path: string | null
  error: string | null
}

/** A backup older than this means the nightly job has stopped running. */
const STALE_HOURS = 36

/**
 * Status strip for the nightly backup.
 *
 * Backups fail quietly by nature — nobody opens a backup until they need one,
 * and by then it is too late. This puts the last run somewhere it will be seen.
 */
export default function BackupStatus() {
  const locale = useLocale()
  const [runs, setRuns] = useState<BackupRun[] | null>(null)
  // Stamped when the data arrives rather than read during render — the clock is
  // impure, and rendering must not depend on when it happens to run.
  const [now, setNow] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/backups')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((data: BackupRun[]) => { setRuns(data); setNow(Date.now()) })
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null
  if (!runs) {
    return (
      <div className="flex items-center gap-2 text-xs mb-5" style={{ color: 'var(--admin-text-muted)' }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    )
  }

  const lastOk = runs.find(r => r.ok)
  const ageHours = lastOk
    ? (now - new Date(lastOk.started_at).getTime()) / 3_600_000
    : Infinity
  const healthy = ageHours < STALE_HOURS
  const lastFailed = runs[0] && !runs[0].ok

  const he = locale !== 'en'
  const when = lastOk
    ? new Date(lastOk.started_at).toLocaleString(he ? 'he-IL' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  const tone = healthy && !lastFailed ? '#22c55e' : '#f59e0b'
  const Icon = healthy && !lastFailed ? ShieldCheck : ShieldAlert

  let text: string
  if (!lastOk) {
    text = he ? 'לא בוצע אף גיבוי מוצלח' : 'No successful backup yet'
  } else if (!healthy) {
    text = he
      ? `הגיבוי האחרון הצליח ב-${when} — מעל ${Math.floor(ageHours / 24)} ימים. הגיבוי הלילי כנראה לא רץ.`
      : `Last successful backup ${when} — over ${Math.floor(ageHours / 24)} days ago. The nightly job may have stopped.`
  } else if (lastFailed) {
    text = he
      ? `הריצה האחרונה נכשלה. הגיבוי התקין האחרון: ${when}`
      : `The most recent run failed. Last good backup: ${when}`
  } else {
    text = he
      ? `גיבוי אחרון ${when} · ${lastOk.table_rows.toLocaleString('he-IL')} שורות · ${lastOk.files_total.toLocaleString('he-IL')} קבצים`
      : `Last backup ${when} · ${lastOk.table_rows.toLocaleString()} rows · ${lastOk.files_total.toLocaleString()} files`
  }

  return (
    <div
      className="flex items-center gap-2 text-xs mb-5 px-3 py-2 rounded-lg"
      style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)' }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: tone }} />
      <span>{text}</span>
    </div>
  )
}
