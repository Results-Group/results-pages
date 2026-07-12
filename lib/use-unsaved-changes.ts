import { useEffect } from 'react'

/**
 * Warns the user before leaving/reloading the tab while there are unsaved
 * edits. Pass a `dirty` flag that is true whenever local state diverges from
 * what was last saved.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy browsers require returnValue to be set to trigger the prompt
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
