/**
 * Undo/redo for a document editor, as a reducer wrapper.
 *
 * Whole-document snapshots rather than diffs — the documents here are small
 * enough that the simplicity is worth more than the memory, and a snapshot can
 * never restore into an inconsistent state the way a mis-applied inverse patch
 * can.
 *
 * Extracted from useCampaignDocument so the strategy editor shares it. Generic
 * over the document type, with no React import, so it can be unit tested.
 */

export interface History<D> {
  past: D[]
  present: D
  future: D[]
}

export const HISTORY_LIMIT = 50

export type HistoryAction<A> = A | { type: 'UNDO' } | { type: 'REDO' }

export function initHistory<D>(present: D): History<D> {
  return { past: [], present, future: [] }
}

export function withHistory<D, A extends { type: string }>(
  reducer: (state: D, action: A) => D,
  /** Actions that replace the document wholesale and reset the timeline —
   *  a fresh load is not something the operator should be able to undo into. */
  isReset: (action: A) => D | null,
) {
  return function historyReducer(state: History<D>, action: HistoryAction<A>): History<D> {
    if (action.type === 'UNDO') {
      if (state.past.length === 0) return state
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      }
    }
    if (action.type === 'REDO') {
      if (state.future.length === 0) return state
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      }
    }

    const reset = isReset(action as A)
    if (reset !== null) return initHistory(reset)

    const next = reducer(state.present, action as A)
    // A no-op action must not create a history entry — and, because autosave
    // keys off document identity, must not trigger a save either.
    if (next === state.present) return state
    return {
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: next,
      future: [],
    }
  }
}

/** Move an array item, returning the same array when the move is a no-op. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
