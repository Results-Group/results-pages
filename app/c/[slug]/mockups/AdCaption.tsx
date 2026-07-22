'use client'

import { useState } from 'react'

/**
 * Ad copy exactly as the advertiser typed it — line breaks and blank lines
 * preserved (whitespace-pre-line) — with a real-ad-platform "show more"
 * collapse for long text, so the preview reads like Instagram/Facebook rather
 * than dumping the whole caption.
 */
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
  const [expanded, setExpanded] = useState(false)

  const isLong = text.length > collapseChars
  // Trim to the last whitespace before the limit so we never cut mid-word.
  const collapsed = isLong ? text.slice(0, collapseChars).replace(/\s+\S*$/, '') : text
  const shown = expanded || !isLong ? text : collapsed

  return (
    <p className={className} style={{ whiteSpace: 'pre-line' }}>
      {clientName && <span className="font-semibold text-gray-900">{clientName} </span>}
      <span className="text-gray-700">{shown}{isLong && !expanded ? '… ' : ''}</span>
      {isLong && (
        <button
          type="button"
          onClick={e => {
            // Stop the click from bubbling to the mockup wrapper, whose
            // onClick opens the fullscreen lightbox — we want inline expansion,
            // not a modal.
            e.stopPropagation()
            setExpanded(v => !v)
          }}
          className="text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          {expanded ? 'הצג פחות' : 'עוד'}
        </button>
      )}
    </p>
  )
}
