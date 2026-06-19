import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { rawQuery, rawExecute, initDb } from '@/lib/db'
import { sendWhopReceiptEmail } from '@/lib/email'

// POST /api/whop/webhook
// Whop webhook handler.
//
// Whop sends webhook events when subscriptions are created, renewed,
// cancelled, etc. Each request is signed with HMAC-SHA256 in the
// `X-Whop-Signature` header using your Webhook Endpoint Secret
// (different from your API key — find it in your Whop developer dashboard
// under Webhooks).
//
// When configured, this endpoint:
//   1. Verifies the signature
//   2. Stores subscription status in a WhopSubscription table (so we don't
//      have to call Whop's API on every /api/auth/me request to check access)
//   3. Grants/revokes DeviceAccess rows tied to the user's primary device
//      (if known)
//   4. Sends a branded receipt email via Resend (optional)
//
// To enable:
//   1. Go to https://whop.com/dashboard/developer/webhooks
//   2. Create a webhook endpoint pointing to:
//        https://YOUR-DEPLOYMENT-URL/api/whop/webhook
//   3. Subscribe to events: subscription.created, subscription.updated,
//      subscription.cancelled, subscription.deleted, membership.created,
//      membership.updated, membership.deleted
//   4. Copy the Webhook Endpoint Secret
//   5. Set it as WHOP_WEBHOOK_SECRET in your .env
//
// Why this is better than polling:
//   - /api/auth/me no longer needs to call Whop's API on every request
//     (it can read subscription status from our DB instead)
//   - Subscription cancellations are detected within seconds (vs up to 1 hour
//     when waiting for the access token to expire)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET || ''
const WHOP_API_KEY = process.env.WHOP_API_KEY || ''
const WHOP_PRODUCT_ID = process.env.WHOP_PRODUCT_ID || ''
const WHOP_COMPANY_ID = process.env.WHOP_COMPANY_ID || ''

/**
 * Verify Whop webhook signature.
 * Whop signs the raw body with HMAC-SHA256 using your webhook endpoint secret.
 * The signature is in the `X-Whop-Signature` header as a hex string.
 */
