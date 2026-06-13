import { NextRequest, NextResponse } from 'next/server'
import { checkUserAccess, getUserMemberships, isWhopConfigured } from '@/lib/whop'

export async function GET(request: NextRequest) {
  if (!isWhopConfigured()) {
    return NextResponse.json({
      configured: false,
      hasAccess: false,
      message: 'Whop integration not configured. Add WHOP_APP_ID and WHOP_API_KEY to your environment variables.',
    })
  }

  // Get user ID from session cookie
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) {
    return NextResponse.json({ configured: true, hasAccess: false, authenticated: false })
  }

  try {
    const session = JSON.parse(Buffer.from(cookie, 'base64').toString()) as {
      userId: string
      hasAccess: boolean
      accessLevel: string
    }

    // Re-check access in real-time
    const access = await checkUserAccess(session.userId)
    const memberships = await getUserMemberships(session.userId)

    return NextResponse.json({
      configured: true,
      authenticated: true,
      hasAccess: access.hasAccess,
      accessLevel: access.accessLevel,
      memberships,
    })
  } catch (error) {
    console.error('[Whop Access] Error:', error)
    return NextResponse.json({ configured: true, hasAccess: false, error: 'Failed to check access' })
  }
}
