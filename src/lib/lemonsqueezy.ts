// Lemon Squeezy integration utilities
// Handles checkout URL generation, webhook signature verification, and
// subscription status checks via the Lemon Squeezy API.
//
// Architecture (different from Whop):
//   - Whop uses OAuth: user logs in via Whop, we check their membership
//   - Lemon Squeezy uses checkout + webhooks: user pays via LS, LS sends
//     webhook events that we store in the DB, access is determined by
//     the stored subscription status
//
// This means we don't need an OAuth flow — just:
//   1. Generate a checkout URL (overlay or hosted)
//   2. Listen for webhooks on /api/lemonsqueezy/webhook
//   3. Store subscription status keyed by email + variantId
//   4. Frontend asks /api/lemonsqueezy/status?email=... to check access

import { createHmac, timingSafeEqual } from 'crypto'
import { rawQuery, rawExecute, initDb } from '@/lib/db'

export const LS_CONFIG = {
  apiKey: process.env.LEMONSQUEEZY_API_KEY || '',
  storeId: process.env.LEMONSQUEEZY_STORE_ID || '',        // e.g. "12345"
  variantId: process.env.LEMONSQUEEZY_VARIANT_ID || '',    // e.g. "67890" — the subscription variant to sell
  webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
  // Optional: override the checkout URL (otherwise we generate one)
  checkoutUrl: process.env.LEMONSQUEEZY_CHECKOUT_URL || '',
}

// ──────────────────── Types ────────────────────

export interface LsSubscription {
  id: string                 // LS subscription ID (e.g. "123")
  customerId: string         // LS customer ID
  customerEmail: string
  customerName: string
  variantId: string
  productId: string
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused' | 'unpaid' | 'on_trial' | 'trial_ended'
  statusFormatted: string
  currentPeriodEnd: string | null   // ISO date
  trialEndsAt: string | null        // ISO date or null
  cancelled: boolean
  renewsAt: string | null           // ISO date or null
  createdAt: string
  updatedAt: string
}

export interface LsAccessResult {
  hasAccess: boolean
  accessLevel: 'active' | 'on_trial' | 'no_access'
  subscription: LsSubscription | null
  reason: string | null
}

// ──────────────────── Configuration checks ────────────────────

export function isLsConfigured(): boolean {
  return !!(LS_CONFIG.apiKey && LS_CONFIG.storeId && LS_CONFIG.variantId)
}

export function getLsConfigStatus() {
  return {
    configured: isLsConfigured(),
    hasApiKey: !!LS_CONFIG.apiKey,
    hasStoreId: !!LS_CONFIG.storeId,
    hasVariantId: !!LS_CONFIG.variantId,
    hasWebhookSecret: !!LS_CONFIG.webhookSecret,
    hasCheckoutUrl: !!LS_CONFIG.checkoutUrl,
    apiKeyPreview: LS_CONFIG.apiKey ? `${LS_CONFIG.apiKey.slice(0, 8)}…${LS_CONFIG.apiKey.slice(-4)}` : null,
    storeId: LS_CONFIG.storeId || null,
    variantId: LS_CONFIG.variantId || null,
    checkoutUrl: LS_CONFIG.checkoutUrl || null,
  }
}

/**
 * Returns the checkout URL for the configured variant.
 * If LEMONSQUEEZY_CHECKOUT_URL is set, use it. Otherwise, generate via API.
 */
