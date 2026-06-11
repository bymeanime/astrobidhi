// Prisma client singleton with Turso/libSQL driver adapter
// Uses @libsql/client for connection + @prisma/adapter-libsql for Prisma integration
//
// Database connection priority:
// 1. TURSO_DATABASE_URL + TURSO_AUTH_TOKEN → Cloud Turso (production)
// 2. DATABASE_URL → Explicit URL (can be libsql://, file:, etc.)
// 3. Auto-created local SQLite file → Always works, data persists on disk
//
// The app NEVER runs without a database — all charts and analyses are always cached.

import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient, type Client } from '@libsql/client'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _db: PrismaClient | null = null
let _dbReady = false
let _dbInitPromise: Promise<void> | null = null
let _dbAvailable = false

// SQL to create tables if they don't exist — runs on first connection
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

let _libsql: Client | null = null

function getLibsqlClient(): Client | null {
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

// ============ Database URL Resolution ============
// Priority: TURSO_DATABASE_URL > DATABASE_URL > Auto-created local SQLite file

// Placeholder URLs from parent project .env that should be ignored
const PLACEHOLDER_URLS = new Set([
  'file:./db/custom.db',
  'file:./dev.db',
  'file:/home/z/my-project/db/custom.db',
  'file:/home/z/my-project/db/dev.db',
])

function isPlaceholderUrl(url: string): boolean {
  return PLACEHOLDER_URLS.has(url) || url.startsWith('file:/home/z/my-project/db/')
}

function getDatabaseUrl(): string {
  // 1. Check for Turso cloud URL first (production)
  const tursoUrl = process.env.TURSO_DATABASE_URL
  if (tursoUrl) {
    return tursoUrl
  }

  // 2. Check for explicit DATABASE_URL (filter out placeholder URLs from parent .env)
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl && !isPlaceholderUrl(dbUrl)) {
    return dbUrl
  }

  // 3. Auto-create a local SQLite database that actually persists
  const localDbPath = resolveLocalDbPath()
  return `file:${localDbPath}`
}

function resolveLocalDbPath(): string {
  // Try multiple locations for the local SQLite database
  // Priority: /data/ (Railway volume) > project dir > /tmp/
  const candidates = [
    '/data/astrobidhi.db',           // Railway persistent volume (if mounted)
    '/app/data/astrobidhi.db',       // Alternative Docker path
    path.join(process.cwd(), 'data', 'astrobidhi.db'),  // Project directory
  ]

  for (const candidate of candidates) {
    const dir = path.dirname(candidate)
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // Test write access
      const testFile = path.join(dir, '.db-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      console.log(`[DB] Using local SQLite database: ${candidate}`)
      return candidate
    } catch {
      // Can't write here, try next
    }
  }

  // Last resort: /tmp (will be wiped on restart, but at least data is stored during session)
  const tmpPath = '/tmp/astrobidhi/astrobidhi.db'
  try {
    fs.mkdirSync('/tmp/astrobidhi', { recursive: true })
  } catch {}
  console.warn('[DB] Using /tmp for database — data will NOT persist across restarts!')
  return tmpPath
}

function getDatabaseAuthToken(): string {
  return process.env.TURSO_AUTH_TOKEN || ''
}

function isTursoConnection(): boolean {
  const url = getDatabaseUrl()
  return url.startsWith('libsql://') || url.startsWith('https://')
}

function createPrismaClient(): PrismaClient | null {
  if (_db) return _db

  const dbUrl = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()

  if (!dbUrl) {
    // This should never happen now since we auto-create a local DB
    console.error('[DB] No database URL resolved — this should not happen!')
    _dbAvailable = false
    return null
  }

  try {
    const isTurso = isTursoConnection()
    console.log(`[DB] Connecting to ${isTurso ? 'Turso cloud' : 'local SQLite'}: ${dbUrl.replace(/\/\/.*@/, '//***@')}`)

    // Create Prisma adapter — PrismaLibSQL is an AdapterFactory that expects
    // a config object {url, authToken}, NOT a libsql Client instance.
    // See: https://www.prisma.io/docs/orm/overview/databases/turso
    const adapter = new PrismaLibSQL({
      url: dbUrl,
      authToken: isTurso && authToken ? authToken : undefined,
    })

    _db = globalForPrisma.prisma ?? new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    })

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
    _dbAvailable = true

    // Also create a separate libsql Client for raw queries (rawQuery/rawExecute)
    // This is needed because Prisma's adapter doesn't expose the raw client
    try {
      _libsql = createClient({
        url: dbUrl,
        authToken: isTurso && authToken ? authToken : undefined,
      })
    } catch (libsqlError) {
      console.warn('[DB] Could not create libsql client for raw queries:', libsqlError instanceof Error ? libsqlError.message : 'unknown')
    }
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
    console.log('[DB] All tables already exist — database is ready')
    return
  }

  console.log(`[DB] Creating missing tables: ${missingTables.join(', ')}`)

  try {
    for (const sql of CREATE_TABLES_SQL) {
      await prisma.$executeRawUnsafe(sql)
    }
    _dbReady = true
    console.log('[DB] All tables created successfully — database is ready')
  } catch (error) {
    console.error('[DB] Failed to create tables:', error instanceof Error ? error.message : error)
  }
}

// Initialize DB tables on first access
export function initDb(): Promise<void> {
  if (_dbInitPromise) return _dbInitPromise
  const client = createPrismaClient()
  if (!client) {
    _dbInitPromise = Promise.resolve()
    return _dbInitPromise
  }
  _dbInitPromise = ensureTablesExist(client)
  return _dbInitPromise
}

// Proxy that lazily creates the PrismaClient on first property access
// Write operations THROW instead of silently returning fake IDs
function createNoOpProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop, _receiver) {
      if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use') {
        return async () => {}
      }
      const value = (_target as Record<string, unknown>)[prop as string]
      if (value !== undefined) return value

      return new Proxy({}, {
        get(delegate, delegateProp) {
          const delegateValue = (delegate as Record<string, unknown>)[delegateProp as string]
          if (typeof delegateValue === 'function') {
            return async (..._args: unknown[]) => {
              const method = delegateProp as string
              if (method === 'findUnique' || method === 'findFirst') return null
              if (method === 'findMany') return []
              if (method === 'count') return 0
              // Write operations MUST throw — silently returning fake IDs masks bugs
              if (method === 'upsert' || method === 'create' || method === 'update' || method === 'delete') {
                throw new Error(`[DB] Cannot ${method}: no database connection available`)
              }
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
            const method = prop as string
            if (method === 'findUnique' || method === 'findFirst') return null
            if (method === 'findMany') return []
            if (method === 'count') return 0
            // Write operations MUST re-throw — silently returning fake IDs masks bugs
            if (method === 'upsert' || method === 'create' || method === 'update' || method === 'delete') {
              throw error
            }
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
                  // Write operations MUST re-throw — silently returning fake IDs masks bugs
                  if (method === 'upsert' || method === 'create' || method === 'update' || method === 'delete') {
                    throw error
                  }
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
      if (prop === 'cachedAnalysis' || prop === 'cachedStaticMeanings' || prop === 'deviceUsage' ||
          prop === 'analyticsEvent' || prop === 'sharedChart' || prop === 'userAccount' || prop === 'userAnalysis' ||
          prop === 'cachedChart') {
        return createNoOpProxy()[prop as keyof PrismaClient]
      }
      return undefined
    }
  },
})
