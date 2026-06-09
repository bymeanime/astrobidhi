// Prisma client singleton with Turso/libSQL driver adapter
// Uses @libsql/client for connection + @prisma/adapter-libsql for Prisma integration
// Gracefully degrades when no database is configured — caching is optional

import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _db: PrismaClient | null = null
let _dbReady = false
let _dbInitPromise: Promise<void> | null = null
let _dbAvailable = false // Tracks whether we have a working DB connection

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
  `CREATE TABLE IF NOT EXISTS CachedChart (
    id TEXT PRIMARY KEY,
    cacheKey TEXT NOT NULL UNIQUE,
    birthParams TEXT NOT NULL,
    chartResult TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS CachedChart_cacheKey_idx ON CachedChart(cacheKey)`,
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
    cachedChartData TEXT,
    cachedAnalysisResult TEXT,
    viewCount INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS SharedChart_shareId_idx ON SharedChart(shareId)`,
  `CREATE TABLE IF NOT EXISTS UserAccount (
    id TEXT PRIMARY KEY,
    whopUserId TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    picture TEXT,
    primaryDeviceId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS UserAccount_whopUserId_idx ON UserAccount(whopUserId)`,
  `CREATE TABLE IF NOT EXISTS UserAnalysis (
    id TEXT PRIMARY KEY,
    whopUserId TEXT NOT NULL,
    analysisType TEXT NOT NULL,
    cacheKey TEXT NOT NULL,
    birthDetails TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS UserAnalysis_whopUserId_idx ON UserAnalysis(whopUserId)`,
  `CREATE INDEX IF NOT EXISTS UserAnalysis_whopUserId_cacheKey_idx ON UserAnalysis(whopUserId, cacheKey)`,
]

let _libsql: ReturnType<typeof createClient> | null = null

function getLibsqlClient() {
  if (_libsql) return _libsql
  const dbUrl = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()
  if (!dbUrl) return null
  try {
    _libsql = createClient({ url: dbUrl, authToken: authToken || undefined })
    return _libsql
  } catch (error) {
    console.error('[DB] Failed to create libsql client:', error instanceof Error ? error.message : error)
    return null
  }
}

// Check if database is available
export function isDbAvailable(): boolean {
  return _dbAvailable
}

// Execute a parameterized SQL query directly via libsql (safe from injection)
export async function rawQuery<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const client = getLibsqlClient()
  if (!client) {
    console.warn('[DB] rawQuery skipped — no database configured')
    return []
  }
  await initDb()
  const result = await client.execute({ sql, args })
  return result.rows as unknown as T[]
}

// Execute a parameterized SQL statement directly via libsql (safe from injection)
export async function rawExecute(sql: string, args: unknown[] = []): Promise<void> {
  const client = getLibsqlClient()
  if (!client) {
    console.warn('[DB] rawExecute skipped — no database configured')
    return
  }
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

function createPrismaClient(): PrismaClient | null {
  if (_db) return _db

  const dbUrl = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()

  if (!dbUrl) {
    // Don't throw — return null so the app can start without a database
    console.warn('[DB] No database URL configured. Caching and persistence features will be disabled. Set DATABASE_URL or TURSO_DATABASE_URL to enable.')
    _dbAvailable = false
    return null
  }

  try {
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
    _dbAvailable = true
    return _db
  } catch (error) {
    console.error('[DB] Failed to create Prisma client:', error instanceof Error ? error.message : error)
    _dbAvailable = false
    return null
  }
}

async function ensureTablesExist(prisma: PrismaClient): Promise<void> {
  if (_dbReady) return

  const tablesToCheck = ['CachedAnalysis', 'CachedChart', 'CachedStaticMeanings', 'DeviceUsage', 'AnalyticsEvent', 'SharedChart', 'UserAccount', 'UserAnalysis']
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
    console.log('[DB] Turso tables already exist — cache is ready')
    return
  }

  console.log(`[DB] Tables missing: ${missingTables.join(', ')}, creating them in Turso...`)

  try {
    for (const sql of CREATE_TABLES_SQL) {
      await prisma.$executeRawUnsafe(sql)
    }
    _dbReady = true
    console.log('[DB] Turso tables created successfully — cache is ready')
  } catch (error) {
    console.error('[DB] Failed to create Turso tables:', error instanceof Error ? error.message : error)
  }
}

// Initialize DB tables on first access
export function initDb(): Promise<void> {
  if (_dbInitPromise) return _dbInitPromise
  const client = createPrismaClient()
  if (!client) {
    // No database available — return a resolved promise so the app doesn't hang
    _dbInitPromise = Promise.resolve()
    return _dbInitPromise
  }
  _dbInitPromise = ensureTablesExist(client)
  return _dbInitPromise
}

// Proxy that lazily creates the PrismaClient on first property access
// Returns a no-op proxy when no database is configured, so the app still works
function createNoOpProxy(): PrismaClient {
  // Return a proxy that silently does nothing when DB is unavailable
  return new Proxy({} as PrismaClient, {
    get(_target, prop, _receiver) {
      if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use') {
        return async () => {}
      }
      // For model access (e.g., db.cachedAnalysis), return another no-op proxy
      const value = (_target as Record<string, unknown>)[prop as string]
      if (value !== undefined) return value

      return new Proxy({}, {
        get(delegate, delegateProp) {
          const delegateValue = (delegate as Record<string, unknown>)[delegateProp as string]
          if (typeof delegateValue === 'function') {
            return async (..._args: unknown[]) => {
              // Return appropriate empty results for common Prisma methods
              const method = delegateProp as string
              if (method === 'findUnique' || method === 'findFirst') return null
              if (method === 'findMany') return []
              if (method === 'count') return 0
              if (method === 'upsert' || method === 'create' || method === 'update') return { id: 'no-db' }
              return null
            }
          }
          return delegateValue
        },
      })
    },
  })
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    // Don't proxy constructor symbols or internal props
    if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use') {
      try {
        const client = createPrismaClient()
        if (!client) return async () => {}
        const value = (client as unknown as Record<string, unknown>)[prop as string]
        return typeof value === 'function' ? value.bind(client) : value
      } catch {
        return async () => {}
      }
    }

    try {
      const client = createPrismaClient()
      if (!client) {
        // No database configured — return a no-op proxy so the app doesn't crash
        return (createNoOpProxy() as unknown as Record<string, unknown>)[prop as string]
      }

      const value = (client as unknown as Record<string, unknown>)[prop as string]

      if (typeof value === 'function') {
        return async (...args: unknown[]) => {
          try {
            await initDb()
            return (value as (...a: unknown[]) => unknown).apply(client, args)
          } catch (error) {
            console.error('[DB] Query error:', error instanceof Error ? error.message : error)
            // Return appropriate empty results for common Prisma methods
            const method = prop as string
            if (method === 'findUnique' || method === 'findFirst') return null
            if (method === 'findMany') return []
            if (method === 'count') return 0
            if (method === 'upsert' || method === 'create' || method === 'update') return { id: 'no-db' }
            return null
          }
        }
      }
      if (value && typeof value === 'object') {
        return new Proxy(value as Record<string, unknown>, {
          get(delegate, delegateProp) {
            const delegateValue = (delegate as Record<string, unknown>)[delegateProp as string]
            if (typeof delegateValue === 'function') {
              return async (...args: unknown[]) => {
                try {
                  await initDb()
                  return (delegateValue as (...a: unknown[]) => unknown).apply(delegate, args)
                } catch (error) {
                  console.error('[DB] Query error:', error instanceof Error ? error.message : error)
                  const method = delegateProp as string
                  if (method === 'findUnique' || method === 'findFirst') return null
                  if (method === 'findMany') return []
                  if (method === 'count') return 0
                  if (method === 'upsert' || method === 'create' || method === 'update') return { id: 'no-db' }
                  return null
                }
              }
            }
            return delegateValue
          },
        })
      }
      return value
    } catch (error) {
      console.error('[DB] Proxy access error:', error instanceof Error ? error.message : error)
      // Return no-op values for common props to prevent crashes
      if (prop === 'cachedAnalysis' || prop === 'cachedStaticMeanings' || prop === 'deviceUsage' ||
          prop === 'analyticsEvent' || prop === 'sharedChart' || prop === 'userAccount' || prop === 'userAnalysis') {
        return createNoOpProxy()[prop as keyof PrismaClient]
      }
      return undefined
    }
  },
})
