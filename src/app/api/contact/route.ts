import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, message } = body as { name: string; email: string; message: string }

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Log the contact form submission (in production, you'd send an email or save to DB)
    console.log('[CONTACT] New message:', {
      name,
      email,
      message: message.substring(0, 200),
      timestamp: new Date().toISOString(),
    })

    // For now, just acknowledge receipt
    // In production, integrate with an email service (SendGrid, Resend, etc.)
    return NextResponse.json({ success: true, message: 'Thank you for your message. We will get back to you soon!' })
  } catch (error) {
    console.error('[CONTACT] Error processing contact form:', error)
    return NextResponse.json({ error: 'Failed to process your message' }, { status: 500 })
  }
}
