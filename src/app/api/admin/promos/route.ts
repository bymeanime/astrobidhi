import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/promos — List all promo codes
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()

    const promos = await rawQuery<{
      id: string
      code: string
      description: string | null
      type: string
      value: number
      applicableType: string
      applicableItems: string | null
      maxUses: number | null
      useCount: number
      validFrom: string | null
      validUntil: string | null
      isActive: number
      createdAt: string
    }>(
      `SELECT id, code, description, type, value, applicableType, applicableItems, maxUses, useCount, validFrom, validUntil, isActive, createdAt FROM PromoCode ORDER BY createdAt DESC`
    )

    // Parse applicableItems JSON
    const enriched = promos.map(p => ({
      ...p,
      applicableItems: p.applicableItems ? JSON.parse(p.applicableItems) : null,
      isActive: p.isActive === 1,
    }))

    return NextResponse.json({ promos: enriched, total: enriched.length })
  } catch (error) {
    console.error('[Admin Promos] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch promo codes', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/promos — Create promo code
export async function POST(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { code, description, type, value, applicableType, applicableItems, maxUses, validFrom, validUntil, isActive } = body

    if (!code) {
      return NextResponse.json({ detail: 'code is required' }, { status: 400 })
    }

    const effectiveType = type || 'percent_off'
    const effectiveValue = value || 0
    const effectiveApplicableType = applicableType || 'all'

    if (!['percent_off', 'fixed_off', 'free_access'].includes(effectiveType)) {
      return NextResponse.json({ detail: 'type must be "percent_off", "fixed_off", or "free_access"' }, { status: 400 })
    }

    if (!['all', 'specific', 'bundle'].includes(effectiveApplicableType)) {
      return NextResponse.json({ detail: 'applicableType must be "all", "specific", or "bundle"' }, { status: 400 })
    }

    await initDb()

    // Check for duplicate code
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM PromoCode WHERE code = ?`,
      [code]
    )
    if (existing.length > 0) {
      return NextResponse.json({ detail: `Promo code '${code}' already exists` }, { status: 409 })
    }

    const id = randomUUID()
    const effectiveIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1
    const effectiveApplicableItems = applicableItems ? JSON.stringify(applicableItems) : null
    const effectiveMaxUses = maxUses !== undefined ? maxUses : null
    const effectiveValidFrom = validFrom || null
    const effectiveValidUntil = validUntil || null

    await rawExecute(
      `INSERT INTO PromoCode (id, code, description, type, value, applicableType, applicableItems, maxUses, useCount, validFrom, validUntil, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, code, description || null, effectiveType, effectiveValue, effectiveApplicableType, effectiveApplicableItems, effectiveMaxUses, effectiveValidFrom, effectiveValidUntil, effectiveIsActive]
    )

    return NextResponse.json({
      message: 'Promo code created',
      id,
      code,
      type: effectiveType,
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin Promos] POST error:', error)
    return NextResponse.json(
      { detail: 'Failed to create promo code', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
