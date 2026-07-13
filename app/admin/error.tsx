'use client'

import { useEffect } from 'react'

// Route-level error boundary for the whole /admin area. Without this, any
// render-time throw (e.g. a malformed API shape hitting a .map) blanks the
// screen with the default Next.js error. This catches it and offers a retry.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface it in the console for debugging; production logging is server-side.
    console.error('Admin error boundary:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6" dir="rtl">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <span style={{ color: '#ef4444', fontSize: '1.6rem' }}>!</span>
      </div>
      <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--admin-text-primary)' }}>משהו השתבש</h2>
      <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--admin-text-muted)' }}>
        אירעה שגיאה בטעינת המסך. אפשר לנסות שוב — ואם זה חוזר, רעננו את הדף.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={reset} className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
          נסה שוב
        </button>
        <button onClick={() => { window.location.href = '/admin' }} className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
          חזרה לדשבורד
        </button>
      </div>
    </div>
  )
}
