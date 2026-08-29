import type { MetadataRoute } from 'next'

/**
 * Everything this app serves publicly is private client work reached by a
 * link we sent — decks, performance reports, positioning documents and
 * uploaded landing pages. None of it belongs in a search index. The React
 * routes each set robots:noindex in their own metadata; this is the
 * belt-and-braces version that also covers the raw HTML under /pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: ['/c/', '/report/', '/s/', '/pages/', '/r/', '/admin/', '/api/'] }],
  }
}
