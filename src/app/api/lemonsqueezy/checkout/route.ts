import { NextRequest, NextResponse } from 'next/server'
import { getCheckoutUrl, isLsConfigured } from '@/lib/lemonsqueezy'

// GET /api/lemonsqueezy/checkout
// Returns a Lemon Squeezy checkout URL for the configured variant.
//
// Behavior:
//   - If called with Accept: application/json (e.g. from fetch()), returns JSON
//     { url: string } so the client can redirect or open in a new tab.
//   - If called from a browser <a> click (default Accept), redirects directly
//     to the Lemon Squeezy checkout page.
//
// Query params (all optional):
//   email        — pre-fill the checkout email
//   name         — pre-fill the checkout name
//   deviceId     — stored as custom_data so the webhook can grant access to
//                  the device the user was browsing from when they paid
//   discountCode — apply a discount code at checkout
//   redirect     — if "true", force redirect mode even with JSON Accept header
//                  if "false", force JSON mode even from a browser request

export async function GET(request: NextRequest) {
  if (!isLsConfigured()) {
    return NextResponse.json(
      { detail: 'Lemon Squeezy not configured. Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID.' },
      { status: 503 }
    )
  }

  const sp = request.nextUrl.searchParams
  const email = sp.get('email') || undefined
  const name = sp.get('name') || undefined
  const deviceId = sp.get('deviceId') || undefined
  const discountCode = sp.get('discountCode') || undefined

  const { url, error } = await getCheckoutUrl({ email, name, deviceId, discountCode })

  if (!url) {
    return NextResponse.json({ detail: error || 'Failed to create checkout URL' }, { status: 500 })
  }

  // Decide: redirect vs JSON
  const acceptHeader = request.headers.get('accept') || ''
  const wantsJson = acceptHeader.includes('application/json')
  const forceRedirect = sp.get('redirect') === 'true'
  const forceJson = sp.get('redirect') === 'false'

  if (forceJson || (wantsJson && !forceRedirect)) {
    return NextResponse.json({ url })
  }

  // Browser click → redirect
  return NextResponse.redirect(url)
}
