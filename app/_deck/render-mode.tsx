'use client'

import { createContext, useContext } from 'react'

/**
 * How the deck is being rendered. `pdf` is the server's own headless capture
 * for PDF export (app/api/campaigns/[id]/pdf): every slide stacked, nothing
 * interactive, everything already open — captions expanded, video posters as
 * links. A context rather than a prop because the switches sit deep inside the
 * mockups (CreativesSlide → FacebookFeed → VideoPlayer, AdCaption).
 */
export interface DeckRenderMode { pdf: boolean }

const DeckRenderModeContext = createContext<DeckRenderMode>({ pdf: false })

export const DeckRenderModeProvider = DeckRenderModeContext.Provider

export function useDeckRenderMode(): DeckRenderMode {
  return useContext(DeckRenderModeContext)
}
