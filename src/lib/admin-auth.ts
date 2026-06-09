// Admin authentication utilities
// Uses HMAC-signed session tokens stored in HTTP-only cookies

import { createHmac, timingSafeEqual } from 'crypto'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'astrobidhi2024'
const SESSION_SECRET = process.env.SESSION_SECRET || 'astrobidhi-session-secret-change-in-production'
const COOKIE_NAME = 'admin_session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

export function verifyAdminPassword(password: string): boolean {
  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(password, 'utf8')
  const b = Buffer.from(ADMIN_PASSWORD, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const payload = `${expiresAt}:${Math.random().toString(36).substring(2)}`
  const signature = createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex')
  return `${payload}:${signature}`
}

export function verifySessionToken(token: string): boolean {
  try {
    const parts = token.split(':')
    if (parts.length !== 3) return false

    const expiresAt = parseInt(parts[0], 10)
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false

    const payload = `${parts[0]}:${parts[1]}`
    const expectedSignature = createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex')

    // Timing-safe comparison
    const a = Buffer.from(parts[2], 'utf8')
    const b = Buffer.from(expectedSignature, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function getCookieName(): string {
  return COOKIE_NAME
}

export function getSessionDuration(): number {
  return SESSION_DURATION_MS
}

/**
 * Verify admin session from a Request object (for use in API routes and middleware)
 */
export function verifyAdminRequest(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )
  const token = cookies[COOKIE_NAME]
  if (!token) return false
  return verifySessionToken(token)
}
