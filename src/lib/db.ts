// Prisma client singleton with lazy initialization + auto table creation
// Safe at build time — PrismaClient is only constructed when first accessed at runtime
// The top-level import is fine because prisma generate runs before next build

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _db: PrismaClient | null = null
let _dbReady = false
let _dbInitPromise: Promise<void> | null = null

// SQL to create tables if they don't exist — this runs WITHOUT needing prisma CLI
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
]

async function ensureTablesExist(prisma: PrismaClient): Promise<void> {
  if (_dbReady) return

  // Check ALL required tables — not just one
  const tablesToCheck = ['CachedAnalysis', 'CachedStaticMeanings']
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
    console.log('[DB] Tables already exist — cache is ready')
    return
  }

  console.log(`[DB] Tables missing: ${missingTables.join(', ')}, creating them programmatically...`)

  try {
    for (const sql of CREATE_TABLES_SQL) {
      await prisma.$executeRawUnsafe(sql)
    }
    _dbReady = true
    console.log('[DB] ✅ Tables created successfully — cache is ready')
  } catch (error) {
    console.error('[DB] ❌ Failed to create tables:', error instanceof Error ? error.message : error)
    // Don't throw — the app will still work, just without caching
    // The route handlers have try/catch around cache operations
  }
}

function createPrismaClient(): PrismaClient {
  if (_db) return _db

  try {
    _db = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    })

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
    return _db
  } catch (error) {
    console.error('[DB] Failed to create PrismaClient:', error)
    throw error
  }
}

// Initialize DB tables on first access (runs once, all subsequent calls await the same promise)
// Exported so routes can explicitly trigger init if needed (belt-and-suspenders)
export function initDb(): Promise<void> {
  if (_dbInitPromise) return _dbInitPromise
  _dbInitPromise = ensureTablesExist(createPrismaClient())
  return _dbInitPromise
}

// Proxy that lazily creates the PrismaClient on first property access
// Also ensures tables exist before any query runs
// Handles both direct methods (db.$queryRaw) AND model delegates (db.cachedAnalysis.count())
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = createPrismaClient()
    const value = (client as unknown as Record<string, unknown>)[prop as string]
    if (typeof value === 'function') {
      // Direct method on PrismaClient (e.g. db.$queryRaw, db.$executeRawUnsafe)
      return async (...args: unknown[]) => {
        await initDb()
        return (value as Function).apply(client, args)
      }
    }
    if (value && typeof value === 'object') {
      // Model delegate (e.g. db.cachedAnalysis, db.cachedStaticMeanings)
      // Wrap in a nested proxy so method calls like .count(), .findUnique() also trigger initDb()
      return new Proxy(value as Record<string, unknown>, {
        get(delegate, delegateProp) {
          const delegateValue = (delegate as Record<string, unknown>)[delegateProp as string]
          if (typeof delegateValue === 'function') {
            return async (...args: unknown[]) => {
              await initDb()
              return (delegateValue as Function).apply(delegate, args)
            }
          }
          return delegateValue
        },
      })
    }
    return value
  },
})
