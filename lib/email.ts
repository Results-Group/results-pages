/**
 * Transactional email via Resend.
 *
 * Safe no-op when RESEND_API_KEY is missing: sends are logged and skipped so
 * local/dev environments don't fail. Configure RESEND_API_KEY and EMAIL_FROM
 * in production.
 */
import { Resend } from 'resend'
import { logger, captureException } from './logger'

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM || 'Results <onboarding@resend.dev>'

const resend = apiKey ? new Resend(apiKey) : null

export function emailEnabled(): boolean {
  return Boolean(resend)
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!resend) {
    logger.warn('Email skipped (RESEND_API_KEY not set)', { to: opts.to, subject: opts.subject })
    return false
  }
  try {
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) {
      captureException(error, { scope: 'sendEmail', to: opts.to })
      return false
    }
    return true
  } catch (err) {
    captureException(err, { scope: 'sendEmail', to: opts.to })
    return false
  }
}

// ── Templates ──

function shell(title: string, body: string): string {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0f10;font-family:-apple-system,Segoe UI,Arial,sans-serif;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#14181a;border:1px solid #23292c;border-radius:16px;padding:32px;color:#e8eaed">
    <h1 style="font-size:18px;margin:0 0 16px;color:#fff">${title}</h1>
    ${body}
    <p style="font-size:12px;color:#7a8288;margin-top:28px">Results Creative</p>
  </div></body></html>`
}

export function passwordResetEmail(link: string): { subject: string; html: string } {
  return {
    subject: 'איפוס סיסמה — Results Creative',
    html: shell('איפוס סיסמה', `
      <p style="font-size:14px;line-height:1.6;color:#c4c9cd">קיבלנו בקשה לאיפוס הסיסמה שלך. לחצו על הכפתור כדי להגדיר סיסמה חדשה. הקישור תקף לשעה אחת.</p>
      <p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#40e1d3;color:#062024;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px">איפוס סיסמה</a></p>
      <p style="font-size:12px;color:#7a8288">אם לא ביקשתם זאת, אפשר להתעלם מהמייל הזה.</p>
    `),
  }
}
