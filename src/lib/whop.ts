// Whop.com integration utilities
// Handles OAuth authentication, membership verification, and signed sessions
//
// IMPORTANT: Whop is used as a private payment/membership system for AstroBidhi.
// We do NOT publish to the Whop App Store. This integration lets users buy a
// Whop product, then log into AstroBidhi via OAuth to unlock premium features.

import { createHmac, timingSafeEqual } from 'crypto'

export const WHOP_CONFIG = {
  appId: process.env.WHOP_APP_ID || '',
  clientSecret: process.env.WHOP_CLIENT_SECRET || '',
  apiKey: process.env.WHOP_API_KEY || '',
  companyId: process.env.WHOP_COMPANY_ID || '',
  productId: process.env.WHOP_PRODUCT_ID || '',        // Product to check access for
  experienceId: process.env.WHOP_EXPERIENCE_ID || '',  // Experience to check access for
  redirectUri: process.env.WHOP_REDIRECT_URI || '',
  checkoutUrl: process.env.WHOP_CHECKOUT_URL || '',    // Direct checkout URL — bypasses OAuth for buy flow
}

// Session secret — falls back to admin's secret so existing deployments keep working
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'astrobidhi-session-secret-change-in-production'

export interface WhopUser {
  id: string
  name?: string
  email?: string
  username?: string
  picture?: string
}

export interface WhopMembership {
  id: string
  status: string
  productId: string
  productTitle?: string
  planId: string
}

export interface WhopAccessResult {
  hasAccess: boolean
  accessLevel: 'customer' | 'admin' | 'no_access'
}

export interface WhopSession {
  userId: string
  name: string
  email: string
  picture: string
  accessToken: string
  refreshToken: string
  hasAccess: boolean
  accessLevel: string
  expiresAt: number
}

// ──────────────────── Signed session cookie helpers ────────────────────
// Sessions are stored as base64url(payload).base64url(hmac) — NOT encrypted,
// but HMAC-signed so users cannot tamper with the contents. Tokens inside
// (access_token, refresh_token) are still secrets only readable server-side.

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64url')
}

function unb64url(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

function signPayload(payload: string): string {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
}

/**
 * Encode a session object into a signed cookie string.
 * Format: base64url(JSON).hmac
 */
export function encodeSession(session: WhopSession): string {
  const json = JSON.stringify(session)
  const payload = b64url(json)
  const sig = signPayload(payload)
  return `${payload}.${sig}`
}

/**
 * Decode and verify a signed session cookie.
 * Returns null if the signature is invalid or the format is wrong.
 */
export function decodeSession(cookie: string): WhopSession | null {
  if (!cookie || typeof cookie !== 'string') return null
  const parts = cookie.split('.')
  if (parts.length !== 2) return null

  const [payload, sig] = parts
  const expectedSig = signPayload(payload)

  // Timing-safe comparison of the signatures
  try {
    const a = Buffer.from(sig, 'base64url')
    const b = Buffer.from(expectedSig, 'base64url')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const json = unb64url(payload).toString('utf8')
    return JSON.parse(json) as WhopSession
  } catch {
    return null
  }
}

// ──────────────────── OAuth flow ────────────────────

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const response = await fetch('https://api.whop.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: WHOP_CONFIG.redirectUri,
      client_id: WHOP_CONFIG.appId,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json() as Promise<{
    access_token: string
    refresh_token: string
    id_token?: string
    token_type: string
    expires_in: number
  }>
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://api.whop.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: WHOP_CONFIG.appId,
    }),
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  return response.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

/**
 * Get user info from Whop using access token
 */
