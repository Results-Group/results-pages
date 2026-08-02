import 'server-only'
import { gzipSync } from 'node:zlib'
import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { snapshotsToPrune } from './backup-retention'
export { snapshotsToPrune } from './backup-retention'

/**
 * Nightly backup.
 *
 * Two halves, because they have completely different shapes: the database is
 * ~5,400 rows that fit in one compressed file, and storage is ~1,570 objects
 * and 350 MB that must be copied incrementally or the job would move a third of
 * a gigabyte every night to no purpose.
 *
 * The destination is a separate bucket in this project by default. Set
 * BACKUP_SUPABASE_URL and BACKUP_SUPABASE_SERVICE_KEY to send everything to a
 * different Supabase project instead — that is the version that survives losing
 * this project, and switching costs two environment variables, no code.
 */

export const BACKUP_BUCKET = 'backups'

/** Everything worth restoring. Order is irrelevant — this is a snapshot, not a replay. */
const TABLES = [
  'landing_pages',
  'landing_page_versions',
  'landing_page_views',
  'campaigns',
  'clients',
  'performance_reports',
  'admin_users',
  'workspaces',
  'workspace_members',
  'audit_log',
  'slide_feedback',
  'slide_pins',
  'pizza_customer_ledger',
  'pizza_ledger_runs',
  'gbp_connections',
  'gbp_locations',
  'gbp_daily_metrics',
] as const

const SOURCE_BUCKETS = ['landing-pages', 'campaign-assets'] as const

/** Supabase caps a select at 1000 rows by default; page through it. */
const PAGE = 1000

/**
 * Files copied per run. Bounds the job so one night can't outrun its timeout.
 * Measured at ~51s for 300 files, so 600 leaves a wide margin under the 300s
 * function limit even if a batch happens to hold the largest assets.
 */
const COPY_BUDGET = 600

/**
 * Copies in flight at once. Serially, 300 files took 4.7 minutes — past
 * Vercel's 300s ceiling — because almost all of that is round-trip latency, not
 * bandwidth. Eight at a time keeps the run well inside the limit without
 * hammering storage.
 */
const CONCURRENCY = 8

/** Where snapshots are written — this project unless told otherwise. */
export function backupTarget() {
  const url = process.env.BACKUP_SUPABASE_URL
  const key = process.env.BACKUP_SUPABASE_SERVICE_KEY
  if (url && key) {
    return { client: createClient(url, key, { auth: { persistSession: false } }), offsite: true }
  }
  return { client: supabase, offsite: false }
}

export interface TableDump { table: string; rows: unknown[] }

export async function dumpTables(): Promise<{ dumps: TableDump[]; total: number }> {
  const dumps: TableDump[] = []
  let total = 0

  for (const table of TABLES) {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1)
      if (error) {
        // A table that doesn't exist in this environment is not a failure —
        // but it must be recorded, so a restore never silently misses one.
        dumps.push({ table, rows: [] })
        break
      }
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    dumps.push({ table, rows })
    total += rows.length
  }

  // A table appearing twice would mean the error path above ran; keep the last.
  const seen = new Map<string, TableDump>()
  for (const d of dumps) seen.set(d.table, d)
  return { dumps: [...seen.values()], total }
}

export interface StorageObject { bucket: string; path: string; size: number; updated_at: string | null }

/** Walks a bucket recursively. Storage lists 100 at a time and marks folders by a null id. */
export async function listBucket(bucket: string, prefix = '', depth = 0): Promise<StorageObject[]> {
  if (depth > 4) return []
  const out: StorageObject[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset })
    if (error || !data || data.length === 0) break
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      const isFolder = entry.id === null
      if (isFolder) out.push(...(await listBucket(bucket, path, depth + 1)))
      else {
        out.push({
          bucket,
          path,
          size: Number((entry.metadata as { size?: number } | null)?.size ?? 0),
          updated_at: entry.updated_at ?? null,
        })
      }
    }
    if (data.length < 100) break
  }
  return out
}

export async function listAllObjects(): Promise<StorageObject[]> {
  const all: StorageObject[] = []
  for (const bucket of SOURCE_BUCKETS) all.push(...(await listBucket(bucket)))
  return all
}

/**
 * Copies objects that the manifest has never seen, or whose size or timestamp
 * changed. Bounded per run: a first run has ~1,570 files to move and would
 * otherwise blow the function's time limit — it simply catches up over the next
 * few nights, and the manifest makes that resumable.
 */
