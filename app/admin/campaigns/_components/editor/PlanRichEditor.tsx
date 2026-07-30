'use client'

// The editing surface is styled with the deck's own stylesheet, so it has to be
// imported here — nothing else in the admin bundle pulls it in.
import '@/app/c/[slug]/presentation.css'
import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Pilcrow, Redo2, Undo2 } from 'lucide-react'
import type { PlanDoc } from '@/lib/distribution'

/**
 * WYSIWYG for the distribution slide's free text.
 *
 * The schema is deliberately narrow — headings, paragraphs, lists, bold,
 * italic. A slide in a pitch deck has no use for code blocks or tables, and
 * every node type allowed here is one the public renderer must also support.
 *
 * The editing surface carries the deck's own classes, so what the operator
 * types is already styled the way the client will see it.
 */

const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Off: nothing on a creative slide needs them, and each one would have to
    // be mirrored in the public renderer.
    codeBlock: false,
    code: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
  }),
]

export default function PlanRichEditor({ doc, onChange }: {
  doc: PlanDoc | null
  onChange: (doc: PlanDoc) => void
}) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: doc && doc.content?.length ? doc : { type: 'doc', content: [{ type: 'paragraph' }] },
    // Rendered on the client only — without this Next warns about SSR
    // hydration for contenteditable.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        dir: 'rtl',
        class: 'dist-text plan-editor-surface',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as PlanDoc),
  })

  // Only adopt an externally-changed document when it isn't what we already
  // hold: setContent on every keystroke would fight the caret.
  useEffect(() => {
    if (!editor || !doc) return
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(doc)) return
    editor.commands.setContent(doc, { emitUpdate: false })
  }, [editor, doc])

  if (!editor) return null

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <Toolbar editor={editor} />
      <div
        className="flex-1 min-h-0 overflow-auto rounded-b-lg"
        style={{ background: '#090c0e', border: '1px solid var(--admin-border)', borderTop: 'none' }}
        onClick={() => editor.chain().focus().run()}
      >
        <div className="campaign-pres" style={{ minHeight: '100%', padding: '18px 22px' }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(64,225,211,0.14)' : 'var(--admin-bg-elevated)',
    border: `1px solid ${active ? 'rgba(64,225,211,0.4)' : 'var(--admin-border)'}`,
    color: active ? '#40e1d3' : 'var(--admin-text-secondary)',
  })

  const items: { key: string; title: string; icon: React.ReactNode; active: boolean; run: () => void }[] = [
    {
      key: 'h1', title: 'כותרת גדולה', icon: <Heading1 className="w-4 h-4" />,
      active: editor.isActive('heading', { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: 'h2', title: 'כותרת', icon: <Heading2 className="w-4 h-4" />,
      active: editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: 'h3', title: 'כותרת קטנה', icon: <Heading3 className="w-4 h-4" />,
      active: editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: 'p', title: 'טקסט רגיל', icon: <Pilcrow className="w-4 h-4" />,
      active: editor.isActive('paragraph') && !editor.isActive('bulletList') && !editor.isActive('orderedList'),
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      key: 'ul', title: 'רשימת בולטים', icon: <List className="w-4 h-4" />,
      active: editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'ol', title: 'רשימה ממוספרת', icon: <ListOrdered className="w-4 h-4" />,
      active: editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: 'bold', title: 'מודגש (Cmd+B)', icon: <Bold className="w-4 h-4" />,
      active: editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic', title: 'נטוי (Cmd+I)', icon: <Italic className="w-4 h-4" />,
      active: editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
  ]

  return (
    <div
      className="flex flex-wrap items-center gap-1 p-2 rounded-t-lg shrink-0"
      style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)', borderBottom: 'none' }}
    >
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          title={item.title}
          aria-pressed={item.active}
          // Keeps the selection while the button takes the click.
          onMouseDown={e => e.preventDefault()}
          onClick={item.run}
          className="p-2 rounded-md transition-colors"
          style={btn(item.active)}
        >
          {item.icon}
        </button>
      ))}

      <span className="w-px h-6 mx-1" style={{ background: 'var(--admin-border)' }} />

      <button
        type="button" title="בטל (Cmd+Z)" onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="p-2 rounded-md disabled:opacity-30" style={btn(false)}
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        type="button" title="בצע שוב (Cmd+Shift+Z)" onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="p-2 rounded-md disabled:opacity-30" style={btn(false)}
      >
        <Redo2 className="w-4 h-4" />
      </button>

      <span className="ms-auto text-[11px] font-bold pe-1" style={{ color: 'var(--admin-text-muted)' }}>
        מה שנראה כאן הוא מה שהלקוח יראה
      </span>
    </div>
  )
}
