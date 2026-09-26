/**
 * Who saved over an open campaign editor, and when — the text for the 409.
 * Client-safe, pure.
 *
 * The editor locks itself when someone else's save lands first (optimistic
 * concurrency in updateCampaign). It used to say only "updated elsewhere —
 * reload", which left the person asking the room what happened. The
 * activity log already records every save by user, so the answer is there.
 */

export interface ConflictInfo {
  /** When the row was last written (campaigns.updated_at). */
  at: string | null
  /** Display name of whoever saved, or null when the log cannot say (the nightly archive, a very old save). */
  by: string | null
  /** The same account — another tab or another device. */
  self: boolean
}

const TZ = 'Asia/Jerusalem'

function when(at: string | null, now: Date): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: TZ })
  const time = d.toLocaleTimeString('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  if (day(d) === day(now)) return `היום ב-${time}`
  const date = d.toLocaleDateString('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric' })
  return `ב-${date} ${time}`
}

/** Full sentence, for the toast. Gender-neutral on purpose — a name says nothing about pronouns. */
export function conflictMessage(c: ConflictInfo | null, now: Date = new Date()): string {
  const t = c ? when(c.at, now) : ''
  const at = t ? `, ${t}` : ''
  if (c?.self) return `שמרת את הקמפיין הזה בלשונית או במכשיר אחר${at}. רעננו כדי להמשיך מהגרסה ההיא.`
  if (c?.by) return `השינויים האחרונים נשמרו על ידי ${c.by}${at}. רעננו כדי לראות אותם — שמירה מכאן הייתה דורסת אותם.`
  return `הקמפיין עודכן במקום אחר${at}. רעננו כדי לא לדרוס שינויים.`
}

/** Short form, for the button in the editor bar. */
export function conflictBadge(c: ConflictInfo | null, now: Date = new Date()): string {
  const t = c ? when(c.at, now) : ''
  const suffix = t ? ` ${t}` : ''
  if (c?.self) return `נשמר בלשונית אחרת${suffix} — רענן`
  if (c?.by) return `עודכן ע״י ${c.by}${suffix} — רענן`
  return `עודכן במקום אחר${suffix} — רענן`
}
