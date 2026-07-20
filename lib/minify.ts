/**
 * Whitespace-collapsing minifier for uploaded landing pages.
 *
 * `<script>`, `<style>`, `<pre>` and `<textarea>` are stashed out before the
 * whitespace rules run and restored verbatim afterwards. Collapsing newlines
 * inside a script is destructive: everything after a `//` line comment ends up
 * on the same line and gets commented out, which silently broke uploaded pages
 * (the markup survived, the JavaScript didn't, so half the page never rendered).
 */
const PROTECTED = /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi

export function minifyHtml(html: string): string {
  // If the page already contains the stash token, minifying could corrupt it —
  // serving the original verbatim is always safe.
  if (html.includes('RPBLOCK')) return html

  const blocks: string[] = []
  // The token carries no whitespace, so the collapsing rules below leave it intact.
  const stashed = html.replace(PROTECTED, match => {
    blocks.push(match)
    return `RPBLOCK${blocks.length - 1}`
  })

  const minified = stashed
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return minified.replace(/RPBLOCK(\d+)/g, (_, i: string) => blocks[Number(i)] ?? '')
}