function verifyWhopSignature(rawBody: string, signature: string): boolean {
  if (!WHOP_WEBHOOK_SECRET || !signature) return false

  try {
    const expected = createHmac('sha256', WHOP_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')

    const a = Buffer.from(signature, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ──────────────────── Whop webhook payload types ────────────────────

interface WhopWebhookEvent {
  id: string
  type: string  // e.g., 'subscription.created', 'membership.updated'
  created_at: string
  data: {
    id: string
    status: string  // 'active', 'past_due', 'canceled', 'expired', etc.
    user: {
      id: string
      username?: string
      email?: string
      profile_pic_url?: string
    }
    product?: {
      id: string
      name: string
    }
    plan?: {
      id: string
      name?: string
      price_cents?: number
      currency?: string
      billing_period?: string
    }
    quantity?: number
    created_at?: string
    expires_at?: string | null
    renew_at?: string | null
  }
}

export async function POST(request: NextRequest) {
  if (!WHOP_WEBHOOK_SECRET) {
    return NextResponse.json(
      { detail: 'Whop webhook not configured. Set WHOP_WEBHOOK_SECRET.' },
      { status: 503 }
    )
  }

  // Read raw body — must be the exact bytes Whop signed
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get('x-whop-signature') || ''
  if (!verifyWhopSignature(rawBody, signature)) {
    console.warn('[Whop Webhook] Invalid signature')
    return NextResponse.json({ detail: 'Invalid signature' }, { status: 401 })
  }

  // Parse event
  let event: WhopWebhookEvent
  try {
    event = JSON.parse(rawBody) as WhopWebhookEvent
  } catch {
    console.warn('[Whop Webhook] Invalid JSON')
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event.type || 'unknown'
  const sub = event.data

  if (!sub || !sub.id || !sub.user?.id) {
    // Not a subscription event we care about — acknowledge and move on
    return NextResponse.json({ received: true, handled: false, event: eventType, reason: 'no subscription data' })
  }

  // Skip if this subscription is for a different product (and we have a product ID configured)
  if (WHOP_PRODUCT_ID && sub.product?.id && sub.product.id !== WHOP_PRODUCT_ID) {
    // Unless we're configured to allow any product under the company
    // (this is just a hint — Whop won't send webhooks for other companies' products anyway)
    console.log(`[Whop Webhook] Skipping event for product ${sub.product.id} (configured: ${WHOP_PRODUCT_ID})`)
    return NextResponse.json({ received: true, handled: false, event: eventType, reason: 'different product' })
  }

  try {
    await initDb()

    // Upsert WhopSubscription record
    const subId = sub.id
    const userId = sub.user.id
    const email = sub.user.email || ''
    const username = sub.user.username || ''
    const picture = sub.user.profile_pic_url || ''
    const productId = sub.product?.id || ''
    const productName = sub.product?.name || ''
    const planId = sub.plan?.id || ''
    const planName = sub.plan?.name || ''
    const priceCents = sub.plan?.price_cents || 0
    const currency = sub.plan?.currency || 'USD'
    const billingPeriod = sub.plan?.billing_period || ''
    const quantity = sub.quantity || 1
    const status = sub.status
    const expiresAt = sub.expires_at || null
    const renewAt = sub.renew_at || null
    const createdAt = sub.created_at || event.created_at

    await rawExecute(
      `INSERT INTO WhopSubscription (
        id, subscriptionId, userId, email, username, picture,
        productId, productName, planId, planName,
        priceCents, currency, billingPeriod, quantity,
        status, expiresAt, renewAt, createdAt, updatedAt, rawEvent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(subscriptionId) DO UPDATE SET
        email=excluded.email,
        username=excluded.username,
        picture=excluded.picture,
        productId=excluded.productId,
        productName=excluded.productName,
        planId=excluded.planId,
        planName=excluded.planName,
        priceCents=excluded.priceCents,
        currency=excluded.currency,
        billingPeriod=excluded.billingPeriod,
        quantity=excluded.quantity,
        status=excluded.status,
        expiresAt=excluded.expiresAt,
        renewAt=excluded.renewAt,
        updatedAt=excluded.updatedAt,
        rawEvent=excluded.rawEvent`,
      [
        `whop_${subId}`,
        subId,
        userId,
        email,
        username,
        picture,
        productId,
        productName,
        planId,
        planName,
        priceCents,
        currency,
        billingPeriod,
        quantity,
        status,
        expiresAt,
        renewAt,
        createdAt,
        new Date().toISOString(),
        rawBody.slice(0, 50000),
      ]
    ).catch(err => {
      // Most likely: table doesn't exist yet — that's fine, the next request
      // after initDb will have created it
      console.warn('[Whop Webhook] Failed to upsert WhopSubscription:', err instanceof Error ? err.message : err)
    })

    // Determine if this event is "active" or "revoked"
    const isActive = status === 'active' || status === 'trialing' || status === 'past_due'
    const isRevoked = status === 'canceled' || status === 'expired' || status === 'unpaid'

    // Find the user's primary device (if any) so we can grant/expire device access
    let deviceId: string | null = null
    try {
      const rows = await rawQuery<{ primaryDeviceId: string | null }>(
        `SELECT primaryDeviceId FROM UserAccount WHERE whopUserId = ?`,
        [userId]
      )
      if (rows.length > 0 && rows[0].primaryDeviceId) {
        deviceId = rows[0].primaryDeviceId
      }
    } catch {
      // UserAccount table might not exist yet — that's fine
    }

    if (deviceId && isActive) {
      // Grant all_premium access with expiry = subscription expires_at
      await rawExecute(
        `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(deviceId, analysisType, source) DO UPDATE SET
           expiresAt=excluded.expiresAt,
           reason=excluded.reason`,
        [
          `da_whop_${subId}`,
          deviceId,
          'all_premium',
          'whop_webhook',
          subId,
          'system',
          `Whop subscription ${subId} (${status})`,
          expiresAt,
        ]
      ).catch(err => {
        console.warn('[Whop Webhook] Failed to grant DeviceAccess:', err instanceof Error ? err.message : err)
      })
      console.log(`[Whop Webhook] Granted all_premium to device ${deviceId.substring(0, 8)}… for Whop sub ${subId} (${status})`)
    }

    if (deviceId && isRevoked) {
      await rawExecute(
        `UPDATE DeviceAccess
         SET expiresAt = MIN(COALESCE(expiresAt, '1970-01-01'), CURRENT_TIMESTAMP)
         WHERE deviceId = ? AND source = 'whop_webhook' AND sourceRef = ?`,
        [deviceId, subId]
      ).catch(err => {
        console.warn('[Whop Webhook] Failed to revoke DeviceAccess:', err instanceof Error ? err.message : err)
      })
      console.log(`[Whop Webhook] Revoked whop_webhook access for device ${deviceId.substring(0, 8)}… (sub ${subId} → ${status})`)
    }

    // Send receipt email on creation (and renewal, which comes through as
    // subscription.updated with status=active)
    if ((eventType === 'subscription.created' || (eventType === 'subscription.updated' && isActive)) && email) {
      const sendResult = await sendWhopReceiptEmail({
        customerEmail: email,
        customerName: username,
        orderId: subId,
        items: [{
          name: productName || 'AstroBidhi Premium',
          description: planName || (billingPeriod ? `${billingPeriod} subscription` : 'Subscription'),
          priceCents: priceCents,
          quantity,
        }],
        totalCents: priceCents * quantity,
        currency,
        providerUrl: 'https://whop.com/dashboard/memberships',
        notes: isActive === (status === 'trialing')
          ? 'You\'re on a free trial. Your card will be charged when the trial ends — cancel anytime from Whop.'
          : undefined,
      })
      if (sendResult.sent) {
        console.log(`[Whop Webhook] Receipt email sent to ${email}`)
      } else if (sendResult.error && !sendResult.error.includes('Not configured')) {
        console.warn(`[Whop Webhook] Receipt email failed: ${sendResult.error}`)
      }
    }

    return NextResponse.json({
      received: true,
      handled: true,
      event: eventType,
      subscriptionId: subId,
      userId,
      status,
    })
  } catch (err) {
    console.error('[Whop Webhook] Processing error:', err)
    // Return 500 so Whop retries
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

// GET /api/whop/webhook — health check
export async function GET() {
  return NextResponse.json({
    configured: !!WHOP_WEBHOOK_SECRET,
    hasApiKey: !!WHOP_API_KEY,
    hasProductId: !!WHOP_PRODUCT_ID,
    hasCompanyId: !!WHOP_COMPANY_ID,
    message: WHOP_WEBHOOK_SECRET
      ? 'Whop webhook endpoint is ready. Configure the webhook URL in your Whop developer dashboard.'
      : 'Whop webhook not configured. Set WHOP_WEBHOOK_SECRET in your .env',
  })
}
