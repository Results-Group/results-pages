/**
 * Decides whether the asset proxy should run its webp→jpeg fallback.
 *
 * That fallback exists for the campaign builder, where compressAndUploadImage
 * stores every image twice — `X.webp` plus an `X.jpeg` sibling — so a browser
 * without webp support still gets a picture. It was applied to every asset,
 * which broke two ways for the raw jpg/png files uploaded pages keep:
 *
 *  - `filePath.replace(/\.webp$/, '.jpeg')` leaves a non-webp path unchanged,
 *    so the proxy re-downloaded the *same* file and served it under a
 *    hard-coded `Content-Type: image/jpeg`. A PNG went out labelled as a JPEG,
 *    and these responses carry `X-Content-Type-Options: nosniff`.
 *  - Failing that, it ran the bytes through `sharp().jpeg()`, which flattens
 *    transparency onto black — the same bug the logo pipeline was fixed for.
 *    A white-on-transparent client logo would have come back on a black box.
 *
 * A stored jpg or png needs neither branch: every browser reads it already.
 */
export function needsJpegFallback(filePath: string, opts: { forceJpeg: boolean; supportsWebp: boolean }): boolean {
  if (!/\.webp$/i.test(filePath)) return false
  return opts.forceJpeg || !opts.supportsWebp
}

/** Content type for a stored asset, from its extension. */
export function contentTypeFor(filePath: string): string | null {
  const ext = filePath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  switch (ext) {
    case 'webp': return 'image/webp'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'svg': return 'image/svg+xml'
    case 'avif': return 'image/avif'
    case 'pdf': return 'application/pdf'
    default: return null
  }
}
