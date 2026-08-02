/**
 * Shown on public URLs when the database itself is unreachable — never for a
 * genuinely missing record. Clients hold links we sent them; during an outage
 * those links must degrade into "we're on it", not a broken 404.
 *
 * Rendered inside the root layout, so no <html>/<body> here — React 19 hoists
 * the <title>/<meta> tags into <head> on its own.
 */
export default function MaintenancePage() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#090c0e', color: '#ffffff', direction: 'rtl',
      fontFamily: "'Assistant', 'Segoe UI', system-ui, sans-serif", textAlign: 'center',
    }}>
      <title>המצגת בעדכון | Results Digital</title>
      <meta name="robots" content="noindex" />
      {/* Try again on its own — a client who leaves the tab open recovers without touching anything. */}
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function(){location.reload()},300000)' }} />
      <div style={{ maxWidth: 480, padding: '0 24px' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 28,
          background: 'linear-gradient(90deg, #40e1d3, #2EC4B6)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}>
          RESULTS DIGITAL
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 14px' }}>
          המערכת בתחזוקה קצרה
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
          אנחנו מבצעים עדכון תשתיתי, והתוכן יחזור להיות זמין בקרוב.
          <br />
          הקישור שברשותכם יישאר בתוקף — אין צורך בקישור חדש.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 26 }}>
          הדף יתרענן אוטומטית · לשאלות: info@resultsdigital.org
        </p>
      </div>
    </div>
  )
}
