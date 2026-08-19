import type { NextConfig } from 'next'

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
      {
        source: '/api/serve/pages/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
              "connect-src 'self'",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
