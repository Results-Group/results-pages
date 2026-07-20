import type { Metadata } from 'next'
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
  description: 'ניהול קמפיינים ודפי נחיתה - Results Group',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Results Creative',
    description: 'ניהול קמפיינים ודפי נחיתה - Results Group',
    images: [SHARE_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Results Creative',
    description: 'ניהול קמפיינים ודפי נחיתה - Results Group',
    images: [SHARE_IMAGE.url],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
