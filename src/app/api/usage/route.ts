import { NextRequest, NextResponse } from 'next/server'
import { rawQuery, initDb } from '@/lib/db'

// Per-device rate limit config (must match ai-analysis route)
const FREE_CHART_LIMIT = 3
const FREE_ANALYSIS_PER_CHART = 2

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId')
    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    // Get all usage records for this device using raw SQL
    // (Prisma ORM calls fail silently through the proxy layer)
    const usage = await rawQuery<{
      id: string
      deviceId: string
      analysisType: string
      cacheKey: string
      createdAt: string
    }>(
      `SELECT id, deviceId, analysisType, cacheKey, createdAt FROM DeviceUsage WHERE deviceId = ? ORDER BY createdAt DESC`,
      [deviceId]
    )

    // Count unique charts (by unique cacheKey)
    const uniqueCacheKeys = new Set(usage.map(u => u.cacheKey))
    const chartsUsed = uniqueCacheKeys.size

    // Count analyses per chart
    const analysesPerChart: Record<string, number> = {}
    for (const u of usage) {
      analysesPerChart[u.cacheKey] = (analysesPerChart[u.cacheKey] || 0) + 1
    }

    // Calculate remaining
    const chartsRemaining = Math.max(0, FREE_CHART_LIMIT - chartsUsed)
    const analysesPerChartRemaining = Math.max(0, FREE_ANALYSIS_PER_CHART - (usage.length > 0 ? Math.max(...Object.values(analysesPerChart)) : 0))

    return NextResponse.json({
      deviceId,
      chartsUsed,
      chartsLimit: FREE_CHART_LIMIT,
      chartsRemaining,
      analysesPerChartLimit: FREE_ANALYSIS_PER_CHART,
      analysesPerChartRemaining,
      recentUsage: usage.slice(0, 10).map(u => ({
        analysisType: u.analysisType,
        cacheKey: u.cacheKey,
        date: u.createdAt,
      })),
      canAnalyze: chartsRemaining > 0 || analysesPerChartRemaining > 0,
    })
  } catch (error) {
    return NextResponse.json({
      detail: error instanceof Error ? error.message : 'Unknown error',
      chartsUsed: 0,
      chartsLimit: FREE_CHART_LIMIT,
      chartsRemaining: FREE_CHART_LIMIT,
      analysesPerChartLimit: FREE_ANALYSIS_PER_CHART,
      analysesPerChartRemaining: FREE_ANALYSIS_PER_CHART,
      canAnalyze: true, // Allow if DB is down
    }, { status: 200 }) // Return 200 with defaults so UI doesn't break
  }
}
