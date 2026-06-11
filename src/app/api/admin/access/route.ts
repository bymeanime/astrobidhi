import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/access — List all access grants
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
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
      `SELECT id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt FROM UserAccess ORDER BY createdAt DESC`
    )

    // Filter out expired grants for display clarity (mark them)
    const now = new Date().toISOString()
    const enriched = grants.map(g => ({
      ...g,
      isExpired: g.expiresAt ? new Date(g.expiresAt).toISOString() < now : false,
    }))

    return NextResponse.json({
      grants: enriched,
      total: enriched.length,
      active: enriched.filter(g => !g.isExpired).length,
    })
  } catch (error) {
    console.error('[Admin Access] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch access grants', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/access — Grant access to a device
export async function POST(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { deviceId, accessLevel, reason, expiresAt, grantedBy } = body

    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    if (accessLevel && !['premium', 'unlimited'].includes(accessLevel)) {
      return NextResponse.json({ detail: 'accessLevel must be "premium" or "unlimited"' }, { status: 400 })
    }

    const effectiveAccessLevel = accessLevel || 'premium'
    const effectiveGrantedBy = grantedBy || 'admin'
    const effectiveReason = reason || null
    const effectiveExpiresAt = expiresAt || null // NULL = never expires

    await initDb()

    // Check if this device already has an active grant
    const existing = await rawQuery<{ id: string; accessLevel: string; expiresAt: string | null }>(
      `SELECT id, accessLevel, expiresAt FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )

    // Filter to non-expired grants
    const now = new Date().toISOString()
    const activeExisting = existing.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    if (activeExisting.length > 0) {
      // Update the existing active grant
      const existingId = activeExisting[0].id
      await rawExecute(
        `UPDATE UserAccess SET accessLevel = ?, grantedBy = ?, reason = ?, expiresAt = ? WHERE id = ?`,
        [effectiveAccessLevel, effectiveGrantedBy, effectiveReason, effectiveExpiresAt, existingId]
      )

      return NextResponse.json({
        message: 'Access grant updated',
        id: existingId,
        deviceId,
        accessLevel: effectiveAccessLevel,
        grantedBy: effectiveGrantedBy,
        reason: effectiveReason,
        expiresAt: effectiveExpiresAt,
        updated: true,
      })
    }

    // Create new grant
    const id = randomUUID()
    await rawExecute(
      `INSERT INTO UserAccess (id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, deviceId, effectiveAccessLevel, effectiveGrantedBy, effectiveReason, effectiveExpiresAt]
    )

    // Verify write
    const verifyRows = await rawQuery<{ id: string }>(
      `SELECT id FROM UserAccess WHERE id = ?`,
      [id]
    )
    if (verifyRows.length === 0) {
      // Retry with explicit timestamp
      const nowTs = new Date().toISOString().replace('T', ' ').substring(0, 19)
      await rawExecute(
        `INSERT INTO UserAccess (id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, deviceId, effectiveAccessLevel, effectiveGrantedBy, effectiveReason, effectiveExpiresAt, nowTs]
      )
    }

    return NextResponse.json({
      message: 'Access granted',
      id,
      deviceId,
      accessLevel: effectiveAccessLevel,
      grantedBy: effectiveGrantedBy,
      reason: effectiveReason,
      expiresAt: effectiveExpiresAt,
      created: true,
    })
  } catch (error) {
    console.error('[Admin Access] POST error:', error)
    return NextResponse.json(
      { detail: 'Failed to grant access', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
