import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getPageByClientSlug, downloadFile, createPageView } from '@/lib/db'
import { signAccessToken, verifyAccessToken, CONTENT_ACCESS_MAX_AGE } from '@/lib/content-access'
import { rateLimit } from '@/lib/rate-limit'

interface Ctx { params: Promise<{ path: string[] }> }

/**
 * Cheap deterministic content hash for the ETag (FNV-1a, 32-bit).
 * Runtime-agnostic — no node:crypto, so this works on any Next runtime.
 */
function contentHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { path } = await params

  if (path.length < 2) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const client = path[0]
  const slug = path.slice(1).join('/')

  const page = await getPageByClientSlug(client, slug)

  if (!page) {
    return new NextResponse(expiredPage('הדף לא נמצא'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (!page.active) {
    return new NextResponse(expiredPage('הדף אינו זמין כרגע'), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (page.publish_at && new Date(page.publish_at) > new Date()) {
    return new NextResponse(expiredPage('הדף עדיין לא זמין'), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (page.expires_at && new Date(page.expires_at) < new Date()) {
    return new NextResponse(expiredPage('תוקף הדף פג'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (page.password) {
    const cookieName = `page_access_${page.id}`
    const accessCookie = req.cookies.get(cookieName)?.value
    const tokenValid = accessCookie ? await verifyAccessToken(accessCookie, page.id, page.password) : false
    if (!tokenValid) {
      return new NextResponse(passwordPage(client, slug, false), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
  }

  const html = await downloadFile(page.file_path)
  if (!html) {
    return new NextResponse(expiredPage('הקובץ לא נמצא'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const pageUrl = `${baseUrl}/pages/${client}/${slug}`
  const ogImageUrl = `${baseUrl}/og-image.png`

  const ogDescription = escapeHtml(page.client || 'Results Group')
  const ogTags = `
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Results Digital" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${ogDescription}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
  `

  const enrichedHtml = injectOgTags(html, ogTags, page.title)

  // Password-protected pages must never be cached by the CDN — the cached
  // copy would be served to visitors who never passed the password gate.
  //
  // For public pages the CDN still caches (s-maxage), but the browser gets
  // `max-age=0, must-revalidate` so it always checks back before reusing a copy.
  // Without an explicit browser directive, browsers fall back to heuristic
  // caching and can hold a page for hours — which meant a re-uploaded page kept
  // showing the old, broken version. The ETag below makes that check a cheap 304.
  const cacheControl = page.password
    ? 'private, no-store'
    : 'public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=60'

  // Record the visit. Fire-and-forget: a stats write must never delay or fail
  // serving the page. createPageView existed but had no callers, so every
  // landing page reported 0 views and "reset statistics" reset nothing.
  createPageView({
    page_id: page.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    user_agent: req.headers.get('user-agent') || undefined,
  }).catch(() => { /* never blocks the response */ })

  const etag = `"${contentHash(enrichedHtml)}"`
  if (!page.password && req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { 'Cache-Control': cacheControl, ETag: etag, 'x-vercel-cache-tag': `page-${page.id}` },
    })
  }

  return new NextResponse(enrichedHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControl,
      ...(page.password ? {} : { ETag: etag }),
      'x-vercel-cache-tag': `page-${page.id}`,
    },
  })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'page-pw' })
  if (rl) return new NextResponse(null, { status: 429 })

  const { path } = await params

  if (path.length < 2) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const client = path[0]
  const slug = path.slice(1).join('/')

  const page = await getPageByClientSlug(client, slug)

  if (!page || !page.password) {
    return new NextResponse('Not Found', { status: 404 })
  }

  let submittedPassword = ''
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    // A malformed body just means "no password submitted" → falls through to the
    // wrong-password path below, same as the JSON branch's .catch().
    const formData = await req.formData().catch(() => null)
    submittedPassword = (formData?.get('password') as string) || ''
  } else {
    const body = await req.json().catch(() => ({}))
    submittedPassword = body.password || ''
  }

  let passwordMatch = false
  if (page.password.startsWith('$2')) {
    passwordMatch = await bcrypt.compare(submittedPassword, page.password)
  } else {
    passwordMatch = submittedPassword === page.password
  }

  if (passwordMatch) {
    const cookieName = `page_access_${page.id}`
    const token = await signAccessToken(page.id, page.password)
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const redirectUrl = `${baseUrl}/pages/${client}/${slug}`
    const response = NextResponse.redirect(redirectUrl, 303)
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CONTENT_ACCESS_MAX_AGE,
      path: '/',
    })
    return response
  }

  return new NextResponse(passwordPage(client, slug, true), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function injectOgTags(html: string, ogTags: string, title: string): string {
  const headClose = html.indexOf('</head>')
  if (headClose !== -1) {
    return html.slice(0, headClose) + ogTags + html.slice(headClose)
  }
  const htmlTag = html.indexOf('<html')
  if (htmlTag !== -1) {
    const afterHtmlTag = html.indexOf('>', htmlTag)
    if (afterHtmlTag !== -1) {
      const head = `<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>${ogTags}</head>`
      return html.slice(0, afterHtmlTag + 1) + head + html.slice(afterHtmlTag + 1)
    }
  }
  return `<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>${ogTags}</head>` + html
}

function expiredPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Results Group</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;background:#f9f9f9;margin:0">
<div style="text-align:center;padding:40px">
<h1 style="font-size:1.3rem;color:#333;margin-bottom:8px">${message}</h1>
<p style="color:#888;font-size:0.9rem">Results Group</p>
</div>
</body></html>`
}

function passwordPage(client: string, slug: string, hasError: boolean): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Results Group - דף מוגן</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #0a0a0f;
  color: #fff;
  padding: 20px;
}
.container {
  width: 100%;
  max-width: 380px;
  text-align: center;
}
.logo {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: -0.5px;
  margin-bottom: 2.5rem;
  color: #f3d56d;
}
.lock-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1.5rem;
  background: rgba(243, 213, 109, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lock-icon svg {
  width: 24px;
  height: 24px;
  color: #f3d56d;
}
h1 {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #fff;
}
.subtitle {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 2rem;
}
form { width: 100%; }
.input-wrapper {
  position: relative;
  margin-bottom: 1rem;
}
input[type="password"] {
  width: 100%;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid #2a2a35;
  background: #12121a;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
  text-align: center;
  direction: ltr;
}
input[type="password"]:focus {
  border-color: #f3d56d;
}
button {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: #f3d56d;
  color: #0a0a0f;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
button:hover {
  box-shadow: 0 0 25px rgba(243, 213, 109, 0.3);
  transform: translateY(-1px);
}
button:active {
  transform: translateY(0);
}
.error {
  color: #ef4444;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
</style>
</head>
<body>
<div class="container">
  <div class="logo">Results</div>
  <div class="lock-icon">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  </div>
  <h1>דף זה מוגן בסיסמה</h1>
  <p class="subtitle">יש להזין סיסמה כדי לצפות בתוכן</p>
  ${hasError ? '<div class="error">סיסמה שגויה, נסה שנית</div>' : ''}
  <form method="POST" action="/pages/${escapeHtml(client)}/${escapeHtml(slug)}">
    <div class="input-wrapper">
      <input type="password" name="password" placeholder="הזן סיסמה" autofocus required />
    </div>
    <button type="submit">כניסה</button>
  </form>
</div>
</body>
</html>`
}
