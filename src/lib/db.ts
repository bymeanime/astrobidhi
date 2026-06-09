// Prisma client singleton with Turso/libSQL driver adapter
// Uses @libsql/client for connection + @prisma/adapter-libsql for Prisma integration
// No more local SQLite files, no volume persistence headaches

import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _db: PrismaClient | null = null
let _dbReady = false
let _dbInitPromise: Promise<void> | null = null

// SQL to create tables if they don't exist — runs on first connection
// Turso uses libSQL which is SQLite-compatible, so same DDL works
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS CachedAnalysis (
    id TEXT PRIMARY KEY,
    cacheKey TEXT NOT NULL UNIQUE,
    analysisType TEXT NOT NULL,
    chartData TEXT NOT NULL,
    result TEXT NOT NULL,
    provider TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS CachedAnalysis_cacheKey_idx ON CachedAnalysis(cacheKey)`,
  `CREATE TABLE IF NOT EXISTS CachedStaticMeanings (
    id TEXT PRIMARY KEY,
    cacheKey TEXT NOT NULL UNIQUE,
    result TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS CachedStaticMeanings_cacheKey_idx ON CachedStaticMeanings(cacheKey)`,
  `CREATE TABLE IF NOT EXISTS DeviceUsage (
    id TEXT PRIMARY KEY,
    deviceId TEXT NOT NULL,
    analysisType TEXT NOT NULL,
    cacheKey TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS DeviceUsage_deviceId_idx ON DeviceUsage(deviceId)`,
  `CREATE INDEX IF NOT EXISTS DeviceUsage_deviceId_cacheKey_idx ON DeviceUsage(deviceId, cacheKey)`,
  `CREATE TABLE IF NOT EXISTS AnalyticsEvent (
    id TEXT PRIMARY KEY,
    eventType TEXT NOT NULL,
    deviceId TEXT,
    metadata TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS AnalyticsEvent_eventType_idx ON AnalyticsEvent(eventType)`,
  `CREATE INDEX IF NOT EXISTS AnalyticsEvent_createdAt_idx ON AnalyticsEvent(createdAt)`,
  `CREATE TABLE IF NOT EXISTS SharedChart (
    id TEXT PRIMARY KEY,
    shareId TEXT NOT NULL UNIQUE,
    chartParams TEXT NOT NULL,
    analysisType TEXT,
    includeAnalysis INTEGER NOT NULL DEFAULT 0,
    viewCount INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS SharedChart_shareId_idx ON SharedChart(shareId)`,
]

let _libsql: ReturnType<typeof createClient> | null = null

function getLibsqlClient() {
  if (_libsql) return _libsql
  const dbUrl = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()
  if (!dbUrl) return null
  _libsql = createClient({ url: dbUrl, authToken: authToken || undefined })
  return _libsql
}

// Execute a parameterized SQL query directly via libsql (safe from injection)
export async function rawQuery<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const client = getLibsqlClient()
  if (!client) throw new Error('Database not configured')
  await initDb()
  const result = await client.execute({ sql, args })
  return result.rows as unknown as T[]
}

// Execute a parameterized SQL statement directly via libsql (safe from injection)
export async function rawExecute(sql: string, args: unknown[] = []): Promise<void> {
  const client = getLibsqlClient()
  if (!client) throw new Error('Database not configured')
  await initDb()
  await client.execute({ sql, args })
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || ''
  if (!url) {
    console.warn('[DB] No DATABASE_URL or TURSO_DATABASE_URL set — caching will be disabled')
  }
  return url
}

function getDatabaseAuthToken(): string {
  return process.env.TURSO_AUTH_TOKEN || ''
}

function createPrismaClient(): PrismaClient {
  if (_db) return _db

  const dbUrl = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()

  if (!dbUrl) {
    throw new Error('[DB] No database URL configured. Set DATABASE_URL or TURSO_DATABASE_URL.')
  }

  console.log(`[DB] Connecting to Turso: ${dbUrl.replace(/\/\/.*@/, '//***@')}`)

  // Create libSQL client for Turso
  const libsql = createClient({
    url: dbUrl,
    authToken: authToken || undefined,
  })

  // Create Prisma adapter using libSQL client
  const adapter = new PrismaLibSQL(libsql)

  _db = globalForPrisma.prisma ?? new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
  return _db
}

async function ensureTablesExist(prisma: PrismaClient): Promise<void> {
  if (_dbReady) return

  const tablesToCheck = ['CachedAnalysis', 'CachedStaticMeanings', 'DeviceUsage', 'AnalyticsEvent', 'SharedChart']
  const missingTables: string[] = []

  for (const table of tablesToCheck) {
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`)
    } catch {
      missingTables.push(table)
    }
  }

  if (missingTables.length === 0) {
    _dbReady = true
    console.log('[DB] ✅ Turso tables already exist — cache is ready')
    return
  }

  console.log(`[DB] Tables missing: ${missingTables.join(', ')}, creating them in Turso...`)

  try {
    for (const sql of CREATE_TABLES_SQL) {
      await prisma.$executeRawUnsafe(sql)
    }
    _dbReady = true
    console.log('[DB] ✅ Turso tables created successfully — cache is ready')
  } catch (error) {
    console.error('[DB] ❌ Failed to create Turso tables:', error instanceof Error ? error.message : error)
  }
}

// Initialize DB tables on first access
export function initDb(): Promise<void> {
  if (_dbInitPromise) return _dbInitPromise
  _dbInitPromise = ensureTablesExist(createPrismaClient())
  return _dbInitPromise
}

// Proxy that lazily creates the PrismaClient on first property access
// Ensures tables exist before any query runs
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    // Don't proxy constructor symbols or internal props
    if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use') {
      try {
        const client = createPrismaClient()
        const value = (client as unknown as Record<string, unknown>)[prop as string]
        return typeof value === 'function' ? value.bind(client) : value
      } catch {
        return undefined
      }
    }

    try {
      const client = createPrismaClient()
      const value = (client as unknown as Record<string, unknown>)[prop as string]

      if (typeof value === 'function') {
        return async (...args: unknown[]) => {
          await initDb()
          return (value as (...a: unknown[]) => unknown).apply(client, args)
        }
      }
      if (value && typeof value === 'object') {
        return new Proxy(value as Record<string, unknown>, {
          get(delegate, delegateProp) {
            const delegateValue = (delegate as Record<string, unknown>)[delegateProp as string]
            if (typeof delegateValue === 'function') {
              return async (...args: unknown[]) => {
                await initDb()
                return (delegateValue as (...a: unknown[]) => unknown).apply(delegate, args)
              }
            }
            return delegateValue
          },
        })
      }
      return value
    } catch (error) {
      console.error('[DB] Proxy access error:', error instanceof Error ? error.message : error)
      return undefined
    }
  },
})
