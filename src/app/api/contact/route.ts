import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { initDb, rawExecute } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, message } = body as { name: string; email: string; message: string }

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Rate limiting: check message length to prevent spam
    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 })
    }

    await initDb()

    // Save the contact message to the database
    const id = `cm_${Date.now()}_${randomUUID().substring(0, 8)}`
    await rawExecute(
      `INSERT INTO ContactMessage (id, name, email, message, isRead, createdAt) VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      [id, name.trim(), email.trim().toLowerCase(), message.trim()]
    )

    console.log('[CONTACT] New message saved:', {
      id,
      name: name.trim(),
      email: email.trim(),
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message. We will get back to you soon!',
    })
  } catch (error) {
    console.error('[CONTACT] Error processing contact form:', error)
    return NextResponse.json({ error: 'Failed to process your message' }, { status: 500 })
  }
}
