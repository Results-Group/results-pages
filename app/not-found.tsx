import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'הדף לא נמצא | Results Digital',
  robots: { index: false, follow: false },
}

/**
 * Global branded 404 — reached only for genuinely missing records (bad slug,
 * deleted content). Expired/unpublished content gets its own explanatory page
 * (app/_deck/unavailable.tsx); this one stays generic on purpose.
 */
export default function NotFound() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#090c0e', color: '#ffffff', direction: 'rtl',
      fontFamily: "'Assistant', 'Segoe UI', system-ui, sans-serif", textAlign: 'center',
    }}>
      <div style={{ maxWidth: 480, padding: '0 24px' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 28,
          background: 'linear-gradient(90deg, #40e1d3, #2EC4B6)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}>
          RESULTS DIGITAL
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 14px' }}>
          הדף לא נמצא
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
          הקישור שהגעתם אליו לא קיים או שהתוכן הוסר.
          <br />
          אם קיבלתם את הקישור מאיתנו — דברו איתנו ונשלח קישור מעודכן.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 26 }}>
          לשאלות: info@resultsdigital.org
        </p>
      </div>
    </div>
  )
}
