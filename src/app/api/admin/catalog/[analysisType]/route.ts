import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// PUT /api/admin/catalog/[analysisType] — Update catalog item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ analysisType: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { analysisType } = await params
    if (!analysisType) {
      return NextResponse.json({ detail: 'analysisType is required' }, { status: 400 })
    }

    const body = await request.json()
    await initDb()

    // Check if catalog item exists
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM PremiumCatalog WHERE analysisType = ?`,
      [analysisType]
    )
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Catalog item not found' }, { status: 404 })
    }

    // Build update dynamically based on provided fields
    const updates: string[] = []
    const values: unknown[] = []

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.priceCents !== undefined) { updates.push('priceCents = ?'); values.push(body.priceCents) }
    if (body.originalPriceCents !== undefined) { updates.push('originalPriceCents = ?'); values.push(body.originalPriceCents) }
    if (body.isActive !== undefined) { updates.push('isActive = ?'); values.push(body.isActive ? 1 : 0) }
    if (body.sortOrder !== undefined) { updates.push('sortOrder = ?'); values.push(body.sortOrder) }

    if (updates.length === 0) {
      return NextResponse.json({ detail: 'No fields to update' }, { status: 400 })
    }

    values.push(analysisType)
    await rawExecute(
      `UPDATE PremiumCatalog SET ${updates.join(', ')} WHERE analysisType = ?`,
      values
    )

    return NextResponse.json({
      message: 'Catalog item updated',
      analysisType,
      updatedFields: updates.map(u => u.split(' = ')[0]),
    })
  } catch (error) {
    console.error('[Admin Catalog] PUT error:', error)
    return NextResponse.json(
      { detail: 'Failed to update catalog item', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/catalog/[analysisType] — Delete catalog item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ analysisType: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { analysisType } = await params
    if (!analysisType) {
      return NextResponse.json({ detail: 'analysisType is required' }, { status: 400 })
    }

    await initDb()

    // Check if catalog item exists
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM PremiumCatalog WHERE analysisType = ?`,
      [analysisType]
    )
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Catalog item not found' }, { status: 404 })
    }

    // Also remove from any bundle items
    await rawExecute(
      `DELETE FROM ProductBundleItem WHERE analysisType = ?`,
      [analysisType]
    )

    // Delete catalog item
    await rawExecute(
      `DELETE FROM PremiumCatalog WHERE analysisType = ?`,
      [analysisType]
    )

    return NextResponse.json({
      message: 'Catalog item deleted',
      analysisType,
    })
  } catch (error) {
    console.error('[Admin Catalog] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to delete catalog item', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
