// Three-tier subscription + bundle purchase tracking
//
// This module handles the new pricing model:
//   - 3 subscription tiers: 'pro' | 'advanced' | 'all_access'
//   - 3 periods each: 'monthly' | 'yearly' | 'lifetime'
//   - 2 new charts per billing period for monthly/yearly
//   - Unlimited charts for lifetime
//   - Bundles: one-time purchase, 1 chart per bundle
//   - Single analyses: one-time purchase, 1 chart per analysis
//   - Daily horoscope: FREE bonus for any active subscription (not guaranteed)
//
// Chart budget logic:
//   - Each "chart" = one unique birth-data combination
//   - Subscriber can add 2 NEW charts per billing period
//   - Re-analyzing a cached chart (same cacheKey) doesn't count
//   - Once analyzed, results are cached forever (viewable even after sub expires)

import { rawQuery, rawExecute, initDb } from '@/lib/db'

export type SubscriptionTier = 'pro' | 'advanced' | 'all_access'
export type SubscriptionPeriod = 'monthly' | 'yearly' | 'lifetime'
export type PaymentProvider = 'lemonsqueezy' | 'whop'

// ──────────────────── Pricing config ────────────────────
// Source of truth for prices + chart budgets. Used by /pricing page,
// /api/auth/me (to expose available tiers), and webhook handlers (to
// determine what to grant based on which variant was purchased).

export const SUBSCRIPTION_PRICING: Record<SubscriptionTier, Record<SubscriptionPeriod, {
  priceCents: number
  priceLabel: string
  effectiveMonthly: string
  yearlySavings: number  // percent off vs monthly
  chartsPerPeriod: number  // 2 for monthly/yearly, 999999 for lifetime
  analysesIncluded: ('pro' | 'advanced')[]
}>> = {
  pro: {
    monthly:   { priceCents: 2999,  priceLabel: '$29.99/mo',  effectiveMonthly: '$29.99',  yearlySavings: 0,  chartsPerPeriod: 2, analysesIncluded: ['pro'] },
    yearly:    { priceCents: 14999, priceLabel: '$149.99/yr', effectiveMonthly: '$12.50',  yearlySavings: 58, chartsPerPeriod: 2, analysesIncluded: ['pro'] },
    lifetime:  { priceCents: 39999, priceLabel: '$399.99',    effectiveMonthly: 'one-time', yearlySavings: 75, chartsPerPeriod: 999999, analysesIncluded: ['pro'] },
  },
  advanced: {
    monthly:   { priceCents: 7999,  priceLabel: '$79.99/mo',  effectiveMonthly: '$79.99',  yearlySavings: 0,  chartsPerPeriod: 2, analysesIncluded: ['advanced'] },
    yearly:    { priceCents: 39999, priceLabel: '$399.99/yr', effectiveMonthly: '$33.33',  yearlySavings: 58, chartsPerPeriod: 2, analysesIncluded: ['advanced'] },
    lifetime:  { priceCents: 99999, priceLabel: '$999.99',    effectiveMonthly: 'one-time', yearlySavings: 75, chartsPerPeriod: 999999, analysesIncluded: ['advanced'] },
  },
  all_access: {
    monthly:   { priceCents: 9999,  priceLabel: '$99.99/mo',  effectiveMonthly: '$99.99',  yearlySavings: 0,  chartsPerPeriod: 2, analysesIncluded: ['pro', 'advanced'] },
    yearly:    { priceCents: 49999, priceLabel: '$499.99/yr', effectiveMonthly: '$41.67',  yearlySavings: 58, chartsPerPeriod: 2, analysesIncluded: ['pro', 'advanced'] },
    lifetime:  { priceCents: 129999, priceLabel: '$1,299.99', effectiveMonthly: 'one-time', yearlySavings: 74, chartsPerPeriod: 999999, analysesIncluded: ['pro', 'advanced'] },
  },
}

// ──────────────────── Variant ID resolution ────────────────────
// Maps (tier, period) → variant ID for each provider.
// Populated from env vars set by the admin after creating variants in
// Lemon Squeezy / Whop dashboards.