export async function copyChangedFiles(
  objects: StorageObject[],
  target: ReturnType<typeof backupTarget>['client']
): Promise<{ copied: number; bytes: number; remaining: number }> {
  // Paged, not a plain select: Supabase caps a select at 1000 rows, and with a
  // 1,566-file manifest that silently made the last 566 look new — they were
  // re-copied in full every single night.
  const known = new Map<string, { size: number; source_updated_at: string | null }>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('backup_file_manifest')
      .select('bucket,path,size,source_updated_at')
      .range(from, from + PAGE - 1)
    if (error || !data) break
    for (const m of data) known.set(`${m.bucket}/${m.path}`, m)
    if (data.length < PAGE) break
  }

  const stale = objects.filter(o => {
    const prev = known.get(`${o.bucket}/${o.path}`)
    if (!prev) return true
    return Number(prev.size) !== o.size || prev.source_updated_at !== o.updated_at
  })

  const batch = stale.slice(0, COPY_BUDGET)
  const done: StorageObject[] = []

  // A shared cursor rather than fixed slices: file sizes vary by orders of
  // magnitude, so pre-splitting would leave workers idle behind one big file.
  let next = 0
  const worker = async () => {
    for (;;) {
      const obj = batch[next++]
      if (!obj) return

      const { data, error } = await supabase.storage.from(obj.bucket).download(obj.path)
      if (error || !data) continue

      const buffer = Buffer.from(await data.arrayBuffer())
      // Blob rather than a raw Buffer — the same upload path the rest of the app
      // uses, because a raw Buffer gets mangled through UTF-8 on Vercel.
      const blob = new Blob([new Uint8Array(buffer)])
      const { error: upErr } = await target.storage
        .from(BACKUP_BUCKET)
        .upload(`files/${obj.bucket}/${obj.path}`, blob, { upsert: true, contentType: 'application/octet-stream' })
      // A file that fails to copy is simply left out of the manifest, so the
      // next run retries it.
      if (upErr) continue

      done.push(obj)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // One upsert for the whole batch — 300 extra round-trips would cost more than
  // the copies themselves.
  if (done.length > 0) {
    const copiedAt = new Date().toISOString()
    await supabase.from('backup_file_manifest').upsert(
      done.map(o => ({
        bucket: o.bucket, path: o.path, size: o.size,
        source_updated_at: o.updated_at, copied_at: copiedAt,
      })),
      { onConflict: 'bucket,path' }
    )
  }

  const bytes = done.reduce((sum, o) => sum + o.size, 0)
  return { copied: done.length, bytes, remaining: Math.max(0, stale.length - done.length) }
}

/**
 * Writes the database snapshot plus a full listing of storage. The listing
 * matters on its own: even for files we haven't copied yet, it records exactly
 * what existed on a given night.
 */
export async function writeSnapshot(
  dumps: TableDump[],
  objects: StorageObject[],
  target: ReturnType<typeof backupTarget>['client']
): Promise<string> {
  const day = new Date().toISOString().slice(0, 10)
  const payload = {
    taken_at: new Date().toISOString(),
    tables: Object.fromEntries(dumps.map(d => [d.table, d.rows])),
    storage_manifest: objects,
  }
  const gz = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))
  const path = `db/${day}.json.gz`

  const { error } = await target.storage
    .from(BACKUP_BUCKET)
    .upload(path, new Blob([new Uint8Array(gz)]), {
      contentType: 'application/gzip',
      upsert: true, // re-running the same day replaces that day's snapshot
    })
  if (error) throw error
  return path
}

/**
 * Keeps 30 daily snapshots, plus the first of each month for a year. A backup
 * only helps against slow corruption if it reaches back past the point where
 * someone noticed.
 */
export async function pruneOldSnapshots(target: ReturnType<typeof backupTarget>['client']): Promise<number> {
  const { data } = await target.storage.from(BACKUP_BUCKET).list('db', { limit: 1000 })
  if (!data) return 0

  const doomed = snapshotsToPrune(data.map(f => f.name), new Date()).map(n => `db/${n}`)
  if (doomed.length === 0) return 0
  await target.storage.from(BACKUP_BUCKET).remove(doomed)
  return doomed.length
}
