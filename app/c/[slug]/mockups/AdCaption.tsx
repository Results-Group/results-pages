'use client'

import { createContext, useContext, useMemo, useState } from 'react'

/**
 * Ad copy exactly as the advertiser typed it — line breaks and blank lines
 * preserved (whitespace-pre-line) — with a real-ad-platform "show more"
 * collapse for long text, so the preview reads like Instagram/Facebook rather
 * than dumping the whole caption.
 */

/**
 * Expansion shared across every caption on one slide.
 *
 * Two mockups sit side by side with the same copy. With the state local to each
 * caption, expanding one grew that phone and left the other short, so the pair
 * stopped lining up — the slide is a comparison, and it has to read as one.
 * Captions outside a provider keep their own state, so a single mockup still
 * works on its own.
 */
const CaptionExpansionContext = createContext<{ expanded: boolean; toggle: () => void } | null>(null)

export function CaptionExpansionProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const value = useMemo(() => ({ expanded, toggle: () => setExpanded(v => !v) }), [expanded])
  return <CaptionExpansionContext.Provider value={value}>{children}</CaptionExpansionContext.Provider>
}

export default function AdCaption({
  text,
  clientName,
  className = '',
  collapseChars = 140,
}: {
  text: string
  /** Bold inline username prefix (Instagram-style). Omit for Facebook. */
  clientName?: string
  className?: string
  collapseChars?: number
}) {
  const shared = useContext(CaptionExpansionContext)
  const [localExpanded, setLocalExpanded] = useState(false)

  const expanded = shared ? shared.expanded : localExpanded
  const toggle = shared ? shared.toggle : () => setLocalExpanded(v => !v)

  const isLong = text.length > collapseChars
  // Trim to the last whitespace before the limit so we never cut mid-word.
  const collapsed = isLong ? text.slice(0, collapseChars).replace(/\s+\S*$/, '') : text
  const shown = expanded || !isLong ? text : collapsed

  return (
    <p className={className} style={{ whiteSpace: 'pre-line' }}>
      {clientName && <span className="font-semibold text-gray-900">{clientName} </span>}
      {/* The trailing space matters: expanded, the text ran straight into
          "הצג פחות" with no gap. */}
      <span className="text-gray-700">{shown}{isLong ? (expanded ? ' ' : '… ') : ''}</span>
      {isLong && (
        <button
          type="button"
          onClick={e => {
            // Stop the click from bubbling to the mockup wrapper, whose
            // onClick opens the fullscreen lightbox — we want inline expansion,
            // not a modal.
            e.stopPropagation()
            toggle()
          }}
          className="text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          {expanded ? 'הצג פחות' : 'עוד'}
        </button>
      )}
    </p>
  )
}
