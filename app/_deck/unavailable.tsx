/**
 * Branded "not available" page for public content that exists but must not be
 * shown: an expired/archived campaign, or content not yet published. Clients
 * hold links we sent them — before this, both cases fell through to the stock
 * English Next.js 404, the one screen in the product that looked broken.
 *
 * Same visual language as MaintenancePage; rendered inside the root layout so
 * no <html>/<body>, and React hoists <title>/<meta> into <head>. No meta
 * refresh — unlike an outage, nothing here changes in five minutes.
 */
export default function ContentUnavailable({ variant }: { variant: 'expired' | 'not_published' }) {
  const expired = variant === 'expired'
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#090c0e', color: '#ffffff', direction: 'rtl',
      fontFamily: "'Assistant', 'Segoe UI', system-ui, sans-serif", textAlign: 'center',
    }}>
      <title>{expired ? 'התוכן כבר לא זמין | Results Digital' : 'התוכן בהכנה | Results Digital'}</title>
      <meta name="robots" content="noindex" />
      <div style={{ maxWidth: 480, padding: '0 24px' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 28,
          background: 'linear-gradient(90deg, #40e1d3, #2EC4B6)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}>
          RESULTS DIGITAL
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 14px' }}>
          {expired ? 'המצגת הזו כבר לא זמינה' : 'התוכן עוד לא פורסם'}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
          {expired
            ? 'תוקף הקישור הסתיים. לקבלת גרסה מעודכנת — דברו איתנו ונשמח לשלוח קישור חדש.'
            : 'המצגת בשלבי הכנה אחרונים. הקישור שברשותכם יתחיל לעבוד ברגע שהתוכן יפורסם.'}
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 26 }}>
          לשאלות: info@resultsdigital.org
        </p>
      </div>
    </div>
  )
}