export function getLsVariantIdForTier(tier: SubscriptionTier, period: SubscriptionPeriod): string {
  const envKey = `LEMONSQUEEZY_VARIANT_${tier.toUpperCase()}_${period.toUpperCase()}`
  return process.env[envKey] || ''
}

export function getWhopProductIdForTier(tier: SubscriptionTier, period: SubscriptionPeriod): string {
  const envKey = `WHOP_PRODUCT_${tier.toUpperCase()}_${period.toUpperCase()}`
  return process.env[envKey] || ''
}

export function getWhopCheckoutUrlForTier(tier: SubscriptionTier, period: SubscriptionPeriod): string {
  const envKey = `WHOP_CHECKOUT_URL_${tier.toUpperCase()}_${period.toUpperCase()}`
  const url = process.env[envKey]
  if (url) return url
  const pid = getWhopProductIdForTier(tier, period)
  return pid ? `https://whop.com/checkout/${pid}` : ''
}

export function getLsCheckoutUrlForTier(tier: SubscriptionTier, period: SubscriptionPeriod): string {
  const envKey = `LEMONSQUEEZY_CHECKOUT_URL_${tier.toUpperCase()}_${period.toUpperCase()}`
  return process.env[envKey] || ''
}

export function getAvailableSubscriptionTiers(provider: 'lemonsqueezy' | 'whop'): Array<{
  tier: SubscriptionTier
  period: SubscriptionPeriod
  variantId?: string
  productId?: string
  checkoutUrl?: string
  pricing: typeof SUBSCRIPTION_PRICING[SubscriptionTier][SubscriptionPeriod]
}> {
  const result: Array<{
    tier: SubscriptionTier
    period: SubscriptionPeriod
    variantId?: string
    productId?: string
    checkoutUrl?: string
    pricing: typeof SUBSCRIPTION_PRICING[SubscriptionTier][SubscriptionPeriod]
  }> = []

  const tiers: SubscriptionTier[] = ['pro', 'advanced', 'all_access']
  const periods: SubscriptionPeriod[] = ['monthly', 'yearly', 'lifetime']

  for (const tier of tiers) {
    for (const period of periods) {
      if (provider === 'lemonsqueezy') {
        const variantId = getLsVariantIdForTier(tier, period)
        if (variantId) {
          result.push({
            tier, period, variantId,
            checkoutUrl: getLsCheckoutUrlForTier(tier, period) || undefined,
            pricing: SUBSCRIPTION_PRICING[tier][period],
          })
        }
      } else {
        const productId = getWhopProductIdForTier(tier, period)
        if (productId) {
          result.push({
            tier, period, productId,
            checkoutUrl: getWhopCheckoutUrlForTier(tier, period) || undefined,
            pricing: SUBSCRIPTION_PRICING[tier][period],
          })
        }
      }
    }
  }
  return result
}

// ──────────────────── Reverse lookup (variant → tier) ────────────────────
// Used by webhook handlers to determine which tier was purchased based
// on the variantId/productId in the webhook payload.

export function resolveLsTier(variantId: string): { tier: SubscriptionTier; period: SubscriptionPeriod } | null {
  const tiers: SubscriptionTier[] = ['pro', 'advanced', 'all_access']
  const periods: SubscriptionPeriod[] = ['monthly', 'yearly', 'lifetime']
  for (const tier of tiers) {
    for (const period of periods) {
      if (getLsVariantIdForTier(tier, period) === variantId) {
        return { tier, period }
      }
    }
  }
  return null
}

export function resolveWhopTier(productId: string): { tier: SubscriptionTier; period: SubscriptionPeriod } | null {
  const tiers: SubscriptionTier[] = ['pro', 'advanced', 'all_access']
  const periods: SubscriptionPeriod[] = ['monthly', 'yearly', 'lifetime']
  for (const tier of tiers) {
    for (const period of periods) {
      if (getWhopProductIdForTier(tier, period) === productId) {
        return { tier, period }
      }
    }
  }
  return null
}

// ──────────────────── Subscription records ────────────────────

export interface ChartSubscriptionRecord {
  subscriptionId: string
  userId: string | null
  customerEmail: string
  customerName: string | null
  deviceId: string | null
  tier: SubscriptionTier
  period: SubscriptionPeriod
  provider: PaymentProvider
  status: string
  chartsPerPeriod: number
  chartsUsedThisPeriod: number
  periodStart: string
  periodEnd: string | null
}

