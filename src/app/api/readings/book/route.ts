import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery, rawExecute } from '@/lib/db'
import { randomUUID } from 'crypto'

// Generate a human-readable booking reference like RD-2024-XXXX
function generateBookingRef(): string {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = ''
  for (let i = 0; i < 4; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return `RD-${year}-${ref}`
}

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()

    const { tier, customerName, customerEmail, customerPhone, birthDate, birthTime, birthCity, birthLat, birthLng, birthUtc, questions, focusAreas, preferredLanguage, deviceId } = body

    // Validate required fields
    if (!tier) {
      return NextResponse.json({ detail: 'Invalid reading tier selected' }, { status: 400 })
    }
    if (!customerName || !customerEmail) {
      return NextResponse.json({ detail: 'Name and email are required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ detail: 'Please provide a valid email address' }, { status: 400 })
    }

    // Look up price from PremiumCatalog (single source of truth)
    const catalogEntry = await rawQuery<{ priceCents: number; isActive: number }>(
      'SELECT priceCents, isActive FROM PremiumCatalog WHERE analysisType = ?',
      [tier]
    )

    if (catalogEntry.length === 0 || !catalogEntry[0]) {
      return NextResponse.json({ detail: `Invalid reading tier: '${tier}'. This tier does not exist in the catalog.` }, { status: 400 })
    }

    if (!catalogEntry[0].isActive) {
      return NextResponse.json({ detail: `This reading tier is currently unavailable. Please select a different tier.` }, { status: 400 })
    }

    const priceCents = catalogEntry[0].priceCents

    const id = randomUUID()
    let bookingRef = generateBookingRef()

    // Ensure bookingRef is unique
    let attempts = 0
    while (attempts < 5) {
      const existing = await rawQuery('SELECT id FROM ReadingBooking WHERE bookingRef = ?', [bookingRef])
      if (existing.length === 0) break
      bookingRef = generateBookingRef()
      attempts++
    }

    await rawExecute(
      `INSERT INTO ReadingBooking (id, bookingRef, tier, customerName, customerEmail, customerPhone, birthDate, birthTime, birthCity, birthLat, birthLng, birthUtc, questions, focusAreas, preferredLanguage, status, priceCents, deviceId, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)`,
      [id, bookingRef, tier, customerName.trim(), customerEmail.trim().toLowerCase(), customerPhone || null, birthDate || null, birthTime || null, birthCity || null, birthLat || null, birthLng || null, birthUtc || null, questions || null, focusAreas || null, preferredLanguage || 'English', priceCents, deviceId || null]
    )

    return NextResponse.json({
      bookingRef,
      tier,
      customerEmail,
      priceCents,
      message: `Your reading has been booked! Reference: ${bookingRef}. We will contact you at ${customerEmail} to confirm your session.`,
    }, { status: 201 })
  } catch (error) {
    console.error('[Readings Book] Error:', error)
    return NextResponse.json({ detail: 'Failed to create booking. Please try again.' }, { status: 500 })
  }
}
