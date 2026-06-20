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

export type Tier = 'monthly' | 'yearly' | 'lifetime'

export const LS_CONFIG = {
  apiKey: process.env.LEMONSQUEEZY_API_KEY || '',
  storeId: process.env.LEMONSQUEEZY_STORE_ID || '',        // e.g. "12345"
  variantId: process.env.LEMONSQUEEZY_VARIANT_ID || '',    // default subscription variant (back-compat)
  webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
  // Optional: override the checkout URL (otherwise we generate one)
  checkoutUrl: process.env.LEMONSQUEEZY_CHECKOUT_URL || '',

  // Tier-specific variant IDs (optional — if set, the front-end can show
  // monthly/yearly/lifetime options). If a tier env var is missing, we
  // fall back to the default `variantId`.
  tierVariantIds: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY || '',
    yearly: process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY || '',
    lifetime: process.env.LEMONSQUEEZY_VARIANT_ID_LIFETIME || '',
  } as Record<Tier, string>,

  // Tier-specific checkout URLs (optional — falls back to API-generated URLs).
  tierCheckoutUrls: {
    monthly: process.env.LEMONSQUEEZY_CHECKOUT_URL_MONTHLY || '',
    yearly: process.env.LEMONSQUEEZY_CHECKOUT_URL_YEARLY || '',
    lifetime: process.env.LEMONSQUEEZY_CHECKOUT_URL_LIFETIME || '',
  } as Record<Tier, string>,
}

/**
 * Mapping of analysisType → LS variant ID for per-analysis one-time purchases.
 *
 * Two ways to populate this:
 *   1. Set env vars at deploy time: LEMONSQUEEZY_VARIANT_<ANALYSIS_TYPE>=<variantId>
 *      (e.g., LEMONSQUEEZY_VARIANT_COSMIC_BLUEPRINT=12345)
 *   2. Set in the PremiumCatalog table via /admin/catalog (preferred — can be
 *      edited at runtime without redeploying).
 *
 * The lookup function below checks both sources (DB first, then env).
 */
function parseAnalysisVariantEnvMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('LEMONSQUEEZY_VARIANT_') && value) {
      const analysisType = key.replace('LEMONSQUEEZY_VARIANT_', '').toLowerCase()
      if (!['monthly', 'yearly', 'lifetime'].includes(analysisType)) {
        map[analysisType] = value
      }
    }
  }
  return map
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
 *
 * Options:
 *   - tier: 'monthly' | 'yearly' | 'lifetime' — use tier-specific variant
 *   - analysisType: string — buy a single analysis (one-time), uses the
 *       variant mapped to that analysis type (DB lookup, then env fallback)
 *   - email/name/deviceId/discountCode: standard prefill/customization
 */
