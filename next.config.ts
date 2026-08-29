import type { NextConfig } from 'next'

/**
 * CSP for uploaded landing pages. These run on our own origin, next to /admin,
 * so a script inside one could otherwise call our API with the operator's
 * session and read the response. The line that stops that is `connect-src`
 * WITHOUT 'self': every fetch in the real pages goes to an external service
 * (currency APIs, a Zapier lead hook, ipify), never back to us — so naming
 * those hosts explicitly keeps the pages working while closing the path to
 * /api/*. The allowlists below were derived by scanning all 30 stored pages;
 * anything dropped here silently breaks a live client page, so extend rather
 * than trim, and re-scan before tightening.
 */
const SERVED_PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://www.googletagmanager.com https://connect.facebook.net https://*.clarity.ms https://*.hotjar.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com https://static.wixstatic.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com data:",
  // Deliberately no 'self' — see the note above.
  "connect-src https://api.frankfurter.app https://api.binance.com https://hooks.zapier.com https://api.ipify.org https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://*.clarity.ms https://*.hotjar.com https://*.hotjar.io",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://maps.google.com https://www.google.com https://drive.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  // Blocks exfiltration by auto-submitted form. Every stored page posts to '#'.
  "form-action 'self'",
  // 'self' rather than 'none': the admin preview modal and the landing-page
  // mockup inside a campaign deck both iframe these pages from our own origin.
  "frame-ancestors 'self'",
].join('; ')

const SERVED_PAGE_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: SERVED_PAGE_CSP },
]

const nextConfig: NextConfig = {
  trailingSlash: false,
  // sharp must stay a real runtime require, not get bundled: the tree holds
  // TWO sharps (ours 0.35 and Next's own 0.34) with different libvips native
  // libraries, and bundling let the tracer pack the wrong .so — every route
  // importing lib/campaigns then 500'd on Vercel with ERR_DLOPEN_FAILED
  // (libvips-cpp.so.8.18.3 missing). Broke 2026-08-19 on a Vercel build-image
  // update with an unchanged lockfile.
  serverExternalPackages: ['sharp'],
  // Belt to the braces above: file tracing missed sharp's native .so (dlopen'd
  // at runtime, invisible to the require graph), so the function bundles
  // shipped without libvips and uploads died with ERR_DLOPEN_FAILED. Force
  // the whole @img tree into every function that might touch sharp.
  outputFileTracingIncludes: {
    '/**': ['node_modules/@img/**', 'node_modules/sharp/**'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      {
        source: '/((?!api/serve/|pages/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Uploaded client HTML. Both entry points carry the same rules: visitors
      // request /pages/*, middleware rewrites to /api/serve/pages/*, and
      // headers() matches the INCOMING path — so keying only the internal one
      // (as this config did until 2026-08-29) shipped every client page with no
      // CSP at all.
      { source: '/pages/:path*', headers: SERVED_PAGE_HEADERS },
      { source: '/api/serve/pages/:path*', headers: SERVED_PAGE_HEADERS },
    ]
  },
}

export default nextConfig
