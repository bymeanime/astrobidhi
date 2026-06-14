import { NextResponse } from 'next/server'
import { generateOAuthUrl, isWhopConfigured } from '@/lib/whop'
import { randomBytes, createHash } from 'crypto'

export async function GET() {
  if (!isWhopConfigured()) {
    return NextResponse.json(
      { detail: 'Whop integration not configured. Set WHOP_APP_ID and WHOP_API_KEY environment variables.' },
      { status: 503 }
    )
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  // Generate state for CSRF protection
  const state = randomBytes(16).toString('hex')

  // Store PKCE verifier and state in cookies for the callback
  const authUrl = generateOAuthUrl(state, codeChallenge)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('whop_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  response.cookies.set('whop_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  return response
}
