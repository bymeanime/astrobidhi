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

export async function GET() {
  try {
    await initDb()

    // Total cached analyses
    const totalAnalysesResult = await safeRawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM CachedAnalysis`
    )
    const totalAnalyses = Number(totalAnalysesResult[0]?.count || 0)

    // Total device usages
    const totalUsageResult = await safeRawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM DeviceUsage`
    )
    const totalUsage = Number(totalUsageResult[0]?.count || 0)

    // Unique devices
    const uniqueDevicesResult = await safeRawQuery<{ count: number }>(
      `SELECT COUNT(DISTINCT deviceId) as count FROM DeviceUsage`
    )
    const uniqueDevices = Number(uniqueDevicesResult[0]?.count || 0)

    // Analysis by type from cache
    const analysesByTypeResult = await safeRawQuery<{ analysisType: string; count: number }>(
      `SELECT analysisType, COUNT(*) as count FROM CachedAnalysis GROUP BY analysisType`
    )
    const analysesByType: Record<string, number> = {}
    for (const row of analysesByTypeResult) {
      analysesByType[row.analysisType] = Number(row.count)
    }

    // Provider usage from cache
    const providerUsageResult = await safeRawQuery<{ provider: string; count: number }>(
      `SELECT provider, COUNT(*) as count FROM CachedAnalysis GROUP BY provider`
    )
    const providerUsage: Record<string, number> = {}
    for (const row of providerUsageResult) {
      providerUsage[row.provider] = Number(row.count)
    }

    // Usage by type
    const usageByTypeResult = await safeRawQuery<{ analysisType: string; count: number }>(
      `SELECT analysisType, COUNT(*) as count FROM DeviceUsage GROUP BY analysisType`
    )
    const usageByType: Record<string, number> = {}
    for (const row of usageByTypeResult) {
      usageByType[row.analysisType] = Number(row.count)
    }

    // Daily activity — analysis requests
    const dailyAnalysesResult = await safeRawQuery<{ day: string; count: number }>(
      `SELECT DATE(createdAt) as day, COUNT(*) as count FROM DeviceUsage GROUP BY DATE(createdAt) ORDER BY day DESC LIMIT 30`
    )
    const dailyActivity: Record<string, { charts: number; analyses: number }> = {}
    for (const row of dailyAnalysesResult) {
      dailyActivity[row.day] = { charts: 0, analyses: Number(row.count) }
    }

    // Daily activity — chart generations from AnalyticsEvent
    const dailyChartsResult = await safeRawQuery<{ day: string; count: number }>(
      `SELECT DATE(createdAt) as day, COUNT(*) as count FROM AnalyticsEvent WHERE eventType = 'chart_generation' GROUP BY DATE(createdAt) ORDER BY day DESC LIMIT 30`
    )
    for (const row of dailyChartsResult) {
      if (!dailyActivity[row.day]) dailyActivity[row.day] = { charts: 0, analyses: 0 }
      dailyActivity[row.day].charts = Number(row.count)
    }

    // Shared charts stats
    const totalSharedChartsResult = await safeRawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM SharedChart`
    )
    const totalSharedCharts = Number(totalSharedChartsResult[0]?.count || 0)

    const sharedChartsResult = await safeRawQuery<{
      shareId: string; analysisType: string | null; includeAnalysis: number; viewCount: number; createdAt: string
    }>(
      `SELECT shareId, analysisType, includeAnalysis, viewCount, createdAt FROM SharedChart ORDER BY viewCount DESC LIMIT 20`
    )
    const totalSharedViews = sharedChartsResult.reduce((sum, s) => sum + Number(s.viewCount), 0)

    // Analytics events by type
    const eventsByTypeResult = await safeRawQuery<{ eventType: string; count: number }>(
      `SELECT eventType, COUNT(*) as count FROM AnalyticsEvent GROUP BY eventType`
    )
    const eventsByType: Record<string, number> = {}
    for (const row of eventsByTypeResult) {
      eventsByType[row.eventType] = Number(row.count)
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
        viewCount: Number(s.viewCount),
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
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
