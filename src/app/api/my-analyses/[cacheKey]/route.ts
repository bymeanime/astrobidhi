import { NextRequest, NextResponse } from 'next/server'
import { rawQuery, initDb } from '@/lib/db'

interface WhopSession {
  userId: string
  name: string
  email: string
  picture: string
  hasAccess: boolean
  accessLevel: string
}

function getSession(request: NextRequest): WhopSession | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  try {
    return JSON.parse(Buffer.from(cookie, 'base64').toString()) as WhopSession
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ cacheKey: string }> }) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  }

  const { cacheKey } = await params

  try {
    await initDb()

    // Verify this analysis belongs to the user
    const userAnalysis = await rawQuery<{ id: string; analysisType: string; birthDetails: string; createdAt: string }>(
      `SELECT id, analysisType, birthDetails, createdAt FROM UserAnalysis WHERE whopUserId = ? AND cacheKey = ?`,
      [session.userId, cacheKey]
    )

    if (userAnalysis.length === 0) {
      return NextResponse.json({ detail: 'Analysis not found or access denied.' }, { status: 404 })
    }

    // Get the cached analysis result
    const cached = await rawQuery<{
      analysisType: string
      chartData: string
      result: string
      provider: string
      createdAt: string
    }>(
      `SELECT analysisType, chartData, result, provider, createdAt FROM CachedAnalysis WHERE cacheKey = ?`,
      [cacheKey]
    )

    if (cached.length === 0) {
      return NextResponse.json({ detail: 'Cached result expired. Please regenerate.' }, { status: 404 })
    }

    return NextResponse.json({
      analysisType: cached[0].analysisType,
      chartData: cached[0].chartData,
      result: cached[0].result,
      provider: cached[0].provider,
      cachedAt: cached[0].createdAt,
      birthDetails: userAnalysis[0].birthDetails,
      userAnalysisCreatedAt: userAnalysis[0].createdAt,
      cached: true,
    })
  } catch (error) {
    console.error('[My Analyses] Fetch error:', error)
    return NextResponse.json({ detail: 'Failed to fetch analysis' }, { status: 500 })
  }
}
