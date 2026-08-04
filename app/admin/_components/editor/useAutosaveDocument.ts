'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Debounced autosave for a document editor.
 *
 * Every guard here is a production incident in the campaign editor, and they
 * are the reason this is worth extracting rather than rewriting per product:
 *
 * - **Serialized queue.** Saves run one after another, so a slow request can
 *   never land after a newer one and resurrect stale content.
 * - **Memoized create.** The first save of a new document is a POST; an upload
 *   and a Cmd+S racing each other would otherwise create two documents.
 * - **Conflict latch.** A 409 stops autosaving permanently until the operator
 *   reloads. Retrying would either overwrite a colleague's work or spin.
 * - **Ref-held document and save fn**, so a timer that fires later reads the
 *   current values rather than the ones captured when it was scheduled.
 *
 * The caller supplies the URLs and how to turn its document into a request
 * body; everything product-specific stays out of here.
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** What a create endpoint returns. Extra fields are carried through to onCreated. */
interface CreatedDoc { id: string; slug?: string; updated_at?: string }

export interface AutosaveOptions<D> {
  doc: D
  /** Existing document id, or null for one that hasn't been created yet. */
  id: string | null
  /** `updated_at` as last seen from the server — the concurrency token. */
  initialUpdatedAt?: string | null
  createUrl: string
  itemUrl: (id: string) => string
  /** The PUT body. `sections: doc.sections` — never a hand-listed field set. */
  buildBody: (doc: D) => Record<string, unknown>
  /** The POST body used to create the document on first save. */
  buildCreateBody: (doc: D) => Record<string, unknown>
  /** Return a message to block the save, or null to allow it. */
  validate?: (doc: D) => string | null
  onCreated?: (created: CreatedDoc) => void
  onSaved?: (data: Record<string, unknown>) => void
  onError?: (message: string) => void
  /** Milliseconds of quiet before an autosave fires. */
  debounceMs?: number
}

export function useAutosaveDocument<D>({
  doc, id, initialUpdatedAt, createUrl, itemUrl,
  buildBody, buildCreateBody, validate, onCreated, onSaved, onError,
  debounceMs = 1500,
}: AutosaveOptions<D>) {
  const [docId, setDocId] = useState<string | null>(id)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [conflict, setConflict] = useState(false)

  const docRef = useRef(doc)
  useEffect(() => { docRef.current = doc })

  const updatedAtRef = useRef<string | null>(initialUpdatedAt ?? null)
  const conflictRef = useRef(false)
  const docIdRef = useRef<string | null>(id)
  useEffect(() => { docIdRef.current = docId }, [docId])

  const createPromise = useRef<Promise<CreatedDoc | null> | null>(null)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Creates the document on first save. One in-flight promise, ever. */
  const ensureExists = useCallback(async (): Promise<string | null> => {
    if (docIdRef.current) return docIdRef.current
    if (!createPromise.current) {
      createPromise.current = (async () => {
        const res = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCreateBody(docRef.current)),
        })
        if (!res.ok) return null
        return res.json()
      })()
    }
    const created = await createPromise.current
    // Clear on failure so a retry can happen; keep it on success so a second
    // caller reuses the same document.
    if (!created) { createPromise.current = null; return null }
    setDocId(created.id)
    docIdRef.current = created.id
    if (created.updated_at) updatedAtRef.current = created.updated_at
    onCreated?.(created)
    return created.id
  }, [createUrl, buildCreateBody, onCreated])

  const save = useCallback(async (opts?: { silent?: boolean }) => {
    if (conflictRef.current) return
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null }

    const invalid = validate?.(docRef.current)
    if (invalid) {
      if (!opts?.silent) onError?.(invalid)
      return
    }

    const run = async () => {
      if (conflictRef.current) return
      setSaveState('saving')
      try {
        const targetId = await ensureExists()
        if (!targetId) throw new Error('create failed')

        const res = await fetch(itemUrl(targetId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...buildBody(docRef.current),
            base_updated_at: updatedAtRef.current ?? undefined,
          }),
        })

        if (res.status === 409) {
          // Latched, not retried: the document moved under us, and anything we
          // send now either loses a colleague's work or loops.
          conflictRef.current = true
          setConflict(true)
          setSaveState('error')
          return
        }
        if (!res.ok) throw new Error(`save failed: ${res.status}`)

        const data = await res.json()
        if (data.updated_at) updatedAtRef.current = data.updated_at
        setSaveState('saved')
        onSaved?.(data)
      } catch (err) {
        setSaveState('error')
        if (!opts?.silent) onError?.(err instanceof Error ? err.message : 'שגיאה בשמירה')
      }
    }

    // `.then(run, run)` so a rejected predecessor still lets this one run.
    const result = saveQueue.current.then(run, run)
    saveQueue.current = result
    return result
  }, [ensureExists, itemUrl, buildBody, validate, onSaved, onError])

  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })

  // Debounced autosave, keyed on document identity. The reducer returns the
  // same object for a no-op action, so an edit that changes nothing does not
  // schedule a save.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (conflictRef.current) return
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null
      saveRef.current({ silent: true })
    }, debounceMs)
    return () => {
      if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null }
    }
  }, [doc, debounceMs])

  return { docId, saveState, conflict, save, ensureExists }
}
