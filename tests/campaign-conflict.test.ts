import { describe, it, expect } from 'vitest'
import { conflictMessage, conflictBadge } from '@/lib/campaign-conflict'

// 27.9.2026 12:00 Israel time (UTC+3).
const NOW = new Date('2026-09-27T09:00:00Z')

describe('conflictMessage', () => {
  it('names who saved and when, today', () => {
    expect(conflictMessage({ at: '2026-09-27T08:32:00Z', by: 'נועה', self: false }, NOW))
      .toBe('השינויים האחרונים נשמרו על ידי נועה, היום ב-11:32. רעננו כדי לראות אותם — שמירה מכאן הייתה דורסת אותם.')
  })

  it('uses the date for an earlier day, in Israel time not UTC', () => {
    // 23:30 UTC on the 26th is 02:30 on the 27th in Israel — "today", not yesterday.
    expect(conflictMessage({ at: '2026-09-26T23:30:00Z', by: 'דן', self: false }, NOW)).toContain('היום ב-02:30')
    expect(conflictMessage({ at: '2026-09-25T08:05:00Z', by: 'דן', self: false }, NOW)).toContain('ב-25.9 11:05')
  })

  it('tells you when the other save was yours — another tab or device', () => {
    expect(conflictMessage({ at: '2026-09-27T08:32:00Z', by: 'מתן', self: true }, NOW))
      .toBe('שמרת את הקמפיין הזה בלשונית או במכשיר אחר, היום ב-11:32. רעננו כדי להמשיך מהגרסה ההיא.')
  })

  it('falls back to the old wording when nobody can be named', () => {
    expect(conflictMessage({ at: null, by: null, self: false }, NOW)).toBe('הקמפיין עודכן במקום אחר. רעננו כדי לא לדרוס שינויים.')
    expect(conflictMessage(null, NOW)).toBe('הקמפיין עודכן במקום אחר. רעננו כדי לא לדרוס שינויים.')
  })
})

describe('conflictBadge', () => {
  it('is short enough for the editor bar', () => {
    expect(conflictBadge({ at: '2026-09-27T08:32:00Z', by: 'נועה', self: false }, NOW)).toBe('עודכן ע״י נועה היום ב-11:32 — רענן')
    expect(conflictBadge({ at: '2026-09-27T08:32:00Z', by: 'מתן', self: true }, NOW)).toBe('נשמר בלשונית אחרת היום ב-11:32 — רענן')
    expect(conflictBadge(null, NOW)).toBe('עודכן במקום אחר — רענן')
  })
})
