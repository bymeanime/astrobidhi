import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawExecute } from '@/lib/db'

// POST: Create a shared chart link
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { chartParams, analysisType, includeAnalysis, cachedChartData, cachedAnalysisResult } = body

    if (!chartParams) {
      return NextResponse.json({ detail: 'chartParams is required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const shareId = crypto.randomUUID()
    const chartParamsStr = JSON.stringify(chartParams)

    // Store the chart data and analysis result for caching
    // so viewers don't need to re-run Python or consume AI credits
    const cachedChartDataStr = cachedChartData ? JSON.stringify(cachedChartData) : null
    const cachedAnalysisResultStr = cachedAnalysisResult || null

    await rawExecute(
      `INSERT INTO SharedChart (id, shareId, chartParams, analysisType, includeAnalysis, cachedChartData, cachedAnalysisResult, viewCount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [id, shareId, chartParamsStr, analysisType || null, includeAnalysis ? 1 : 0, cachedChartDataStr, cachedAnalysisResultStr]
    )

    // Record analytics event (fire and forget)
    try {
      const eventId = crypto.randomUUID()
      const metaStr = JSON.stringify({ shareId, analysisType, includeAnalysis })
      await rawExecute(
        `INSERT INTO AnalyticsEvent (id, eventType, deviceId, metadata, createdAt) VALUES (?, 'share', ?, ?, datetime('now'))`,
        [eventId, body.deviceId || null, metaStr]
      )
    } catch {}

    return NextResponse.json({
      shareId,
      shareUrl: `/share/${shareId}`,
    })
  } catch (error) {
    console.error('Share create error:', error)
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
