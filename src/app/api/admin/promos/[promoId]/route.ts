import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// PUT /api/admin/promos/[promoId] — Update promo code
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { promoId } = await params
    if (!promoId) {
      return NextResponse.json({ detail: 'promoId is required' }, { status: 400 })
    }

    const body = await request.json()
    await initDb()

    // Check if promo exists
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM PromoCode WHERE id = ?`,
      [promoId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Promo code not found' }, { status: 404 })
    }

    // Build update dynamically based on provided fields
    const updates: string[] = []
    const values: unknown[] = []

    if (body.code !== undefined) { updates.push('code = ?'); values.push(body.code) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.type !== undefined) { updates.push('type = ?'); values.push(body.type) }
    if (body.value !== undefined) { updates.push('value = ?'); values.push(body.value) }
    if (body.applicableType !== undefined) { updates.push('applicableType = ?'); values.push(body.applicableType) }
    if (body.applicableItems !== undefined) { updates.push('applicableItems = ?'); values.push(JSON.stringify(body.applicableItems)) }
    if (body.maxUses !== undefined) { updates.push('maxUses = ?'); values.push(body.maxUses) }
    if (body.validFrom !== undefined) { updates.push('validFrom = ?'); values.push(body.validFrom) }
    if (body.validUntil !== undefined) { updates.push('validUntil = ?'); values.push(body.validUntil) }
    if (body.isActive !== undefined) { updates.push('isActive = ?'); values.push(body.isActive ? 1 : 0) }

    if (updates.length === 0) {
      return NextResponse.json({ detail: 'No fields to update' }, { status: 400 })
    }

    values.push(promoId)
    await rawExecute(
      `UPDATE PromoCode SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return NextResponse.json({
      message: 'Promo code updated',
      promoId,
      updatedFields: updates.map(u => u.split(' = ')[0]),
    })
  } catch (error) {
    console.error('[Admin Promos] PUT error:', error)
    return NextResponse.json(
      { detail: 'Failed to update promo code', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/promos/[promoId] — Delete promo code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { promoId } = await params
    if (!promoId) {
      return NextResponse.json({ detail: 'promoId is required' }, { status: 400 })
    }

    await initDb()

    // Check if promo exists
    const existing = await rawQuery<{ id: string; code: string }>(
      `SELECT id, code FROM PromoCode WHERE id = ?`,
      [promoId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Promo code not found' }, { status: 404 })
    }

    // Delete promo code
    await rawExecute(
      `DELETE FROM PromoCode WHERE id = ?`,
      [promoId]
    )

    return NextResponse.json({
      message: 'Promo code deleted',
      promoId,
      code: existing[0].code,
    })
  } catch (error) {
    console.error('[Admin Promos] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to delete promo code', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
