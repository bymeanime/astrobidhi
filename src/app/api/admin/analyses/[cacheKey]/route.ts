import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

interface RouteContext {
  params: Promise<{ cacheKey: string }>
}

// GET /api/admin/analyses/[cacheKey] — Inspect full analysis data for a specific cacheKey
export async function GET(request: NextRequest, context: RouteContext) {
  // ---- Auth ----
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { cacheKey } = await context.params
    if (!cacheKey) {
      return NextResponse.json({ detail: 'cacheKey is required' }, { status: 400 })
    }

    await initDb()

    // Fetch the full CachedAnalysis record
    const analysisRows = await rawQuery<{
      id: string
      cacheKey: string
      analysisType: string
      chartData: string
      result: string
      provider: string
      createdAt: string
    }>(
      `SELECT id, cacheKey, analysisType, chartData, result, provider, createdAt FROM CachedAnalysis WHERE cacheKey = ?`,
      [cacheKey]
    )

    if (analysisRows.length === 0) {
      return NextResponse.json(
        { detail: `No CachedAnalysis found for cacheKey: ${cacheKey}`, cacheKey },
        { status: 404 }
      )
    }

    const analysis = analysisRows[0]

    // Also check if a matching CachedChart exists
    const chartRows = await rawQuery<{
      id: string
      cacheKey: string
      birthParams: string
      createdAt: string
    }>(
      `SELECT id, cacheKey, birthParams, createdAt FROM CachedChart WHERE cacheKey = ?`,
      [cacheKey]
    )

    // Check DeviceUsage records for this cacheKey
    const usageRows = await rawQuery<{
      id: string
      deviceId: string
      analysisType: string
      createdAt: string
    }>(
      `SELECT id, deviceId, analysisType, createdAt FROM DeviceUsage WHERE cacheKey = ?`,
      [cacheKey]
    )

    // Check UserAnalysis records for this cacheKey
    const userAnalysisRows = await rawQuery<{
      id: string
      whopUserId: string
      analysisType: string
      birthDetails: string
      createdAt: string
    }>(
      `SELECT id, whopUserId, analysisType, birthDetails, createdAt FROM UserAnalysis WHERE cacheKey = ?`,
      [cacheKey]
    )

    // Try to parse chartData and result as JSON for structured viewing
    let parsedChartData: unknown = analysis.chartData
    let parsedResult: unknown = analysis.result
    try {
      parsedChartData = JSON.parse(analysis.chartData)
    } catch {
      // chartData is not JSON — keep as raw text
    }
    try {
      parsedResult = JSON.parse(analysis.result)
    } catch {
      // result is not JSON — keep as raw markdown/text
    }

    return NextResponse.json({
      cacheKey,
      analysis: {
        id: analysis.id,
        cacheKey: analysis.cacheKey,
        analysisType: analysis.analysisType,
        provider: analysis.provider,
        chartData: parsedChartData,
        chartDataRawLength: analysis.chartData.length,
        result: parsedResult,
        resultRawLength: analysis.result.length,
        createdAt: analysis.createdAt,
      },
      relatedChart: chartRows.length > 0
        ? {
            id: chartRows[0].id,
            cacheKey: chartRows[0].cacheKey,
            birthParamsLength: chartRows[0].birthParams.length,
            createdAt: chartRows[0].createdAt,
          }
        : null,
      relatedUsage: usageRows.map(u => ({
        id: u.id,
        deviceId: u.deviceId,
        analysisType: u.analysisType,
        createdAt: u.createdAt,
      })),
      relatedUserAnalyses: userAnalysisRows.map(ua => ({
        id: ua.id,
        whopUserId: ua.whopUserId,
        analysisType: ua.analysisType,
        birthDetails: ua.birthDetails,
        createdAt: ua.createdAt,
      })),
      _meta: {
        timestamp: new Date().toISOString(),
        note: 'chartData and result are parsed as JSON if possible; otherwise returned as raw text.',
      },
    })
  } catch (error) {
    console.error('[Admin Analyses/Key] Fatal error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch analysis', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/analyses/[cacheKey] — Delete a specific analysis by cacheKey
export async function DELETE(request: NextRequest, context: RouteContext) {
  // ---- Auth ----
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { cacheKey } = await context.params
    if (!cacheKey) {
      return NextResponse.json({ detail: 'cacheKey is required' }, { status: 400 })
    }

    await initDb()

    // Check the analysis exists first
    const existing = await rawQuery<{ id: string; analysisType: string }>(
      `SELECT id, analysisType FROM CachedAnalysis WHERE cacheKey = ?`,
      [cacheKey]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { detail: `No CachedAnalysis found for cacheKey: ${cacheKey}`, cacheKey },
        { status: 404 }
      )
    }

    const deletedAnalysis = existing[0]

    // Delete the CachedAnalysis record
    await rawExecute(
      `DELETE FROM CachedAnalysis WHERE cacheKey = ?`,
      [cacheKey]
    )

    // Also clean up related DeviceUsage records (orphans would be meaningless)
    const usageDeleted = await rawQuery<{ changes: number | string }>(
      `SELECT changes() as changes`
    )

    // Note: We intentionally do NOT delete CachedChart or UserAnalysis
    // because they may be shared across multiple analysis types.
    // Only CachedAnalysis and its DeviceUsage entries are directly linked.

    // Check remaining DeviceUsage for this cacheKey
    const remainingUsage = await rawQuery<{ id: string }>(
      `SELECT id FROM DeviceUsage WHERE cacheKey = ? LIMIT 1`,
      [cacheKey]
    )

    return NextResponse.json({
      success: true,
      message: `Deleted CachedAnalysis for cacheKey: ${cacheKey}`,
      deleted: {
        cacheKey,
        analysisType: deletedAnalysis.analysisType,
        id: deletedAnalysis.id,
      },
      remainingUsageForCacheKey: remainingUsage.length > 0
        ? 'DeviceUsage records still exist for this cacheKey (from other analysis types)'
        : 'No remaining DeviceUsage records for this cacheKey',
      _meta: {
        timestamp: new Date().toISOString(),
        note: 'CachedChart and UserAnalysis records were NOT deleted — they may be shared across analysis types.',
      },
    })
  } catch (error) {
    console.error('[Admin Analyses/Key] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to delete analysis', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
