import { NextResponse } from 'next/server'
import { getCookieName } from '@/lib/admin-auth'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out' })
  response.cookies.set(getCookieName(), '', {
    httpOnly: true,
    secure: false, // Must match login cookie settings (behind reverse proxy)
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
