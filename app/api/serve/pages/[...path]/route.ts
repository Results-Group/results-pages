import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getPageByClientSlug, createPageView, downloadFile } from '@/lib/db'
import { signAccessToken, verifyAccessToken, CONTENT_ACCESS_MAX_AGE } from '@/lib/content-access'
import { rateLimit } from '@/lib/rate-limit'

interface Ctx { params: Promise<{ path: string[] }> }

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

  if (page.expires_at && new Date(page.expires_at) < new Date()) {
    return new NextResponse(expiredPage('תוקף הדף פג'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (page.password) {
    const cookieName = `page_access_${page.id}`
    const accessCookie = req.cookies.get(cookieName)?.value
    const tokenValid = accessCookie ? await verifyAccessToken(accessCookie, page.id) : false
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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const userAgent = req.headers.get('user-agent') || ''
  createPageView({ page_id: page.id, ip, user_agent: userAgent }).catch(() => {})

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const pageUrl = `${baseUrl}/pages/${client}/${slug}`
  const ogImageUrl = `${baseUrl}/og-image.png`

  const ogTags = `
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="Results Group" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="Results Group" />
    <meta name="twitter:image" content="${ogImageUrl}" />
  `

  const enrichedHtml = injectOgTags(html, ogTags, page.title)

  return new NextResponse(enrichedHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=3600',
      'x-vercel-cache-tag': `page-${page.id}`,
    },
  })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const rl = rateLimit(req, { windowMs: 60_000, max: 10, prefix: 'page-pw' })
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
    const formData = await req.formData()
    submittedPassword = (formData.get('password') as string) || ''
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
    const token = await signAccessToken(page.id)
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
