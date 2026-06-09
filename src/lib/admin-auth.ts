// Admin authentication utilities
// Uses Web Crypto API (Edge Runtime compatible) for HMAC-signed session tokens
// stored in HTTP-only cookies

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'astrobidhi2024'
const SESSION_SECRET = process.env.SESSION_SECRET || 'astrobidhi-session-secret-change-in-production'
const COOKIE_NAME = 'admin_session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

// Convert a string to an ArrayBuffer for Web Crypto API
function encode(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer
}

// Convert a hex string to ArrayBuffer
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Timing-safe comparison using Web Crypto API
// Compares two ArrayBuffers in constant time
async function timingSafeCompare(a: ArrayBuffer, b: ArrayBuffer): Promise<boolean> {
  if (a.byteLength !== b.byteLength) return false
  const aKey = await crypto.subtle.importKey('raw', a, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bKey = await crypto.subtle.importKey('raw', b, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const aSig = await crypto.subtle.sign('HMAC', aKey, new Uint8Array(1))
  const bSig = await crypto.subtle.sign('HMAC', bKey, new Uint8Array(1))
  return arrayBufferToHex(aSig) === arrayBufferToHex(bSig)
}

// Create HMAC-SHA256 signature using Web Crypto API
async function createHmacSignature(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encode(payload))
  return arrayBufferToHex(signature)
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  // Timing-safe comparison to prevent timing attacks
  const a = encode(password)
  const b = encode(ADMIN_PASSWORD)
  // Even if lengths differ, we still do the comparison to avoid timing leaks
  // We compare the password hash instead of raw values for better security
  const aHash = await createHmacSignature(password)
  const bHash = await createHmacSignature(ADMIN_PASSWORD)
  return aHash === bHash
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  // Use crypto.randomUUID() for cryptographically secure randomness (Edge Runtime compatible)
  const randomPart = crypto.randomUUID().replace(/-/g, '')
  const payload = `${expiresAt}:${randomPart}`
  const signature = await createHmacSignature(payload)
  return `${payload}:${signature}`
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(':')
    if (parts.length !== 3) return false

    const expiresAt = parseInt(parts[0], 10)
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false

    const payload = `${parts[0]}:${parts[1]}`
    const expectedSignature = await createHmacSignature(payload)

    // Timing-safe comparison of signatures
    return await timingSafeCompare(
      hexToArrayBuffer(parts[2]),
      hexToArrayBuffer(expectedSignature)
    )
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
export async function verifyAdminRequest(request: Request): Promise<boolean> {
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
