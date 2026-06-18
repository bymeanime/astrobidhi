import { NextRequest, NextResponse } from 'next/server'
import {
  checkUserAccess,
  refreshAccessToken,
  getWhopUserInfo,
  isWhopConfigured,
  decodeSession,
  encodeSession,
  getCheckoutUrl,
  type WhopSession,
} from '@/lib/whop'

function getSession(request: NextRequest): WhopSession | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  return decodeSession(cookie)
}

export async function GET(request: NextRequest) {
  // Check if Whop is configured at all
  const configured = isWhopConfigured()

  if (!configured) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      accessLevel: 'no_access',
      configured: false,
      checkoutUrl: getCheckoutUrl() || null,
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
      checkoutUrl: getCheckoutUrl() || null,
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
        checkoutUrl: getCheckoutUrl() || null,
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
        checkoutUrl: getCheckoutUrl() || null,
        user: null,
        error: 'Session expired',
      })
    }
  }

  return NextResponse.json({
    authenticated: true,
    hasAccess: session.hasAccess,
    accessLevel: session.accessLevel,
    configured: true,
    checkoutUrl: getCheckoutUrl() || null,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      picture: session.picture,
    },
  })
}
