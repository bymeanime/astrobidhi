import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/catalog — List all catalog items
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()

    const items = await rawQuery<{
      id: string
      analysisType: string
      name: string
      description: string | null
      priceCents: number
      originalPriceCents: number | null
      isActive: number
      sortOrder: number
      createdAt: string
    }>(
      `SELECT id, analysisType, name, description, priceCents, originalPriceCents, isActive, sortOrder, createdAt FROM PremiumCatalog ORDER BY sortOrder ASC, createdAt ASC`
    )

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('[Admin Catalog] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch catalog items', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/catalog — Create new catalog item
export async function POST(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { analysisType, name, description, priceCents, originalPriceCents, isActive, sortOrder } = body

    if (!analysisType || !name) {
      return NextResponse.json({ detail: 'analysisType and name are required' }, { status: 400 })
    }

    if (typeof priceCents !== 'number' || priceCents < 0) {
      return NextResponse.json({ detail: 'priceCents must be a non-negative number' }, { status: 400 })
    }

    await initDb()

    // Check for duplicate analysisType
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM PremiumCatalog WHERE analysisType = ?`,
      [analysisType]
    )
    if (existing.length > 0) {
      return NextResponse.json({ detail: `Catalog item with analysisType '${analysisType}' already exists` }, { status: 409 })
    }

    const id = randomUUID()
    const effectiveIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1
    const effectiveSortOrder = sortOrder || 0
    const effectiveOriginalPriceCents = originalPriceCents || null

    await rawExecute(
      `INSERT INTO PremiumCatalog (id, analysisType, name, description, priceCents, originalPriceCents, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, analysisType, name, description || null, priceCents, effectiveOriginalPriceCents, effectiveIsActive, effectiveSortOrder]
    )

    return NextResponse.json({
      message: 'Catalog item created',
      id,
      analysisType,
      name,
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin Catalog] POST error:', error)
    return NextResponse.json(
      { detail: 'Failed to create catalog item', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
