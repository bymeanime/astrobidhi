import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { initDb, rawQuery, rawExecute } from '@/lib/db'

// GET /api/admin/messages — List all contact messages
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `SELECT id, name, email, message, isRead, createdAt FROM ContactMessage`
    const params: (string | number)[] = []

    if (unreadOnly) {
      query += ` WHERE isRead = 0`
    }

    query += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const messages = await rawQuery<{
      id: string
      name: string
      email: string
      message: string
      isRead: number
      createdAt: string
    }>(query, params)

    // Get unread count
    const unreadResult = await rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ContactMessage WHERE isRead = 0`)
    const totalResult = await rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ContactMessage`)

    return NextResponse.json({
      messages,
      unreadCount: unreadResult[0]?.cnt || 0,
      totalCount: totalResult[0]?.cnt || 0,
    })
  } catch (error) {
    console.error('[Admin Messages] GET error:', error)
    return NextResponse.json(
      { detail: 'Failed to fetch messages', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/messages — Delete all read messages
export async function DELETE(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDb()

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    if (all) {
      await rawExecute(`DELETE FROM ContactMessage`)
    } else {
      await rawExecute(`DELETE FROM ContactMessage WHERE isRead = 1`)
    }

    return NextResponse.json({ message: 'Messages deleted' })
  } catch (error) {
    console.error('[Admin Messages] DELETE error:', error)
    return NextResponse.json(
      { detail: 'Failed to delete messages' },
      { status: 500 }
    )
  }
}
