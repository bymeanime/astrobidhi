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
import { randomUUID } from 'crypto'
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
  `CREATE TABLE IF NOT EXISTS UserAccess (
    id TEXT PRIMARY KEY,
    deviceId TEXT NOT NULL,
    accessLevel TEXT NOT NULL DEFAULT 'premium',
    grantedBy TEXT NOT NULL DEFAULT 'admin',
    reason TEXT,
    expiresAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS UserAccess_deviceId_idx ON UserAccess(deviceId)`,

  // Premium analysis catalog: defines each premium analysis with its price
  `CREATE TABLE IF NOT EXISTS PremiumCatalog (
    id TEXT PRIMARY KEY,
    analysisType TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    priceCents INTEGER NOT NULL DEFAULT 0,
    originalPriceCents INTEGER,
    isActive INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS PremiumCatalog_analysisType_idx ON PremiumCatalog(analysisType)`,

  // Product bundles: group of analyses at a discounted price
  `CREATE TABLE IF NOT EXISTS ProductBundle (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    priceCents INTEGER NOT NULL DEFAULT 0,
    originalPriceCents INTEGER,
    isActive INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ProductBundle_slug_idx ON ProductBundle(slug)`,

  // Bundle items: which analyses are in each bundle
  `CREATE TABLE IF NOT EXISTS ProductBundleItem (
    id TEXT PRIMARY KEY,
    bundleId TEXT NOT NULL,
    analysisType TEXT NOT NULL,
    FOREIGN KEY (bundleId) REFERENCES ProductBundle(id)
  )`,
  `CREATE INDEX IF NOT EXISTS ProductBundleItem_bundleId_idx ON ProductBundleItem(bundleId)`,

  // Promo codes for discounts and free access
  `CREATE TABLE IF NOT EXISTS PromoCode (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'percent_off',
    value INTEGER NOT NULL DEFAULT 0,
    applicableType TEXT NOT NULL DEFAULT 'all',
    applicableItems TEXT,
    maxUses INTEGER,
    useCount INTEGER NOT NULL DEFAULT 0,
    validFrom DATETIME,
    validUntil DATETIME,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS PromoCode_code_idx ON PromoCode(code)`,

  // Granular device access: per-analysis-type grants
  `CREATE TABLE IF NOT EXISTS DeviceAccess (
    id TEXT PRIMARY KEY,
    deviceId TEXT NOT NULL,
    analysisType TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'admin_grant',
    sourceRef TEXT,
    grantedBy TEXT NOT NULL DEFAULT 'admin',
    reason TEXT,
    expiresAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS DeviceAccess_deviceId_idx ON DeviceAccess(deviceId)`,
  `CREATE INDEX IF NOT EXISTS DeviceAccess_deviceId_type_idx ON DeviceAccess(deviceId, analysisType)`,

  // Astrologer profiles for in-person readings
  `CREATE TABLE IF NOT EXISTS Astrologer (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    bio TEXT,
    specialties TEXT NOT NULL DEFAULT 'vedic_reading',
    experienceYears INTEGER NOT NULL DEFAULT 0,
    qualifications TEXT,
    languages TEXT NOT NULL DEFAULT 'English,Hindi',
    rating REAL NOT NULL DEFAULT 0,
    reviewCount INTEGER NOT NULL DEFAULT 0,
    photoUrl TEXT,
    isAvailable INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // Reading bookings
  `CREATE TABLE IF NOT EXISTS ReadingBooking (
    id TEXT PRIMARY KEY,
    bookingRef TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerEmail TEXT NOT NULL,
    customerPhone TEXT,
    birthDate TEXT,
    birthTime TEXT,
    birthCity TEXT,
    birthLat REAL,
    birthLng REAL,
    birthUtc TEXT,
    questions TEXT,
    focusAreas TEXT,
    preferredLanguage TEXT NOT NULL DEFAULT 'English',
    astrologerId TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    scheduledAt DATETIME,
    completedAt DATETIME,
    meetingLink TEXT,
    notes TEXT,
    priceCents INTEGER NOT NULL DEFAULT 0,
    paidAt DATETIME,
    paymentRef TEXT,
    deviceId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (astrologerId) REFERENCES Astrologer(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ReadingBooking_bookingRef_idx ON ReadingBooking(bookingRef)`,
  `CREATE INDEX IF NOT EXISTS ReadingBooking_status_idx ON ReadingBooking(status)`,
  `CREATE INDEX IF NOT EXISTS ReadingBooking_tier_idx ON ReadingBooking(tier)`,
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
  // Only wait for init if tables haven't been set up yet (avoids deadlock when called from seedDefaultData)
  if (!_dbReady) await initDb()
  const result = await client.execute({ sql, args })
  return result.rows as unknown as T[]
}

// Execute a parameterized SQL statement directly via libsql (safe from injection)
// Returns the number of affected rows for verification
export async function rawExecute(sql: string, args: unknown[] = []): Promise<number> {
  const client = getLibsqlClient()
  if (!client) {
    console.error('[DB] rawExecute SKIPPED — no libsql client available. SQL:', sql.substring(0, 100))
    return 0
  }
  if (!_dbReady) await initDb()
  try {
    const result = await client.execute({ sql, args })
    if (result.rowsAffected === 0 && sql.trim().toUpperCase().startsWith('INSERT')) {
      console.warn('[DB] rawExecute: INSERT affected 0 rows — possible silent failure. SQL:', sql.substring(0, 100))
    }
    return result.rowsAffected
  } catch (error) {
    console.error('[DB] rawExecute FAILED:', error instanceof Error ? error.message : 'unknown')
    console.error('[DB] SQL:', sql.substring(0, 200))
    throw error
  }
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

  const tablesToCheck = ['CachedAnalysis', 'CachedChart', 'CachedStaticMeanings', 'DeviceUsage', 'AnalyticsEvent', 'SharedChart', 'UserAccount', 'UserAnalysis', 'UserAccess', 'PremiumCatalog', 'ProductBundle', 'ProductBundleItem', 'PromoCode', 'DeviceAccess', 'Astrologer', 'ReadingBooking']
  const missingTables: string[] = []

  // Check which tables are missing using the libsql client (more reliable than Prisma for DDL checks)
  const client = getLibsqlClient()
  if (client) {
    for (const table of tablesToCheck) {
      try {
        await client.execute(`SELECT 1 FROM ${table} LIMIT 1`)
      } catch {
        missingTables.push(table)
      }
    }
  } else {
    // Fallback to Prisma if libsql client isn't available
    for (const table of tablesToCheck) {
      try {
        await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`)
      } catch {
        missingTables.push(table)
      }
    }
  }

  if (missingTables.length === 0) {
    _dbReady = true
    console.log('[DB] All tables already exist — database is ready')
    return
  }

  console.log(`[DB] Creating missing tables: ${missingTables.join(', ')}`)

  // Try creating tables using the libsql client first (more reliable for DDL)
  let createdWithLibsql = false
  if (client) {
    try {
      for (const sql of CREATE_TABLES_SQL) {
        await client.execute(sql)
      }
      _dbReady = true
      createdWithLibsql = true
      console.log('[DB] All tables created successfully via libsql client — database is ready')
    } catch (error) {
      console.error('[DB] Failed to create tables via libsql client:', error instanceof Error ? error.message : error)
    }
  }

  // Fallback: try Prisma if libsql client failed
  if (!createdWithLibsql) {
    try {
      for (const sql of CREATE_TABLES_SQL) {
        await prisma.$executeRawUnsafe(sql)
      }
      _dbReady = true
      console.log('[DB] All tables created successfully via Prisma — database is ready')
    } catch (error) {
      console.error('[DB] Failed to create tables via Prisma:', error instanceof Error ? error.message : error)
      // Try one more time: create only the missing tables using individual statements
      try {
        for (const sql of CREATE_TABLES_SQL) {
          try {
            if (client) {
              await client.execute(sql)
            } else {
              await prisma.$executeRawUnsafe(sql)
            }
          } catch (singleError) {
            // Individual statement might fail if table already exists, which is OK
            const msg = singleError instanceof Error ? singleError.message : String(singleError)
            if (!msg.toLowerCase().includes('already exists')) {
              console.warn('[DB] Individual CREATE statement warning:', msg.substring(0, 100))
            }
          }
        }
        _dbReady = true
        console.log('[DB] Tables created (with some individual statement warnings) — database is ready')
      } catch (finalError) {
        console.error('[DB] All table creation methods failed:', finalError instanceof Error ? finalError.message : finalError)
      }
    }
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
    .then(() => seedDefaultData())
    .catch((error) => {
      // If init fails, clear the cached promise so it can be retried
      console.error('[DB] initDb failed, clearing cache for retry:', error instanceof Error ? error.message : error)
      _dbInitPromise = null
    })
  return _dbInitPromise
}

