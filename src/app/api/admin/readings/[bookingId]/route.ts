import { NextRequest, NextResponse } from 'next/server'
import { initDb, rawQuery, rawExecute } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/admin-auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()
    const { bookingId } = await params
    const body = await request.json()

    // Check booking exists
    const existing = await rawQuery('SELECT id FROM ReadingBooking WHERE id = ?', [bookingId])
    if (existing.length === 0) {
      return NextResponse.json({ detail: 'Booking not found' }, { status: 404 })
    }

    const updates: string[] = []
    const args: unknown[] = []

    if (body.status && ['pending', 'confirmed', 'scheduled', 'completed', 'cancelled'].includes(body.status)) {
      updates.push('status = ?')
      args.push(body.status)
      if (body.status === 'completed') {
        updates.push('completedAt = CURRENT_TIMESTAMP')
      }
    }
    if (body.astrologerId !== undefined) {
      updates.push('astrologerId = ?')
      args.push(body.astrologerId || null)
    }
    if (body.scheduledAt !== undefined) {
      updates.push('scheduledAt = ?')
      args.push(body.scheduledAt || null)
    }
    if (body.meetingLink !== undefined) {
      updates.push('meetingLink = ?')
      args.push(body.meetingLink || null)
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?')
      args.push(body.notes || null)
    }
    if (body.paidAt !== undefined) {
      updates.push('paidAt = ?')
      args.push(body.paidAt || null)
    }
    if (body.paymentRef !== undefined) {
      updates.push('paymentRef = ?')
      args.push(body.paymentRef || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ detail: 'No valid fields to update' }, { status: 400 })
    }

    updates.push('updatedAt = CURRENT_TIMESTAMP')
    args.push(bookingId)

    await rawExecute(
      `UPDATE ReadingBooking SET ${updates.join(', ')} WHERE id = ?`,
      args
    )

    return NextResponse.json({ message: 'Booking updated successfully' })
  } catch (error) {
    console.error('[Admin Readings Update] Error:', error)
    return NextResponse.json({ detail: 'Failed to update booking' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    if (!await verifyAdminRequest(request)) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    await initDb()
    const { bookingId } = await params

    await rawExecute('DELETE FROM ReadingBooking WHERE id = ?', [bookingId])
    return NextResponse.json({ message: 'Booking deleted' })
  } catch (error) {
    console.error('[Admin Readings Delete] Error:', error)
    return NextResponse.json({ detail: 'Failed to delete booking' }, { status: 500 })
  }
}
