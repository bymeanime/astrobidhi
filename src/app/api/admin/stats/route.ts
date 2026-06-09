import { NextResponse } from 'next/server'
import { db, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()

    // Total cached analyses
    const totalAnalyses = await db.cachedAnalysis.count()

    // Total device usages (analysis requests)
    const totalUsage = await db.deviceUsage.count()

    // Unique devices
    const allUsage = await db.deviceUsage.findMany({ select: { deviceId: true } })
    const uniqueDevices = new Set(allUsage.map(u => u.deviceId)).size

    // Analysis by type from cache
    const cachedAnalyses = await db.cachedAnalysis.findMany({
      select: { analysisType: true, provider: true, createdAt: true }
    })
    const analysesByType: Record<string, number> = {}
    const providerUsage: Record<string, number> = {}
    for (const a of cachedAnalyses) {
      analysesByType[a.analysisType] = (analysesByType[a.analysisType] || 0) + 1
      providerUsage[a.provider] = (providerUsage[a.provider] || 0) + 1
    }

    // Usage by type (includes duplicates = how many times each type was requested)
    const usageRecords = await db.deviceUsage.findMany({
      select: { analysisType: true, createdAt: true, deviceId: true }
    })
    const usageByType: Record<string, number> = {}
    const dailyActivity: Record<string, { charts: number; analyses: number }> = {}

    for (const u of usageRecords) {
      usageByType[u.analysisType] = (usageByType[u.analysisType] || 0) + 1
      const day = new Date(u.createdAt).toISOString().split('T')[0]
      if (!dailyActivity[day]) dailyActivity[day] = { charts: 0, analyses: 0 }
      dailyActivity[day].analyses++
    }

    // Shared charts stats
    const totalSharedCharts = await db.sharedChart.count()
    const sharedCharts = await db.sharedChart.findMany({ orderBy: { viewCount: 'desc' }, take: 20 })
    const totalSharedViews = sharedCharts.reduce((sum, s) => sum + s.viewCount, 0)

    // Analytics events
    const analyticsEvents = await db.analyticsEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })

    // Chart generation events
    const chartEvents = analyticsEvents.filter(e => e.eventType === 'chart_generation')
    for (const e of chartEvents) {
      const day = new Date(e.createdAt).toISOString().split('T')[0]
      if (!dailyActivity[day]) dailyActivity[day] = { charts: 0, analyses: 0 }
      dailyActivity[day].charts++
    }

    // Recent activity (combine usage records)
    const recentUsage = await db.deviceUsage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { analysisType: true, deviceId: true, cacheKey: true, createdAt: true }
    })

    // Total analytics events by type
    const allAnalyticsEvents = await db.analyticsEvent.findMany({ select: { eventType: true } })
    const eventsByType: Record<string, number> = {}
    for (const e of allAnalyticsEvents) {
      eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1
    }

    return NextResponse.json({
      totalAnalyses,
      totalUsage,
      uniqueDevices,
      analysesByType,
      usageByType,
      providerUsage,
      dailyActivity,
      recentUsage,
      sharedCharts: sharedCharts.map(s => ({
        shareId: s.shareId,
        analysisType: s.analysisType,
        includeAnalysis: s.includeAnalysis,
        viewCount: s.viewCount,
        createdAt: s.createdAt,
      })),
      totalSharedCharts,
      totalSharedViews,
      eventsByType,
      analyticsEvents: analyticsEvents.map(e => ({
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
