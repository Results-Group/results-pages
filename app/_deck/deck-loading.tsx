/**
 * Route-level loading screen for the public surfaces (/c, /report, /s).
 * Before this the client stared at a blank white page for the full DB round
 * trip — jarring against the dark deck that follows. Paints the deck's dark
 * ground immediately with a pulsing wordmark; pure CSS, no client JS.
 */
export default function DeckLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#090c0e', direction: 'rtl',
      fontFamily: "'Assistant', 'Segoe UI', system-ui, sans-serif",
    }}>
      <style>{`@keyframes deckLoadingPulse { 0%, 100% { opacity: 0.35 } 50% { opacity: 1 } }`}</style>
      <div style={{
        fontSize: 15, fontWeight: 700, letterSpacing: '0.2em',
        background: 'linear-gradient(90deg, #40e1d3, #2EC4B6)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        animation: 'deckLoadingPulse 1.6s ease-in-out infinite',
      }}>
        RESULTS DIGITAL
      </div>
    </div>
  )
}
