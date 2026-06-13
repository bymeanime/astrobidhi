import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// POST: Record an analytics event
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { eventType, deviceId, metadata } = body

    if (!eventType) {
      return NextResponse.json({ detail: 'eventType is required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const metaStr = JSON.stringify(metadata || {})

    await rawExecute(
      `INSERT INTO AnalyticsEvent (id, eventType, deviceId, metadata, createdAt) VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, eventType, deviceId || null, metaStr]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ success: false, detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// GET: Fetch analytics events (for admin)
export async function GET(request: NextRequest) {
  try {
    await initDb()
    const eventType = request.nextUrl.searchParams.get('eventType')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100')

    let sql = `SELECT id, eventType, deviceId, metadata, createdAt FROM AnalyticsEvent`
    const args: unknown[] = []

    if (eventType) {
      sql += ` WHERE eventType = ?`
      args.push(eventType)
    }

    sql += ` ORDER BY createdAt DESC LIMIT ?`
    args.push(limit)

    const events = await rawQuery<{
      id: string; eventType: string; deviceId: string | null; metadata: string; createdAt: string
    }>(sql, args)

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
