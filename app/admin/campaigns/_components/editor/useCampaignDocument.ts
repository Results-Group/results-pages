'use client'

import { useCallback, useReducer } from 'react'
import type { CampaignDocument, CampaignMeta, EditorAsset, EditorSection } from './types'
import { newSection } from './types'

type Action =
  | { type: 'SET_META'; patch: Partial<CampaignMeta> }
  | { type: 'ADD_SECTION' }
  | { type: 'DUPLICATE_SECTION'; id: string }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'UPDATE_SECTION'; id: string; patch: Partial<EditorSection> }
  | { type: 'MOVE_SECTION'; from: number; to: number }
  | { type: 'ADD_ASSET'; sectionId: string; asset: EditorAsset }
  | { type: 'UPDATE_ASSET'; sectionId: string; assetId: string; patch: Partial<EditorAsset> }
  | { type: 'REMOVE_ASSET'; sectionId: string; assetId: string }
  | { type: 'MOVE_ASSET'; sectionId: string; from: number; to: number }
  | { type: 'REPLACE_DOC'; doc: CampaignDocument }

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function docReducer(state: CampaignDocument, action: Action): CampaignDocument {
  switch (action.type) {
    case 'REPLACE_DOC':
      return action.doc
    case 'SET_META':
      return { ...state, meta: { ...state.meta, ...action.patch } }
    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, newSection()] }
    case 'DUPLICATE_SECTION': {
      const idx = state.sections.findIndex(s => s.id === action.id)
      if (idx < 0) return state
      const orig = state.sections[idx]
      const copy: EditorSection = {
        ...orig,
        id: crypto.randomUUID(),
        title: orig.title ? `${orig.title} (עותק)` : '',
        assets: orig.assets.map(a => ({ ...a, id: crypto.randomUUID() })),
      }
      const sections = state.sections.slice()
      sections.splice(idx + 1, 0, copy)
      return { ...state, sections }
    }
    case 'REMOVE_SECTION':
      return { ...state, sections: state.sections.filter(s => s.id !== action.id) }
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map(s => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }
    case 'MOVE_SECTION':
      return { ...state, sections: move(state.sections, action.from, action.to) }
    case 'ADD_ASSET':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.sectionId ? { ...s, assets: [...s.assets, action.asset] } : s,
        ),
      }
    case 'UPDATE_ASSET':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.sectionId
            ? { ...s, assets: s.assets.map(a => (a.id === action.assetId ? { ...a, ...action.patch } : a)) }
            : s,
        ),
      }
    case 'REMOVE_ASSET':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.sectionId ? { ...s, assets: s.assets.filter(a => a.id !== action.assetId) } : s,
        ),
      }
    case 'MOVE_ASSET':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.sectionId ? { ...s, assets: move(s.assets, action.from, action.to) } : s,
        ),
      }
    default:
      return state
  }
}

// ── History wrapper for undo/redo ──

interface History {
  past: CampaignDocument[]
  present: CampaignDocument
  future: CampaignDocument[]
}

type HistoryAction = Action | { type: 'UNDO' } | { type: 'REDO' }

const HISTORY_LIMIT = 50

function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    }
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
    }
  }
  // REPLACE_DOC resets history (fresh load)
  if (action.type === 'REPLACE_DOC') {
    return { past: [], present: action.doc, future: [] }
  }
  const newPresent = docReducer(state.present, action)
  if (newPresent === state.present) return state
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: newPresent,
    future: [],
  }
}

export function useCampaignDocument(initial: CampaignDocument) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
  })

  const actions = {
    setMeta: useCallback((patch: Partial<CampaignMeta>) => dispatch({ type: 'SET_META', patch }), []),
    addSection: useCallback(() => dispatch({ type: 'ADD_SECTION' }), []),
    duplicateSection: useCallback((id: string) => dispatch({ type: 'DUPLICATE_SECTION', id }), []),
    removeSection: useCallback((id: string) => dispatch({ type: 'REMOVE_SECTION', id }), []),
    updateSection: useCallback((id: string, patch: Partial<EditorSection>) => dispatch({ type: 'UPDATE_SECTION', id, patch }), []),
    moveSection: useCallback((from: number, to: number) => dispatch({ type: 'MOVE_SECTION', from, to }), []),
    addAsset: useCallback((sectionId: string, asset: EditorAsset) => dispatch({ type: 'ADD_ASSET', sectionId, asset }), []),
    updateAsset: useCallback((sectionId: string, assetId: string, patch: Partial<EditorAsset>) => dispatch({ type: 'UPDATE_ASSET', sectionId, assetId, patch }), []),
    removeAsset: useCallback((sectionId: string, assetId: string) => dispatch({ type: 'REMOVE_ASSET', sectionId, assetId }), []),
    moveAsset: useCallback((sectionId: string, from: number, to: number) => dispatch({ type: 'MOVE_ASSET', sectionId, from, to }), []),
    replaceDoc: useCallback((doc: CampaignDocument) => dispatch({ type: 'REPLACE_DOC', doc }), []),
    undo: useCallback(() => dispatch({ type: 'UNDO' }), []),
    redo: useCallback(() => dispatch({ type: 'REDO' }), []),
  }

  return {
    doc: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    ...actions,
  }
}