export async function getWhopUserInfo(accessToken: string): Promise<WhopUser> {
  const response = await fetch('https://api.whop.com/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  return response.json()
}

/**
 * Check if a user has access to a resource (product/experience/company)
 * Uses the server-side API key
 */
export async function checkUserAccess(userId: string): Promise<WhopAccessResult> {
  const resourceId = WHOP_CONFIG.experienceId || WHOP_CONFIG.productId || WHOP_CONFIG.companyId
  if (!resourceId) {
    console.warn('[Whop] No resource ID configured for access check')
    return { hasAccess: false, accessLevel: 'no_access' }
  }

  try {
    const response = await fetch(
      `https://api.whop.com/api/v1/users/${userId}/access/${resourceId}`,
      {
        headers: { Authorization: `Bearer ${WHOP_CONFIG.apiKey}` },
      }
    )

    if (!response.ok) {
      console.error('[Whop] Access check failed:', response.status)
      return { hasAccess: false, accessLevel: 'no_access' }
    }

    const data = await response.json() as { has_access: boolean; access_level: string }
    return {
      hasAccess: data.has_access,
      accessLevel: data.access_level as WhopAccessResult['accessLevel'],
    }
  } catch (error) {
    console.error('[Whop] Access check error:', error)
    return { hasAccess: false, accessLevel: 'no_access' }
  }
}

/**
 * List a user's active memberships
 */
export async function getUserMemberships(userId: string): Promise<WhopMembership[]> {
  try {
    const response = await fetch(
      `https://api.whop.com/api/v1/memberships?user_id=${userId}&status=active`,
      {
        headers: { Authorization: `Bearer ${WHOP_CONFIG.apiKey}` },
      }
    )

    if (!response.ok) {
      console.error('[Whop] Memberships fetch failed:', response.status)
      return []
    }

    const data = await response.json() as { data: Array<{ id: string; status: string; product: { id: string; title: string }; plan: { id: string } }> }
    return data.data.map(m => ({
      id: m.id,
      status: m.status,
      productId: m.product.id,
      productTitle: m.product.title,
      planId: m.plan.id,
    }))
  } catch (error) {
    console.error('[Whop] Memberships error:', error)
    return []
  }
}

/**
 * Generate OAuth authorization URL with PKCE
 */
export function generateOAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: WHOP_CONFIG.appId,
    redirect_uri: WHOP_CONFIG.redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `https://api.whop.com/oauth/authorize?${params}`
}

/**
 * Revoke a Whop token (for logout)
 */
export async function revokeWhopToken(token: string): Promise<void> {
  try {
    await fetch('https://api.whop.com/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        client_id: WHOP_CONFIG.appId,
      }),
    })
  } catch (error) {
    console.error('[Whop] Token revocation error:', error)
  }
}

// ──────────────────── Configuration checks ────────────────────

/**
 * Check if Whop is properly configured for OAuth login.
 * Requires: WHOP_APP_ID + WHOP_API_KEY
 */
export function isWhopConfigured(): boolean {
  return !!(WHOP_CONFIG.appId && WHOP_CONFIG.apiKey)
}

/**
 * Returns a public-safe status object showing which Whop env vars are set.
 * Used by /api/whop/setup so admins can diagnose config issues without
 * exposing any secret values.
 */
export function getWhopConfigStatus() {
  return {
    configured: isWhopConfigured(),
    hasAppId: !!WHOP_CONFIG.appId,
    hasClientSecret: !!WHOP_CONFIG.clientSecret,
    hasApiKey: !!WHOP_CONFIG.apiKey,
    hasCompanyId: !!WHOP_CONFIG.companyId,
    hasProductId: !!WHOP_CONFIG.productId,
    hasExperienceId: !!WHOP_CONFIG.experienceId,
    hasRedirectUri: !!WHOP_CONFIG.redirectUri,
    hasCheckoutUrl: !!WHOP_CONFIG.checkoutUrl,
    // Show first/last few chars only — enough for the admin to verify they pasted the right key
    appIdPreview: WHOP_CONFIG.appId ? `${WHOP_CONFIG.appId.slice(0, 6)}…${WHOP_CONFIG.appId.slice(-4)}` : null,
    productIdPreview: WHOP_CONFIG.productId ? `${WHOP_CONFIG.productId.slice(0, 6)}…${WHOP_CONFIG.productId.slice(-4)}` : null,
    redirectUri: WHOP_CONFIG.redirectUri || null,
    checkoutUrl: WHOP_CONFIG.checkoutUrl || null,
  }
}

/**
 * Returns the Whop checkout URL. Falls back to constructing one from the
 * product ID if WHOP_CHECKOUT_URL is not set explicitly.
 *   https://whop.com/checkout/{productId}
 */
export function getCheckoutUrl(): string {
  if (WHOP_CONFIG.checkoutUrl) return WHOP_CONFIG.checkoutUrl
  if (WHOP_CONFIG.productId) return `https://whop.com/checkout/${WHOP_CONFIG.productId}`
  return ''
}
