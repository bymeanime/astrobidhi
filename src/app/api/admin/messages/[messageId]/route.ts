import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawExecute } from '@/lib/db'

// PATCH /api/admin/messages/[messageId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { messageId } = await params
    await initDb()

    const body = await request.json() as { isRead?: boolean }
    const isRead = body.isRead !== false ? 1 : 0

    await rawExecute(
      'UPDATE ContactMessage SET isRead = ? WHERE id = ?',
      [isRead, messageId]
    )

    return NextResponse.json({ message: 'Message updated', messageId, isRead })
  } catch (error) {
    console.error('[Admin Messages] PATCH error:', error)
    return NextResponse.json(
      { detail: 'Failed to update message' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/messages/[messageId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { messageId } = await params
    await initDb()

    await rawExecute(
      'DELETE FROM ContactMessage WHERE id = ?',
      [messageId]
    )

    return NextResponse.json({ message: 'Message deleted', messageId })
  } catch (error) {
    console.error('[Admin Messages] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to delete message' },
      { status: 500 }
    )
  }
}
