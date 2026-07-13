// Turn a name (possibly Hebrew) into an ASCII, URL- and storage-safe slug.
// Supabase Storage rejects non-ASCII object keys ("Invalid key"), and the
// public /pages/<client>/<slug> URL must be ASCII too — so Hebrew client and
// page names are transliterated to Latin here before they hit either.

const HEBREW_MAP: Record<string, string> = {
  'א': '', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
  'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
  'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': '', 'פ': 'p', 'ף': 'p',
  'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
}

/**
 * Transliterate Hebrew → Latin, then lowercase and reduce to [a-z0-9-].
 * Returns `fallback` if nothing usable remains (e.g. an all-symbol name).
 */
export function slugifyPath(input: string | null | undefined, fallback = 'client'): string {
  const raw = (input || '').trim()
  const transliterated = Array.from(raw).map(ch => HEBREW_MAP[ch] ?? ch).join('')
  const slug = transliterated
    .toLowerCase()
    .replace(/['’"״׳]/g, '')      // drop quotes / geresh-gershayim
    .replace(/[^a-z0-9]+/g, '-')  // any run of non-alphanumerics → one hyphen
    .replace(/^-+|-+$/g, '')      // trim edge hyphens
  return slug || fallback
}
