import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

/**
 * Base URL that relative OG/Twitter image paths resolve against.
 * VERCEL_URL is the per-deployment hostname (results-pages-<hash>.vercel.app),
 * which can sit behind deployment protection — link previews pointing there
 * fail to fetch the image, so shares render without one. Production pins the
 * real domain instead.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_ENV === 'production') return 'https://reports.resultsdigital.org'
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

const SHARE_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'Results Creative' }

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: 'Results Creative',
  description: 'ניהול קמפיינים ודפי נחיתה - Results Digital',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Results Creative',
    description: 'ניהול קמפיינים ודפי נחיתה - Results Digital',
    images: [SHARE_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Results Creative',
    description: 'ניהול קמפיינים ודפי נחיתה - Results Digital',
    images: [SHARE_IMAGE.url],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Ping (~80KB/weight) is the face of every public deck — all three
            weights are used (900 carries the slide titles). Preloading kills
            the font-swap flash on first open; font-display:swap in the CSS
            stays as the fallback behaviour. */}
        <link rel="preload" href="/fonts/ping-regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/ping-bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/ping-heavy.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Theme applied before paint so a light-mode user never sees a dark
            flash. Via next/script (beforeInteractive) rather than a raw
            <script> in <head>: React 19 treats a script tag rendered inside a
            component as an error, and the dev overlay it raises blocked the
            whole app for anyone opening localhost. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  )
}