/**
 * Upsert a ChartSubscription row (called from webhook handlers when a
 * subscription is created/renewed/cancelled).
 */
export async function upsertChartSubscription(params: {
  subscriptionId: string
  userId?: string | null
  customerEmail: string
  customerName?: string | null
  deviceId?: string | null
  tier: SubscriptionTier
  period: SubscriptionPeriod
  provider: PaymentProvider
  status: string
  periodEnd?: string | null
  rawEvent?: string
}): Promise<void> {
  await initDb()
  const pricing = SUBSCRIPTION_PRICING[params.tier][params.period]
  const chartsPerPeriod = pricing.chartsPerPeriod

  // For monthly/yearly: reset chartsUsedThisPeriod when a NEW billing period starts
  // (subscription_created or renewed = new period)
  // For lifetime: chartsUsedThisPeriod stays at 0 (effectively unlimited)
  await rawExecute(
    `INSERT INTO ChartSubscription (
      id, subscriptionId, userId, customerEmail, customerName, deviceId,
      tier, period, provider, status,
      chartsPerPeriod, chartsUsedThisPeriod,
      periodStart, periodEnd, createdAt, updatedAt, rawEvent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(subscriptionId) DO UPDATE SET
      userId = COALESCE(excluded.userId, ChartSubscription.userId),
      customerEmail = excluded.customerEmail,
      customerName = COALESCE(excluded.customerName, ChartSubscription.customerName),
      deviceId = COALESCE(excluded.deviceId, ChartSubscription.deviceId),
      status = excluded.status,
      periodEnd = excluded.periodEnd,
      updatedAt = CURRENT_TIMESTAMP,
      rawEvent = excluded.rawEvent`,
    [
      `sub_${params.subscriptionId}`,
      params.subscriptionId,
      params.userId || null,
      params.customerEmail,
      params.customerName || null,
      params.deviceId || null,
      params.tier,
      params.period,
      params.provider,
      params.status,
      chartsPerPeriod,
      params.periodEnd || null,
      (params.rawEvent || '').slice(0, 50000),
    ]
  )
}

/**
 * Mark a subscription as cancelled/expired (called from webhook when
 * subscription_cancelled or subscription_expired event fires).
 */
export async function deactivateChartSubscription(subscriptionId: string, status: string): Promise<void> {
  await initDb()
  await rawExecute(
    `UPDATE ChartSubscription SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE subscriptionId = ?`,
    [status, subscriptionId]
  )
}

/**
 * Look up the active subscription for a given device.
 * Returns the highest-tier active subscription (All-Access > Advanced > Pro).
 */
export async function getActiveSubscriptionForDevice(deviceId: string): Promise<ChartSubscriptionRecord | null> {
  if (!deviceId) return null
  await initDb()
  const rows = await rawQuery<ChartSubscriptionRecord>(
    `SELECT subscriptionId, userId, customerEmail, customerName, deviceId,
            tier, period, provider, status,
            chartsPerPeriod, chartsUsedThisPeriod,
            periodStart, periodEnd
     FROM ChartSubscription
     WHERE deviceId = ? AND status IN ('active', 'trialing', 'past_due')
     ORDER BY CASE tier
       WHEN 'all_access' THEN 3
       WHEN 'advanced' THEN 2
       WHEN 'pro' THEN 1
       ELSE 0
     END DESC, updatedAt DESC
     LIMIT 1`,
    [deviceId]
  )
  return rows[0] || null
}

/**
 * Look up active subscriptions by Whop userId.
 */
export async function getActiveSubscriptionForUser(userId: string): Promise<ChartSubscriptionRecord | null> {
  if (!userId) return null
  await initDb()
  const rows = await rawQuery<ChartSubscriptionRecord>(
    `SELECT subscriptionId, userId, customerEmail, customerName, deviceId,
            tier, period, provider, status,
            chartsPerPeriod, chartsUsedThisPeriod,
            periodStart, periodEnd
     FROM ChartSubscription
     WHERE userId = ? AND status IN ('active', 'trialing', 'past_due')
     ORDER BY CASE tier
       WHEN 'all_access' THEN 3
       WHEN 'advanced' THEN 2
       WHEN 'pro' THEN 1
       ELSE 0
     END DESC, updatedAt DESC
     LIMIT 1`,
    [userId]
  )
  return rows[0] || null
}

