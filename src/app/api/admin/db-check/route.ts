import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute, isDbAvailable } from '@/lib/db'

interface HealthCheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  durationMs?: number
}

// GET /api/admin/db-check — Database health check
export async function GET(request: NextRequest) {
  // ---- Auth ----
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const checks: HealthCheckResult[] = []
  const startTime = Date.now()

  // ---- Check 1: Database availability flag ----
  checks.push({
    name: 'database_availability',
    status: isDbAvailable() ? 'pass' : 'fail',
    message: isDbAvailable()
      ? 'Database client is available'
      : 'Database client is NOT available — isDbAvailable() returned false',
  })

  // ---- Check 2: DB init ----
  const initStart = Date.now()
  try {
    await initDb()
    checks.push({
      name: 'database_init',
      status: 'pass',
      message: 'Database initialization completed successfully',
      durationMs: Date.now() - initStart,
    })
  } catch (error) {
    checks.push({
      name: 'database_init',
      status: 'fail',
      message: `Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - initStart,
    })
    // If init fails, we can't do further checks
    const overallStatus = checks.some(c => c.status === 'fail') ? 'unhealthy' : 'healthy'
    return NextResponse.json({
      status: overallStatus,
      checks,
      totalDurationMs: Date.now() - startTime,
    }, { status: 503 })
  }

  // ---- Check 3: Basic read query ----
  const readStart = Date.now()
  try {
    // Type as number|string because SQLite may return either depending on the driver
    const result = await rawQuery<{ test: number | string }>('SELECT 1 as test')
    const testVal = result[0]?.test
    const isOne = testVal === 1 || testVal === '1' || String(testVal) === '1'
    if (result.length > 0 && isOne) {
      checks.push({
        name: 'read_query',
        status: 'pass',
        message: 'Basic SELECT query succeeded',
        durationMs: Date.now() - readStart,
      })
    } else {
      checks.push({
        name: 'read_query',
        status: 'fail',
        message: `SELECT 1 returned unexpected result: ${JSON.stringify(result)}`,
        durationMs: Date.now() - readStart,
      })
    }
  } catch (error) {
    checks.push({
      name: 'read_query',
      status: 'fail',
      message: `Read query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - readStart,
    })
  }

  // ---- Check 4: Table existence ----
  const expectedTables = [
    'CachedAnalysis',
    'CachedChart',
    'CachedStaticMeanings',
    'DeviceUsage',
    'AnalyticsEvent',
    'SharedChart',
    'UserAccount',
    'UserAnalysis',
    'UserAccess',
    'PremiumCatalog',
    'ProductBundle',
    'ProductBundleItem',
    'PromoCode',
    'DeviceAccess',
  ]

  const tableResults: Record<string, { exists: boolean; rowCount: number }> = {}
  const tableStart = Date.now()
  let allTablesExist = true

  for (const table of expectedTables) {
    try {
      const countResult = await rawQuery<{ count: number | string }>(
        `SELECT COUNT(*) as count FROM ${table}`
      )
      tableResults[table] = {
        exists: true,
        rowCount: typeof countResult[0]?.count === 'number'
          ? countResult[0].count
          : parseInt(String(countResult[0]?.count || '0'), 10),
      }
    } catch (error) {
      allTablesExist = false
      tableResults[table] = {
        exists: false,
        rowCount: 0,
      }
    }
  }

  const missingTables = expectedTables.filter(t => !tableResults[t]?.exists)
  checks.push({
    name: 'table_existence',
    status: missingTables.length === 0 ? 'pass' : 'fail',
    message: missingTables.length === 0
      ? `All ${expectedTables.length} tables exist`
      : `Missing tables: ${missingTables.join(', ')}`,
    durationMs: Date.now() - tableStart,
  })

  // ---- Check 5: Read/Write capability ----
  const rwStart = Date.now()
  const testId = `dbcheck_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  const testCacheKey = `__dbcheck_${Date.now()}`

  try {
    // Write a test row into CachedAnalysis (using a clearly-fake cacheKey)
    await rawExecute(
      `INSERT INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [testId, testCacheKey, '__dbcheck', '__test_chart_data', '__test_result', '__dbcheck_provider']
    )

    // Read it back
    const readBack = await rawQuery<{ id: string; cacheKey: string; analysisType: string }>(
      `SELECT id, cacheKey, analysisType FROM CachedAnalysis WHERE cacheKey = ?`,
      [testCacheKey]
    )

    if (readBack.length === 1 && readBack[0].id === testId) {
      // Delete the test row
      await rawExecute(
        `DELETE FROM CachedAnalysis WHERE cacheKey = ?`,
        [testCacheKey]
      )

      // Verify deletion
      const afterDelete = await rawQuery<{ id: string }>(
        `SELECT id FROM CachedAnalysis WHERE cacheKey = ?`,
        [testCacheKey]
      )

      if (afterDelete.length === 0) {
        checks.push({
          name: 'read_write_capability',
          status: 'pass',
          message: 'INSERT → SELECT → DELETE cycle completed successfully',
          durationMs: Date.now() - rwStart,
        })
      } else {
        // Row wasn't deleted — cleanup attempt
        await rawExecute(`DELETE FROM CachedAnalysis WHERE cacheKey = ?`, [testCacheKey])
        checks.push({
          name: 'read_write_capability',
          status: 'warn',
          message: 'INSERT and SELECT worked, but DELETE did not remove the row (cleanup attempted)',
          durationMs: Date.now() - rwStart,
        })
      }
    } else {
      // Read-back failed — cleanup
      await rawExecute(`DELETE FROM CachedAnalysis WHERE cacheKey = ?`, [testCacheKey])
      checks.push({
        name: 'read_write_capability',
        status: 'fail',
        message: `INSERT succeeded but SELECT did not return expected row. Got: ${JSON.stringify(readBack)}`,
        durationMs: Date.now() - rwStart,
      })
    }
  } catch (error) {
    // Attempt cleanup
    try {
      await rawExecute(`DELETE FROM CachedAnalysis WHERE cacheKey = ?`, [testCacheKey])
    } catch {
      // Ignore cleanup failure
    }
    checks.push({
      name: 'read_write_capability',
      status: 'fail',
      message: `Read/write test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - rwStart,
    })
  }

  // ---- Check 6: Index verification ----
  const indexStart = Date.now()
  const expectedIndexes = [
    'CachedAnalysis_cacheKey_idx',
    'CachedChart_cacheKey_idx',
    'DeviceUsage_deviceId_idx',
    'DeviceUsage_deviceId_cacheKey_idx',
  ]

  const indexResults: Record<string, boolean> = {}
  try {
    const sqliteIndexes = await rawQuery<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`
    )
    const indexNames = new Set(sqliteIndexes.map(i => i.name))

    for (const idx of expectedIndexes) {
      indexResults[idx] = indexNames.has(idx)
    }

    const missingIndexes = expectedIndexes.filter(idx => !indexResults[idx])
    checks.push({
      name: 'index_verification',
      status: missingIndexes.length === 0 ? 'pass' : 'warn',
      message: missingIndexes.length === 0
        ? `All ${expectedIndexes.length} expected indexes exist`
        : `Missing indexes: ${missingIndexes.join(', ')} (performance may be affected)`,
      durationMs: Date.now() - indexStart,
    })
  } catch (error) {
    checks.push({
      name: 'index_verification',
      status: 'warn',
      message: `Could not verify indexes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - indexStart,
    })
  }

  // ---- Check 7: Schema column verification for CachedAnalysis ----
  const schemaStart = Date.now()
  try {
    const columns = await rawQuery<{ name: string; type: string; notnull: number; pk: number }>(
      `PRAGMA table_info(CachedAnalysis)`
    )
    const columnNames = new Set(columns.map(c => c.name))
    const requiredColumns = ['id', 'cacheKey', 'analysisType', 'chartData', 'result', 'provider', 'createdAt']
    const missingColumns = requiredColumns.filter(c => !columnNames.has(c))

    checks.push({
      name: 'cached_analysis_schema',
      status: missingColumns.length === 0 ? 'pass' : 'fail',
      message: missingColumns.length === 0
        ? `CachedAnalysis has all ${requiredColumns.length} required columns`
        : `CachedAnalysis missing columns: ${missingColumns.join(', ')}. Found: ${[...columnNames].join(', ')}`,
      durationMs: Date.now() - schemaStart,
    })
  } catch (error) {
    checks.push({
      name: 'cached_analysis_schema',
      status: 'warn',
      message: `Could not verify CachedAnalysis schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - schemaStart,
    })
  }

  // ---- Overall status ----
  const hasFail = checks.some(c => c.status === 'fail')
  const hasWarn = checks.some(c => c.status === 'warn')
  const overallStatus = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy'

  return NextResponse.json({
    status: overallStatus,
    checks,
    tables: tableResults,
    indexes: indexResults,
    totalDurationMs: Date.now() - startTime,
    _meta: {
      timestamp: new Date().toISOString(),
      description: 'Database health check. Status: healthy (all pass), degraded (warnings), unhealthy (failures).',
    },
  }, { status: hasFail ? 503 : 200 })
}
