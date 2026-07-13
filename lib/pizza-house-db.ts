import mysql from 'mysql2/promise'
import { AsyncLocalStorage } from 'async_hooks'

// Aviv POS interface databases (read-only usage). Multi-branch: each branch is a
// separate MySQL database on the Aviv host, selected per request. Branch "main"
// keeps the original PIZZAHOUSE_DB_* env vars for backwards compatibility; every
// other branch reads a prefixed set (e.g. PIZZAHOUSE_MEVASERET_DB_HOST).

export interface PizzaBranch { id: string; label: string }

/** id → env-var prefix + default label. Add a branch by adding a row + its env vars. */
const BRANCH_REGISTRY: Record<string, { prefix: string; label: string }> = {
  main: { prefix: 'PIZZAHOUSE_DB', label: process.env.PIZZAHOUSE_MAIN_LABEL || 'גבעת זאב' },
  mevaseret: { prefix: 'PIZZAHOUSE_MEVASERET_DB', label: 'מבשרת ציון' },
}

/** Only branches whose credentials are actually configured (env HOST present). */
export function listPizzaBranches(): PizzaBranch[] {
  return Object.entries(BRANCH_REGISTRY)
    .filter(([, b]) => process.env[`${b.prefix}_HOST`])
    .map(([id, b]) => ({ id, label: b.label }))
}

export function isPizzaBranch(id: string): boolean {
  const b = BRANCH_REGISTRY[id]
  return !!b && !!process.env[`${b.prefix}_HOST`]
}

// One connection pool per branch, created lazily and reused.
const pools = new Map<string, mysql.Pool>()

export function getPizzaHousePool(branchId = 'main'): mysql.Pool {
  const branch = BRANCH_REGISTRY[branchId]
  if (!branch || !process.env[`${branch.prefix}_HOST`]) {
    throw new Error(`Unknown or unconfigured pizza branch: ${branchId}`)
  }
  let pool = pools.get(branchId)
  if (!pool) {
    const p = branch.prefix
    pool = mysql.createPool({
      host: process.env[`${p}_HOST`],
      user: process.env[`${p}_USER`],
      password: process.env[`${p}_PASSWORD`],
      database: process.env[`${p}_NAME`],
      port: Number(process.env[`${p}_PORT`] || 3306),
      connectTimeout: 10_000,
      // Return DATETIME columns as plain strings (DB stores Israel local time)
      dateStrings: true,
      // Serverless: keep the pool tiny, connections don't survive between invocations anyway
      connectionLimit: 2,
      waitForConnections: true,
    })
    pools.set(branchId, pool)
  }
  return pool
}

// Per-request branch context so the many query functions in pizza-house-queries.ts
// don't each need a branchId argument threaded through — the route wraps its
// fetches in runWithBranch() and every pizzaHouseQuery() below reads the store.
const branchContext = new AsyncLocalStorage<string>()

export function runWithBranch<T>(branchId: string, fn: () => Promise<T>): Promise<T> {
  return branchContext.run(branchId, fn)
}

export async function pizzaHouseQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const branchId = branchContext.getStore() ?? 'main'
  const [rows] = await getPizzaHousePool(branchId).query(sql, params)
  return rows as T[]
}
