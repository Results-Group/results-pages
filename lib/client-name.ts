/**
 * Client-name matching. Kept in its own module with no server-only imports so
 * it can be unit tested and used from either side — the same split as
 * lib/copies.ts.
 */

/**
 * Loose key for matching client names.
 *
 * Case and separators are dropped, so "Pizza House", "pizza-house" and
 * "pizza house" collapse to one key. Exact string matching is what produced ten
 * duplicate clients in production: a page uploaded as "pizza-house" (the slug
 * used for its storage path) never matched the "Pizza House" record synced from
 * Monday, so a second client was created beside it.
 *
 * Hebrew letters are kept — many clients are named in Hebrew, and stripping
 * them would collapse unrelated names onto an empty key and match them to each
 * other.
 */
export function clientNameKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining marks left by the decomposition (accents), not letters.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9֐-׿]+/g, '')
}
