import { NextRequest, NextResponse } from 'next/server'
import { checkUserAccess, refreshAccessToken, getWhopUserInfo, isWhopConfigured } from '@/lib/whop'

interface WhopSession {
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

function getSession(request: NextRequest): WhopSession | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null

  try {
    return JSON.parse(Buffer.from(cookie, 'base64').toString()) as WhopSession
  } catch {
    return null
  }
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

      // Update session cookie
      const response = NextResponse.json({
        authenticated: true,
        hasAccess: session.hasAccess,
        accessLevel: session.accessLevel,
        configured: true,
        user: {
          id: session.userId,
          name: session.name,
          email: session.email,
          picture: session.picture,
        },
      })

      response.cookies.set('whop_session', Buffer.from(JSON.stringify(session)).toString('base64'), {
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
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      picture: session.picture,
    },
  })
}
