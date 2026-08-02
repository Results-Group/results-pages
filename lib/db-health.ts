import { supabase } from './supabase'

/**
 * Distinguishes "this record doesn't exist" from "the database is unreachable".
 *
 * Born on 2026-08-02, when the production Supabase project was deleted by
 * mistake: every public campaign and report URL that clients had received
 * collapsed into a bare 404, because data-layer helpers return null for both
 * cases. During an outage the public pages must say "we're on it", not
 * "this never existed".
 */
/**
 * REBUILD_HOLD=1 keeps every public page on the maintenance screen even though
 * the (new, still-empty) database answers queries. Without it, the moment we
 * switched projects every link clients hold flipped from "maintenance" back to
 * a hard 404 — the empty database looked perfectly healthy. Remove the env var
 * once the rebuilt content is live.
 */
export function rebuildHold(): boolean {
  return process.env.REBUILD_HOLD === '1'
}

export async function databaseReachable(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    // A permission or schema error still proves the database answered.
    return !error || !isConnectivityError(error.message)
  } catch {
    return false
  }
}

function isConnectivityError(message: string | undefined): boolean {
  if (!message) return false
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Gone|timed out|tenant/i.test(message)
}
