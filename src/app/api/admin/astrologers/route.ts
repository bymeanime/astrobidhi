import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery, rawExecute } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()

    const astrologers = await rawQuery<{
      id: string; name: string; title: string | null; bio: string | null;
      specialties: string; experienceYears: number; qualifications: string | null;
      languages: string; rating: number; reviewCount: number; photoUrl: string | null;
      isAvailable: number; sortOrder: number; createdAt: string;
    }>('SELECT * FROM Astrologer ORDER BY sortOrder ASC, name ASC')

    return NextResponse.json({ astrologers })
  } catch (error) {
    console.error('[Admin Astrologers] Error:', error)
    return NextResponse.json({ detail: 'Failed to fetch astrologers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ detail: 'Astrologer name is required' }, { status: 400 })
    }

    const id = randomUUID()
    await rawExecute(
      `INSERT INTO Astrologer (id, name, title, bio, specialties, experienceYears, qualifications, languages, rating, reviewCount, photoUrl, isAvailable, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.name.trim(),
        body.title?.trim() || null,
        body.bio?.trim() || null,
        body.specialties || 'vedic_reading',
        body.experienceYears || 0,
        body.qualifications?.trim() || null,
        body.languages || 'English,Hindi',
        body.rating || 0,
        body.reviewCount || 0,
        body.photoUrl?.trim() || null,
        body.isAvailable !== false ? 1 : 0,
        body.sortOrder || 0,
      ]
    )

    return NextResponse.json({ id, message: 'Astrologer added successfully' }, { status: 201 })
  } catch (error) {
    console.error('[Admin Astrologers Create] Error:', error)
    return NextResponse.json({ detail: 'Failed to add astrologer' }, { status: 500 })
  }
}
