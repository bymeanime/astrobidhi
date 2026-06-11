import { NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

export async function GET() {
  try {
    await initDb()

    // Get reading tier catalog items
    const tiers = await rawQuery<{
      analysisType: string; name: string; description: string | null;
      priceCents: number; originalPriceCents: number | null; isActive: number;
    }>("SELECT analysisType, name, description, priceCents, originalPriceCents, isActive FROM PremiumCatalog WHERE analysisType LIKE 'reading_%' AND isActive = 1 ORDER BY sortOrder ASC")

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
