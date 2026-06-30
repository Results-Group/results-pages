// Client-safe helpers for building asset URLs. No server-only imports here.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

// Same-origin proxy URL — images are streamed through our own domain so the
// browser never has to reach the Supabase domain directly (avoids corporate
// firewalls / DNS / extension blocks that broke direct loading).
export function assetProxyUrl(filePath?: string | null): string {
  if (!filePath) return ''
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return `/api/asset/${encoded}`
}

// Direct Supabase public URL — used as a fallback if the proxy is unavailable.
export function assetDirectUrl(filePath?: string | null): string {
  if (!filePath) return ''
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/public/campaign-assets/${encoded}`
}
