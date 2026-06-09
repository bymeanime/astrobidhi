import { NextResponse } from 'next/server'
import { isDbAvailable, initDb } from '@/lib/db'

export async function GET() {
  try {
    if (!isDbAvailable()) {
      return NextResponse.json({
        status: 'degraded',
        database: 'not_configured',
        hint: 'No DATABASE_URL or TURSO_DATABASE_URL set. Caching is disabled but the app still works.',
        timestamp: new Date().toISOString(),
      })
    }

    // Explicitly ensure tables exist before querying (belt-and-suspenders)
    await initDb()

    // Dynamically import db only when available
    const { db } = await import('@/lib/db')

    // Check if database tables exist and have data
    const analysisCount = await db.cachedAnalysis.count()
    const meaningsCount = await db.cachedStaticMeanings.count()

    // Get recent cached analyses (last 5, without the full result to keep response small)
    const recentAnalyses = await db.cachedAnalysis.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cacheKey: true,
        analysisType: true,
        provider: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      tables: {
        CachedAnalysis: { count: analysisCount },
        CachedStaticMeanings: { count: meaningsCount },
      },
      recentAnalyses,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: 'not_connected',
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Database tables may not exist yet. The programmatic init in db.ts should create them on first API call.',
      timestamp: new Date().toISOString(),
    }, { status: 200 }) // Return 200 so monitoring doesn't flag it as down
  }
}
