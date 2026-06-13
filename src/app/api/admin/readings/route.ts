import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let bookings
    if (status && ['pending', 'confirmed', 'scheduled', 'completed', 'cancelled'].includes(status)) {
      bookings = await rawQuery<{
        id: string; bookingRef: string; tier: string; customerName: string; customerEmail: string;
        customerPhone: string | null; birthDate: string | null; birthTime: string | null; birthCity: string | null;
        questions: string | null; focusAreas: string | null; preferredLanguage: string;
        status: string; scheduledAt: string | null; completedAt: string | null;
        meetingLink: string | null; notes: string | null;
        priceCents: number; paidAt: string | null; paymentRef: string | null;
        astrologerId: string | null; deviceId: string | null;
        createdAt: string; updatedAt: string;
      }>('SELECT * FROM ReadingBooking WHERE status = ? ORDER BY createdAt DESC', [status])
    } else {
      bookings = await rawQuery<{
        id: string; bookingRef: string; tier: string; customerName: string; customerEmail: string;
        customerPhone: string | null; birthDate: string | null; birthTime: string | null; birthCity: string | null;
        questions: string | null; focusAreas: string | null; preferredLanguage: string;
        status: string; scheduledAt: string | null; completedAt: string | null;
        meetingLink: string | null; notes: string | null;
        priceCents: number; paidAt: string | null; paymentRef: string | null;
        astrologerId: string | null; deviceId: string | null;
        createdAt: string; updatedAt: string;
      }>('SELECT * FROM ReadingBooking ORDER BY createdAt DESC')
    }

    // Get astrologer names for assigned bookings
    const astrologerIds = [...new Set(bookings.filter(b => b.astrologerId).map(b => b.astrologerId!))]
    const astrologerMap: Record<string, { name: string; title: string | null }> = {}
    for (const aId of astrologerIds) {
      const astrologers = await rawQuery<{ name: string; title: string | null }>('SELECT name, title FROM Astrologer WHERE id = ?', [aId])
      if (astrologers.length > 0) astrologerMap[aId] = astrologers[0]
    }

    return NextResponse.json({
      bookings: bookings.map(b => ({
        ...b,
        astrologerName: b.astrologerId ? astrologerMap[b.astrologerId]?.name || null : null,
        astrologerTitle: b.astrologerId ? astrologerMap[b.astrologerId]?.title || null : null,
      })),
    })
  } catch (error) {
    console.error('[Admin Readings] Error:', error)
    return NextResponse.json({ detail: 'Failed to fetch bookings' }, { status: 500 })
  }
}
