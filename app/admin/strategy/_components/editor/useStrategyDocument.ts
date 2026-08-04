'use client'

import { useCallback, useReducer } from 'react'
import { initHistory, withHistory, moveItem, type History } from '@/lib/editor/history'
import { SECTION_KINDS, uid } from '@/lib/strategy/registry'
import type { AnySection, SectionKind, StrategyDocMeta, StrategyDocument } from '@/lib/strategy/types'

/**
 * The strategy document store: a reducer plus undo/redo.
 *
 * Pure — no I/O. Sections are stored in exactly the shape that goes over the
 * wire, so saving is `sections: doc.sections` with nothing to enumerate. That
 * is what makes the campaign builder's data-loss trap impossible here: there is
 * no field list to forget a field from.
 */

type Action =
  | { type: 'SET_META'; patch: Partial<StrategyDocMeta> }
  | { type: 'ADD_SECTION'; kind: SectionKind; afterId?: string }
  | { type: 'DUPLICATE_SECTION'; id: string }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'UPDATE_SECTION'; id: string; patch: Record<string, unknown> }
  | { type: 'MOVE_SECTION'; from: number; to: number }
  | { type: 'REPLACE_DOC'; doc: StrategyDocument }

function reducer(state: StrategyDocument, action: Action): StrategyDocument {
  switch (action.type) {
    case 'SET_META':
      return { ...state, meta: { ...state.meta, ...action.patch } }

    case 'ADD_SECTION': {
      const section = SECTION_KINDS[action.kind].create() as AnySection
      const sections = state.sections.slice()
      const at = action.afterId ? sections.findIndex(s => s.id === action.afterId) : -1
      // Inserted after the current slide when there is one, so "add" lands
      // where the operator is looking rather than at the end of 29 slides.
      sections.splice(at >= 0 ? at + 1 : sections.length, 0, section)
      return { ...state, sections }
    }

    case 'DUPLICATE_SECTION': {
      const idx = state.sections.findIndex(s => s.id === action.id)
      if (idx < 0) return state
      const original = state.sections[idx]
      // Deep clone so nested arrays (rows, boxes, points) aren't shared with
      // the original — editing the copy would otherwise change both.
      const copy = structuredClone(original)
      copy.id = uid()
      regenerateNestedIds(copy)
      if ('title' in copy && typeof copy.title === 'string' && copy.title) {
        copy.title = `${copy.title} (עותק)`
      }
      const sections = state.sections.slice()
      sections.splice(idx + 1, 0, copy)
      return { ...state, sections }
    }

    case 'REMOVE_SECTION':
      return { ...state, sections: state.sections.filter(s => s.id !== action.id) }

    case 'UPDATE_SECTION': {
      let changed = false
      const sections = state.sections.map(s => {
        if (s.id !== action.id) return s
        changed = true
        return { ...s, ...action.patch } as AnySection
      })
      return changed ? { ...state, sections } : state
    }

    case 'MOVE_SECTION': {
      const sections = moveItem(state.sections, action.from, action.to)
      return sections === state.sections ? state : { ...state, sections }
    }

    case 'REPLACE_DOC':
      return action.doc
  }
}

/**
 * Fresh ids for every nested item that has one. A duplicated slide whose rows
 * or points kept their ids would have two elements answering to the same key,
 * and editing one would move the other.
 */
function regenerateNestedIds(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) regenerateNestedIds(item)
    return
  }
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  for (const [key, child] of Object.entries(record)) {
    if (key === 'id' && typeof child === 'string') record.id = uid()
    else regenerateNestedIds(child)
  }
}

const historyReducer = withHistory<StrategyDocument, Action>(
  reducer,
  action => (action.type === 'REPLACE_DOC' ? action.doc : null),
)

export function useStrategyDocument(initial: StrategyDocument) {
  const [history, dispatch] = useReducer(
    historyReducer,
    initial,
    initHistory as (d: StrategyDocument) => History<StrategyDocument>,
  )

  return {
    doc: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    setMeta: useCallback((patch: Partial<StrategyDocMeta>) => dispatch({ type: 'SET_META', patch }), []),
    addSection: useCallback((kind: SectionKind, afterId?: string) => dispatch({ type: 'ADD_SECTION', kind, afterId }), []),
    duplicateSection: useCallback((id: string) => dispatch({ type: 'DUPLICATE_SECTION', id }), []),
    removeSection: useCallback((id: string) => dispatch({ type: 'REMOVE_SECTION', id }), []),
    updateSection: useCallback((id: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_SECTION', id, patch }), []),
    moveSection: useCallback((from: number, to: number) => dispatch({ type: 'MOVE_SECTION', from, to }), []),
    replaceDoc: useCallback((doc: StrategyDocument) => dispatch({ type: 'REPLACE_DOC', doc }), []),
    undo: useCallback(() => dispatch({ type: 'UNDO' }), []),
    redo: useCallback(() => dispatch({ type: 'REDO' }), []),
  }
}
