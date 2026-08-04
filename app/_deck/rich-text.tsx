import type { PlanDoc, PlanDocNode } from '@/lib/rich-doc'

/**
 * Renders a stored rich-text document.
 *
 * A deliberate whitelist: any node type not handled here renders as nothing,
 * and text is emitted as text. That is what makes it safe to show a document an
 * operator pasted from anywhere into a page a client opens — there is no path
 * from the stored data to markup.
 *
 * Shared by every deck. There must be exactly one of these to audit, so the
 * campaign and strategy decks import it rather than each keeping a copy.
 *
 * `classes` maps the node types onto each deck's own stylesheet, so the markup
 * stays identical while the two products style it their own way.
 */

export interface RichTextClasses {
  heading: (level: number) => string
  paragraph: string
  list: (ordered: boolean) => string
}

/** The distribution slide's classes — the original consumer. */
export const DIST_CLASSES: RichTextClasses = {
  heading: level => `dist-text-h lvl-${level}`,
  paragraph: 'dist-text-p',
  list: ordered => `dist-text-list${ordered ? ' is-ordered' : ''}`,
}

export function renderNodes(
  nodes: PlanDocNode[],
  classes: RichTextClasses,
  keyPrefix = '',
): React.ReactNode {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`
    switch (node.type) {
      case 'text': {
        const bold = node.marks?.some(m => m.type === 'bold')
        const italic = node.marks?.some(m => m.type === 'italic')
        let out: React.ReactNode = node.text ?? ''
        if (italic) out = <em key={key}>{out}</em>
        if (bold) out = <strong key={key}>{out}</strong>
        return <span key={key}>{out}</span>
      }
      case 'hardBreak':
        return <br key={key} />
      case 'heading': {
        const level = Math.min(Math.max(node.attrs?.level ?? 2, 1), 3)
        return (
          <h3 key={key} className={classes.heading(level)}>
            {renderNodes(node.content || [], classes, `${key}-`)}
          </h3>
        )
      }
      case 'paragraph':
        return <p key={key} className={classes.paragraph}>{renderNodes(node.content || [], classes, `${key}-`)}</p>
      case 'bulletList':
      case 'orderedList':
        return (
          <ul key={key} className={classes.list(node.type === 'orderedList')}>
            {renderNodes(node.content || [], classes, `${key}-`)}
          </ul>
        )
      case 'listItem':
        return <li key={key}>{renderNodes(node.content || [], classes, `${key}-`)}</li>
      default:
        return null
    }
  })
}

/** A whole document rendered into a container. */
export function RichText({
  doc,
  classes,
  className,
}: {
  doc: PlanDoc
  classes: RichTextClasses
  className?: string
}) {
  return (
    <div className={className} dir="rtl">
      {renderNodes(doc.content || [], classes)}
    </div>
  )
}
