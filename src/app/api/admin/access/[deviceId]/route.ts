import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/access/[deviceId] — Check access for a specific device (both legacy and new)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { deviceId } = await params
    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    // Legacy UserAccess grants
    const legacyGrants = await rawQuery<{
      id: string
      deviceId: string
      accessLevel: string
      grantedBy: string
      reason: string | null
      expiresAt: string | null
      createdAt: string
    }>(
      `SELECT id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt FROM UserAccess WHERE deviceId = ? ORDER BY createdAt DESC`,
      [deviceId]
    )

    // New DeviceAccess grants
    const deviceAccessGrants = await rawQuery<{
      id: string
      deviceId: string
      analysisType: string
      source: string
      sourceRef: string | null
      grantedBy: string
      reason: string | null
      expiresAt: string | null
      createdAt: string
    }>(
      `SELECT id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt FROM DeviceAccess WHERE deviceId = ? ORDER BY createdAt DESC`,
      [deviceId]
    )

    // Filter to active (non-expired) grants
    const now = new Date().toISOString()
    const activeLegacyGrants = legacyGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)
    const activeDeviceAccessGrants = deviceAccessGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    // Determine effective access level from legacy
    let effectiveAccess: 'none' | 'premium' | 'unlimited' = 'none'
    for (const g of activeLegacyGrants) {
      if (g.accessLevel === 'unlimited') {
        effectiveAccess = 'unlimited'
        break
      }
      if (g.accessLevel === 'premium' && effectiveAccess === 'none') {
        effectiveAccess = 'premium'
      }
    }

    // Determine granular access from DeviceAccess
    const grantedTypes = activeDeviceAccessGrants.map(g => g.analysisType)
    const allPremiumAccess = grantedTypes.includes('all_premium')
    const unlimitedAccess = grantedTypes.includes('unlimited')

    return NextResponse.json({
      deviceId,
      hasAccess: effectiveAccess !== 'none' || activeDeviceAccessGrants.length > 0,
      accessLevel: effectiveAccess,
      grantedTypes,
      allPremiumAccess,
      unlimitedAccess,
      legacyGrants: legacyGrants.map(g => ({
        ...g,
        isExpired: g.expiresAt ? new Date(g.expiresAt).toISOString() < now : false,
      })),
      activeLegacyGrants: activeLegacyGrants.map(g => ({
        ...g,
        isExpired: false,
      })),
      deviceAccessGrants: deviceAccessGrants.map(g => ({
        ...g,
        isExpired: g.expiresAt ? new Date(g.expiresAt).toISOString() < now : false,
      })),
      activeDeviceAccessGrants: activeDeviceAccessGrants.map(g => ({
        ...g,
        isExpired: false,
      })),
    })
  } catch (error) {
    console.error('[Admin Access] GET device error:', error)
    return NextResponse.json(
      { detail: 'Failed to check access', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/access/[deviceId] — Revoke access for a device (both legacy and new)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { deviceId } = await params
    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    // Check if any grants exist
    const existingLegacy = await rawQuery<{ id: string }>(
      `SELECT id FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )
    const existingDeviceAccess = await rawQuery<{ id: string }>(
      `SELECT id FROM DeviceAccess WHERE deviceId = ?`,
      [deviceId]
    )

    if (existingLegacy.length === 0 && existingDeviceAccess.length === 0) {
      return NextResponse.json({ detail: 'No access grants found for this device' }, { status: 404 })
    }

    // Delete all grants for this device from both tables
    const deletedLegacy = await rawExecute(
      `DELETE FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )
    const deletedDeviceAccess = await rawExecute(
      `DELETE FROM DeviceAccess WHERE deviceId = ?`,
      [deviceId]
    )

    return NextResponse.json({
      message: 'Access revoked',
      deviceId,
      legacyGrantsRemoved: deletedLegacy,
      deviceAccessGrantsRemoved: deletedDeviceAccess,
    })
  } catch (error) {
    console.error('[Admin Access] DELETE device error:', error)
    return NextResponse.json(
      { detail: 'Failed to revoke access', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
