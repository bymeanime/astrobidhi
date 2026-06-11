import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

// GET /api/access?deviceId=xxx — Check if current device has premium access
// This is a public endpoint that users call to check their own access status
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId')
    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    // Get all grants for this device
    const grants = await rawQuery<{
      id: string
      accessLevel: string
      grantedBy: string
      reason: string | null
      expiresAt: string | null
      createdAt: string
    }>(
      `SELECT id, accessLevel, grantedBy, reason, expiresAt, createdAt FROM UserAccess WHERE deviceId = ? ORDER BY createdAt DESC`,
      [deviceId]
    )

    // Filter to active (non-expired) grants
    const now = new Date().toISOString()
    const activeGrants = grants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    // Determine effective access level
    let effectiveAccess: 'none' | 'premium' | 'unlimited' = 'none'
    let grantReason: string | null = null
    let grantExpiresAt: string | null = null

    for (const g of activeGrants) {
      if (g.accessLevel === 'unlimited') {
        effectiveAccess = 'unlimited'
        grantReason = g.reason
        grantExpiresAt = g.expiresAt
        break // unlimited is the highest
      }
      if (g.accessLevel === 'premium' && effectiveAccess === 'none') {
        effectiveAccess = 'premium'
        grantReason = g.reason
        grantExpiresAt = g.expiresAt
      }
    }

    return NextResponse.json({
      deviceId,
      hasAccess: effectiveAccess !== 'none',
      accessLevel: effectiveAccess,
      reason: grantReason,
      expiresAt: grantExpiresAt,
      // Don't expose internal grant details to users
    })
  } catch (error) {
    console.error('[Access] GET error:', error)
    // Return no-access on error rather than 500, so UI degrades gracefully
    return NextResponse.json({
      hasAccess: false,
      accessLevel: 'none',
      reason: null,
      expiresAt: null,
    })
  }
}
