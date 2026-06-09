import { NextRequest, NextResponse } from 'next/server'
import { db, initDb } from '@/lib/db'

// POST: Create a shared chart link
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { chartParams, analysisType, includeAnalysis } = body

    if (!chartParams) {
      return NextResponse.json({ detail: 'chartParams is required' }, { status: 400 })
    }

    const shared = await db.sharedChart.create({
      data: {
        chartParams: JSON.stringify(chartParams),
        analysisType: analysisType || null,
        includeAnalysis: !!includeAnalysis,
      },
    })

    // Record analytics event
    try {
      await db.analyticsEvent.create({
        data: {
          eventType: 'share',
          deviceId: body.deviceId || null,
          metadata: JSON.stringify({ shareId: shared.shareId, analysisType, includeAnalysis }),
        },
      })
    } catch {}

    return NextResponse.json({
      shareId: shared.shareId,
      shareUrl: `/share/${shared.shareId}`,
    })
  } catch (error) {
    console.error('Share create error:', error)
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
