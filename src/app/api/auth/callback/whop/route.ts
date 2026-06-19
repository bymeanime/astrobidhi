import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getWhopUserInfo,
  checkUserAccess,
  isWhopConfigured,
  encodeSession,
  getCheckoutUrl,
  type WhopSession,
} from '@/lib/whop'

export async function GET(request: NextRequest) {
  if (!isWhopConfigured()) {
    return NextResponse.redirect(new URL('/?error=whop_not_configured', request.url))
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth error
  if (error) {
    console.error('[Whop OAuth] Error:', error, searchParams.get('error_description'))
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }

  // Verify state for CSRF protection
  const storedState = request.cookies.get('whop_state')?.value
  if (state !== storedState) {
    console.error('[Whop OAuth] State mismatch')
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url))
  }

  // Get PKCE code verifier
  const codeVerifier = request.cookies.get('whop_code_verifier')?.value
  if (!codeVerifier) {
    console.error('[Whop OAuth] No code verifier found')
    return NextResponse.redirect(new URL('/?error=verifier_missing', request.url))
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier)

    // Get user info
    const userInfo = await getWhopUserInfo(tokens.access_token)

    // Check membership access
    const access = await checkUserAccess(userInfo.id)

    // Build session object
    const session: WhopSession = {
      userId: userInfo.id,
      name: userInfo.name || userInfo.username || '',
      email: userInfo.email || '',
      picture: userInfo.picture || '',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      hasAccess: access.hasAccess,
      accessLevel: access.accessLevel,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    }

    // HMAC-signed session cookie (replaces old plain base64 encoding)
    const cookieValue = encodeSession(session)

    // Decide where to send the user next:
    //  - Has access → back to the homepage, success toast
    //  - No access  → if we have a checkout URL, send them there; else homepage with hint
    const checkoutUrl = getCheckoutUrl()
    const redirectTo = (!access.hasAccess && checkoutUrl)
      ? new URL(checkoutUrl)
      : new URL('/?auth=success', request.url)

    const response = NextResponse.redirect(redirectTo)

    response.cookies.set('whop_session', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Clear PKCE cookies
    response.cookies.set('whop_code_verifier', '', { maxAge: 0, path: '/' })
    response.cookies.set('whop_state', '', { maxAge: 0, path: '/' })

    console.log(`[Whop OAuth] User ${userInfo.username || userInfo.id} logged in, access: ${access.accessLevel}${!access.hasAccess && checkoutUrl ? ' → redirected to checkout' : ''}`)
    return response
  } catch (error) {
    console.error('[Whop OAuth] Callback error:', error)
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', request.url))
  }
}
