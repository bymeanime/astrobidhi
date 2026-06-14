import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery } from '@/lib/db'

// Safe number conversion (handles string counts from SQLite)
function safeNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseInt(val, 10) || fallback
  return fallback
}

// Safe raw query — returns fallback on error instead of crashing
async function safeQuery<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
  fallback: T[] = []
): Promise<T[]> {
  try {
    return await rawQuery<T>(sql, args)
  } catch (error) {
    console.error('[Admin Analyses] Query failed:', error instanceof Error ? error.message : error)
    console.error('[Admin Analyses] SQL:', sql)
    return fallback
  }
}

// GET /api/admin/analyses — Comprehensive analysis audit & verification
export async function GET(request: NextRequest) {
  // ---- Auth ----
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()

    // ---- Row counts ----
    const [analysisCount, chartCount, usageCount] = await Promise.all([
      safeQuery<{ count: number | string }>('SELECT COUNT(*) as count FROM CachedAnalysis'),
      safeQuery<{ count: number | string }>('SELECT COUNT(*) as count FROM CachedChart'),
      safeQuery<{ count: number | string }>('SELECT COUNT(*) as count FROM DeviceUsage'),
    ])

    // ---- Full CachedAnalysis listing (with result/chartData lengths) ----
    const analysesList = await safeQuery<{
      id: string
      cacheKey: string
      analysisType: string
      provider: string
      resultLen: number | string
      chartDataLen: number | string
      createdAt: string
    }>(
      `SELECT id, cacheKey, analysisType, provider, LENGTH(result) as resultLen, LENGTH(chartData) as chartDataLen, createdAt FROM CachedAnalysis ORDER BY createdAt DESC`
    )

    // ---- Full DeviceUsage listing ----
    const usageList = await safeQuery<{
      id: string
      deviceId: string
      analysisType: string
      cacheKey: string
      createdAt: string
    }>(
      `SELECT id, deviceId, analysisType, cacheKey, createdAt FROM DeviceUsage ORDER BY createdAt DESC`
    )

    // ---- Data integrity: DeviceUsage orphans (no matching CachedAnalysis) ----
    const orphanUsages = await safeQuery<{
      id: string
      deviceId: string
      analysisType: string
      cacheKey: string
      createdAt: string
    }>(
      `SELECT du.id, du.deviceId, du.analysisType, du.cacheKey, du.createdAt
       FROM DeviceUsage du
       LEFT JOIN CachedAnalysis ca ON du.cacheKey = ca.cacheKey
       WHERE ca.cacheKey IS NULL
       ORDER BY du.createdAt DESC`
    )

    // ---- Data integrity: CachedAnalysis without matching CachedChart ----
    const analysesWithoutCharts = await safeQuery<{
      id: string
      cacheKey: string
      analysisType: string
      provider: string
      createdAt: string
    }>(
      `SELECT ca.id, ca.cacheKey, ca.analysisType, ca.provider, ca.createdAt
       FROM CachedAnalysis ca
       LEFT JOIN CachedChart cc ON ca.cacheKey = cc.cacheKey
       WHERE cc.cacheKey IS NULL
       ORDER BY ca.createdAt DESC`
    )

    // ---- Stats by analysis type ----
    const statsByType = await safeQuery<{
      analysisType: string
      count: number | string
      avgResultLen: number | string
      providers: string
    }>(
      `SELECT analysisType, COUNT(*) as count, AVG(LENGTH(result)) as avgResultLen, GROUP_CONCAT(DISTINCT provider) as providers
       FROM CachedAnalysis
       GROUP BY analysisType
       ORDER BY count DESC`
    )

    // ---- Stats by provider ----
    const statsByProvider = await safeQuery<{
      provider: string
      count: number | string
      types: string
      avgResultLen: number | string
    }>(
      `SELECT provider, COUNT(*) as count, GROUP_CONCAT(DISTINCT analysisType) as types, AVG(LENGTH(result)) as avgResultLen
       FROM CachedAnalysis
       GROUP BY provider
       ORDER BY count DESC`
    )

    // ---- Usage by analysis type ----
    const usageByType = await safeQuery<{
      analysisType: string
      count: number | string
      uniqueDevices: number | string
    }>(
      `SELECT analysisType, COUNT(*) as count, COUNT(DISTINCT deviceId) as uniqueDevices
       FROM DeviceUsage
       GROUP BY analysisType
       ORDER BY count DESC`
    )

    // ---- Recent analyses (last 10) ----
    const recentAnalyses = await safeQuery<{
      id: string
      cacheKey: string
      analysisType: string
      provider: string
      resultLen: number | string
      chartDataLen: number | string
      createdAt: string
    }>(
      `SELECT id, cacheKey, analysisType, provider, LENGTH(result) as resultLen, LENGTH(chartData) as chartDataLen, createdAt
       FROM CachedAnalysis
       ORDER BY createdAt DESC
       LIMIT 10`
    )

    // ---- Build response ----
    return NextResponse.json({
      // Summary counts
      counts: {
        cachedAnalysis: safeNum(analysisCount[0]?.count),
        cachedChart: safeNum(chartCount[0]?.count),
        deviceUsage: safeNum(usageCount[0]?.count),
      },

      // Data integrity checks
      integrity: {
        orphanUsages: {
          description: 'DeviceUsage records with NO matching CachedAnalysis (analysis was requested but result was not stored)',
          count: orphanUsages.length,
          records: orphanUsages,
        },
        analysesWithoutCharts: {
          description: 'CachedAnalysis records with NO matching CachedChart (analysis stored but chart data was not cached)',
          count: analysesWithoutCharts.length,
          records: analysesWithoutCharts,
        },
      },

      // All CachedAnalysis records (lightweight — no full result text)
      analyses: analysesList.map(a => ({
        id: a.id,
        cacheKey: a.cacheKey,
        analysisType: a.analysisType,
        provider: a.provider,
        resultLength: safeNum(a.resultLen),
        chartDataLength: safeNum(a.chartDataLen),
        createdAt: a.createdAt,
      })),

      // All DeviceUsage records
      deviceUsage: usageList.map(u => ({
        id: u.id,
        deviceId: u.deviceId,
        analysisType: u.analysisType,
        cacheKey: u.cacheKey,
        createdAt: u.createdAt,
      })),

      // Stats breakdown
      stats: {
        byAnalysisType: statsByType.map(s => ({
          analysisType: s.analysisType,
          count: safeNum(s.count),
          avgResultLength: Math.round(safeNum(s.avgResultLen)),
          providers: s.providers || '',
        })),
        byProvider: statsByProvider.map(s => ({
          provider: s.provider,
          count: safeNum(s.count),
          analysisTypes: s.types || '',
          avgResultLength: Math.round(safeNum(s.avgResultLen)),
        })),
        usageByType: usageByType.map(s => ({
          analysisType: s.analysisType,
          requestCount: safeNum(s.count),
          uniqueDevices: safeNum(s.uniqueDevices),
        })),
      },

      // Most recent analyses
      recent: recentAnalyses.map(a => ({
        id: a.id,
        cacheKey: a.cacheKey,
        analysisType: a.analysisType,
        provider: a.provider,
        resultLength: safeNum(a.resultLen),
        chartDataLength: safeNum(a.chartDataLen),
        createdAt: a.createdAt,
      })),

      // Audit metadata
      _meta: {
        timestamp: new Date().toISOString(),
        description: 'Comprehensive analysis audit. Use /api/admin/analyses/[cacheKey] to inspect full data for a specific record.',
      },
    })
  } catch (error) {
    console.error('[Admin Analyses] Fatal error:', error)
    return NextResponse.json(
      {
        detail: 'Failed to run analysis audit',
        error: error instanceof Error ? error.message : 'Unknown error',
        counts: { cachedAnalysis: 0, cachedChart: 0, deviceUsage: 0 },
        integrity: { orphanUsages: { description: '', count: 0, records: [] }, analysesWithoutCharts: { description: '', count: 0, records: [] } },
        analyses: [],
        deviceUsage: [],
        stats: { byAnalysisType: [], byProvider: [], usageByType: [] },
        recent: [],
      },
      { status: 500 }
    )
  }
}
