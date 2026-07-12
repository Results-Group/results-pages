'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const colors: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e' },
    error: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
    info: { bg: 'rgba(64, 225, 211, 0.12)', border: 'rgba(64, 225, 211, 0.3)', text: '#40e1d3' },
  }

  const c = colors[toast.type]

  return (
    <div
      className="pointer-events-auto px-5 py-3 rounded-xl text-sm font-medium shadow-lg backdrop-blur-sm animate-slide-up cursor-pointer"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.message}
    </div>
  )
}
