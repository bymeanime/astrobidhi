import { NextRequest, NextResponse } from 'next/server'
import { verifyLsWebhookSignature, processLsWebhookEvent, isLsConfigured } from '@/lib/lemonsqueezy'

// POST /api/lemonsqueezy/webhook
// Lemon Squeezy webhook handler.
//
// LS sends events when subscriptions are created, renewed, cancelled, etc.
// Each request is signed with HMAC-SHA256 in the X-Signature header using
// the webhook secret you configured in the LS dashboard.
//
// This route:
//   1. Reads the raw body (Next.js gives us this via request.text())
//   2. Verifies the signature against LEMONSQUEEZY_WEBHOOK_SECRET
//   3. Processes the event (upserts LsSubscription, grants/revokes device access)
//   4. Returns 200 OK (LS retries on non-2xx)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!isLsConfigured()) {
    return NextResponse.json({ detail: 'Lemon Squeezy not configured' }, { status: 503 })
  }

  // Get the signature from the header
  const signature = request.headers.get('x-signature') || ''
  if (!signature) {
    console.warn('[LS Webhook] Missing X-Signature header')
    return NextResponse.json({ detail: 'Missing signature' }, { status: 401 })
  }

  // Read the raw body — must be the exact bytes LS signed
  const rawBody = await request.text()

  // Verify signature
  if (!verifyLsWebhookSignature(rawBody, signature)) {
    console.warn('[LS Webhook] Invalid signature')
    return NextResponse.json({ detail: 'Invalid signature' }, { status: 401 })
  }

  // Process the event
  try {
    const result = await processLsWebhookEvent(rawBody)
    if (!result.handled) {
      console.warn(`[LS Webhook] Event not handled: ${result.eventName}`)
      // Still return 200 so LS doesn't retry — we got it, we just don't care
      return NextResponse.json({ received: true, handled: false, event: result.eventName })
    }
    console.log(`[LS Webhook] Handled ${result.eventName} for subscription ${result.subscriptionId}`)
    return NextResponse.json({ received: true, handled: true, event: result.eventName, subscriptionId: result.subscriptionId })
  } catch (err) {
    console.error('[LS Webhook] Processing error:', err)
    // Return 500 so LS retries
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

// GET /api/lemonsqueezy/webhook — health check
export async function GET() {
  return NextResponse.json({
    configured: isLsConfigured(),
    message: isLsConfigured()
      ? 'Lemon Squeezy webhook endpoint is ready. Configure your webhook URL in the LS dashboard to receive events.'
      : 'Lemon Squeezy not configured.',
  })
}
