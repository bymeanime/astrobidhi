import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    await initDb()
    const { shareId } = await params

    const results = await rawQuery<{
      id: string; shareId: string; chartParams: string; analysisType: string | null;
      includeAnalysis: number; viewCount: number; createdAt: string
    }>(
      `SELECT id, shareId, chartParams, analysisType, includeAnalysis, viewCount, createdAt FROM SharedChart WHERE shareId = ?`,
      [shareId]
    )

    if (!results || results.length === 0) {
      return NextResponse.json({ detail: 'Shared chart not found' }, { status: 404 })
    }

    const shared = results[0]

    // Increment view count
    try {
      await rawExecute(
        `UPDATE SharedChart SET viewCount = viewCount + 1 WHERE shareId = ?`,
        [shareId]
      )
    } catch {}

    // Record analytics event
    try {
      const eventId = crypto.randomUUID()
      const metaStr = JSON.stringify({ shareId })
      await rawExecute(
        `INSERT INTO AnalyticsEvent (id, eventType, deviceId, metadata, createdAt) VALUES (?, 'share_view', NULL, ?, datetime('now'))`,
        [eventId, metaStr]
      )
    } catch {}

    return NextResponse.json({
      chartParams: JSON.parse(shared.chartParams),
      analysisType: shared.analysisType,
      includeAnalysis: !!shared.includeAnalysis,
      viewCount: Number(shared.viewCount) + 1,
      createdAt: shared.createdAt,
    })
  } catch (error) {
    console.error('Share get error:', error)
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
