import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword, createSessionToken, getCookieName, getSessionDuration } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ detail: 'Password is required' }, { status: 400 })
    }

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ detail: 'Invalid password' }, { status: 401 })
    }

    const token = createSessionToken()
    const response = NextResponse.json({ success: true, message: 'Logged in successfully' })

    response.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: getSessionDuration() / 1000, // Convert ms to seconds
    })

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json({ detail: 'Login failed' }, { status: 500 })
  }
}