export async function getCheckoutUrl(options?: {
  email?: string        // Pre-fill checkout email
  name?: string         // Pre-fill checkout name
  deviceId?: string     // Stored as `checkout_data[custom][device_id]` for webhook
  discountCode?: string // Apply a discount code
}): Promise<{ url: string | null; error?: string }> {
  if (!isLsConfigured()) {
    return { url: null, error: 'Lemon Squeezy not configured' }
  }

  // If a manual checkout URL is set, just use it (with optional email prefilled)
  if (LS_CONFIG.checkoutUrl) {
    const url = new URL(LS_CONFIG.checkoutUrl)
    if (options?.email) url.searchParams.set('checkout[email]', options.email)
    if (options?.name) url.searchParams.set('checkout[name]', options.name)
    return { url: url.toString() }
  }

  // Otherwise, create a checkout session via the API
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${LS_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            ...(options?.email ? { 'checkout_email': options.email } : {}),
            ...(options?.name ? { 'checkout_name': options.name } : {}),
            ...(options?.discountCode ? { 'discount_code': options.discountCode } : {}),
            'product_options': {
              'enabled_variants': [LS_CONFIG.variantId],
              'redirect_url': process.env.NEXT_PUBLIC_URL
                ? `${process.env.NEXT_PUBLIC_URL}/?payment=success`
                : undefined,
            },
            'checkout_options': {
              'embed': false,
              'dark': false,
            },
            // Pass custom data so the webhook can identify the buyer
            ...(options?.deviceId
              ? { 'custom': { 'device_id': options.deviceId } }
              : {}),
          },
          relationships: {
            store: {
              data: { type: 'stores', id: LS_CONFIG.storeId },
            },
            variant: {
              data: { type: 'variants', id: LS_CONFIG.variantId },
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[LS] Checkout creation failed:', response.status, text.slice(0, 300))
      return { url: null, error: `Lemon Squeezy API error: ${response.status}` }
    }

    const json = await response.json() as {
      data: { attributes: { url: string } }
    }
    return { url: json.data.attributes.url }
  } catch (err) {
    console.error('[LS] getCheckoutURL error:', err)
    return { url: null, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// ──────────────────── Webhook signature verification ────────────────────

/**
 * Verify the X-Signature header on a Lemon Squeezy webhook.
 * LS signs the raw body with HMAC-SHA256 using your webhook secret.
 *
 * @param rawBody - The raw request body as a string (NOT parsed JSON)
 * @param signature - The X-Signature header value (hex string)
 * @returns true if the signature is valid
 */
export function verifyLsWebhookSignature(rawBody: string, signature: string): boolean {
  if (!LS_CONFIG.webhookSecret || !signature) return false

  try {
    const expected = createHmac('sha256', LS_CONFIG.webhookSecret)
      .update(rawBody)
      .digest('hex')

    // Timing-safe comparison
    const a = Buffer.from(signature, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ──────────────────── Webhook event handling ────────────────────

interface LsWebhookEvent {
  meta: {
    event_name: string
    custom_data?: { device_id?: string } | null
  }
  data: {
    id: string
    type: string
    attributes: {
      id: number
      customer_id: string
      customer_email: string
      customer_name: string
      variant_id: number | string
      product_id: number | string
      status: string
      status_formatted: string
      current_period_end?: string | null
      trial_ends_at?: string | null
      cancelled?: boolean
      renews_at?: string | null
      created_at: string
      updated_at: string
    }
  }
}

/**
 * Process a Lemon Squeezy webhook event.
 * Stores/updates the subscription in the LsSubscription table.
 *
 * Returns true if the access state was updated.
 */
export async function processLsWebhookEvent(rawBody: string): Promise<{ handled: boolean; eventName: string; subscriptionId?: string }> {
  let event: LsWebhookEvent
  try {
    event = JSON.parse(rawBody) as LsWebhookEvent
  } catch {
    return { handled: false, eventName: 'invalid_json' }
  }

  const eventName = event.meta?.event_name || 'unknown'
  const attrs = event.data?.attributes
  if (!attrs) {
    return { handled: false, eventName }
  }

  await initDb()

  const subscriptionId = String(attrs.id)
  const deviceId = event.meta?.custom_data?.device_id || null

  // Upsert subscription record
  await rawExecute(
    `INSERT INTO LsSubscription (
      id, subscriptionId, customerId, customerEmail, customerName,
      variantId, productId, status, statusFormatted,
      currentPeriodEnd, trialEndsAt, cancelled, renewsAt,
      deviceId, createdAt, updatedAt, rawEvent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(subscriptionId) DO UPDATE SET
      status=excluded.status,
      statusFormatted=excluded.statusFormatted,
      currentPeriodEnd=excluded.currentPeriodEnd,
      trialEndsAt=excluded.trialEndsAt,
      cancelled=excluded.cancelled,
      renewsAt=excluded.renewsAt,
      deviceId=COALESCE(excluded.deviceId, LsSubscription.deviceId),
      updatedAt=excluded.updatedAt,
      rawEvent=excluded.rawEvent`,
    [
      `ls_${subscriptionId}`,
      subscriptionId,
      attrs.customer_id,
      attrs.customer_email,
      attrs.customer_name,
      String(attrs.variant_id),
      String(attrs.product_id),
      attrs.status,
      attrs.status_formatted,
      attrs.current_period_end || null,
      attrs.trial_ends_at || null,
      attrs.cancelled ? 1 : 0,
      attrs.renews_at || null,
      deviceId,
      attrs.created_at,
      attrs.updated_at,
      rawBody.slice(0, 50000), // Keep last event for debugging (capped at 50KB)
    ]
  )

  // If we have a device_id from the checkout, link it: grant 'all_premium' access
  // to that device so the user immediately gets premium features on the device
  // they were browsing from when they paid.
  if (deviceId && (attrs.status === 'active' || attrs.status === 'on_trial')) {
    await rawExecute(
      `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(deviceId, analysisType, source) DO UPDATE SET
         expiresAt=excluded.expiresAt,
         reason=excluded.reason`,
      [
        `da_ls_${subscriptionId}`,
        deviceId,
        'all_premium',
        'lemonsqueezy',
        subscriptionId,
        'system',
        `Lemon Squeezy subscription ${subscriptionId} (${attrs.status_formatted})`,
        attrs.current_period_end || attrs.renews_at || null,
      ]
    )
    console.log(`[LS Webhook] Granted all_premium to device ${deviceId.substring(0, 8)}… for subscription ${subscriptionId}`)
  }

  // If subscription ended/cancelled, revoke the grant (let it expire naturally
  // — we don't delete the row so admin can see history, but we set expiresAt
  // to now if it's still in the future)
  if (deviceId && (attrs.status === 'expired' || attrs.status === 'cancelled' || attrs.status === 'unpaid')) {
    await rawExecute(
      `UPDATE DeviceAccess
       SET expiresAt = MIN(COALESCE(expiresAt, '1970-01-01'), CURRENT_TIMESTAMP)
       WHERE deviceId = ? AND source = 'lemonsqueezy' AND sourceRef = ?`,
      [deviceId, subscriptionId]
    )
    console.log(`[LS Webhook] Revoked lemonsqueezy access for device ${deviceId.substring(0, 8)}… (subscription ${subscriptionId} → ${attrs.status})`)
  }

  return { handled: true, eventName, subscriptionId }
}

// ──────────────────── Access checks ────────────────────

/**
 * Check if a given email has active Lemon Squeezy subscription access.
 * Used by the frontend after a user provides their email to verify they
 * have an active subscription.
 */
export async function checkLsAccessByEmail(email: string): Promise<LsAccessResult> {
  if (!email) {
    return { hasAccess: false, accessLevel: 'no_access', subscription: null, reason: 'No email provided' }
  }

  try {
    await initDb()
    const rows = await rawQuery<LsSubscription>(
      `SELECT subscriptionId, customerId, customerEmail, customerName,
              variantId, productId, status, statusFormatted,
              currentPeriodEnd, trialEndsAt, cancelled, renewsAt,
              createdAt, updatedAt
       FROM LsSubscription
       WHERE customerEmail = ?
       ORDER BY updatedAt DESC
       LIMIT 1`,
      [email.toLowerCase()]
    )

    if (rows.length === 0) {
      return { hasAccess: false, accessLevel: 'no_access', subscription: null, reason: 'No subscription found for this email' }
    }

    const sub = rows[0]
    const activeStatuses = ['active', 'on_trial']
    if (!activeStatuses.includes(sub.status)) {
      return { hasAccess: false, accessLevel: 'no_access', subscription: sub, reason: `Subscription status: ${sub.statusFormatted || sub.status}` }
    }

    // Check expiry for active subs (not trial — trial can be in the past, that's fine, status would change)
    if (sub.status === 'active' && sub.currentPeriodEnd) {
      const expiry = new Date(sub.currentPeriodEnd)
      if (expiry.getTime() < Date.now()) {
        return { hasAccess: false, accessLevel: 'no_access', subscription: sub, reason: 'Subscription period ended' }
      }
    }

    return {
      hasAccess: true,
      accessLevel: sub.status === 'on_trial' ? 'on_trial' : 'active',
      subscription: sub,
      reason: null,
    }
  } catch (err) {
    console.error('[LS] checkLsAccessByEmail error:', err)
    return { hasAccess: false, accessLevel: 'no_access', subscription: null, reason: 'Database error' }
  }
}

/**
 * List recent subscriptions (for admin dashboard).
 */
export async function listRecentLsSubscriptions(limit = 20): Promise<LsSubscription[]> {
  try {
    await initDb()
    return await rawQuery<LsSubscription>(
      `SELECT subscriptionId, customerId, customerEmail, customerName,
              variantId, productId, status, statusFormatted,
              currentPeriodEnd, trialEndsAt, cancelled, renewsAt,
              createdAt, updatedAt
       FROM LsSubscription
       ORDER BY updatedAt DESC
       LIMIT ?`,
      [String(limit)]
    )
  } catch (err) {
    console.error('[LS] listRecentLsSubscriptions error:', err)
    return []
  }
}

/**
 * Ping the Lemon Squeezy API to verify the API key works.
 */
export async function pingLsApi(): Promise<{ reachable: boolean; status: number | null; error: string | null; storeName?: string }> {
  if (!LS_CONFIG.apiKey) {
    return { reachable: false, status: null, error: 'No API key configured' }
  }
  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/users/me', {
      headers: { 'Authorization': `Bearer ${LS_CONFIG.apiKey}`, 'Accept': 'application/vnd.api+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json() as { data: { attributes: { email: string; name: string } } }
      return { reachable: true, status: res.status, error: null }
    }
    return { reachable: true, status: res.status, error: res.status === 401 ? 'API key rejected (401)' : `HTTP ${res.status}` }
  } catch (err) {
    return { reachable: false, status: null, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// ──────────────────── Customer portal URL ────────────────────

/**
 * Get a "customer portal" URL where the user can manage their subscription
 * (cancel, update card, view invoices). Lemon Squeezy generates this per-customer.
 *
 * Implementation: LS doesn't have a direct portal API endpoint like Stripe,
 * but you can build a "manage subscription" link that takes the user to
 * https://[your-store].lemonsqueezy.com/my-orders  (their self-service page).
 */
export function getCustomerPortalUrl(): string {
  if (LS_CONFIG.storeId) {
    // The generic customer self-service URL
    return `https://app.lemonsqueezy.com/my-orders`
  }
  return ''
}
