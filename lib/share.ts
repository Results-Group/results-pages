// Shared helpers for building prefilled share messages (WhatsApp, etc.)

export interface ShareParams {
  /** Human title of the page / campaign */
  title: string
  /** Client name */
  client?: string | null
  /** Public URL to the content */
  url: string
  /** Optional short description / concept */
  description?: string | null
}

/**
 * Build a friendly, prefilled Hebrew share message. Includes the client name,
 * the link, and (when available) a short description.
 */
export function buildShareMessage({ title, client, url, description }: ShareParams): string {
  const lines: string[] = []
  const greeting = client ? `היי! שיתפתי איתך את "${title}" עבור ${client} 👇` : `היי! שיתפתי איתך את "${title}" 👇`
  lines.push(greeting)
  if (description && description.trim()) {
    lines.push('')
    lines.push(description.trim())
  }
  lines.push('')
  lines.push(url)
  return lines.join('\n')
}

/** WhatsApp share URL with a prefilled message. */
export function whatsappShareUrl(params: ShareParams): string {
  return `https://wa.me/?text=${encodeURIComponent(buildShareMessage(params))}`
}

/**
 * The message for "we updated the campaign you already saw". Sent from the
 * editor once the client has opened the campaign and the team saves changes;
 * the deck itself marks the changed slides "updated" for that client.
 */
export function buildUpdateMessage({ title, url }: Pick<ShareParams, 'title' | 'url'>): string {
  return [`היי! עדכנו את "${title}" — השקפים שהשתנו מסומנים ב"עודכן" 👇`, '', url].join('\n')
}

export function whatsappUpdateUrl(params: Pick<ShareParams, 'title' | 'url'>): string {
  return `https://wa.me/?text=${encodeURIComponent(buildUpdateMessage(params))}`
}
