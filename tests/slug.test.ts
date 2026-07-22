import { describe, it, expect } from 'vitest'
import { slugifyPath } from '@/lib/slug'

describe('slugifyPath', () => {
  it('transliterates Hebrew to ASCII', () => {
    // Supabase Storage rejects non-ASCII object keys, so this is what keeps
    // Hebrew client names storable and URL-safe.
    // א/ע map to '' by design, so מילאנו → m-y-l-''-n-v.
    expect(slugifyPath('מילאנו')).toBe('mylnv')
    expect(slugifyPath('פיצה האוס')).toBe('pytzh-hvs')
  })

  it('lowercases and collapses separators', () => {
    expect(slugifyPath('My Studio  Teachers LP')).toBe('my-studio-teachers-lp')
    expect(slugifyPath('A---B___C')).toBe('a-b-c')
  })

  it('trims separators from the edges', () => {
    expect(slugifyPath('  hello world  ')).toBe('hello-world')
    expect(slugifyPath('---edge---')).toBe('edge')
  })

  it('drops quotes and Hebrew punctuation rather than turning them into hyphens', () => {
    expect(slugifyPath('דו"ח')).toBe('dvch')
    expect(slugifyPath("O'Brien")).toBe('obrien')
  })

  it('falls back when nothing usable is left', () => {
    expect(slugifyPath('')).toBe('client')
    expect(slugifyPath('!!!')).toBe('client')
    expect(slugifyPath(null)).toBe('client')
    expect(slugifyPath(undefined)).toBe('client')
    expect(slugifyPath('###', 'report')).toBe('report')
  })

  it('leaves an already-clean slug untouched', () => {
    expect(slugifyPath('quarterly-summary')).toBe('quarterly-summary')
  })
})
