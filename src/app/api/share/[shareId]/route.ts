import { NextRequest, NextResponse } from 'next/server'
import { db, initDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    await initDb()
    const { shareId } = await params

    const shared = await db.sharedChart.findUnique({ where: { shareId } })
    if (!shared) {
      return NextResponse.json({ detail: 'Shared chart not found' }, { status: 404 })
    }

    // Increment view count
    try {
      await db.sharedChart.update({
        where: { shareId },
        data: { viewCount: { increment: 1 } },
      })
    } catch {}

    // Record analytics event
    try {
      await db.analyticsEvent.create({
        data: {
          eventType: 'share_view',
          metadata: JSON.stringify({ shareId }),
        },
      })
    } catch {}

    return NextResponse.json({
      chartParams: JSON.parse(shared.chartParams),
      analysisType: shared.analysisType,
      includeAnalysis: shared.includeAnalysis,
      viewCount: shared.viewCount + 1,
      createdAt: shared.createdAt,
    })
  } catch (error) {
    console.error('Share get error:', error)
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
