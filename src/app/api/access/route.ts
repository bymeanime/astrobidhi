import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

// GET /api/access?deviceId=xxx — Check if current device has premium access
// This is a public endpoint that users call to check their own access status
// Now returns granular access information including which premium types are accessible
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId')
    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    // Get legacy UserAccess grants
    const legacyGrants = await rawQuery<{
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

    // Get new DeviceAccess grants
    const deviceAccessGrants = await rawQuery<{
      id: string
      analysisType: string
      source: string
      sourceRef: string | null
      grantedBy: string
      reason: string | null
      expiresAt: string | null
      createdAt: string
    }>(
      `SELECT id, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt FROM DeviceAccess WHERE deviceId = ? ORDER BY createdAt DESC`,
      [deviceId]
    )

    // Filter to active (non-expired) grants
    const now = new Date().toISOString()
    const activeLegacyGrants = legacyGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)
    const activeDeviceAccessGrants = deviceAccessGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    // Determine effective access level from legacy
    let effectiveAccess: 'none' | 'premium' | 'unlimited' = 'none'
    let grantReason: string | null = null
    let grantExpiresAt: string | null = null

    for (const g of activeLegacyGrants) {
      if (g.accessLevel === 'unlimited') {
        effectiveAccess = 'unlimited'
        grantReason = g.reason
        grantExpiresAt = g.expiresAt
        break
      }
      if (g.accessLevel === 'premium' && effectiveAccess === 'none') {
        effectiveAccess = 'premium'
        grantReason = g.reason
        grantExpiresAt = g.expiresAt
      }
    }

    // Determine granular access from DeviceAccess
    const grantedTypes: string[] = []
    let allPremiumAccess = false
    let unlimitedAccess = false

    for (const g of activeDeviceAccessGrants) {
      if (g.analysisType === 'all_premium') {
        allPremiumAccess = true
      } else if (g.analysisType === 'unlimited') {
        unlimitedAccess = true
      } else {
        grantedTypes.push(g.analysisType)
      }
      // Use the first available reason/expiresAt if not set from legacy
      if (!grantReason && g.reason) grantReason = g.reason
      if (!grantExpiresAt && g.expiresAt) grantExpiresAt = g.expiresAt
    }

    // If unlimited from DeviceAccess, also set all premium
    if (unlimitedAccess) allPremiumAccess = true

    // If all premium or unlimited from legacy, also set the flags
    if (effectiveAccess === 'unlimited') {
      unlimitedAccess = true
      allPremiumAccess = true
    } else if (effectiveAccess === 'premium') {
      allPremiumAccess = true
    }

    // Get all active premium types from catalog for complete grantedTypes list
    if (allPremiumAccess || unlimitedAccess) {
      const premiumTypes = await rawQuery<{ analysisType: string }>(
        `SELECT analysisType FROM PremiumCatalog WHERE isActive = 1`
      )
      // Add any premium types not already in grantedTypes
      for (const pt of premiumTypes) {
        if (!grantedTypes.includes(pt.analysisType)) {
          grantedTypes.push(pt.analysisType)
        }
      }
    }

    const hasAccess = effectiveAccess !== 'none' || activeDeviceAccessGrants.length > 0

    return NextResponse.json({
      deviceId,
      hasAccess,
      accessLevel: effectiveAccess,
      grantedTypes,
      allPremiumAccess,
      unlimitedAccess,
      reason: grantReason,
      expiresAt: grantExpiresAt,
    })
  } catch (error) {
    console.error('[Access] GET error:', error)
    // Return no-access on error rather than 500, so UI degrades gracefully
    return NextResponse.json({
      hasAccess: false,
      accessLevel: 'none',
      grantedTypes: [],
      allPremiumAccess: false,
      unlimitedAccess: false,
      reason: null,
      expiresAt: null,
    })
  }
}
