/**
 * Markup-safe translation plumbing for uploaded HTML pages, pure and
 * node-testable. The model never sees markup: every Hebrew-bearing text
 * segment is swapped for a ⟦N⟧ token and shipped as a JSON array — same
 * stash-transform-restore idea as lib/minify.ts. What never leaves the file
 * can never be mangled by the model.
 */

const HEBREW = /[֐-׿]/
/** Token wrapper. U+27E6/27E7 — never appears in real pages; bail if it does. */
const TOKEN = (n: number) => `⟦${n}⟧`
const TOKEN_RE = /⟦(\d+)⟧/g

export interface ExtractResult {
  masked: string
  segments: string[]
}

/**
 * Replaces every Hebrew-bearing text segment with a ⟦N⟧ token:
 * - text nodes between tags (whitespace around the text is preserved in place)
 * - values of title/alt/placeholder/aria-label attributes, and content= of
 *   <meta name="description">
 * - '…'/"…" string literals inside <script> blocks (chart labels etc.)
 * <style> blocks are never touched.
 */
export function extractSegments(html: string): ExtractResult {
  if (html.includes('⟦')) {
    throw new Error('input already contains the token character U+27E6')
  }
  const segments: string[] = []
  const take = (text: string): string => {
    segments.push(text)
    return TOKEN(segments.length - 1)
  }

  // Stash script/style bodies first so tag-splitting can't cross them.
  const blocks: string[] = []
  let stashed = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, m => {
    blocks.push(m)
    return `⟦B${blocks.length - 1}⟧`
  })

  // Text nodes: non-tag chunks that carry Hebrew.
  stashed = stashed
    .split(/(<[^>]*>)/)
    .map(chunk => {
      if (!chunk || chunk.startsWith('<') || !HEBREW.test(chunk)) return chunk
      // keep the surrounding whitespace out of the model's hands
      const m = chunk.match(/^(\s*)([\s\S]*?)(\s*)$/)
      if (!m) return take(chunk)
      return m[1] + take(m[2]) + m[3]
    })
    .join('')

  // Attribute values inside tags.
  stashed = stashed.replace(
    /(\s(?:title|alt|placeholder|aria-label|content)=")([^"]*)(")/gi,
    (full, pre: string, value: string, post: string) =>
      HEBREW.test(value) ? pre + take(value) + post : full
  )

  // Script blocks back, with their Hebrew string literals tokenized.
  stashed = stashed.replace(/⟦B(\d+)⟧/g, (_, i: string) => {
    const block = blocks[Number(i)]
    if (/^<style/i.test(block) || !HEBREW.test(block)) return block
    return block.replace(
      /(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g,
      (full, quote: string, inner: string) =>
        HEBREW.test(inner) ? quote + take(inner) + quote : full
    )
  })

  return { masked: stashed, segments }
}

/** Puts translated segments back; throws on any count/coverage mismatch. */
export function restoreSegments(masked: string, translations: string[]): string {
  let used = 0
  const out = masked.replace(TOKEN_RE, (_, n: string) => {
    const i = Number(n)
    if (i >= translations.length) throw new Error(`token ${i} has no translation`)
    used++
    return translations[i]
  })
  if (used !== translations.length) {
    throw new Error(`restore mismatch: ${translations.length} translations, ${used} tokens`)
  }
  if (/⟦/.test(out)) throw new Error('unreplaced token left in output')
  return out
}

/**
 * RTL → LTR: html-tag lang/dir, plus the directional CSS declarations that
 * exist to support Hebrew. text-align:right in these pages is directional
 * by construction (the operator reviews the result before sharing the link).
 */
export function flipDirection(html: string): string {
  return html
    .replace(/(<html\b[^>]*?)\blang="he"/i, '$1lang="en"')
    .replace(/(<html\b[^>]*?)\bdir="rtl"/i, '$1dir="ltr"')
    .replace(/\bdirection(\s*:\s*)rtl\b/gi, 'direction$1ltr')
    .replace(/\btext-align(\s*:\s*)right\b/gi, 'text-align$1left')
}

/** Chunk for per-batch model calls; order is preserved, concat to reassemble. */
export function chunkSegments(segments: string[], maxPerBatch = 120): string[][] {
  const out: string[][] = []
  for (let i = 0; i < segments.length; i += maxPerBatch) {
    out.push(segments.slice(i, i + maxPerBatch))
  }
  return out
}
