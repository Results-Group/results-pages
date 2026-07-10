#!/usr/bin/env node
/**
 * Apply supabase/*.sql migrations to the linked remote Supabase project.
 *
 * Auth (first match wins):
 *   1. SUPABASE_ACCESS_TOKEN  — Supabase Management API (from `supabase login`)
 *   2. DATABASE_URL / SUPABASE_DB_URL — direct Postgres connection string
 *   3. SUPABASE_DB_PASSWORD   — combined with the pooler URL from supabase/.temp/pooler-url
 *
 * Usage:
 *   node scripts/run-migrations.mjs            # run all migrations
 *   node scripts/run-migrations.mjs --dry-run  # parse only, no SQL executed
 *   node scripts/run-migrations.mjs --only=ops # run only files whose name contains "ops"
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Ordered list — each file uses IF NOT EXISTS so re-runs are safe.
const MIGRATIONS = [
  'migration-foundations.sql',
  'migration-workspaces.sql',
  'migration-clients.sql',
  'migration-approval.sql',
  'migration-ops.sql',
  'migration-scheduling.sql',
  'migration-monday-sync.sql',
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadEnvLocal () {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function readProjectRef () {
  const refPath = join(ROOT, 'supabase/.temp/project-ref')
  if (existsSync(refPath)) return readFileSync(refPath, 'utf8').trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return m?.[1] || null
}

function splitStatements (sql) {
  // Split on semicolons that terminate a statement, skipping comment-only lines.
  const stmts = []
  let buf = ''
  for (const line of sql.split('\n')) {
    const trimmed = line.trim()
    // Keep comment lines in context (Postgres needs them stripped for multi-stmt)
    if (!trimmed.startsWith('--')) buf += line + '\n'
    if (trimmed.endsWith(';')) {
      const s = buf.trim()
      if (s) stmts.push(s)
      buf = ''
    }
  }
  if (buf.trim()) stmts.push(buf.trim())
  return stmts.filter(s => s.length > 0)
}

function isBenign (msg) {
  const m = msg.toLowerCase()
  return (
    m.includes('already exists') ||
    m.includes('duplicate key') ||
    (m.includes('does not exist') && m.includes('policy'))
  )
}

// ── Execution backends ───────────────────────────────────────────────────────

async function viaManagementApi (ref, token, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`Management API ${res.status}: ${text.slice(0, 400)}`)
    err.status = res.status
    throw err
  }
}

async function viaPostgres (connectionString, sql) {
  const pg = await import('pg').catch(() => {
    throw new Error(
      'pg package not installed. Run: npm install -D pg',
    )
  })
  const Client = pg.default?.Client || pg.Client
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

// ── Verification ─────────────────────────────────────────────────────────────

async function verify (supabase) {
  const results = []
  for (const table of ['audit_log', 'slide_feedback', 'clients']) {
    const { error } = await supabase.from(table).select('*').limit(0)
    results.push({ label: `table: ${table}`, ok: !error, detail: error?.message })
  }
  for (const table of ['landing_pages', 'campaigns']) {
    const { error } = await supabase
      .from(table)
      .select('deleted_at, publish_at, client_id')
      .limit(1)
    results.push({
      label: `${table} columns (deleted_at, publish_at, client_id)`,
      ok: !error,
      detail: error?.message || 'readable',
    })
  }
  return results
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main () {
  loadEnvLocal()

  const dryRun = process.argv.includes('--dry-run')
  const onlyArg = process.argv.find(a => a.startsWith('--only='))
  const only = onlyArg?.slice('--only='.length)

  const ref = readProjectRef()
  if (!ref) { console.error('Cannot resolve Supabase project ref'); process.exit(1) }

  const files = MIGRATIONS.filter(f => !only || f.includes(only))

  // Resolve credentials
  const token = process.env.SUPABASE_ACCESS_TOKEN
  let dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!dbUrl && process.env.SUPABASE_DB_PASSWORD) {
    const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)
    const poolerPath = join(ROOT, 'supabase/.temp/pooler-url')
    const poolerBase = existsSync(poolerPath)
      ? readFileSync(poolerPath, 'utf8').trim().replace('postgresql://', '')
      : `postgres.${ref}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`
    // poolerBase is like "postgres.REF@host:port/db" – inject password
    const atIdx = poolerBase.indexOf('@')
    const user = poolerBase.slice(0, atIdx)
    const rest = poolerBase.slice(atIdx + 1)
    dbUrl = `postgresql://${user}:${pw}@${rest}`
  }

  const mode = token ? 'management-api' : dbUrl ? 'postgres' : null
  if (!mode) {
    console.error(`
No database credentials found. Provide one of:
  - SUPABASE_ACCESS_TOKEN (run: npx supabase login, copy token to .env.local)
  - DATABASE_URL or SUPABASE_DB_URL (full connection string)
  - SUPABASE_DB_PASSWORD (from Supabase Dashboard → Project Settings → Database)
`)
    process.exit(1)
  }

  console.log(`Project : ${ref}`)
  console.log(`Mode    : ${mode}`)
  console.log(`Files   : ${files.join(', ')}`)
  if (dryRun) { console.log('Dry run — nothing executed.'); process.exit(0) }

  for (const file of files) {
    const path = join(ROOT, 'supabase', file)
    if (!existsSync(path)) { console.warn(`  skip missing: ${file}`); continue }

    const sql = readFileSync(path, 'utf8')
    const stmts = splitStatements(sql)
    console.log(`\n── ${file} (${stmts.length} statements) ──`)

    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i]
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
      try {
        if (mode === 'management-api') {
          await viaManagementApi(ref, token, stmt)
        } else {
          await viaPostgres(dbUrl, stmt)
        }
        console.log(`  ✓ [${i + 1}/${stmts.length}] ${preview}`)
      } catch (e) {
        const msg = e.message || String(e)
        if (isBenign(msg)) {
          console.log(`  ~ [${i + 1}/${stmts.length}] already applied: ${preview}`)
          continue
        }
        console.error(`  ✗ [${i + 1}/${stmts.length}] ${preview}`)
        console.error(`    ERROR: ${msg}`)
        process.exit(1)
      }
    }
  }

  // Verify via service role (read-only probe)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    console.log('\n── Verification ──')
    const checks = await verify(sb)
    for (const c of checks) {
      console.log(c.ok ? `  ✓ ${c.label}` : `  ✗ ${c.label}: ${c.detail}`)
    }
    const failed = checks.filter(c => !c.ok)
    if (failed.length > 0) {
      console.error(`\n${failed.length} check(s) failed — migrations may be incomplete.`)
      process.exit(1)
    }
  }

  console.log('\nAll migrations applied successfully.')
}

main().catch(e => { console.error(e); process.exit(1) })
