/**
 * The rich-text document format shared by every Results deck.
 *
 * A ProseMirror/TipTap document, typed structurally so nothing outside the
 * admin editor has to depend on TipTap — the client's deck renders this with a
 * plain React function and never loads the library.
 *
 * The renderer walks these nodes and emits text only. Storing the document
 * rather than HTML is what keeps that guarantee: there is no markup to inject,
 * whatever gets pasted into the editor.
 *
 * Lives in its own module (no server-only imports) so the admin editor, the
 * public deck and the unit tests can all reach it. Same split as
 * lib/client-name.ts and lib/copies.ts.
 */

export interface PlanDocNode {
  type: string
  attrs?: { level?: number }
  content?: PlanDocNode[]
  text?: string
  marks?: { type: string }[]
}

export interface PlanDoc {
  type: 'doc'
  content?: PlanDocNode[]
}

/** True when the document holds no visible text. */
export function docIsEmpty(doc?: PlanDoc | null): boolean {
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) return true
  const hasText = (nodes: PlanDocNode[]): boolean =>
    nodes.some(n => (typeof n.text === 'string' && n.text.trim().length > 0) || (n.content ? hasText(n.content) : false))
  return !hasText(doc.content)
}

/** Flattens a document to plain text — used for previews and summaries. */
export function docPlainText(doc?: PlanDoc | null): string {
  if (!doc?.content) return ''
  const walk = (nodes: PlanDocNode[]): string =>
    nodes.map(n => (typeof n.text === 'string' ? n.text : '') + (n.content ? ` ${walk(n.content)}` : '')).join(' ')
  return walk(doc.content).replace(/\s+/g, ' ').trim()
}

/**
 * Builds a document from plain paragraphs. For seeding fixed copy from a
 * template — one paragraph per line, no markup parsing.
 */
export function docFromLines(...lines: string[]): PlanDoc {
  return {
    type: 'doc',
    content: lines
      .filter(line => line.trim().length > 0)
      .map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }
}

/** An empty document — what an editor mounts on, and what a factory returns. */
export function emptyDoc(): PlanDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}