// ──────────────────── Chart budget logic ────────────────────

/**
 * Determine if a device can generate a NEW chart analysis (i.e., a chart
 * it hasn't analyzed before in this billing period).
 *
 * Rules:
 *   - Lifetime subscribers: always allowed (chartsPerPeriod = 999999)
 *   - Monthly/yearly subscribers: allowed if chartsUsedThisPeriod < chartsPerPeriod
 *   - Non-subscribers: fall back to legacy free-tier check (handled by caller)
 *
 * Cached re-analyses (same cacheKey) don't count — those are always free.
 *
 * Returns: { allowed: boolean, reason?: string, remainingCharts?: number }
 */
export async function canGenerateNewChart(
  deviceId: string,
  cacheKey: string,
): Promise<{ allowed: boolean; reason?: string; remainingCharts?: number; subscription?: ChartSubscriptionRecord }> {
  // Check if this chart was already analyzed (cache hit — always allowed)
  await initDb()
  const existingUsage = await rawQuery<{ id: string }>(
    `SELECT id FROM DeviceUsage WHERE deviceId = ? AND cacheKey = ? LIMIT 1`,
    [deviceId, cacheKey]
  )
  if (existingUsage.length > 0) {
    return { allowed: true, reason: 'cached', remainingCharts: undefined }
  }

  // New chart — check subscription budget
  const sub = await getActiveSubscriptionForDevice(deviceId)
  if (!sub) {
    return {
      allowed: false,
      reason: 'no_subscription',
      remainingCharts: 0,
    }
  }

  // Check if subscription period has ended (for monthly/yearly)
  if (sub.periodEnd && sub.period !== 'lifetime') {
    const periodEndDate = new Date(sub.periodEnd)
    if (periodEndDate.getTime() < Date.now()) {
      return {
        allowed: false,
        reason: 'subscription_expired',
        remainingCharts: 0,
        subscription: sub,
      }
    }

    // If period ended but sub still active (grace period), reset counter
    // (This is a safety check — webhooks should reset the counter on renewal)
    if (sub.chartsUsedThisPeriod >= sub.chartsPerPeriod) {
      // Check if we're past periodEnd — if so, the webhook may not have fired yet
      // Allow 24-hour grace period
      const graceEnd = new Date(periodEndDate.getTime() + 24 * 60 * 60 * 1000)
      if (graceEnd.getTime() > Date.now()) {
        return {
          allowed: true,
          reason: 'grace_period',
          remainingCharts: sub.chartsPerPeriod,
          subscription: sub,
        }
      }
    }
  }

  if (sub.chartsUsedThisPeriod >= sub.chartsPerPeriod) {
    return {
      allowed: false,
      reason: 'budget_exhausted',
      remainingCharts: 0,
      subscription: sub,
    }
  }

  return {
    allowed: true,
    reason: 'within_budget',
    remainingCharts: sub.chartsPerPeriod - sub.chartsUsedThisPeriod,
    subscription: sub,
  }
}

/**
 * Increment the chart counter for a subscriber's current billing period.
 * Called AFTER a new chart analysis is successfully generated.
 *
 * Note: this is best-effort — even if it fails, the analysis is already
 * cached and the user can view it. The counter is a soft limit.
 */
export async function incrementChartUsage(deviceId: string): Promise<void> {
  await initDb()
  // Find the active subscription and increment its counter
  await rawExecute(
    `UPDATE ChartSubscription
     SET chartsUsedThisPeriod = chartsUsedThisPeriod + 1,
         updatedAt = CURRENT_TIMESTAMP
     WHERE deviceId = ? AND status IN ('active', 'trialing', 'past_due')
     ORDER BY CASE tier
       WHEN 'all_access' THEN 3
       WHEN 'advanced' THEN 2
       WHEN 'pro' THEN 1
       ELSE 0
     END DESC
     LIMIT 1`,
    [deviceId]
  )
}

/**
 * Get a summary of the subscriber's current chart budget.
 * Used by the front-end to show "2 of 2 charts used this month".
 */
