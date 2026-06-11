import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery, rawExecute } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/admin-auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ astrologerId: string }> }) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()
    const { astrologerId } = await params
    const body = await request.json()

    const existing = await rawQuery('SELECT id FROM Astrologer WHERE id = ?', [astrologerId])
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Astrologer not found' }, { status: 404 })
    }

    const updates: string[] = []
    const args: unknown[] = []

    const allowedFields = ['name', 'title', 'bio', 'specialties', 'experienceYears', 'qualifications', 'languages', 'rating', 'reviewCount', 'photoUrl', 'sortOrder']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        args.push(body[field])
      }
    }
    if (body.isAvailable !== undefined) {
      updates.push('isAvailable = ?')
      args.push(body.isAvailable ? 1 : 0)
    }

    if (updates.length === 0) {
      return NextResponse.json({ detail: 'No valid fields to update' }, { status: 400 })
    }

    args.push(astrologerId)
    await rawExecute(`UPDATE Astrologer SET ${updates.join(', ')} WHERE id = ?`, args)

    return NextResponse.json({ message: 'Astrologer updated successfully' })
  } catch (error) {
    console.error('[Admin Astrologers Update] Error:', error)
    return NextResponse.json({ detail: 'Failed to update astrologer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ astrologerId: string }> }) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()
    const { astrologerId } = await params

    // Unassign from any bookings first
    await rawExecute('UPDATE ReadingBooking SET astrologerId = NULL WHERE astrologerId = ?', [astrologerId])
    await rawExecute('DELETE FROM Astrologer WHERE id = ?', [astrologerId])

    return NextResponse.json({ message: 'Astrologer deleted and unassigned from bookings' })
  } catch (error) {
    console.error('[Admin Astrologers Delete] Error:', error)
    return NextResponse.json({ detail: 'Failed to delete astrologer' }, { status: 500 })
  }
}
