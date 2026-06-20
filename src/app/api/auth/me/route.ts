import { NextRequest, NextResponse } from 'next/server'
import {
  checkUserAccess,
  refreshAccessToken,
  getWhopUserInfo,
  isWhopConfigured,
  decodeSession,
  encodeSession,
  getCheckoutUrl as getWhopCheckoutUrl,
  getManageSubscriptionUrl as getWhopManageUrl,
  getAvailableTiers as getWhopTiers,
  type WhopSession,
} from '@/lib/whop'
import {
  isLsConfigured,
  getLsConfigStatus,
  getCheckoutUrl as getLsCheckoutUrl,
  getManageSubscriptionUrl as getLsManageUrl,
  getAvailableTiers as getLsTiers,
  getAllAnalysisVariantMappings,
} from '@/lib/lemonsqueezy'
import { rawQuery, initDb } from '@/lib/db'
import {
  getAvailableSubscriptionTiers,
  getSubscriptionStatusForDevice,
  getActiveBundlePurchasesForDevice,
  type SubscriptionTier,
  type SubscriptionPeriod,
} from '@/lib/subscriptions'

function getSession(request: NextRequest): WhopSession | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  return decodeSession(cookie)
}

/**
 * Look up the user's Whop subscription status from the local DB
 * (populated by /api/whop/webhook). Returns null if no record exists.
 */