export async function getSubscriptionStatusForDevice(deviceId: string): Promise<{
  hasActiveSubscription: boolean
  tier: SubscriptionTier | null
  period: SubscriptionPeriod | null
  chartsUsedThisPeriod: number
  chartsPerPeriod: number
  periodEnd: string | null
  remainingCharts: number
  includesHoroscopeBonus: boolean
} | null> {
  if (!deviceId) return null
  const sub = await getActiveSubscriptionForDevice(deviceId)
  if (!sub) {
    return {
      hasActiveSubscription: false,
      tier: null,
      period: null,
      chartsUsedThisPeriod: 0,
      chartsPerPeriod: 0,
      periodEnd: null,
      remainingCharts: 0,
      includesHoroscopeBonus: false,
    }
  }
  const remaining = Math.max(0, sub.chartsPerPeriod - sub.chartsUsedThisPeriod)
  return {
    hasActiveSubscription: true,
    tier: sub.tier,
    period: sub.period,
    chartsUsedThisPeriod: sub.chartsUsedThisPeriod,
    chartsPerPeriod: sub.chartsPerPeriod,
    periodEnd: sub.periodEnd,
    remainingCharts: remaining,
    includesHoroscopeBonus: true,  // All active subscribers get horoscope bonus
  }
}

// ──────────────────── Bundle purchase helpers ────────────────────

/**
 * Get all active bundle purchases for a device.
 * Each bundle grants 1 chart's worth of access to its included analyses.
 */
export async function getActiveBundlePurchasesForDevice(deviceId: string): Promise<Array<{
  orderId: string
  bundleSlug: string
  bundleName: string | null
  analysesIncluded: string  // comma-separated
  chartsAllowed: number
  chartsUsed: number
  status: string
}>> {
  if (!deviceId) return []
  await initDb()
  return await rawQuery<{
    orderId: string
    bundleSlug: string
    bundleName: string | null
    analysesIncluded: string
    chartsAllowed: number
    chartsUsed: number
    status: string
  }>(
    `SELECT orderId, bundleSlug, bundleName, analysesIncluded, chartsAllowed, chartsUsed, status
     FROM BundlePurchase
     WHERE deviceId = ? AND status = 'active'
     ORDER BY createdAt DESC`,
    [deviceId]
  )
}

/**
 * Record a new bundle purchase (called from webhook when an order completes).
 */
export async function recordBundlePurchase(params: {
  orderId: string
  customerEmail: string
  customerName?: string | null
  deviceId?: string | null
  bundleSlug: string
  bundleName?: string | null
  analysesIncluded: string[]  // array of analysisTypes
  provider: PaymentProvider
  priceCents: number
  currency?: string
  rawEvent?: string
}): Promise<void> {
  await initDb()
  await rawExecute(
    `INSERT INTO BundlePurchase (
      id, orderId, customerEmail, customerName, deviceId,
      bundleSlug, bundleName, analysesIncluded,
      provider, priceCents, currency,
      chartsAllowed, chartsUsed, status,
      createdAt, rawEvent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'active', CURRENT_TIMESTAMP, ?)
    ON CONFLICT(orderId) DO UPDATE SET
      customerEmail = excluded.customerEmail,
      customerName = COALESCE(excluded.customerName, BundlePurchase.customerName),
      deviceId = COALESCE(excluded.deviceId, BundlePurchase.deviceId),
      status = excluded.status,
      rawEvent = excluded.rawEvent`,
    [
      `bp_${params.orderId}`,
      params.orderId,
      params.customerEmail,
      params.customerName || null,
      params.deviceId || null,
      params.bundleSlug,
      params.bundleName || null,
      params.analysesIncluded.join(','),
      params.provider,
      params.priceCents,
      params.currency || 'USD',
      (params.rawEvent || '').slice(0, 50000),
    ]
  )
}

/**
 * Mark a bundle purchase as refunded (so the buyer loses access to NEW
 * generations — cached results remain viewable per the "cached forever"
 * guarantee).
 */
export async function refundBundlePurchase(orderId: string): Promise<void> {
  await initDb()
  await rawExecute(
    `UPDATE BundlePurchase SET status = 'refunded' WHERE orderId = ?`,
    [orderId]
  )
}
