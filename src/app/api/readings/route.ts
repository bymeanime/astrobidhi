import { NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

// UI metadata for reading tiers — keeps rich display data (features, colors, badges)
// separate from database prices, so admin can change prices without touching code
const TIER_UI_META: Record<string, {
  duration: string
  questions: string
  features: string[]
  highlight: string | null
  badge: string | null
  color: string
  borderColor: string
}> = {
  reading_basic: {
    duration: '30 min',
    questions: '1 question',
    features: [
      'Basic Dasa analysis',
      'Simple remedies',
      'Birth chart overview',
      'Email summary included',
    ],
    highlight: null,
    badge: null,
    color: 'from-saffron/10 to-temple-bg',
    borderColor: 'border-saffron/30',
  },
  reading_standard: {
    duration: '45 min',
    questions: '3 questions',
    features: [
      'Detailed Dasa + transit analysis',
      'Gemstone recommendations',
      'Nakshatra deep dive',
      'Priority scheduling',
      'Recording included',
    ],
    highlight: null,
    badge: null,
    color: 'from-gold/10 to-temple-bg',
    borderColor: 'border-gold/30',
  },
  reading_premium: {
    duration: '60 min',
    questions: '5 questions',
    features: [
      'Full Dasa-bhukti analysis',
      'Kundali matching included',
      'Complete remedies protocol',
      'Yoga identification & timing',
      'Priority scheduling',
      'Recording + transcript',
    ],
    highlight: 'Most comprehensive value for serious seekers',
    badge: 'POPULAR',
    color: 'from-maroon/10 to-temple-bg',
    borderColor: 'border-maroon/40',
  },
  reading_ultimate: {
    duration: '90 min',
    questions: 'Unlimited questions',
    features: [
      'Deep dive into every area of life',
      'Full Kundali + Navamsha analysis',
      'Ashtakvarga scoring',
      'Year-by-year predictions',
      '30-day follow-up support',
      'Personalized remedy kit guide',
      'Priority scheduling',
      'Recording + transcript + PDF report',
    ],
    highlight: 'The most thorough reading we offer',
    badge: 'BEST VALUE',
    color: 'from-temple-red/10 to-temple-bg',
    borderColor: 'border-temple-red/40',
  },
}

export async function GET() {
  try {
    await initDb()

    // Get reading tier catalog items from database
    const dbTiers = await rawQuery<{
      analysisType: string; name: string; description: string | null;
      priceCents: number; originalPriceCents: number | null; isActive: number;
    }>("SELECT analysisType, name, description, priceCents, originalPriceCents, isActive FROM PremiumCatalog WHERE analysisType LIKE 'reading_%' AND isActive = 1 ORDER BY sortOrder ASC")

    // Merge database prices with UI metadata
    const tiers = dbTiers.map(tier => {
      const meta = TIER_UI_META[tier.analysisType] || {
        duration: '30 min',
        questions: '1 question',
        features: tier.description ? [tier.description] : [],
        highlight: null,
        badge: null,
        color: 'from-saffron/10 to-temple-bg',
        borderColor: 'border-saffron/30',
      }
      return {
        id: tier.analysisType.replace('reading_', ''), // "basic", "standard", etc.
        analysisType: tier.analysisType,
        name: tier.name,
        description: tier.description,
        price: tier.priceCents / 100,        // Convert cents to dollars
        originalPrice: (tier.originalPriceCents || tier.priceCents) / 100,
        duration: meta.duration,
        questions: meta.questions,
        features: meta.features,
        highlight: meta.highlight,
        badge: meta.badge,
        color: meta.color,
        borderColor: meta.borderColor,
      }
    })

    // Get available astrologers
    const astrologers = await rawQuery<{
      id: string; name: string; title: string | null; bio: string | null;
      specialties: string; experienceYears: number; qualifications: string | null;
      languages: string; rating: number; reviewCount: number; photoUrl: string | null;
    }>('SELECT id, name, title, bio, specialties, experienceYears, qualifications, languages, rating, reviewCount, photoUrl FROM Astrologer WHERE isAvailable = 1 ORDER BY rating DESC, reviewCount DESC')

    return NextResponse.json({ tiers, astrologers })
  } catch (error) {
    console.error('[Readings] Error:', error)
    return NextResponse.json({ tiers: [], astrologers: [] })
  }
}
