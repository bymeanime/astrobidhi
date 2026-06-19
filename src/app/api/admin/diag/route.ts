import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest, getCookieName } from '@/lib/admin-auth'
import { initDb, rawQuery, isDbAvailable } from '@/lib/db'

// Strongly-typed shape for the database portion of the diagnostic payload
interface DbDiag {
  isDbAvailable: boolean
  initDb?: string
  tables?: Record<string, { exists: boolean; rowCount: number | string; error?: string }>
  seededCatalog?: unknown
  seededBundles?: unknown
  seedCheckError?: string
}

// GET /api/admin/diag — Diagnostic endpoint for debugging auth and database issues
// This endpoint provides detailed info about the auth state and database connectivity
export async function GET(request: NextRequest) {
  const diag: { timestamp: string; auth: Record<string, unknown>; database: DbDiag; message?: string } = {
    timestamp: new Date().toISOString(),
    auth: {},
    database: { isDbAvailable: isDbAvailable() },
  }

  // ── Auth diagnostics ──
  const cookieName = getCookieName()
  const cookieViaGet = request.cookies.get(cookieName)?.value
  const cookieHeader = request.headers.get('cookie') || ''
  const hasCookieHeader = cookieHeader.length > 0
  const hasAdminCookieInHeader = cookieHeader.includes(cookieName)

  let manualCookieValue: string | undefined
  if (hasCookieHeader) {
    try {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const eqIdx = c.indexOf('=')
          if (eqIdx === -1) return ['', '']
          return [c.substring(0, eqIdx).trim(), c.substring(eqIdx + 1).trim()]
        }).filter(([k]) => k)
      )
      manualCookieValue = cookies[cookieName]
    } catch {}
  }

  const isAuthed = await verifyAdminRequest(request)

  diag.auth = {
    cookieName,
    cookieViaGet: cookieViaGet ? `present (${cookieViaGet.length} chars)` : 'not found',
    cookieHeaderPresent: hasCookieHeader,
    adminCookieInHeader: hasAdminCookieInHeader,
    manualCookieValue: manualCookieValue ? `present (${manualCookieValue.length} chars, URL-encoded: ${manualCookieValue.includes('%')})` : 'not found',
    verifyAdminRequest: isAuthed,
  }

  // If not authed, return early with auth info only
  if (!isAuthed) {
    return NextResponse.json({
      ...diag,
      message: 'Authentication failed. Check the auth section for details.',
    }, { status: 401 })
  }

  // ── Database diagnostics ──
  diag.database = {
    isDbAvailable: isDbAvailable(),
    initDb: undefined,
    tables: undefined,
  }

  try {
    await initDb()
    diag.database.initDb = 'completed'
  } catch (error) {
    diag.database.initDb = `failed: ${error instanceof Error ? error.message : 'unknown'}`
  }

  // Check if key tables exist and have data
  const tablesToCheck = [
    'CachedAnalysis', 'DeviceUsage', 'AnalyticsEvent', 'SharedChart',
    'UserAccess', 'PremiumCatalog', 'ProductBundle', 'ProductBundleItem',
    'PromoCode', 'DeviceAccess',
  ]

  const tableInfo: Record<string, { exists: boolean; rowCount: number | string; error?: string }> = {}
  for (const table of tablesToCheck) {
    try {
      const result = await rawQuery<{ count: number | string }>(`SELECT COUNT(*) as count FROM ${table}`)
      tableInfo[table] = {
        exists: true,
        rowCount: typeof result[0]?.count === 'number' ? result[0].count : parseInt(String(result[0]?.count || '0'), 10),
      }
    } catch (error) {
      tableInfo[table] = {
        exists: false,
        rowCount: 0,
        error: error instanceof Error ? error.message : 'unknown error',
      }
    }
  }

  diag.database.tables = tableInfo

  // Check if default data was seeded
  try {
    const catalogItems = await rawQuery<{ analysisType: string; name: string }>(
      'SELECT analysisType, name FROM PremiumCatalog'
    )
    diag.database.seededCatalog = catalogItems.length > 0 ? catalogItems : 'empty — seeding may have failed'

    const bundles = await rawQuery<{ slug: string; name: string }>(
      'SELECT slug, name FROM ProductBundle'
    )
    diag.database.seededBundles = bundles.length > 0 ? bundles : 'empty — seeding may have failed'
  } catch (error) {
    diag.database.seedCheckError = error instanceof Error ? error.message : 'unknown'
  }

  return NextResponse.json(diag)
}
