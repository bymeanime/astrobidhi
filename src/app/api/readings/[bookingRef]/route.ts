import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ bookingRef: string }> }) {
  try {
    await initDb()
    const { bookingRef } = await params

    const bookings = await rawQuery<{
      id: string; bookingRef: string; tier: string; customerName: string; customerEmail: string;
      customerPhone: string | null; birthDate: string | null; birthTime: string | null; birthCity: string | null;
      status: string; scheduledAt: string | null; meetingLink: string | null; priceCents: number;
      createdAt: string; updatedAt: string; astrologerId: string | null;
    }>('SELECT * FROM ReadingBooking WHERE bookingRef = ?', [bookingRef])

    if (bookings.length === 0) {
      return NextResponse.json({ detail: 'Booking not found' }, { status: 404 })
    }

    const booking = bookings[0]

    // If astrologer is assigned, get their info
    let astrologer = null
    if (booking.astrologerId) {
      const astrologers = await rawQuery<{
        name: string; title: string | null; languages: string; rating: number;
      }>('SELECT name, title, languages, rating FROM Astrologer WHERE id = ?', [booking.astrologerId])
      if (astrologers.length > 0) astrologer = astrologers[0]
    }

    return NextResponse.json({
      bookingRef: booking.bookingRef,
      tier: booking.tier,
      customerName: booking.customerName,
      status: booking.status,
      scheduledAt: booking.scheduledAt,
      meetingLink: booking.meetingLink,
      priceCents: booking.priceCents,
      astrologer,
      createdAt: booking.createdAt,
    })
  } catch (error) {
    console.error('[Readings Status] Error:', error)
    return NextResponse.json({ detail: 'Failed to fetch booking status' }, { status: 500 })
  }
}
