'use client'

import {
  useRef, useEffect, useState, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import type { ComponentType } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link2,
  Undo2, Redo2, Maximize2, Minimize2,
  Highlighter, Eraser,
} from 'lucide-react'
import { usePrompt } from '../../_components/confirm-dialog'

export interface VisualEditorRef {
  getHtml: () => string
}

interface Props {
  html: string
  onSave: (html: string) => Promise<void>
  saving: boolean
  /** Lifts the private dirty flag so the page-level unsaved guard sees it. */
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * Elements a caret must not be able to eat. designMode makes the whole document
 * editable, so a backspace beside a slider arrow removes the arrow — the page
 * still renders, so nothing announces the loss. Marking these non-editable
 * makes each one an atomic island that ordinary typing cannot dissolve.
 *
 * <a> is deliberately absent: its text is legitimate copy to edit. Deleting a
 * whole link is caught server-side instead, where every path is covered.
 */
const LOCKED = 'button, img, svg, iframe, video, audio, canvas, input, select, textarea, object, embed'

/** Lock the structure. The marker attribute records what we added, so export
 *  can strip exactly those and never a contenteditable the page shipped with. */
function lockStructure(doc: Document) {
  doc.querySelectorAll(LOCKED).forEach(el => {
    if (el.hasAttribute('contenteditable')) return
    el.setAttribute('contenteditable', 'false')
    el.setAttribute('data-rp-locked', '')
  })
}

/**
 * Remember every class attribute as the document arrived.
 *
 * The export is documentElement.outerHTML, which is the DOM as it stands right
 * then — and an uploaded page's own scripts toggle classes as you look around
 * it. Save while viewing the fourth tab and that tab is what the file now
 * opens on: the Netiv HaChesed deck spent a day opening on its billboard
 * section instead of its cover, because a caption was edited from there.
 *
 * The snapshot rides on the element itself rather than on an index, so it
 * survives text edits adding or removing nodes around it.
 */
function snapshotClasses(doc: Document) {
  doc.querySelectorAll('[class]').forEach(el => {
    el.setAttribute('data-rp-class', el.getAttribute('class') || '')
  })
}

/** Undo lockStructure on a clone, so the attributes never reach the live page. */
function unlockClone(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-rp-locked]').forEach(el => {
    el.removeAttribute('contenteditable')
    el.removeAttribute('data-rp-locked')
  })
  // Put every class back the way the file had it, undoing whatever the page's
  // own navigation toggled while the operator was reading. Elements the
  // toolbar created carry no snapshot and keep what they have — formatting
  // runs with styleWithCSS, so it writes inline styles, never classes.
  clone.querySelectorAll('[data-rp-class]').forEach(el => {
    const original = el.getAttribute('data-rp-class') || ''
    el.removeAttribute('data-rp-class')
    if (original) el.setAttribute('class', original)
    else el.removeAttribute('class')
  })
  return clone.outerHTML
}

