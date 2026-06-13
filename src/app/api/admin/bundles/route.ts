import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/bundles — List all bundles with their items
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()

    const bundles = await rawQuery<{
      id: string
      slug: string
      name: string
      description: string | null
      priceCents: number
      originalPriceCents: number | null
      isActive: number
      sortOrder: number
      createdAt: string
    }>(
      `SELECT id, slug, name, description, priceCents, originalPriceCents, isActive, sortOrder, createdAt FROM ProductBundle ORDER BY sortOrder ASC, createdAt ASC`
    )

    // Fetch items for all bundles
    const bundlesWithItems = await Promise.all(
      bundles.map(async (bundle) => {
        const items = await rawQuery<{
          id: string
          analysisType: string
        }>(
          `SELECT id, analysisType FROM ProductBundleItem WHERE bundleId = ?`,
          [bundle.id]
        )
        return {
          ...bundle,
          items: items.map(i => i.analysisType),
        }
      })
    )

    return NextResponse.json({ bundles: bundlesWithItems, total: bundlesWithItems.length })
  } catch (error) {
    console.error('[Admin Bundles] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch bundles', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/bundles — Create bundle with items
export async function POST(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { slug, name, description, priceCents, originalPriceCents, items, isActive, sortOrder } = body

    if (!slug || !name) {
      return NextResponse.json({ detail: 'slug and name are required' }, { status: 400 })
    }

    if (typeof priceCents !== 'number' || priceCents < 0) {
      return NextResponse.json({ detail: 'priceCents must be a non-negative number' }, { status: 400 })
    }

    await initDb()

    // Check for duplicate slug
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM ProductBundle WHERE slug = ?`,
      [slug]
    )
    if (existing.length > 0) {
      return NextResponse.json({ detail: `Bundle with slug '${slug}' already exists` }, { status: 409 })
    }

    const bundleId = randomUUID()
    const effectiveIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1
    const effectiveSortOrder = sortOrder || 0
    const effectiveOriginalPriceCents = originalPriceCents || null

    await rawExecute(
      `INSERT INTO ProductBundle (id, slug, name, description, priceCents, originalPriceCents, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bundleId, slug, name, description || null, priceCents, effectiveOriginalPriceCents, effectiveIsActive, effectiveSortOrder]
    )

    // Insert bundle items
    const itemTypes: string[] = Array.isArray(items) ? items : []
    for (const analysisType of itemTypes) {
      const itemId = randomUUID()
      await rawExecute(
        `INSERT INTO ProductBundleItem (id, bundleId, analysisType) VALUES (?, ?, ?)`,
        [itemId, bundleId, analysisType]
      )
    }

    return NextResponse.json({
      message: 'Bundle created',
      id: bundleId,
      slug,
      name,
      items: itemTypes,
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin Bundles] POST error:', error)
    return NextResponse.json(
      { detail: 'Failed to create bundle', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
