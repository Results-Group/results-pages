import mysql from 'mysql2/promise'

// Aviv POS interface database (read-only usage)
let pool: mysql.Pool | null = null

export function getPizzaHousePool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.PIZZAHOUSE_DB_HOST,
      user: process.env.PIZZAHOUSE_DB_USER,
      password: process.env.PIZZAHOUSE_DB_PASSWORD,
      database: process.env.PIZZAHOUSE_DB_NAME,
      port: Number(process.env.PIZZAHOUSE_DB_PORT || 3306),
      connectTimeout: 10_000,
      // Return DATETIME columns as plain strings (DB stores Israel local time)
      dateStrings: true,
      // Serverless: keep the pool tiny, connections don't survive between invocations anyway
      connectionLimit: 2,
      waitForConnections: true,
    })
  }
  return pool
}

export async function pizzaHouseQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getPizzaHousePool().query(sql, params)
  return rows as T[]
}
