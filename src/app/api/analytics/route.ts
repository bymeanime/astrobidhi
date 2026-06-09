import { NextRequest, NextResponse } from 'next/server'
import { db, initDb } from '@/lib/db'

// POST: Record an analytics event
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { eventType, deviceId, metadata } = body

    if (!eventType) {
      return NextResponse.json({ detail: 'eventType is required' }, { status: 400 })
    }

    await db.analyticsEvent.create({
      data: {
        eventType,
        deviceId: deviceId || null,
        metadata: JSON.stringify(metadata || {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics error:', error)
    // Don't fail the user request if analytics fails
    return NextResponse.json({ success: false, detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// GET: Fetch analytics events (for admin)
export async function GET(request: NextRequest) {
  try {
    await initDb()
    const eventType = request.nextUrl.searchParams.get('eventType')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100')

    const where = eventType ? { eventType } : {}
    const events = await db.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      events: events.map(e => ({
        ...e,
        metadata: JSON.parse(e.metadata),
      })),
    })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
