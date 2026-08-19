/**
 * The autosave protocol's three invariants, as pure pieces so tests can hold
 * them (the hook that uses them can't run under vitest's node environment).
 * Every one of these is a production incident:
 *
 * - A 409 latches saving off permanently until reload — retrying would either
 *   overwrite a colleague's work or spin.
 * - Saves are serialized, and a FAILED save must not wedge the queue.
 * - The concurrency token only ever advances from a server response.
 */

/** Once latched by a 409, stays latched — there is no unlatch but a reload. */
export class ConflictLatch {
  private v = false
  get latched(): boolean { return this.v }
  /** Feed every save response's status through; returns the latch state. */
  noteHttpStatus(status: number): boolean {
    if (status === 409) this.v = true
    return this.v
  }
}

/**
 * Appends a save to the serialized queue. `.then(run, run)` — a rejected
 * predecessor still lets the next save run, otherwise one network error
 * would silently end autosaving for the rest of the session.
 */
export function chainSerialized<T>(queue: Promise<unknown>, run: () => Promise<T>): Promise<T> {
  return queue.then(run, run)
}

/** The concurrency token: advance only when the response carries one. */
export function nextToken(current: string | null, response: { updated_at?: string } | null | undefined): string | null {
  return response?.updated_at || current
}
