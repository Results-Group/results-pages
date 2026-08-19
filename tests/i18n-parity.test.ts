import { describe, it, expect } from 'vitest'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

/**
 * The two dictionaries must carry exactly the same keys. A key added to one
 * side only fails here, in CI — not as a raw key string rendered to a client
 * at runtime. (en is typed Record<TranslationKey, string>, which catches
 * MISSING en keys at compile time, but nothing caught extra/orphaned ones.)
 */
describe('i18n key parity', () => {
  it('he and en define the identical key set', () => {
    const heKeys = Object.keys(he).sort()
    const enKeys = Object.keys(en).sort()
    const missingInEn = heKeys.filter(k => !enKeys.includes(k))
    const missingInHe = enKeys.filter(k => !heKeys.includes(k))
    expect(missingInEn, 'keys present in he but not en').toEqual([])
    expect(missingInHe, 'keys present in en but not he').toEqual([])
  })

  it('no empty values on either side', () => {
    for (const [k, v] of Object.entries(he)) expect(v, `he['${k}']`).toBeTruthy()
    for (const [k, v] of Object.entries(en)) expect(v, `en['${k}']`).toBeTruthy()
  })
})
