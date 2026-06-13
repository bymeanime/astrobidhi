import { NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

// GET /api/catalog — Public endpoint for the frontend
// Returns active catalog items and active bundles (no auth required)
export async function GET() {
  try {
    await initDb()

    // Get active catalog items
    const catalogItems = await rawQuery<{
      id: string
      analysisType: string
      name: string
      description: string | null
      priceCents: number
      originalPriceCents: number | null
      sortOrder: number
    }>(
      `SELECT id, analysisType, name, description, priceCents, originalPriceCents, sortOrder FROM PremiumCatalog WHERE isActive = 1 ORDER BY sortOrder ASC`
    )

    // Get active bundles
    const bundles = await rawQuery<{
      id: string
      slug: string
      name: string
      description: string | null
      priceCents: number
      originalPriceCents: number | null
      sortOrder: number
    }>(
      `SELECT id, slug, name, description, priceCents, originalPriceCents, sortOrder FROM ProductBundle WHERE isActive = 1 ORDER BY sortOrder ASC`
    )

    // Fetch items for each bundle
    const bundlesWithItems = await Promise.all(
      bundles.map(async (bundle) => {
        const items = await rawQuery<{
          analysisType: string
        }>(
          `SELECT analysisType FROM ProductBundleItem WHERE bundleId = ?`,
          [bundle.id]
        )
        return {
          ...bundle,
          items: items.map(i => i.analysisType),
        }
      })
    )

    return NextResponse.json({
      catalog: catalogItems,
      bundles: bundlesWithItems,
    })
  } catch (error) {
    console.error('[Catalog] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch catalog', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
