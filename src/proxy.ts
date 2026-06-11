import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, getCookieName } from '@/lib/admin-auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /admin (except /admin/login which is the login page)
  if (pathname === '/admin') {
    const token = request.cookies.get(getCookieName())?.value
    if (!token || !(await verifySessionToken(token))) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Protect /api/admin/* routes (except /api/admin/login and /api/admin/logout)
  if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login' && pathname !== '/api/admin/logout') {
    const token = request.cookies.get(getCookieName())?.value
    if (!token) {
      console.warn(`[Proxy] No admin session cookie for ${pathname}`)
      return NextResponse.json({ detail: 'Unauthorized. Admin authentication required.' }, { status: 401 })
    }
    const isValid = await verifySessionToken(token)
    if (!isValid) {
      console.warn(`[Proxy] Invalid/expired admin session for ${pathname}`)
      return NextResponse.json({ detail: 'Unauthorized. Admin authentication required.' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/api/admin/:path*'],
}