// Seed default catalog and bundle data if tables are empty
async function seedDefaultData(): Promise<void> {
  try {
    // Seed default premium catalog items if empty
    const catalogCount = await rawQuery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM PremiumCatalog')
    if (catalogCount[0]?.cnt === 0) {
      const defaults = [
        { analysisType: 'swot_5year', name: '5-Year SWOT Forecast', description: 'Comprehensive 5-year career & wealth forecast with SWOT analysis, specific timing, and remedies', priceCents: 499, originalPriceCents: 999, sortOrder: 1 },
        { analysisType: 'cosmic_blueprint', name: 'Cosmic Blueprint', description: 'Premium house-by-house blueprint with Ashtakvarga, Yoga directory, and Harmonized interpretations', priceCents: 699, originalPriceCents: 1299, sortOrder: 2 },
        { analysisType: 'shadow_integration', name: 'Shadow Integration', description: 'Uncompromising shadow work analysis with Tragic Sublimation, vulnerability map, and integration protocol', priceCents: 399, originalPriceCents: 799, sortOrder: 3 },
      ]
      for (const item of defaults) {
        const id = randomUUID()
        await rawExecute(
          `INSERT INTO PremiumCatalog (id, analysisType, name, description, priceCents, originalPriceCents, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [id, item.analysisType, item.name, item.description, item.priceCents, item.originalPriceCents, item.sortOrder]
        )
      }
      console.log('[DB] Seeded default PremiumCatalog entries')
    }

    // Seed standard (free) analysis types if not already present
    const standardTypes = [
      { analysisType: 'overall', name: 'Overall Reading', description: 'Complete birth chart interpretation covering personality, strengths, life purpose, and key planetary influences', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'career', name: 'Career & Profession', description: 'Professional path, suitable fields, career growth periods, and financial prospects based on 10th house and Amatyakaraka', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'relationships', name: 'Love & Marriage', description: 'Marriage timing, spouse characteristics, compatibility analysis, and relationship dynamics from 7th house and Venus', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'health', name: 'Health & Wellness', description: 'Health vulnerabilities, body constitution, and preventive guidance from 6th house and Ascendant lord', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'finance', name: 'Wealth & Finance', description: 'Income sources, wealth yogas, investment periods, and financial growth from 2nd and 11th houses', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'spiritual', name: 'Spiritual Growth', description: 'Dharma, spiritual path, past life karma, and moksha indications from 9th and 12th houses', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'dasa', name: 'Dasa Periods', description: 'Current and upcoming Vimshottari Dasa planetary periods with timeline predictions', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
      { analysisType: 'horary', name: 'Horary (Prasna)', description: 'Prasna chart analysis using KP system for specific questions and timing', priceCents: 0, originalPriceCents: null, sortOrder: 0 },
    ]
    for (const item of standardTypes) {
      const existing = await rawQuery<{ id: string }>('SELECT id FROM PremiumCatalog WHERE analysisType = ?', [item.analysisType])
      if (existing.length === 0) {
        const id = randomUUID()
        await rawExecute(
          `INSERT INTO PremiumCatalog (id, analysisType, name, description, priceCents, originalPriceCents, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [id, item.analysisType, item.name, item.description, item.priceCents, item.originalPriceCents, item.sortOrder]
        )
      }
    }
    console.log('[DB] Seeded standard analysis types in PremiumCatalog')

    // Seed default bundle if empty
    const bundleCount = await rawQuery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM ProductBundle')
    if (bundleCount[0]?.cnt === 0) {
      const bundleId = randomUUID()
      await rawExecute(
        `INSERT INTO ProductBundle (id, slug, name, description, priceCents, originalPriceCents, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
        [bundleId, 'all-premium-pack', 'All Premium Pack', 'Get all three premium analyses at a discounted price', 1199, 2097]
      )
      for (const type of ['swot_5year', 'cosmic_blueprint', 'shadow_integration']) {
        const itemId = randomUUID()
        await rawExecute(
          `INSERT INTO ProductBundleItem (id, bundleId, analysisType) VALUES (?, ?, ?)`,
          [itemId, bundleId, type]
        )
      }
      console.log('[DB] Seeded default All Premium Bundle')
    }

    // Seed reading tiers if not already present
    const readingTiers = [
      { analysisType: 'reading_basic', name: 'Basic Vedic Consultation', description: '30-minute personal reading with a certified Vedic astrologer. Get answers to 1 specific question with basic Dasa period analysis and simple remedies based on your birth chart.', priceCents: 2999, originalPriceCents: 4999, sortOrder: 10 },
      { analysisType: 'reading_standard', name: 'Standard Vedic Reading', description: '45-minute in-depth reading with a senior Vedic astrologer. Ask up to 3 questions covering career, relationships, or health. Includes detailed Dasa analysis, planetary transit impacts, and personalized remedies with gemstone recommendations.', priceCents: 4999, originalPriceCents: 7999, sortOrder: 11 },
      { analysisType: 'reading_premium', name: 'Premium Vedic Consultation', description: '60-minute comprehensive consultation with an expert Vedic astrologer. Up to 5 questions, full Dasa-bhukti analysis, Kundali matching for marriage compatibility, detailed transit forecast, and complete remedies including mantras, gemstones, and rituals.', priceCents: 7999, originalPriceCents: 11999, sortOrder: 12 },
      { analysisType: 'reading_ultimate', name: 'Ultimate Vedic Session', description: '90-minute complete life consultation with a master Vedic astrologer. Unlimited questions, full birth chart analysis, Dasa-bhukti-antara deep dive, Kundali matching, Prasna (horary) for urgent questions, yearly forecast, and comprehensive remedies with follow-up email support for 30 days.', priceCents: 14999, originalPriceCents: 21999, sortOrder: 13 },
    ]
    const existingReadingTiers = await rawQuery<{ analysisType: string }>('SELECT analysisType FROM PremiumCatalog WHERE analysisType LIKE ?', ['reading_%'])
    const existingTierTypes = new Set(existingReadingTiers.map(t => t.analysisType))
    for (const tier of readingTiers) {
      if (!existingTierTypes.has(tier.analysisType)) {
        const id = randomUUID()
        await rawExecute(
          `INSERT INTO PremiumCatalog (id, analysisType, name, description, priceCents, originalPriceCents, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [id, tier.analysisType, tier.name, tier.description, tier.priceCents, tier.originalPriceCents, tier.sortOrder]
        )
      }
    }

    // Seed default astrologer if empty
    const astrologerCount = await rawQuery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM Astrologer')
    if (astrologerCount[0]?.cnt === 0) {
      const defaultAstrologers = [
        { name: 'Pandit Ramesh Sharma', title: 'Jyotish Acharya', bio: '35+ years of experience in Vedic astrology, specializing in career guidance and marriage compatibility. Trained in the Parashari system with deep knowledge of Ashtakvarga and Vimshottari Dasa analysis.', specialties: 'vedic_reading,career,kundali_matching,dasa', experienceYears: 35, qualifications: 'Jyotish Acharya, Vedic Astrology Research Institute', languages: 'English,Hindi,Sanskrit', rating: 4.9, reviewCount: 284 },
        { name: 'Acharya Priya Devi', title: 'Jyotish Maharathi', bio: 'Expert in KP (Krishnamurti Paddhati) system and Prasna (horary) astrology. Known for precise timing predictions and spiritual guidance. 25+ years helping seekers find clarity through Vedic wisdom.', specialties: 'vedic_reading,horary,spiritual,remedies', experienceYears: 25, qualifications: 'KP System Certified, Jyotish Bharati', languages: 'English,Hindi,Tamil', rating: 4.8, reviewCount: 192 },
        { name: 'Dr. Vikram Joshi', title: 'PhD in Jyotish', bio: 'Academic scholar and practitioner combining traditional Jyotish with modern counseling approaches. Specializes in health astrology, gem therapy, and Vastu consultation. Published author of three books on Vedic astrology.', specialties: 'vedic_reading,health,gem_therapy,vastu,remedies', experienceYears: 20, qualifications: 'PhD Jyotish, Vastu Shastra Certified, Gem Therapy Diploma', languages: 'English,Hindi,Marathi', rating: 4.7, reviewCount: 156 },
      ]
      for (const astro of defaultAstrologers) {
        const id = randomUUID()
        await rawExecute(
          `INSERT INTO Astrologer (id, name, title, bio, specialties, experienceYears, qualifications, languages, rating, reviewCount, isAvailable, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
          [id, astro.name, astro.title, astro.bio, astro.specialties, astro.experienceYears, astro.qualifications, astro.languages, astro.rating, astro.reviewCount]
        )
      }
      console.log('[DB] Seeded default astrologers')
    }
  } catch (error) {
    console.error('[DB] Seed default data error:', error instanceof Error ? error.message : 'unknown')
  }
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
