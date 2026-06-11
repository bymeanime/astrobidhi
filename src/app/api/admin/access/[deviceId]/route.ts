import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/access/[deviceId] — Check access for a specific device
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

    const grants = await rawQuery<{
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

    // Filter to active (non-expired) grants
    const now = new Date().toISOString()
    const activeGrants = grants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    // Determine effective access level
    let effectiveAccess: 'none' | 'premium' | 'unlimited' = 'none'
    for (const g of activeGrants) {
      if (g.accessLevel === 'unlimited') {
        effectiveAccess = 'unlimited'
        break // unlimited is the highest
      }
      if (g.accessLevel === 'premium' && effectiveAccess === 'none') {
        effectiveAccess = 'premium'
      }
    }

    return NextResponse.json({
      deviceId,
      hasAccess: effectiveAccess !== 'none',
      accessLevel: effectiveAccess,
      grants: grants.map(g => ({
        ...g,
        isExpired: g.expiresAt ? new Date(g.expiresAt).toISOString() < now : false,
      })),
      activeGrants: activeGrants.map(g => ({
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

// DELETE /api/admin/access/[deviceId] — Revoke access for a device
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

    // Check if grant exists
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )

    if (existing.length === 0) {
      return NextResponse.json({ detail: 'No access grant found for this device' }, { status: 404 })
    }

    // Delete all grants for this device
    const deleted = await rawExecute(
      `DELETE FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )

    return NextResponse.json({
      message: 'Access revoked',
      deviceId,
      grantsRemoved: deleted,
    })
  } catch (error) {
    console.error('[Admin Access] DELETE device error:', error)
    return NextResponse.json(
      { detail: 'Failed to revoke access', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
