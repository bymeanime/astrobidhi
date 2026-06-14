import { NextResponse } from 'next/server'
import { isDbAvailable, initDb, rawQuery } from '@/lib/db'

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

    // Check if database tables exist and have data using raw SQL
    // (matches the working pattern from chart caching)
    const analysisCountRows = await rawQuery<{ count: number | string }>('SELECT COUNT(*) as count FROM CachedAnalysis')
    const meaningsCountRows = await rawQuery<{ count: number | string }>('SELECT COUNT(*) as count FROM CachedStaticMeanings')
    const chartCountRows = await rawQuery<{ count: number | string }>('SELECT COUNT(*) as count FROM CachedChart')

    const analysisCount = Number(analysisCountRows[0]?.count || 0)
    const meaningsCount = Number(meaningsCountRows[0]?.count || 0)
    const chartCount = Number(chartCountRows[0]?.count || 0)

    // Get recent cached analyses (last 5, without the full result to keep response small)
    const recentAnalyses = await rawQuery<{
      id: string; cacheKey: string; analysisType: string; provider: string; createdAt: string;
    }>(
      `SELECT id, cacheKey, analysisType, provider, createdAt FROM CachedAnalysis ORDER BY createdAt DESC LIMIT 5`
    )

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      tables: {
        CachedAnalysis: { count: analysisCount },
        CachedChart: { count: chartCount },
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
