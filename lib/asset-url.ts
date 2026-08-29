// Client-safe helpers for building asset URLs. No server-only imports here.

// Same-origin proxy URL — images are streamed through our own domain so the
// browser never has to reach the Supabase domain directly (avoids corporate
// firewalls / DNS / extension blocks that broke direct loading).
export function assetProxyUrl(filePath?: string | null): string {
  if (!filePath) return ''
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return `/api/asset/${encoded}`
}

// There is deliberately no direct-Supabase URL helper here any more. The assets
// bucket is private, so the proxy above is the only way in: it authorises the
// request and downloads with the service role. A direct URL would 400.
