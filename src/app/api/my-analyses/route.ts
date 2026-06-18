import { NextRequest, NextResponse } from 'next/server'
import { rawQuery, initDb } from '@/lib/db'
import { decodeSession, type WhopSession } from '@/lib/whop'

function getSession(request: NextRequest): WhopSession | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  return decodeSession(cookie)
}

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ detail: 'Authentication required. Please log in via Whop.' }, { status: 401 })
  }

  try {
    await initDb()

    // Get all analyses for this Whop user, joined with CachedAnalysis for the actual results
    const analyses = await rawQuery<{
      id: string
      analysisType: string
      cacheKey: string
      birthDetails: string
      createdAt: string
      result: string | null
      provider: string | null
      cachedCreatedAt: string | null
    }>(
      `SELECT
        ua.id, ua.analysisType, ua.cacheKey, ua.birthDetails, ua.createdAt,
        ca.result, ca.provider, ca.createdAt as cachedCreatedAt
      FROM UserAnalysis ua
      LEFT JOIN CachedAnalysis ca ON ua.cacheKey = ca.cacheKey
      WHERE ua.whopUserId = ?
      ORDER BY ua.createdAt DESC
      LIMIT 100`,
      [session.userId]
    )

    // Group by birthDetails to show charts with their analyses
    const chartGroups: Record<string, {
      birthDetails: Record<string, unknown>
      analyses: Array<{
        id: string
        type: string
        cacheKey: string
        createdAt: string
        hasResult: boolean
        provider: string | null
      }>
    }> = {}

    for (const row of analyses) {
      let bd: Record<string, unknown>
      try {
        bd = JSON.parse(row.birthDetails)
      } catch {
        bd = { raw: row.birthDetails }
      }

      // Create a grouping key from birth details
      const groupKey = `${bd.year}-${bd.month}-${bd.day}-${bd.hour}-${bd.minute}-${bd.latitude}-${bd.longitude}`

      if (!chartGroups[groupKey]) {
        chartGroups[groupKey] = {
          birthDetails: bd,
          analyses: [],
        }
      }

      chartGroups[groupKey].analyses.push({
        id: row.id,
        type: row.analysisType,
        cacheKey: row.cacheKey,
        createdAt: row.createdAt,
        hasResult: !!row.result,
        provider: row.provider,
      })
    }

    return NextResponse.json({
      userId: session.userId,
      userName: session.name,
      totalAnalyses: analyses.length,
      charts: Object.values(chartGroups),
    })
  } catch (error) {
    console.error('[My Analyses] Error:', error)
    return NextResponse.json({
      userId: session?.userId,
      totalAnalyses: 0,
      charts: [],
      _error: error instanceof Error ? error.message : 'Failed to fetch analyses',
    }, { status: 200 })
  }
}

// POST: Link past device analyses to Whop account
export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { deviceId } = body

    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    // Get all DeviceUsage records for this device
    const deviceUsages = await rawQuery<{
      analysisType: string
      cacheKey: string
      createdAt: string
    }>(
      `SELECT analysisType, cacheKey, createdAt FROM DeviceUsage WHERE deviceId = ?`,
      [deviceId]
    )

    // Get cached analysis data for birth details
    // Guard against empty deviceUsages which would produce invalid SQL
    let cachedAnalyses: { cacheKey: string; chartData: string; analysisType: string }[] = []
    if (deviceUsages.length > 0) {
      cachedAnalyses = await rawQuery<{
        cacheKey: string
        chartData: string
        analysisType: string
      }>(
        `SELECT cacheKey, chartData, analysisType FROM CachedAnalysis WHERE cacheKey IN (${deviceUsages.map(() => '?').join(',')})`,
        deviceUsages.map(u => u.cacheKey)
      )
    }

    // Create chartData lookup
    const chartDataMap = new Map(cachedAnalyses.map(c => [c.cacheKey, c.chartData]))

    let linked = 0
    for (const usage of deviceUsages) {
      // Check if this analysis is already linked
      const existing = await rawQuery<{ id: string }>(
        `SELECT id FROM UserAnalysis WHERE whopUserId = ? AND cacheKey = ? AND analysisType = ?`,
        [session.userId, usage.cacheKey, usage.analysisType]
      )

      if (existing.length > 0) continue

      // Extract birth details from chart data
      const chartData = chartDataMap.get(usage.cacheKey)
      let birthDetails = '{}'
      if (chartData) {
        try {
          // Parse the compressed chart data to extract birth info
          const lines = chartData.split('\n')
          const bd: Record<string, string> = {}
          for (const line of lines) {
            if (line.startsWith('Birth:')) bd.birthLine = line.replace('Birth: ', '')
            if (line.startsWith('Location:')) bd.locationLine = line.replace('Location: ', '')
          }
          birthDetails = JSON.stringify(bd)
        } catch {
          birthDetails = JSON.stringify({ cacheKey: usage.cacheKey })
        }
      }

      // Create UserAnalysis record
      await rawExecute(
        `INSERT INTO UserAnalysis (id, whopUserId, analysisType, cacheKey, birthDetails, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [`ua_${Date.now()}_${linked}`, session.userId, usage.analysisType, usage.cacheKey, birthDetails, usage.createdAt]
      )
      linked++
    }

    // Update UserAccount with primary device
    const existingAccount = await rawQuery<{ id: string }>(
      `SELECT id FROM UserAccount WHERE whopUserId = ?`,
      [session.userId]
    )

    if (existingAccount.length > 0) {
      await rawExecute(
        `UPDATE UserAccount SET primaryDeviceId = ?, updatedAt = CURRENT_TIMESTAMP WHERE whopUserId = ?`,
        [deviceId, session.userId]
      )
    } else {
      await rawExecute(
        `INSERT INTO UserAccount (id, whopUserId, name, email, picture, primaryDeviceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`ua_${Date.now()}`, session.userId, session.name, session.email || '', session.picture || '', deviceId]
      )
    }

    return NextResponse.json({ success: true, linked, total: deviceUsages.length })
  } catch (error) {
    console.error('[My Analyses] Link error:', error)
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Failed to link analyses' }, { status: 500 })
  }
}
