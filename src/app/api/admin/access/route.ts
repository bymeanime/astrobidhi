import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/access — List all access grants (both legacy and new)
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
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
      `SELECT id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt FROM UserAccess ORDER BY createdAt DESC`
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
      `SELECT id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt FROM DeviceAccess ORDER BY createdAt DESC`
    )

    // Filter out expired grants for display clarity (mark them)
    const now = new Date().toISOString()
    const enrichedLegacy = legacyGrants.map(g => ({
      ...g,
      isExpired: g.expiresAt ? new Date(g.expiresAt).toISOString() < now : false,
      system: 'legacy' as const,
    }))

    const enrichedDeviceAccess = deviceAccessGrants.map(g => ({
      ...g,
      isExpired: g.expiresAt ? new Date(g.expiresAt).toISOString() < now : false,
      system: 'granular' as const,
    }))

    return NextResponse.json({
      grants: enrichedLegacy,
      deviceAccessGrants: enrichedDeviceAccess,
      total: enrichedLegacy.length + enrichedDeviceAccess.length,
      active: enrichedLegacy.filter(g => !g.isExpired).length + enrichedDeviceAccess.filter(g => !g.isExpired).length,
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
// Supports both legacy format (accessLevel) and new granular format (analysisTypes array)
export async function POST(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { deviceId, accessLevel, analysisTypes, source, sourceRef, reason, expiresAt, grantedBy } = body

    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required' }, { status: 400 })
    }

    await initDb()

    const effectiveGrantedBy = grantedBy || 'admin'
    const effectiveReason = reason || null
    const effectiveExpiresAt = expiresAt || null

    // === LEGACY FORMAT: accessLevel ===
    if (accessLevel && !analysisTypes) {
      if (!['premium', 'unlimited'].includes(accessLevel)) {
        return NextResponse.json({ detail: 'accessLevel must be "premium" or "unlimited"' }, { status: 400 })
      }

      // Also create granular DeviceAccess entries for backward compat
      const effectiveAccessLevel = accessLevel

      // Check if this device already has an active legacy grant
      const existing = await rawQuery<{ id: string; accessLevel: string; expiresAt: string | null }>(
        `SELECT id, accessLevel, expiresAt FROM UserAccess WHERE deviceId = ?`,
        [deviceId]
      )

      const now = new Date().toISOString()
      const activeExisting = existing.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

      if (activeExisting.length > 0) {
        // Update the existing active grant
        const existingId = activeExisting[0].id
        await rawExecute(
          `UPDATE UserAccess SET accessLevel = ?, grantedBy = ?, reason = ?, expiresAt = ? WHERE id = ?`,
          [effectiveAccessLevel, effectiveGrantedBy, effectiveReason, effectiveExpiresAt, existingId]
        )
      } else {
        // Create new legacy grant
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
          const nowTs = new Date().toISOString().replace('T', ' ').substring(0, 19)
          await rawExecute(
            `INSERT INTO UserAccess (id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, deviceId, effectiveAccessLevel, effectiveGrantedBy, effectiveReason, effectiveExpiresAt, nowTs]
          )
        }
      }

      // Also create DeviceAccess entry for the new system
      const daId = randomUUID()
      await rawExecute(
        `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [daId, deviceId, effectiveAccessLevel === 'unlimited' ? 'unlimited' : 'all_premium', 'admin_grant', null, effectiveGrantedBy, effectiveReason, effectiveExpiresAt]
      )

      return NextResponse.json({
        message: 'Access granted (legacy + granular)',
        deviceId,
        accessLevel: effectiveAccessLevel,
        grantedBy: effectiveGrantedBy,
        reason: effectiveReason,
        expiresAt: effectiveExpiresAt,
      })
    }

    // === GRANULAR FORMAT: analysisTypes array ===
    if (analysisTypes && Array.isArray(analysisTypes) && analysisTypes.length > 0) {
      const effectiveSource = source || 'admin_grant'
      const effectiveSourceRef = sourceRef || null

      const created: string[] = []
      for (const analysisType of analysisTypes) {
        // Check if this specific grant already exists
        const existingGrant = await rawQuery<{ id: string }>(
          `SELECT id FROM DeviceAccess WHERE deviceId = ? AND analysisType = ?`,
          [deviceId, analysisType]
        )

        if (existingGrant.length > 0) {
          // Update existing grant
          await rawExecute(
            `UPDATE DeviceAccess SET source = ?, sourceRef = ?, grantedBy = ?, reason = ?, expiresAt = ? WHERE id = ?`,
            [effectiveSource, effectiveSourceRef, effectiveGrantedBy, effectiveReason, effectiveExpiresAt, existingGrant[0].id]
          )
        } else {
          // Create new grant
          const id = randomUUID()
          await rawExecute(
            `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, deviceId, analysisType, effectiveSource, effectiveSourceRef, effectiveGrantedBy, effectiveReason, effectiveExpiresAt]
          )
        }
        created.push(analysisType)
      }

      return NextResponse.json({
        message: 'Granular access granted',
        deviceId,
        analysisTypes: created,
        source: effectiveSource,
        sourceRef: effectiveSourceRef,
        grantedBy: effectiveGrantedBy,
        reason: effectiveReason,
        expiresAt: effectiveExpiresAt,
      })
    }

    return NextResponse.json({ detail: 'Provide either accessLevel (legacy) or analysisTypes array (granular)' }, { status: 400 })
  } catch (error) {
    console.error('[Admin Access] POST error:', error)
    return NextResponse.json(
      { detail: 'Failed to grant access', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
