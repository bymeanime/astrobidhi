import { NextRequest, NextResponse } from 'next/server'
import { revokeWhopToken, decodeSession } from '@/lib/whop'

export async function POST(request: NextRequest) {
  // Get session to revoke token
  const cookie = request.cookies.get('whop_session')?.value
  if (cookie) {
    const session = decodeSession(cookie)
    if (session?.refreshToken) {
      try {
        await revokeWhopToken(session.refreshToken)
      } catch { /* ignore */ }
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out from Whop' })
  response.cookies.set('whop_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
