import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword, createSessionToken, getCookieName, getSessionDuration } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ detail: 'Password is required' }, { status: 400 })
    }

    console.log('[Admin Login] Attempt with password length:', password.length)

    // verifyAdminPassword is now async (uses Web Crypto API)
    const isValid = await verifyAdminPassword(password)
    if (!isValid) {
      console.log('[Admin Login] Invalid password attempt')
      return NextResponse.json({ detail: 'Invalid password' }, { status: 401 })
    }

    console.log('[Admin Login] Password verified, creating session token')

    // createSessionToken is now async (uses Web Crypto API)
    const token = await createSessionToken()
    const response = NextResponse.json({ success: true, message: 'Logged in successfully' })

    response.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: false, // Must be false when behind reverse proxy (Railway/Caddy terminates SSL)
      sameSite: 'lax',
      path: '/',
      maxAge: getSessionDuration() / 1000, // Convert ms to seconds
    })

    console.log('[Admin Login] Session cookie set, login successful')
    return response
  } catch (error) {
    console.error('[Admin Login] Error:', error)
    return NextResponse.json({ detail: 'Login failed: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
  }
}
