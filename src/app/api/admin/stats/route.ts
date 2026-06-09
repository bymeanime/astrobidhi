import { NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

// Helper to safely run a query — returns fallback on error
async function safeRawQuery<T>(sql: string, args: unknown[] = [], fallback: T[] = []): Promise<T[]> {
  try {
    return await rawQuery<T>(sql, args)
  } catch (error) {
    console.error('[Admin Stats] Query failed:', error instanceof Error ? error.message : error)
    return fallback
  }
}

// Safe number conversion
function safeNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseInt(val, 10) || fallback
  return fallback
}

export async function GET() {
  try {
    // Attempt DB init, but don't let it crash everything
    try {
      await initDb()
    } catch (initError) {
      console.error('[Admin Stats] DB init failed:', initError instanceof Error ? initError.message : initError)
      // Return empty stats rather than 500
      return NextResponse.json({
        totalAnalyses: 0, totalUsage: 0, uniqueDevices: 0,
        analysesByType: {}, usageByType: {}, providerUsage: {},
        dailyActivity: {}, recentUsage: [], sharedCharts: [],
        totalSharedCharts: 0, totalSharedViews: 0, eventsByType: {},
        analyticsEvents: [],
        _warning: 'Database initialization failed. Stats may be incomplete.',
      })
    }

    // Total cached analyses
    const totalAnalysesResult = await safeRawQuery<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM CachedAnalysis`
    )
    const totalAnalyses = safeNum(totalAnalysesResult[0]?.count)

    // Total device usages
    const totalUsageResult = await safeRawQuery<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM DeviceUsage`
    )
    const totalUsage = safeNum(totalUsageResult[0]?.count)

    // Unique devices
    const uniqueDevicesResult = await safeRawQuery<{ count: number | string }>(
      `SELECT COUNT(DISTINCT deviceId) as count FROM DeviceUsage`
    )
    const uniqueDevices = safeNum(uniqueDevicesResult[0]?.count)

    // Analysis by type from cache
    const analysesByTypeResult = await safeRawQuery<{ analysisType: string; count: number | string }>(
      `SELECT analysisType, COUNT(*) as count FROM CachedAnalysis GROUP BY analysisType`
    )
    const analysesByType: Record<string, number> = {}
    for (const row of analysesByTypeResult) {
      analysesByType[row.analysisType] = safeNum(row.count)
    }

    // Provider usage from cache
    const providerUsageResult = await safeRawQuery<{ provider: string; count: number | string }>(
      `SELECT provider, COUNT(*) as count FROM CachedAnalysis GROUP BY provider`
    )
    const providerUsage: Record<string, number> = {}
    for (const row of providerUsageResult) {
      providerUsage[row.provider] = safeNum(row.count)
    }

    // Usage by type
    const usageByTypeResult = await safeRawQuery<{ analysisType: string; count: number | string }>(
      `SELECT analysisType, COUNT(*) as count FROM DeviceUsage GROUP BY analysisType`
    )
    const usageByType: Record<string, number> = {}
    for (const row of usageByTypeResult) {
      usageByType[row.analysisType] = safeNum(row.count)
    }

    // Daily activity — analysis requests
    const dailyAnalysesResult = await safeRawQuery<{ day: string; count: number | string }>(
      `SELECT DATE(createdAt) as day, COUNT(*) as count FROM DeviceUsage GROUP BY DATE(createdAt) ORDER BY day DESC LIMIT 30`
    )
    const dailyActivity: Record<string, { charts: number; analyses: number }> = {}
    for (const row of dailyAnalysesResult) {
      dailyActivity[row.day] = { charts: 0, analyses: safeNum(row.count) }
    }

    // Daily activity — chart generations from AnalyticsEvent
    const dailyChartsResult = await safeRawQuery<{ day: string; count: number | string }>(
      `SELECT DATE(createdAt) as day, COUNT(*) as count FROM AnalyticsEvent WHERE eventType = 'chart_generation' GROUP BY DATE(createdAt) ORDER BY day DESC LIMIT 30`
    )
    for (const row of dailyChartsResult) {
      if (!dailyActivity[row.day]) dailyActivity[row.day] = { charts: 0, analyses: 0 }
      dailyActivity[row.day].charts = safeNum(row.count)
    }

    // Shared charts stats
    const totalSharedChartsResult = await safeRawQuery<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM SharedChart`
    )
    const totalSharedCharts = safeNum(totalSharedChartsResult[0]?.count)

    const sharedChartsResult = await safeRawQuery<{
      shareId: string; analysisType: string | null; includeAnalysis: number | string; viewCount: number | string; createdAt: string
    }>(
      `SELECT shareId, analysisType, includeAnalysis, viewCount, createdAt FROM SharedChart ORDER BY viewCount DESC LIMIT 20`
    )
    const totalSharedViews = sharedChartsResult.reduce((sum, s) => sum + safeNum(s.viewCount), 0)

    // Analytics events by type
    const eventsByTypeResult = await safeRawQuery<{ eventType: string; count: number | string }>(
      `SELECT eventType, COUNT(*) as count FROM AnalyticsEvent GROUP BY eventType`
    )
    const eventsByType: Record<string, number> = {}
    for (const row of eventsByTypeResult) {
      eventsByType[row.eventType] = safeNum(row.count)
    }

    // Recent analytics events
    const recentEventsResult = await safeRawQuery<{
      eventType: string; deviceId: string | null; metadata: string; createdAt: string
    }>(
      `SELECT eventType, deviceId, metadata, createdAt FROM AnalyticsEvent ORDER BY createdAt DESC LIMIT 100`
    )

    // Recent usage
    const recentUsageResult = await safeRawQuery<{
      analysisType: string; deviceId: string; cacheKey: string; createdAt: string
    }>(
      `SELECT analysisType, deviceId, cacheKey, createdAt FROM DeviceUsage ORDER BY createdAt DESC LIMIT 50`
    )

    return NextResponse.json({
      totalAnalyses,
      totalUsage,
      uniqueDevices,
      analysesByType,
      usageByType,
      providerUsage,
      dailyActivity,
      recentUsage: recentUsageResult.map(u => ({
        analysisType: u.analysisType,
        deviceId: u.deviceId,
        cacheKey: u.cacheKey,
        createdAt: u.createdAt,
      })),
      sharedCharts: sharedChartsResult.map(s => ({
        shareId: s.shareId,
        analysisType: s.analysisType,
        includeAnalysis: !!s.includeAnalysis,
        viewCount: safeNum(s.viewCount),
        createdAt: s.createdAt,
      })),
      totalSharedCharts,
      totalSharedViews,
      eventsByType,
      analyticsEvents: recentEventsResult.map(e => ({
        eventType: e.eventType,
        deviceId: e.deviceId,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    // Return a valid response with empty data instead of 500
    return NextResponse.json({
      totalAnalyses: 0, totalUsage: 0, uniqueDevices: 0,
      analysesByType: {}, usageByType: {}, providerUsage: {},
      dailyActivity: {}, recentUsage: [], sharedCharts: [],
      totalSharedCharts: 0, totalSharedViews: 0, eventsByType: {},
      analyticsEvents: [],
      _error: error instanceof Error ? error.message : 'Unknown error fetching stats',
    }, { status: 200 }) // Return 200 with empty data so the dashboard renders
  }
}
