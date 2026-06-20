import { NextRequest, NextResponse } from 'next/server'
import { getCheckoutUrl, isLsConfigured, type Tier } from '@/lib/lemonsqueezy'
import { getLsVariantIdForTier, type SubscriptionTier, type SubscriptionPeriod } from '@/lib/subscriptions'

// GET /api/lemonsqueezy/checkout
// Returns a Lemon Squeezy checkout URL.
//
// Query params:
//   email, name, deviceId, discountCode — standard prefill/customization
//   tier + period — new 3-tier subscription model
//     e.g. ?tier=pro&period=monthly → uses LEMONSQUEEZY_VARIANT_PRO_MONTHLY
//   tier (legacy) — old single-tier model: 'monthly' | 'yearly' | 'lifetime'
//   analysisType — per-analysis one-time purchase (overrides tier)
//   bundle — bundle slug for bundle purchases (overrides tier/analysisType)
//   redirect — 'true' to force redirect, 'false' to force JSON

export async function GET(request: NextRequest) {
  if (!isLsConfigured()) {
    return NextResponse.json(
      { detail: 'Lemon Squeezy not configured. Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID.' },
      { status: 503 }
    )
  }

  const sp = request.nextUrl.searchParams
  const email = sp.get('email') || undefined
  const name = sp.get('name') || undefined
  const deviceId = sp.get('deviceId') || undefined
  const discountCode = sp.get('discountCode') || undefined
  const analysisType = sp.get('analysisType') || undefined
  const bundle = sp.get('bundle') || undefined

  // New 3-tier model: ?tier=pro&period=monthly
  const tierParam = sp.get('tier') as SubscriptionTier | null
  const periodParam = sp.get('period') as SubscriptionPeriod | null

  // Legacy: ?tier=monthly (no period param)
  const legacyTierParam = sp.get('tier') as Tier | null

  let checkoutResult: { url: string | null; error?: string }

  if (analysisType) {
    // Per-analysis one-time purchase
    checkoutResult = await getCheckoutUrl({ email, name, deviceId, discountCode, analysisType })
  } else if (tierParam && periodParam) {
    // New 3-tier subscription: look up variant from env
    const validTiers: SubscriptionTier[] = ['pro', 'advanced', 'all_access']
    const validPeriods: SubscriptionPeriod[] = ['monthly', 'yearly', 'lifetime']
    if (!validTiers.includes(tierParam)) {
      return NextResponse.json({ detail: `Invalid tier: ${tierParam}. Must be pro, advanced, or all_access.` }, { status: 400 })
    }
    if (!validPeriods.includes(periodParam)) {
      return NextResponse.json({ detail: `Invalid period: ${periodParam}. Must be monthly, yearly, or lifetime.` }, { status: 400 })
    }

    const variantId = getLsVariantIdForTier(tierParam, periodParam)
    if (!variantId) {
      return NextResponse.json({ detail: `No LS variant configured for ${tierParam}/${periodParam}. Set LEMONSQUEEZY_VARIANT_${tierParam.toUpperCase()}_${periodParam.toUpperCase()} in .env.` }, { status: 503 })
    }

    // Build a direct checkout URL with the variant ID
    const checkoutUrlBase = process.env[`LEMONSQUEEZY_CHECKOUT_URL_${tierParam.toUpperCase()}_${periodParam.toUpperCase()}`]
    if (checkoutUrlBase) {
      const url = new URL(checkoutUrlBase)
      if (email) url.searchParams.set('checkout[email]', email)
      if (name) url.searchParams.set('checkout[name]', name)
      checkoutResult = { url: url.toString() }
    } else {
      // Generate via API
      checkoutResult = await getCheckoutUrl({
        email, name, deviceId, discountCode,
        tier: periodParam as Tier,  // Cast for legacy code path
      })
      // Override the variant ID manually if needed
      if (checkoutResult.url === null) {
        checkoutResult = { url: null, error: `Failed to create checkout for ${tierParam}/${periodParam}` }
      }
    }
  } else if (legacyTierParam) {
    // Legacy: ?tier=monthly (treats tier as the period)
    if (legacyTierParam === 'monthly' || legacyTierParam === 'yearly' || legacyTierParam === 'lifetime') {
      checkoutResult = await getCheckoutUrl({ email, name, deviceId, discountCode, tier: legacyTierParam })
    } else {
      return NextResponse.json({ detail: `Invalid tier: ${legacyTierParam}` }, { status: 400 })
    }
  } else if (bundle) {
    // Bundle purchase (Phase 2 — not yet implemented for checkout)
    return NextResponse.json({ detail: `Bundle checkout coming soon. Bundle: ${bundle}` }, { status: 501 })
  } else {
    // Default — use whatever's configured
    checkoutResult = await getCheckoutUrl({ email, name, deviceId, discountCode })
  }

  if (!checkoutResult.url) {
    return NextResponse.json({ detail: checkoutResult.error || 'Failed to create checkout URL' }, { status: 500 })
  }

  // Decide: redirect vs JSON
  const acceptHeader = request.headers.get('accept') || ''
  const wantsJson = acceptHeader.includes('application/json')
  const forceRedirect = sp.get('redirect') === 'true'
  const forceJson = sp.get('redirect') === 'false'

  if (forceJson || (wantsJson && !forceRedirect)) {
    return NextResponse.json({ url: checkoutResult.url })
  }

  return NextResponse.redirect(checkoutResult.url)
}
