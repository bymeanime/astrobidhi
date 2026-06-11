import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// PUT /api/admin/bundles/[bundleId] — Update bundle and its items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { bundleId } = await params
    if (!bundleId) {
      return NextResponse.json({ detail: 'bundleId is required' }, { status: 400 })
    }

    const body = await request.json()
    await initDb()

    // Check if bundle exists
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM ProductBundle WHERE id = ?`,
      [bundleId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Bundle not found' }, { status: 404 })
    }

    // Build update dynamically based on provided fields
    const updates: string[] = []
    const values: unknown[] = []

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
    if (body.slug !== undefined) { updates.push('slug = ?'); values.push(body.slug) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.priceCents !== undefined) { updates.push('priceCents = ?'); values.push(body.priceCents) }
    if (body.originalPriceCents !== undefined) { updates.push('originalPriceCents = ?'); values.push(body.originalPriceCents) }
    if (body.isActive !== undefined) { updates.push('isActive = ?'); values.push(body.isActive ? 1 : 0) }
    if (body.sortOrder !== undefined) { updates.push('sortOrder = ?'); values.push(body.sortOrder) }

    if (updates.length > 0) {
      values.push(bundleId)
      await rawExecute(
        `UPDATE ProductBundle SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    // If items array is provided, replace all bundle items
    if (Array.isArray(body.items)) {
      // Delete existing items
      await rawExecute(
        `DELETE FROM ProductBundleItem WHERE bundleId = ?`,
        [bundleId]
      )
      // Insert new items
      for (const analysisType of body.items) {
        const itemId = randomUUID()
        await rawExecute(
          `INSERT INTO ProductBundleItem (id, bundleId, analysisType) VALUES (?, ?, ?)`,
          [itemId, bundleId, analysisType]
        )
      }
    }

    return NextResponse.json({
      message: 'Bundle updated',
      bundleId,
      updatedFields: updates.map(u => u.split(' = ')[0]),
      itemsUpdated: Array.isArray(body.items),
    })
  } catch (error) {
    console.error('[Admin Bundles] PUT error:', error)
    return NextResponse.json(
      { detail: 'Failed to update bundle', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/bundles/[bundleId] — Delete bundle and its items
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { bundleId } = await params
    if (!bundleId) {
      return NextResponse.json({ detail: 'bundleId is required' }, { status: 400 })
    }

    await initDb()

    // Check if bundle exists
    const existing = await rawQuery<{ id: string; name: string }>(
      `SELECT id, name FROM ProductBundle WHERE id = ?`,
      [bundleId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Bundle not found' }, { status: 404 })
    }

    // Delete bundle items first
    await rawExecute(
      `DELETE FROM ProductBundleItem WHERE bundleId = ?`,
      [bundleId]
    )

    // Delete bundle
    await rawExecute(
      `DELETE FROM ProductBundle WHERE id = ?`,
      [bundleId]
    )

    return NextResponse.json({
      message: 'Bundle deleted',
      bundleId,
    })
  } catch (error) {
    console.error('[Admin Bundles] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to delete bundle', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