async function getCachedWhopSubscription(userId: string): Promise<{ hasAccess: boolean; accessLevel: string; status: string } | null> {
  try {
    await initDb()
    const rows = await rawQuery<{ status: string; expiresAt: string | null }>(
      `SELECT status, expiresAt FROM WhopSubscription
       WHERE userId = ? AND status IN ('active', 'trialing', 'past_due')
       ORDER BY updatedAt DESC LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) return null

    const row = rows[0]
    const now = new Date().toISOString()
    if (row.expiresAt && new Date(row.expiresAt).toISOString() < now) {
      return { hasAccess: false, accessLevel: 'no_access', status: 'expired' }
    }

    return {
      hasAccess: true,
      accessLevel: 'customer',
      status: row.status,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // ── Build a unified payment config block ──
  const whopConfigured = isWhopConfigured()
  const lsConfigured = isLsConfigured()
  const lsStatus = getLsConfigStatus()

  // Legacy single-tier checkout URLs (backwards compat)
  const whopCheckoutUrl = whopConfigured ? (getWhopCheckoutUrl() || null) : null
  const whopManageUrl = whopConfigured ? getWhopManageUrl() : null

  const lsCheckoutUrl = lsConfigured
    ? (lsStatus.checkoutUrl || (lsStatus.variantId ? `https://[store-id].lemonsqueezy.com/checkout/buy/${lsStatus.variantId}` : null))
    : null
  const lsManageUrl = lsConfigured ? getLsManageUrl() : null

  // New 3-tier subscription options (Pro/Advanced/All-Access × Monthly/Yearly/Lifetime)
  const lsSubscriptionTiers = lsConfigured ? getAvailableSubscriptionTiers('lemonsqueezy') : []
  const whopSubscriptionTiers = whopConfigured ? getAvailableSubscriptionTiers('whop') : []

  // Legacy tier lists (kept for backwards compat with old front-end code)
  const whopTiers = whopConfigured ? getWhopTiers() : []
  const lsTiers = lsConfigured ? getLsTiers() : []

  // Per-analysis variant mappings (for "Buy this analysis" one-time purchases)
  const analysisVariantMappings = lsConfigured ? await getAllAnalysisVariantMappings() : []

  const paymentConfig = {
    whop: {
      configured: whopConfigured,
      checkoutUrl: whopCheckoutUrl,
      manageUrl: whopManageUrl,
      tiers: whopTiers,
      subscriptionTiers: whopSubscriptionTiers,
    },
    lemonsqueezy: {
      configured: lsConfigured,
      checkoutUrl: lsCheckoutUrl,
      manageUrl: lsManageUrl,
      hasWebhookSecret: lsStatus.hasWebhookSecret,
      tiers: lsTiers,
      subscriptionTiers: lsSubscriptionTiers,
      analysisVariantMappings,
    },
  }

  // ── Look up the device's subscription + bundle status ──
  const deviceIdFromQuery = request.nextUrl.searchParams.get('deviceId')
  const deviceIdFromHeader = request.headers.get('x-device-id')
  const deviceId = deviceIdFromQuery || deviceIdFromHeader || ''

  let subscriptionStatus: {
    hasActiveSubscription: boolean
    tier: SubscriptionTier | null
    period: SubscriptionPeriod | null
    chartsUsedThisPeriod: number
    chartsPerPeriod: number
    periodEnd: string | null
    remainingCharts: number
    includesHoroscopeBonus: boolean
  } | null = null
  let bundlePurchases: Array<{
    orderId: string
    bundleSlug: string
    bundleName: string | null
    analysesIncluded: string
    chartsUsed: number
  }> = []

  if (deviceId) {
    try {
      subscriptionStatus = await getSubscriptionStatusForDevice(deviceId)
      const bundles = await getActiveBundlePurchasesForDevice(deviceId)
      bundlePurchases = bundles.map(b => ({
        orderId: b.orderId,
        bundleSlug: b.bundleSlug,
        bundleName: b.bundleName,
        analysesIncluded: b.analysesIncluded,
        chartsUsed: b.chartsUsed,
      }))
    } catch {
      // Tables might not exist yet — ignore
    }
  }

  // If neither provider is configured, return early
  if (!whopConfigured && !lsConfigured) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      accessLevel: 'no_access',
      configured: false,
      checkoutUrl: null,
      payment: paymentConfig,
      subscription: subscriptionStatus,
      bundles: bundlePurchases,
      user: null,
    })
  }

  const session = getSession(request)

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      accessLevel: 'no_access',
      configured: whopConfigured,
      checkoutUrl: whopCheckoutUrl,
      payment: paymentConfig,
      subscription: subscriptionStatus,
      bundles: bundlePurchases,
      user: null,
    })
  }

  // Check if access token is expired
  if (Date.now() > session.expiresAt) {
    try {
      const newTokens = await refreshAccessToken(session.refreshToken)
      session.accessToken = newTokens.access_token
      session.refreshToken = newTokens.refresh_token
      session.expiresAt = Date.now() + (newTokens.expires_in * 1000)

      const userInfo = await getWhopUserInfo(session.accessToken)
      const access = await checkUserAccess(userInfo.id)
      session.hasAccess = access.hasAccess
      session.accessLevel = access.accessLevel
      session.name = userInfo.name || session.name
      session.picture = userInfo.picture || session.picture

      const response = NextResponse.json({
        authenticated: true,
        hasAccess: session.hasAccess,
        accessLevel: session.accessLevel,
        configured: true,
        checkoutUrl: whopCheckoutUrl,
        payment: paymentConfig,
        subscription: subscriptionStatus,
        bundles: bundlePurchases,
        user: {
          id: session.userId,
          name: session.name,
          email: session.email,
          picture: session.picture,
        },
      })

      response.cookies.set('whop_session', encodeSession(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      })

      return response
    } catch (error) {
      console.error('[Auth/Me] Token refresh failed:', error)
      return NextResponse.json({
        authenticated: false,
        hasAccess: false,
        accessLevel: 'no_access',
        configured: true,
        checkoutUrl: whopCheckoutUrl,
        payment: paymentConfig,
        subscription: subscriptionStatus,
        bundles: bundlePurchases,
        user: null,
        error: 'Session expired',
      })
    }
  }

  // Try cached subscription first
  let effectiveHasAccess = session.hasAccess
  let effectiveAccessLevel = session.accessLevel
  const cached = await getCachedWhopSubscription(session.userId)
  if (cached) {
    effectiveHasAccess = cached.hasAccess
    effectiveAccessLevel = cached.accessLevel
    if (session.hasAccess !== effectiveHasAccess || session.accessLevel !== effectiveAccessLevel) {
      session.hasAccess = effectiveHasAccess
      session.accessLevel = effectiveAccessLevel
    }
  } else if (session.hasAccess) {
    try {
      const access = await checkUserAccess(session.userId)
      session.hasAccess = access.hasAccess
      session.accessLevel = access.accessLevel
      effectiveHasAccess = access.hasAccess
      effectiveAccessLevel = access.accessLevel
    } catch {
      // keep session value
    }
  }

  return NextResponse.json({
    authenticated: true,
    hasAccess: effectiveHasAccess,
    accessLevel: effectiveAccessLevel,
    configured: true,
    checkoutUrl: whopCheckoutUrl,
    payment: paymentConfig,
    subscription: subscriptionStatus,
    bundles: bundlePurchases,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      picture: session.picture,
    },
  })
}
