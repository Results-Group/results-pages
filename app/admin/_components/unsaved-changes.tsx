'use client'

import { useEffect, useId } from 'react'
import { useConfirm, type ConfirmOptions } from './confirm-dialog'
import { useT } from '@/lib/i18n'

/**
 * A module-level dirty registry instead of a React context: the admin layout
 * both renders the providers and owns the sidebar handlers, so it cannot
 * consume a context it provides. Editors register through the hook below; the
 * layout's navigation handlers call guardNavigation() before leaving.
 */
const registry = new Map<string, string | undefined>()

// Filled by <UnsavedGuardBridge/> (rendered inside ConfirmProvider) so the
// module-level guard can open the styled dialog.
let bridge: { confirmDialog: (opts: ConfirmOptions) => Promise<boolean>; labels: { message: string; leave: string; stay: string } } | null = null

// While true, the beforeunload listener stays quiet — set right before a
// navigation the user already confirmed, so they aren't prompted twice.
let bypass = false

export function hasUnsavedChanges(): boolean {
  return registry.size > 0
}

/** Run `navigate` immediately when clean; otherwise ask first. */
export async function guardNavigation(navigate: () => void | Promise<void>): Promise<void> {
  if (registry.size === 0) {
    await navigate()
    return
  }
  const first = [...registry.values()].find(Boolean)
  const ok = bridge
    ? await bridge.confirmDialog({
        message: first || bridge.labels.message,
        confirmLabel: bridge.labels.leave,
        cancelLabel: bridge.labels.stay,
        variant: 'danger',
      })
    : window.confirm(first || 'יש שינויים שלא נשמרו. לעזוב בכל זאת?')
  if (!ok) return
  bypass = true
  registry.clear()
  try {
    await navigate()
  } finally {
    // Full-page navigations tear the tab down anyway; for client-side ones
    // the flag must reset or a later real edit would leave unguarded.
    setTimeout(() => { bypass = false }, 3000)
  }
}

/** Editors call this with their dirty flag; beforeunload + nav guard follow. */
export function useRegisterUnsavedChanges(dirty: boolean, message?: string) {
  const id = useId()
  useEffect(() => {
    if (dirty) registry.set(id, message)
    else registry.delete(id)
    return () => { registry.delete(id) }
  }, [id, dirty, message])
}

/** Mount once inside ConfirmProvider; owns the single beforeunload listener. */
export function UnsavedGuardBridge() {
  const confirmDialog = useConfirm()
  const t = useT()

  useEffect(() => {
    bridge = {
      confirmDialog,
      labels: { message: t('unsaved.confirmLeave'), leave: t('unsaved.leave'), stay: t('unsaved.stay') },
    }
    return () => { bridge = null }
  }, [confirmDialog, t])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (registry.size === 0 || bypass) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return null
}
