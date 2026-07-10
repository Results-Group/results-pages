'use client'

import { createContext, useContext } from 'react'
import he from './he'
import en from './en'
import type { TranslationKey } from './he'

export type Locale = 'he' | 'en'

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { he, en }

export const I18nContext = createContext<Locale>('he')

export function useT() {
  const locale = useContext(I18nContext)
  return function t(key: TranslationKey): string {
    return dictionaries[locale]?.[key] ?? dictionaries.he[key] ?? key
  }
}

export function useLocale(): Locale {
  return useContext(I18nContext)
}

export function useDir(): 'rtl' | 'ltr' {
  const locale = useContext(I18nContext)
  return locale === 'he' ? 'rtl' : 'ltr'
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'he'
  const stored = localStorage.getItem('admin_locale')
  if (stored === 'en') return 'en'
  return 'he'
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem('admin_locale', locale)
}

export type { TranslationKey }
