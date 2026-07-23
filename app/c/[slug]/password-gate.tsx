'use client'

import { useState } from 'react'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

export default function PasswordGate({ slug, clientName, lang = 'he' }: { slug: string; clientName: string; lang?: 'he' | 'en' }) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/campaign-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('public.wrongPassword'))
      }
    } catch {
      setError(t('public.errorTryAgain'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GATE_STYLES }} />
      <div className="pw-gate">
        <div className="pw-glow" />
        <form className="pw-card" onSubmit={handleSubmit}>
          <div className="pw-lock">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="pw-title">{t('public.protectedContent')}</h1>
          <p className="pw-subtitle">{clientName ? t('public.campaignProtected').replace('{client}', clientName) : t('public.enterPasswordCampaign')}</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('public.enterPassword')}
            className="pw-input"
            autoFocus
          />
          {error && <p className="pw-error">{error}</p>}
          <button type="submit" disabled={loading || !password} className="pw-btn">
            {loading ? t('public.checking') : t('public.enter')}
          </button>
        </form>
        <div className="pw-footer">By Results Digital</div>
      </div>
    </>
  )
}

const GATE_STYLES = `
  @font-face{font-family:'Ping';src:url('/fonts/ping-regular.otf') format('opentype');font-weight:400;font-display:swap}
  @font-face{font-family:'Ping';src:url('/fonts/ping-bold.otf') format('opentype');font-weight:700;font-display:swap}
  @font-face{font-family:'Ping';src:url('/fonts/ping-heavy.otf') format('opentype');font-weight:900;font-display:swap}

  .pw-gate{
    --brand-cyan:#40e1d3;--brand-yellow:#F3D56D;--text-primary:#f0f0f0;--text-secondary:#a0aab0;
    font-family:'Ping','Heebo',sans-serif;direction:rtl;background:#0d1112;color:var(--text-primary);
    min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:20px;
  }
  .pw-gate .pw-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(64,225,211,0.07) 0%,transparent 60%);pointer-events:none;animation:pwPulse 5s ease-in-out infinite}
  @keyframes pwPulse{0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}}
  .pw-gate .pw-card{position:relative;background:rgba(20,30,32,0.7);backdrop-filter:blur(16px);border:1px solid rgba(64,225,211,0.15);border-radius:18px;padding:44px 36px;width:100%;max-width:380px;text-align:center;display:flex;flex-direction:column;align-items:center}
  .pw-gate .pw-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:18px 18px 0 0}
  .pw-gate .pw-lock{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(64,225,211,0.1);border:1px solid rgba(64,225,211,0.3);color:var(--brand-cyan);margin-bottom:20px}
  .pw-gate .pw-title{font-size:1.6rem;font-weight:900;color:var(--brand-yellow);margin-bottom:8px}
  .pw-gate .pw-subtitle{font-size:0.9rem;color:var(--text-secondary);margin-bottom:24px;line-height:1.6}
  .pw-gate .pw-input{width:100%;padding:13px 16px;border-radius:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(64,225,211,0.2);color:var(--text-primary);font-family:'Ping',sans-serif;font-size:0.95rem;text-align:center;outline:none;transition:border-color 0.2s;direction:ltr}
  .pw-gate .pw-input:focus{border-color:var(--brand-cyan)}
  .pw-gate .pw-input::placeholder{color:rgba(160,170,176,0.5);text-align:center}
  .pw-gate .pw-error{color:#FF2A4D;font-size:0.82rem;margin-top:12px}
  .pw-gate .pw-btn{width:100%;margin-top:18px;padding:13px;border-radius:12px;border:none;background:linear-gradient(120deg,var(--brand-cyan),var(--brand-yellow));color:#0d1112;font-family:'Ping',sans-serif;font-weight:700;font-size:0.95rem;cursor:pointer;transition:all 0.2s}
  .pw-gate .pw-btn:hover:not(:disabled){box-shadow:0 0 24px rgba(64,225,211,0.3);transform:translateY(-1px)}
  .pw-gate .pw-btn:disabled{opacity:0.5;cursor:default}
  .pw-gate .pw-footer{position:relative;margin-top:28px;font-size:0.78rem;color:var(--text-secondary)}
`
