import { Metadata } from 'next'
import { rawQuery, initDb } from '@/lib/db'

// Maps analysis type keys to readable labels — kept in sync with page.tsx
const ANALYSIS_LABELS: Record<string, string> = {
  overall: 'Overall Reading',
  career: 'Career & Profession',
  relationships: 'Love & Marriage',
  health: 'Health & Wellness',
  finance: 'Wealth & Finance',
  spiritual: 'Spiritual Growth',
  dasa: 'Dasa Periods',
  horary: 'Horary (Prasna)',
  swot_5year: '5-Year SWOT Forecast',
  cosmic_blueprint: 'Cosmic Blueprint',
  shadow_integration: 'Shadow Integration',
}

interface ShareLayoutProps {
  children: React.ReactNode
  params: Promise<{ shareId: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const { shareId } = await params

  // Default fallback metadata
  let title = 'Vedic Birth Chart Reading - AstroBidhi'
  let description = 'View this Vedic astrology birth chart with AI-powered analysis on AstroBidhi'
  let analysisLabel = 'Vedic Birth Chart'

  try {
    await initDb()

    const results = await rawQuery<{
      id: string
      shareId: string
      chartParams: string
      analysisType: string | null
      includeAnalysis: number
    }>(
      `SELECT id, shareId, chartParams, analysisType, includeAnalysis FROM SharedChart WHERE shareId = ?`,
      [shareId]
    )

    if (results && results.length > 0) {
      const shared = results[0]

      // Parse chartParams to extract birth details
      let birthDetails: Record<string, unknown> = {}
      try {
        birthDetails = JSON.parse(shared.chartParams)
      } catch {}

      // Build a human-readable description from birth details
      const year = birthDetails.year as number | undefined
      const month = birthDetails.month as number | undefined
      const day = birthDetails.day as number | undefined
      const lat = birthDetails.latitude as number | undefined
      const lng = birthDetails.longitude as number | undefined

      const dateStr = year && month && day
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : ''
      const locationStr = lat != null && lng != null
        ? `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`
        : ''

      // Determine analysis type label
      if (shared.analysisType && ANALYSIS_LABELS[shared.analysisType]) {
        analysisLabel = ANALYSIS_LABELS[shared.analysisType]
      } else if (shared.analysisType) {
        analysisLabel = shared.analysisType
      }

      // Build title and description
      title = `${analysisLabel} - Vedic Birth Chart Reading - AstroBidhi`

      const parts: string[] = []
      if (shared.includeAnalysis) {
        parts.push(`View this ${analysisLabel} Vedic astrology birth chart with AI-powered analysis`)
      } else {
        parts.push('View this Vedic astrology birth chart')
      }
      if (dateStr) parts.push(`born ${dateStr}`)
      if (locationStr) parts.push(`at ${locationStr}`)
      parts.push('on AstroBidhi')
      description = parts.join(' ')
    }
  } catch (error) {
    console.error('[Share Layout] Failed to fetch metadata:', error instanceof Error ? error.message : error)
  }

  const url = `/share/${shareId}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      siteName: 'AstroBidhi',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function ShareLayout({ children }: ShareLayoutProps) {
  return children
}