export async function getCheckoutUrl(options?: {
  email?: string        // Pre-fill checkout email
  name?: string         // Pre-fill checkout name
  deviceId?: string     // Stored as `checkout_data[custom][device_id]` for webhook
  discountCode?: string // Apply a discount code
  tier?: Tier           // Tier-specific variant (overrides default)
  analysisType?: string // Per-analysis one-time purchase (overrides tier)
}): Promise<{ url: string | null; error?: string }> {
  if (!isLsConfigured()) {
    return { url: null, error: 'Lemon Squeezy not configured' }
  }

  // Resolve the variant ID for this checkout
  let variantId = LS_CONFIG.variantId
  let staticCheckoutUrl = LS_CONFIG.checkoutUrl

  if (options?.analysisType) {
    // Per-analysis one-time purchase — look up the variant for this analysis type
    const lookup = await getVariantForAnalysisType(options.analysisType)
    if (!lookup) {
      return { url: null, error: `No LS variant configured for analysis type: ${options.analysisType}` }
    }
    variantId = lookup
    staticCheckoutUrl = ''  // never use the default static URL for per-analysis purchases
  } else if (options?.tier) {
    // Tier-specific purchase (monthly/yearly/lifetime)
    variantId = LS_CONFIG.tierVariantIds[options.tier] || LS_CONFIG.variantId
    staticCheckoutUrl = LS_CONFIG.tierCheckoutUrls[options.tier] || ''
  }

  // If a manual checkout URL is set for this tier/variant, just use it (with optional email prefilled)
  if (staticCheckoutUrl) {
    const url = new URL(staticCheckoutUrl)
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
              'enabled_variants': [variantId],
              'redirect_url': process.env.NEXT_PUBLIC_URL
                ? `${process.env.NEXT_PUBLIC_URL}/?payment=success`
                : undefined,
            },
            'checkout_options': {
              'embed': false,
              'dark': false,
            },
            // Pass custom data so the webhook can identify the buyer + what they bought
            ...(options?.deviceId || options?.analysisType || options?.tier
              ? { 'custom': {
                  ...(options?.deviceId ? { 'device_id': options.deviceId } : {}),
                  ...(options?.analysisType ? { 'analysis_type': options.analysisType } : {}),
                  ...(options?.tier ? { 'tier': options.tier } : {}),
                } }
              : {}),
          },
          relationships: {
            store: {
              data: { type: 'stores', id: LS_CONFIG.storeId },
            },
            variant: {
              data: { type: 'variants', id: variantId },
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
    custom_data?: {
      device_id?: string
      analysis_type?: string  // set for per-analysis purchases
      tier?: string           // set for tier-specific subscription purchases
    } | null
  }
  data: {
    id: string
    type: string  // 'subscriptions' or 'orders'
    attributes: {
      id: number
      customer_id: string
      customer_email: string
      customer_name: string
      variant_id: number | string
      product_id: number | string
      product_name?: string
      variant_name?: string
      status: string
      status_formatted: string
      // Subscription fields
      current_period_end?: string | null
      trial_ends_at?: string | null
      cancelled?: boolean
      renews_at?: string | null
      // Order fields (one-time purchases)
      total?: number          // cents
      subtotal?: number
      tax?: number
      currency?: string
      // Both
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
  const customAnalysisType = event.meta?.custom_data?.analysis_type || null
  const variantId = String(attrs.variant_id)

  // Determine if this is a per-analysis purchase (one-time) by looking up
  // the variantId in the PremiumCatalog table OR in the env-var map.
  // If `customAnalysisType` was set at checkout, that takes priority.
  let analysisTypeToGrant: string | null = customAnalysisType
  if (!analysisTypeToGrant) {
    analysisTypeToGrant = await getAnalysisTypeForVariant(variantId)
  }

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
      variantId,
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

  // Determine if this event represents an "active" state.
  // For subscriptions: 'active' or 'on_trial'
  // For one-time orders: the event_name is 'order_created' or 'order_refunded'
  const isOrderEvent = eventName.startsWith('order_')
  const isActiveState = isOrderEvent
    ? eventName === 'order_created'
    : (attrs.status === 'active' || attrs.status === 'on_trial')
  const isRevokedState = isOrderEvent
    ? eventName === 'order_refunded'
    : (attrs.status === 'expired' || attrs.status === 'cancelled' || attrs.status === 'unpaid')

  // Grant access when active
  if (deviceId && isActiveState) {
    // What to grant:
    //   - Per-analysis one-time purchase → grant that specific analysisType (no expiry)
    //   - Subscription (any tier)         → grant 'all_premium' with expiry = period_end
    const grantType = analysisTypeToGrant || 'all_premium'
    const grantExpiry = analysisTypeToGrant
      ? null  // one-time purchases never expire
      : (attrs.current_period_end || attrs.renews_at || null)

    await rawExecute(
      `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(deviceId, analysisType, source) DO UPDATE SET
         expiresAt=excluded.expiresAt,
         reason=excluded.reason`,
      [
        `da_ls_${subscriptionId}`,
        deviceId,
        grantType,
        'lemonsqueezy',
        subscriptionId,
        'system',
        analysisTypeToGrant
          ? `Lemon Squeezy one-time purchase (${analysisTypeToGrant}) — order ${subscriptionId}`
          : `Lemon Squeezy subscription ${subscriptionId} (${attrs.status_formatted})`,
        grantExpiry,
      ]
    )
    console.log(`[LS Webhook] Granted ${grantType} to device ${deviceId.substring(0, 8)}… for ${isOrderEvent ? 'order' : 'subscription'} ${subscriptionId}`)
  }

  // Revoke access when refunded/cancelled/expired
  if (deviceId && isRevokedState) {
    await rawExecute(
      `UPDATE DeviceAccess
       SET expiresAt = MIN(COALESCE(expiresAt, '1970-01-01'), CURRENT_TIMESTAMP)
       WHERE deviceId = ? AND source = 'lemonsqueezy' AND sourceRef = ?`,
      [deviceId, subscriptionId]
    )
    console.log(`[LS Webhook] Revoked lemonsqueezy access for device ${deviceId.substring(0, 8)}… (${isOrderEvent ? 'order' : 'subscription'} ${subscriptionId} → ${eventName})`)
  }

  // Send branded receipt email on initial purchase/renewal.
  // Lazy-import to avoid pulling email lib into the config-time path.
  if (isActiveState && attrs.customer_email) {
    try {
      const { sendLsReceiptEmail } = await import('@/lib/email')
      const totalCents = attrs.total
        || (isOrderEvent ? 0 : 0)  // LS doesn't always include price in subscription events
      const productName = attrs.product_name || `Lemon Squeezy product ${attrs.product_id}`
      const variantName = attrs.variant_name || (analysisTypeToGrant ? `Analysis: ${analysisTypeToGrant}` : `Variant ${variantId}`)

      await sendLsReceiptEmail({
        customerEmail: attrs.customer_email,
        customerName: attrs.customer_name,
        orderId: subscriptionId,
        items: [{
          name: productName,
          description: variantName,
          priceCents: totalCents,
        }],
        totalCents: totalCents,
        currency: attrs.currency || 'USD',
        providerUrl: 'https://app.lemonsqueezy.com/my-orders',
        notes: analysisTypeToGrant
          ? `This is a one-time purchase — your "${analysisTypeToGrant}" analysis is now unlocked permanently.`
          : (eventName === 'subscription_created'
              ? 'Your subscription is now active. Cancel anytime from Lemon Squeezy.'
              : undefined),
      })
    } catch (emailErr) {
      // Don't fail the webhook if email fails
      console.warn('[LS Webhook] Receipt email failed:', emailErr instanceof Error ? emailErr.message : emailErr)
    }
  }

  // ── New 3-tier subscription handling ──
  // If this variant corresponds to one of the 9 subscription tier+period
  // combinations (Pro/Advanced/All-Access × Monthly/Yearly/Lifetime),
  // record it in the ChartSubscription table so the rate limiter knows
  // the subscriber's chart budget.
  try {
    const { resolveLsTier, upsertChartSubscription, deactivateChartSubscription } = await import('@/lib/subscriptions')
    const resolved = resolveLsTier(variantId)
    if (resolved) {
      const { tier, period } = resolved
      const isActiveState2 = eventName === 'order_created' || eventName === 'subscription_created' || eventName === 'subscription_updated'
      const isRevokedState2 = eventName === 'subscription_cancelled' || eventName === 'subscription_expired' || eventName === 'order_refunded'

      if (isActiveState2) {
        await upsertChartSubscription({
          subscriptionId,
          customerEmail: attrs.customer_email,
          customerName: attrs.customer_name,
          deviceId,
          tier,
          period,
          provider: 'lemonsqueezy',
          status: attrs.status || 'active',
          periodEnd: attrs.current_period_end || attrs.renews_at || null,
          rawEvent: rawBody.slice(0, 50000),
        })
        console.log(`[LS Webhook] Recorded ChartSubscription: ${tier}/${period} for ${attrs.customer_email}`)

        // Also grant DeviceAccess for the analyses included in this tier
        // (so the existing premium-check code works unchanged)
        const { SUBSCRIPTION_PRICING } = await import('@/lib/subscriptions')
        const analysesIncluded = SUBSCRIPTION_PRICING[tier][period].analysesIncluded
        for (const analysisTier of analysesIncluded) {
          // Grant all_premium covers Pro tier; for Advanced we need a different marker
          // The existing system uses 'all_premium' to mean "all premium analyses"
          // We'll keep using that for all_access, and use 'all_premium' for pro/advanced
          // too — the front-end / API will check the subscription tier separately
          // to know which analyses are actually allowed.
          // For now, just grant all_premium (covers everything). The new
          // /api/ai-analysis route will check the subscription tier to determine
          // which specific analysisTypes are allowed.
          if (analysisTier === 'pro' || analysisTier === 'advanced') {
            await rawExecute(
              `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, sourceRef, grantedBy, reason, expiresAt, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(deviceId, analysisType, source) DO UPDATE SET
                 expiresAt=excluded.expiresAt,
                 reason=excluded.reason`,
              [
                `da_ls_${subscriptionId}_${analysisTier}`,
                deviceId,
                analysisTier === 'pro' ? 'all_premium' : 'all_advanced',
                'lemonsqueezy',
                subscriptionId,
                'system',
                `Lemon Squeezy ${tier}/${period} subscription`,
                attrs.current_period_end || attrs.renews_at || null,
              ]
            )
          }
        }
      } else if (isRevokedState2) {
        await deactivateChartSubscription(subscriptionId, attrs.status || 'cancelled')
        console.log(`[LS Webhook] Deactivated ChartSubscription ${subscriptionId} (${attrs.status})`)
      }
    }
  } catch (subErr) {
    console.warn('[LS Webhook] Subscription tracking failed:', subErr instanceof Error ? subErr.message : subErr)
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

/**
 * Alias for getCustomerPortalUrl — the URL where users can cancel/update
 * their LS subscription. Same as the customer portal.
 */
export function getManageSubscriptionUrl(): string {
  return getCustomerPortalUrl()
}

// ──────────────────── Tier + per-analysis helpers ────────────────────

/**
 * Returns all tier-specific checkout info that's configured.
 * Used by the front-end to render a tier picker.
 */
export function getAvailableTiers(): Array<{ tier: Tier; variantId: string; checkoutUrl: string | null }> {
  const tiers: Tier[] = ['monthly', 'yearly', 'lifetime']
  const result: Array<{ tier: Tier; variantId: string; checkoutUrl: string | null }> = []
  for (const t of tiers) {
    const vid = LS_CONFIG.tierVariantIds[t] || LS_CONFIG.variantId || ''
    const url = LS_CONFIG.tierCheckoutUrls[t] || LS_CONFIG.checkoutUrl || null
    if (vid) {
      result.push({ tier: t, variantId: vid, checkoutUrl: url })
    }
  }
  // If no tiers configured but a default variant exists, expose it as 'monthly'
  if (result.length === 0 && LS_CONFIG.variantId) {
    result.push({ tier: 'monthly', variantId: LS_CONFIG.variantId, checkoutUrl: LS_CONFIG.checkoutUrl || null })
  }
  return result
}

/**
 * Look up the LS variant ID for a given analysis type (per-analysis purchase).
 * Checks the PremiumCatalog DB table first, then env vars (LEMONSQUEEZY_VARIANT_<TYPE>).
 *
 * Returns null if no variant is configured for this analysis type.
 */
export async function getVariantForAnalysisType(analysisType: string): Promise<string | null> {
  // 1. DB lookup (admin-editable at runtime)
  try {
    await initDb()
    const rows = await rawQuery<{ lsVariantId: string | null }>(
      `SELECT lsVariantId FROM PremiumCatalog WHERE analysisType = ? AND lsVariantId IS NOT NULL AND lsVariantId != ''`,
      [analysisType]
    )
    if (rows.length > 0 && rows[0].lsVariantId) {
      return rows[0].lsVariantId
    }
  } catch (err) {
    console.warn('[LS] PremiumCatalog lookup failed:', err)
  }

  // 2. Env var fallback (set at deploy time)
  const envMap = parseAnalysisVariantEnvMap()
  return envMap[analysisType.toLowerCase()] || null
}

/**
 * Reverse lookup: given a variant ID from a webhook, find the analysis type
 * it corresponds to (if any). Used by the webhook handler to grant specific
 * analysisType instead of 'all_premium'.
 *
 * Checks PremiumCatalog DB first, then env vars.
 */
export async function getAnalysisTypeForVariant(variantId: string): Promise<string | null> {
  if (!variantId) return null

  // 1. DB lookup
  try {
    await initDb()
    const rows = await rawQuery<{ analysisType: string }>(
      `SELECT analysisType FROM PremiumCatalog WHERE lsVariantId = ?`,
      [variantId]
    )
    if (rows.length > 0) {
      return rows[0].analysisType
    }
  } catch (err) {
    console.warn('[LS] PremiumCatalog reverse lookup failed:', err)
  }

  // 2. Env var fallback
  const envMap = parseAnalysisVariantEnvMap()
  for (const [analysisType, vid] of Object.entries(envMap)) {
    if (vid === variantId) return analysisType
  }

  return null
}

/**
 * Returns the full analysis→variant map (for admin display + diagnostics).
 * Merges DB-stored mappings with env-var mappings.
 */
export async function getAllAnalysisVariantMappings(): Promise<Array<{ analysisType: string; variantId: string; source: 'db' | 'env' }>> {
  const result: Array<{ analysisType: string; variantId: string; source: 'db' | 'env' }> = []
  const seen = new Set<string>()

  // DB mappings
  try {
    await initDb()
    const rows = await rawQuery<{ analysisType: string; lsVariantId: string }>(
      `SELECT analysisType, lsVariantId FROM PremiumCatalog WHERE lsVariantId IS NOT NULL AND lsVariantId != ''`
    )
    for (const row of rows) {
      result.push({ analysisType: row.analysisType, variantId: row.lsVariantId, source: 'db' })
      seen.add(`${row.analysisType}|${row.lsVariantId}`)
    }
  } catch (err) {
    console.warn('[LS] getAllAnalysisVariantMappings DB error:', err)
  }

  // Env mappings (only if not already in DB)
  const envMap = parseAnalysisVariantEnvMap()
  for (const [analysisType, variantId] of Object.entries(envMap)) {
    if (!seen.has(`${analysisType}|${variantId}`)) {
      result.push({ analysisType, variantId, source: 'env' })
    }
  }

  return result
}

