import { NextRequest, NextResponse } from 'next/server'
import { revokeWhopToken } from '@/lib/whop'

export async function POST(request: NextRequest) {
  // Get session to revoke token
  const cookie = request.cookies.get('whop_session')?.value
  if (cookie) {
    try {
      const session = JSON.parse(Buffer.from(cookie, 'base64').toString()) as {
        refreshToken: string
      }
      await revokeWhopToken(session.refreshToken)
    } catch {}
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
