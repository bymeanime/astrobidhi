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

function getSession(request: NextRequest): WhopSession | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  return decodeSession(cookie)
}

/**
 * Look up the user's Whop subscription status from the local DB
 * (populated by /api/whop/webhook). Returns null if no record exists
 * or the table doesn't exist yet.
 *
 * When this returns a valid record, /api/auth/me uses it to determine
 * hasAccess WITHOUT calling Whop's API — saves ~200ms per request.
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

    // 'trialing' and 'past_due' still get access in Whop's model
    return {
      hasAccess: true,
      accessLevel: row.status === 'trialing' ? 'customer' : 'customer',
      status: row.status,
    }
  } catch {
    // Table doesn't exist or query failed — fall back to API check
    return null
  }
}

export async function GET(request: NextRequest) {
  // ── Build a unified payment config block ──
  // The front-end uses this to decide which "Buy Now" buttons to show.
  const whopConfigured = isWhopConfigured()
  const lsConfigured = isLsConfigured()
  const lsStatus = getLsConfigStatus()

  // Get Whop checkout URL (sync — already cached)
  const whopCheckoutUrl = whopConfigured ? (getWhopCheckoutUrl() || null) : null
  const whopManageUrl = whopConfigured ? getWhopManageUrl() : null
  const whopTiers = whopConfigured ? getWhopTiers() : []

  // Get LS checkout URL (async — needs API call if no static URL set, but
  // we return the static one immediately for speed)
  const lsCheckoutUrl = lsConfigured
    ? (lsStatus.checkoutUrl || `https://[store-id].lemonsqueezy.com/checkout/buy/${lsStatus.variantId}`)
    : null
  const lsManageUrl = lsConfigured ? getLsManageUrl() : null
  const lsTiers = lsConfigured ? getLsTiers() : []

  // Per-analysis variant mappings (for "Buy this analysis" buttons)
  const analysisVariantMappings = lsConfigured ? await getAllAnalysisVariantMappings() : []

  const paymentConfig = {
    whop: {
      configured: whopConfigured,
      checkoutUrl: whopCheckoutUrl,
      manageUrl: whopManageUrl,
      tiers: whopTiers,
    },
    lemonsqueezy: {
      configured: lsConfigured,
      checkoutUrl: lsCheckoutUrl,
      manageUrl: lsManageUrl,
      hasWebhookSecret: lsStatus.hasWebhookSecret,
      tiers: lsTiers,
      analysisVariantMappings,
    },
  }

  // If neither is configured, return early with the payment config so the
  // front-end can show appropriate "coming soon" messaging.
  if (!whopConfigured) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      accessLevel: 'no_access',
      configured: false,
      checkoutUrl: whopCheckoutUrl,
      payment: paymentConfig,
      user: null,
    })
  }

  const session = getSession(request)

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      accessLevel: 'no_access',
      configured: true,
      checkoutUrl: whopCheckoutUrl,
      payment: paymentConfig,
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

      // Refresh user info and access
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
        user: {
          id: session.userId,
          name: session.name,
          email: session.email,
          picture: session.picture,
        },
      })

      // Re-encode with new signature
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
        user: null,
        error: 'Session expired',
      })
    }
  }

  // ── Try cached subscription first (no API call needed) ──
  // If the webhook is configured and has populated WhopSubscription rows,
  // we can determine access without hitting Whop's API on every request.
  let effectiveHasAccess = session.hasAccess
  let effectiveAccessLevel = session.accessLevel
  const cached = await getCachedWhopSubscription(session.userId)
  if (cached) {
    effectiveHasAccess = cached.hasAccess
    effectiveAccessLevel = cached.accessLevel
    // Update session if changed (so cookie stays consistent)
    if (session.hasAccess !== effectiveHasAccess || session.accessLevel !== effectiveAccessLevel) {
      session.hasAccess = effectiveHasAccess
      session.accessLevel = effectiveAccessLevel
    }
  } else if (session.hasAccess) {
    // No cached record but session says hasAccess=true — verify with Whop API
    // (this catches the case where user cancelled but webhook isn't set up yet)
    try {
      const access = await checkUserAccess(session.userId)
      session.hasAccess = access.hasAccess
      session.accessLevel = access.accessLevel
      effectiveHasAccess = access.hasAccess
      effectiveAccessLevel = access.accessLevel
    } catch {
      // API call failed — keep the session value
    }
  }

  return NextResponse.json({
    authenticated: true,
    hasAccess: effectiveHasAccess,
    accessLevel: effectiveAccessLevel,
    configured: true,
    checkoutUrl: whopCheckoutUrl,
    payment: paymentConfig,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      picture: session.picture,
    },
  })
}
