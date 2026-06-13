// Whop.com integration utilities
// Handles OAuth authentication and membership verification

export const WHOP_CONFIG = {
  appId: process.env.WHOP_APP_ID || '',
  clientSecret: process.env.WHOP_CLIENT_SECRET || '',
  apiKey: process.env.WHOP_API_KEY || '',
  companyId: process.env.WHOP_COMPANY_ID || '',
  productId: process.env.WHOP_PRODUCT_ID || '',        // Product to check access for
  experienceId: process.env.WHOP_EXPERIENCE_ID || '',  // Experience to check access for
  redirectUri: process.env.WHOP_REDIRECT_URI || '',
}

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

/**
 * Check if Whop is properly configured
 */
export function isWhopConfigured(): boolean {
  return !!(WHOP_CONFIG.appId && WHOP_CONFIG.apiKey)
}
