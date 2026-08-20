'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useT, useDir } from '@/lib/i18n'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}

export interface PromptOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  defaultValue?: string
  placeholder?: string
  /** Force input direction (e.g. 'ltr' for URLs) regardless of UI locale. */
  dir?: 'ltr' | 'rtl'
}

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (value: string | null) => void }

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  promptText: (opts: PromptOptions) => Promise<string | null>
}

const noop = () => Promise.reject(new Error('ConfirmProvider is not mounted'))
const ConfirmContext = createContext<ConfirmContextValue>({ confirm: noop, promptText: noop })

export function useConfirm() {
  return useContext(ConfirmContext).confirm
}

export function usePrompt() {
  return useContext(ConfirmContext).promptText
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  // A second request while one dialog is open cancels the first — the raw
  // browser dialogs this replaces could never stack either.
  const pendingRef = useRef<Pending | null>(null)

  const settle = useCallback((p: Pending | null, ok: boolean, value?: string) => {
    if (!p) return
    if (p.kind === 'confirm') p.resolve(ok)
    else p.resolve(ok ? (value ?? '') : null)
  }, [])

  const open = useCallback((next: Pending) => {
    settle(pendingRef.current, false)
    pendingRef.current = next
    setPending(next)
  }, [settle])

  const close = useCallback((ok: boolean, value?: string) => {
    settle(pendingRef.current, ok, value)
    pendingRef.current = null
    setPending(null)
  }, [settle])

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => open({ kind: 'confirm', opts, resolve }))
  }, [open])

  const promptText = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>(resolve => open({ kind: 'prompt', opts, resolve }))
  }, [open])

  return (
    <ConfirmContext.Provider value={{ confirm, promptText }}>
      {children}
      {pending && <DialogCard pending={pending} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function DialogCard({ pending, onClose }: { pending: Pending; onClose: (ok: boolean, value?: string) => void }) {
  const t = useT()
  const dir = useDir()
  const [value, setValue] = useState(pending.kind === 'prompt' ? (pending.opts.defaultValue ?? '') : '')
  const focusRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isPrompt = pending.kind === 'prompt'
  const danger = !isPrompt && pending.opts.variant === 'danger'

  useEffect(() => {
    if (isPrompt) inputRef.current?.focus()
    else focusRef.current?.focus()
  }, [isPrompt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => onClose(true, value)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => onClose(false)}
      dir={dir}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {pending.opts.title && (
          <h3 className="text-base font-bold mb-1.5" style={{ color: 'var(--admin-text-primary)' }}>
            {pending.opts.title}
          </h3>
        )}
        {pending.opts.message && (
          <p className="text-sm whitespace-pre-line mb-4" style={{ color: 'var(--admin-text-secondary)' }}>
            {pending.opts.message}
          </p>
        )}
        {isPrompt && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder={pending.opts.placeholder}
            dir={pending.opts.dir}
            className="w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none focus:ring-1"
            style={{
              background: 'var(--admin-input-bg)',
              border: '1px solid var(--admin-border-input)',
              color: 'var(--admin-text-primary)',
            }}
          />
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1px solid var(--admin-border-input)', color: 'var(--admin-text-secondary)' }}
          >
            {pending.opts.cancelLabel || t('confirm.cancel')}
          </button>
          <button
            ref={focusRef}
            onClick={submit}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={danger
              ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }
              : { background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          >
            {pending.opts.confirmLabel || t('confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
