import { describe, it, expect } from 'vitest'
import { escapeOrFilterValue } from '@/lib/pg-filter'

describe('escapeOrFilterValue', () => {
  it('leaves an ordinary search untouched', () => {
    expect(escapeOrFilterValue('Medera')).toBe('Medera')
    expect(escapeOrFilterValue('מדרה קליניק')).toBe('מדרה קליניק')
  })

  it('neutralises the hash-oracle payload from the audit', () => {
    const payload = 'zzzz,password.like.$2a$12$K*,client.ilike.zzzz'
    const escaped = escapeOrFilterValue(payload)
    expect(escaped).not.toContain(',')
    expect(escaped).not.toContain('*')
    // and therefore cannot open a second condition
    const filter = `campaign_name.ilike.%${escaped}%,client.ilike.%${escaped}%`
    expect(filter.split(',')).toHaveLength(2)
  })

  it('drops every PostgREST grammar character', () => {
    for (const c of [',', '(', ')', '"', '*', '\\']) {
      expect(escapeOrFilterValue(`a${c}b`)).not.toContain(c)
    }
  })

  it('escapes LIKE wildcards so they match themselves', () => {
    expect(escapeOrFilterValue('100%')).toBe('100\\%')
    expect(escapeOrFilterValue('a_b')).toBe('a\\_b')
  })

  it('keeps a search with parentheses usable', () => {
    // "Results (Global)" still matches — the parens become spaces, not a hole.
    expect(escapeOrFilterValue('Results (Global)')).toBe('Results  Global')
  })
})
