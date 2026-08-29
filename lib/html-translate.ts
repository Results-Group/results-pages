/**
 * Markup-safe translation plumbing for uploaded HTML pages, pure and
 * node-testable. The model never sees markup: every Hebrew-bearing text
 * segment is swapped for a ⟦N⟧ token and shipped as a JSON array — same
 * stash-transform-restore idea as lib/minify.ts. What never leaves the file
 * can never be mangled by the model.
 *
 * Masking the input is only half the job. Whatever comes back is written into
 * three different syntactic contexts, so each segment remembers which one it
 * came from and is re-encoded for it on the way in. Without that, a model
 * answer containing a quote or a tag escapes its context — and the everyday
 * version of the same bug is an English apostrophe ("don't") silently
 * terminating a JS string and breaking the page.
 */

const HEBREW = /[֐-׿]/
/** Token wrapper. U+27E6/27E7 — never appears in real pages; bail if it does. */
const TOKEN = (n: number) => `⟦${n}⟧`
const TOKEN_RE = /⟦(\d+)⟧/g

/**
 * A tag is `<`, then any mix of plain characters and quoted attribute values,
 * then `>`. Matching quotes matters: `<div title="א > ב">` is ONE tag, and the
 * naive /<[^>]*>/ split it in half and handed the model a piece of markup.
 */
const TAG_RE = /(<(?:[^>"']|"[^"]*"|'[^']*')*>)/

/** Where a segment sits in the document — decides how it is re-encoded. */
export type SegmentContext = 'text' | 'attr' | 'js'

export interface Segment {
  text: string
  ctx: SegmentContext
  /** For 'js': the quote character the literal was written with. */
  quote?: string
}

export interface ExtractResult {
  masked: string
  segments: Segment[]
}

/** The plain strings to send to the model, in order. */
export function segmentTexts(segments: Segment[]): string[] {
  return segments.map(s => s.text)
}

/**
 * Replaces every Hebrew-bearing text segment with a ⟦N⟧ token:
 * - text nodes between tags (whitespace around the text is preserved in place)
 * - values of title/alt/placeholder/aria-label/content attributes
 * - '…'/"…" string literals inside <script> blocks (chart labels etc.)
 * <style> blocks are never touched.
 */
export function extractSegments(html: string): ExtractResult {
  if (html.includes('⟦')) {
    throw new Error('input already contains the token character U+27E6')
  }
  const segments: Segment[] = []
  const take = (text: string, ctx: SegmentContext, quote?: string): string => {
    segments.push({ text, ctx, quote })
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
    .split(TAG_RE)
    .map(chunk => {
      if (!chunk || chunk.startsWith('<') || !HEBREW.test(chunk)) return chunk
      // keep the surrounding whitespace out of the model's hands
      const m = chunk.match(/^(\s*)([\s\S]*?)(\s*)$/)
      if (!m) return take(chunk, 'text')
      return m[1] + take(m[2], 'text') + m[3]
    })
    .join('')

  // Attribute values inside tags.
  stashed = stashed.replace(
    /(\s(?:title|alt|placeholder|aria-label|content)=")([^"]*)(")/gi,
    (full, pre: string, value: string, post: string) =>
      HEBREW.test(value) ? pre + take(value, 'attr') + post : full
  )

  // Script blocks back, with their Hebrew string literals tokenized. A literal
  // carrying a backslash is left alone: re-encoding it would need the model's
  // answer decoded first, and chart labels never contain one.
  stashed = stashed.replace(/⟦B(\d+)⟧/g, (_, i: string) => {
    const block = blocks[Number(i)]
    if (/^<style/i.test(block) || !HEBREW.test(block)) return block
    return block.replace(
      /(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g,
      (full, quote: string, inner: string) =>
        HEBREW.test(inner) && !inner.includes('\\')
          ? quote + take(inner, 'js', quote) + quote
          : full
    )
  })

  return { masked: stashed, segments }
}

/**
 * Re-encodes one translation for the context it is being written back into.
 * Each rule is a no-op on the text the extractor produced — a text node can
 * never hold a raw `<`, a double-quoted attribute can never hold a raw `"`,
 * and js literals with backslashes are never extracted — so an identity
 * round-trip still returns the original document byte for byte.
 */
export function encodeForContext(value: string, segment: Segment): string {
  switch (segment.ctx) {
    case 'text':
      // Blocking `<` is enough to make a tag unopenable; leaving `&` alone
      // keeps existing entities (&nbsp;) intact.
      return value.replace(/</g, '&lt;')
    case 'attr':
      return value.replace(/"/g, '&quot;').replace(/</g, '&lt;')
    case 'js': {
      const q = segment.quote || "'"
      return value
        .replace(/\\/g, '\\\\')
        .replace(new RegExp(q, 'g'), '\\' + q)
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        // `</script` inside a string still ends the element in the HTML parser.
        .replace(/<\//g, '<\\/')
    }
  }
}

/** Puts translated segments back, encoded for their context. */
export function restoreSegments(
  masked: string,
  segments: Segment[],
  translations: string[],
): string {
  if (translations.length !== segments.length) {
    throw new Error(`restore mismatch: ${segments.length} segments, ${translations.length} translations`)
  }
  let used = 0
  const out = masked.replace(TOKEN_RE, (_, n: string) => {
    const i = Number(n)
    if (i >= translations.length) throw new Error(`token ${i} has no translation`)
    used++
    return encodeForContext(translations[i], segments[i])
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
export function chunkSegments<T>(segments: T[], maxPerBatch = 120): T[][] {
  const out: T[][] = []
  for (let i = 0; i < segments.length; i += maxPerBatch) {
    out.push(segments.slice(i, i + maxPerBatch))
  }
  return out
}
