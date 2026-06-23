import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/cache — List cached analyses (with optional filters)
// Query params:
//   analysisType - filter by analysis type
//   limit        - max rows (default 100)
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()
    const sp = request.nextUrl.searchParams
    const analysisType = sp.get('analysisType')
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 1000)

    let rows
    if (analysisType) {
      rows = await rawQuery<{
        cacheKey: string
        analysisType: string
        provider: string
        createdAt: string
        resultLength: number
      }>(
        `SELECT cacheKey, analysisType, provider, createdAt, LENGTH(result) as resultLength
         FROM CachedAnalysis
         WHERE analysisType = ?
         ORDER BY createdAt DESC
         LIMIT ?`,
        [analysisType, String(limit)]
      )
    } else {
      rows = await rawQuery<{
        cacheKey: string
        analysisType: string
        provider: string
        createdAt: string
        resultLength: number
      }>(
        `SELECT cacheKey, analysisType, provider, createdAt, LENGTH(result) as resultLength
         FROM CachedAnalysis
         ORDER BY createdAt DESC
         LIMIT ?`,
        [String(limit)]
      )
    }

    // Summary stats
    const stats = await rawQuery<{ count: number; types: number }>(
      `SELECT COUNT(*) as count, COUNT(DISTINCT analysisType) as types FROM CachedAnalysis`
    )

    return NextResponse.json({
      cachedAnalyses: rows,
      total: rows.length,
      totalCount: stats[0]?.count || 0,
      totalTypes: stats[0]?.types || 0,
    })
  } catch (error) {
    console.error('[Admin Cache] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch cache', error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/cache — Clear cached analyses
// Body:
//   { "all": true }                              — clear ALL cached analyses
//   { "analysisType": "overall" }                — clear all caches for a specific type
//   { "cacheKey": "abc123..." }                  — clear a specific cache entry
//   { "olderThanDays": 30 }                      — clear entries older than N days
export async function DELETE(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()
    const body = await request.json().catch(() => ({}))
    let deletedCount = 0
    let whereClause = ''
    const params: string[] = []

    if (body.all === true) {
      // Clear everything
      const countResult = await rawQuery<{ count: number }>(`SELECT COUNT(*) as count FROM CachedAnalysis`)
      deletedCount = countResult[0]?.count || 0
      await rawExecute(`DELETE FROM CachedAnalysis`)
      // Also clear DeviceUsage so users can re-run analyses without hitting "limit reached"
      await rawExecute(`DELETE FROM DeviceUsage`)
      return NextResponse.json({
        message: 'Cleared ALL cached analyses + device usage records',
        deletedCount,
      })
    } else if (body.analysisType) {
      // Clear by analysis type
      const countResult = await rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM CachedAnalysis WHERE analysisType = ?`,
        [body.analysisType]
      )
      deletedCount = countResult[0]?.count || 0
      await rawExecute(
        `DELETE FROM CachedAnalysis WHERE analysisType = ?`,
        [body.analysisType]
      )
      await rawExecute(
        `DELETE FROM DeviceUsage WHERE analysisType = ?`,
        [body.analysisType]
      )
      return NextResponse.json({
        message: `Cleared ${deletedCount} cached analyses for type: ${body.analysisType}`,
        deletedCount,
        analysisType: body.analysisType,
      })
    } else if (body.cacheKey) {
      // Clear a specific cache entry
      const countResult = await rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM CachedAnalysis WHERE cacheKey = ?`,
        [body.cacheKey]
      )
      deletedCount = countResult[0]?.count || 0
      await rawExecute(
        `DELETE FROM CachedAnalysis WHERE cacheKey = ?`,
        [body.cacheKey]
      )
      await rawExecute(
        `DELETE FROM DeviceUsage WHERE cacheKey = ?`,
        [body.cacheKey]
      )
      return NextResponse.json({
        message: `Cleared ${deletedCount} cache entries for key: ${body.cacheKey.substring(0, 16)}…`,
        deletedCount,
        cacheKey: body.cacheKey,
      })
    } else if (typeof body.olderThanDays === 'number') {
      // Clear entries older than N days
      const days = body.olderThanDays
      const countResult = await rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM CachedAnalysis WHERE createdAt < datetime('now', ?)`,
        [`-${days} days`]
      )
      deletedCount = countResult[0]?.count || 0
      await rawExecute(
        `DELETE FROM CachedAnalysis WHERE createdAt < datetime('now', ?)`,
        [`-${days} days`]
      )
      await rawExecute(
        `DELETE FROM DeviceUsage WHERE createdAt < datetime('now', ?)`,
        [`-${days} days`]
      )
      return NextResponse.json({
        message: `Cleared ${deletedCount} cache entries older than ${days} days`,
        deletedCount,
        olderThanDays: days,
      })
    } else {
      return NextResponse.json(
        { detail: 'Provide one of: { all: true }, { analysisType: "..." }, { cacheKey: "..." }, or { olderThanDays: N }' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Admin Cache] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to clear cache', error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