const VisualEditor = forwardRef<VisualEditorRef, Props>(function VisualEditor(
  { html, onSave, saving, onDirtyChange },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const textColorRef = useRef<HTMLInputElement>(null)
  const bgColorRef = useRef<HTMLInputElement>(null)
  const savedSelRef = useRef<Range | null>(null)
  const initHtmlRef = useRef('')
  const [ready, setReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const promptText = usePrompt()

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  const getHtml = useCallback((): string => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !ready) return html
    // Never doc.documentElement.outerHTML directly — that would ship our own
    // contenteditable="false" markers into the page the client sees.
    return '<!DOCTYPE html>\n' + unlockClone(doc)
  }, [html, ready])

  useImperativeHandle(ref, () => ({ getHtml }), [getHtml])

  useEffect(() => {
    if (!html || !iframeRef.current || html === initHtmlRef.current) return
    initHtmlRef.current = html
    const iframe = iframeRef.current

    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      doc.designMode = 'on'
      try { doc.execCommand('styleWithCSS', false, 'true') } catch { /* noop */ }
      lockStructure(doc)
      snapshotClasses(doc)
      doc.addEventListener('input', () => setDirty(true))
      doc.addEventListener('paste', () => setDirty(true))
      setReady(true)
      setDirty(false)
    }, 50)
  }, [html])

  useEffect(() => {
    if (!fullscreen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fullscreen])

  const exec = useCallback((cmd: string, val?: string) => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.execCommand(cmd, false, val)
    iframeRef.current?.contentWindow?.focus()
  }, [])

  const saveSelection = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const sel = doc.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedSelRef.current = sel.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !savedSelRef.current) return
    const sel = doc.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(savedSelRef.current)
    }
  }, [])

  const handleLink = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const sel = doc.getSelection()
    const node = sel?.anchorNode
    const el = node instanceof HTMLElement ? node : node?.parentElement
    const anchor = el?.closest?.('a')
    // The dialog steals focus and can collapse the iframe selection — capture
    // the range before awaiting and restore it after, or execCommand is a no-op.
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
    const restore = () => {
      if (range && sel) { sel.removeAllRanges(); sel.addRange(range) }
    }
    if (anchor) {
      const url = await promptText({ title: 'ערוך כתובת קישור', dir: 'ltr', defaultValue: anchor.href })
      if (url === null) return
      restore()
      if (url === '') doc.execCommand('unlink')
      else anchor.href = url
    } else {
      const url = await promptText({ title: 'הזן כתובת קישור', dir: 'ltr', placeholder: 'https://' })
      if (!url) return
      restore()
      doc.execCommand('createLink', false, url)
    }
    iframeRef.current?.contentWindow?.focus()
  }, [promptText])

  const handleSave = useCallback(async () => {
    await onSave(getHtml())
    setDirty(false)
  }, [onSave, getHtml])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleSave])

  const btnBase = 'flex items-center justify-center rounded-md transition-all duration-150'

  const TB = ({ icon: Icon, cmd, val, title, onClick, children }: {
    icon?: ComponentType<{ className?: string }>
    cmd?: string
    val?: string
    title: string
    onClick?: () => void
    children?: React.ReactNode
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={e => {
        e.preventDefault()
        if (onClick) onClick()
        else if (cmd) exec(cmd, val)
      }}
      className={btnBase}
      style={{ width: 32, height: 32, color: 'var(--admin-text-secondary)' }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--admin-bg-elevated)'
        e.currentTarget.style.color = 'var(--admin-text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--admin-text-secondary)'
      }}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )

  const Sep = () => (
    <div className="mx-1 self-stretch" style={{ width: 1, background: 'var(--admin-border)' }} />
  )

  return (
    <div
      className={fullscreen ? 'fixed inset-0 z-[9999] flex flex-col' : 'rounded-xl overflow-hidden'}
      style={{
        background: fullscreen ? 'var(--admin-bg)' : undefined,
        border: fullscreen ? 'none' : '1px solid var(--admin-border)',
      }}
    >
      {/* Floating exit — the toolbar's own minimize button lives at the end
          of a flex-wrap row and slips off-screen once the toolbar breaks onto
          a second line, so users get trapped in fullscreen with no visible way
          out. This corner button is always on top and always reachable. */}
      {fullscreen && (
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="fixed top-4 z-[10000] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-all"
          style={{
            // RTL layout: pin to the left (Hebrew reads right-to-left, so the
            // top-left corner is the "trailing" corner that stays clear of the
            // content the user is reading).
            insetInlineStart: '1rem',
            background: 'var(--admin-danger)',
            color: '#fff',
          }}
          title="יציאה ממסך מלא (Esc)"
        >
          <Minimize2 className="w-4 h-4" />
          יציאה ממסך מלא
        </button>
      )}
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 px-3 py-2"
        style={{ background: 'var(--admin-bg-elevated)', borderBottom: '1px solid var(--admin-border)' }}
      >
        <select
          onChange={e => { if (e.target.value) exec('formatBlock', e.target.value); e.target.value = '' }}
          className="h-8 px-2 rounded-md text-xs font-medium outline-none cursor-pointer"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
          defaultValue=""
        >
          <option value="" disabled>פורמט</option>
          <option value="p">פסקה</option>
          <option value="h1">כותרת 1</option>
          <option value="h2">כותרת 2</option>
          <option value="h3">כותרת 3</option>
          <option value="h4">כותרת 4</option>
        </select>
        <Sep />

        <TB icon={Bold} cmd="bold" title="מודגש (Ctrl+B)" />
        <TB icon={Italic} cmd="italic" title="נטוי (Ctrl+I)" />
        <TB icon={Underline} cmd="underline" title="קו תחתון (Ctrl+U)" />
        <TB icon={Strikethrough} cmd="strikeThrough" title="קו חוצה" />
        <Sep />

        <TB icon={AlignRight} cmd="justifyRight" title="יישור לימין" />
        <TB icon={AlignCenter} cmd="justifyCenter" title="מרכז" />
        <TB icon={AlignLeft} cmd="justifyLeft" title="יישור לשמאל" />
        <Sep />

        <TB icon={ListOrdered} cmd="insertOrderedList" title="רשימה ממוספרת" />
        <TB icon={List} cmd="insertUnorderedList" title="רשימה" />
        <Sep />

        <TB icon={Link2} onClick={handleLink} title="קישור" />
        <Sep />

        <input
          ref={textColorRef}
          type="color"
          className="sr-only"
          onChange={e => { restoreSelection(); exec('foreColor', e.target.value) }}
        />
        <TB title="צבע טקסט" onClick={() => { saveSelection(); textColorRef.current?.click() }}>
          <span className="text-sm font-medium" style={{ borderBottom: '3px solid #ef4444' }}>A</span>
        </TB>

        <input
          ref={bgColorRef}
          type="color"
          defaultValue="#ffff00"
          className="sr-only"
          onChange={e => { restoreSelection(); exec('hiliteColor', e.target.value) }}
        />
        <TB icon={Highlighter} title="צבע רקע" onClick={() => { saveSelection(); bgColorRef.current?.click() }} />
        <Sep />

        <TB icon={Eraser} cmd="removeFormat" title="הסר עיצוב" />
        <Sep />

        <TB icon={Undo2} cmd="undo" title="ביטול (Ctrl+Z)" />
        <TB icon={Redo2} cmd="redo" title="חזרה (Ctrl+Y)" />

        <div className="flex-1" />

        {dirty && (
          <span className="text-xs font-medium px-2 animate-pulse" style={{ color: 'var(--admin-accent)' }}>
            שינויים לא שמורים
          </span>
        )}

        <TB
          icon={fullscreen ? Minimize2 : Maximize2}
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? 'יציאה ממסך מלא (Esc)' : 'מסך מלא'}
        />
      </div>

      {/* Loading state */}
      {!ready && (
        <div className="flex items-center justify-center py-16" style={{ background: '#fff', color: '#999' }}>
          <span className="text-sm">טוען עורך ויזואלי...</span>
        </div>
      )}

      {/* Editing iframe */}
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: fullscreen ? 'calc(100vh - 110px)' : '600px',
          background: '#fff',
          display: ready ? 'block' : 'none',
        }}
      />

      {/* Save bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--admin-bg-elevated)', borderTop: '1px solid var(--admin-border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Ctrl+S לשמירה מהירה
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.transform = 'none'
          }}
        >
          {saving ? 'שומר...' : 'שמירת שינויים'}
        </button>
      </div>
    </div>
  )
})

export default VisualEditor
