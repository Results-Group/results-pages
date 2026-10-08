// Browser side of the deck PDF export — shared by the client's deck button and
// the editor. Client-safe: no server imports.

/** The real file name out of a Content-Disposition header (RFC 5987 first). */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try { return decodeURIComponent(star[1].trim()) } catch { /* fall through */ }
  }
  const plain = /filename="([^"]+)"/i.exec(header)
  return plain ? plain[1] : null
}

/**
 * Asks the server for the deck as PDF and saves it. The first export of a
 * version renders the whole deck (up to a minute); later ones come from cache.
 * Throws an Error carrying the server's own Hebrew message on failure.
 */
export async function downloadDeckPdf(campaignId: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api/campaigns/${campaignId}/pdf`, { credentials: 'same-origin' })
  if (!res.ok) {
    let message = ''
    try { message = ((await res.json()) as { error?: string }).error || '' } catch { /* not JSON */ }
    throw new Error(message || 'יצירת ה-PDF נכשלה, נסו שוב')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileNameFromDisposition(res.headers.get('Content-Disposition')) || fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking at once can cancel the download in Safari before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
