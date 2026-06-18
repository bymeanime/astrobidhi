import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import {
  WHOP_CONFIG,
  getWhopConfigStatus,
  getCheckoutUrl,
  type WhopMembership,
} from '@/lib/whop'

// GET /api/admin/whop — Admin-only Whop integration status
// Returns full config + recent memberships (requires admin auth)
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const status = getWhopConfigStatus()
  const checkoutUrl = getCheckoutUrl()

  // If we have an API key, also list recent memberships (across all users
  // in the company). This helps the admin see real activity.
  let recentMemberships: WhopMembership[] = []
  let membershipsError: string | null = null
  let apiStatusCode: number | null = null

  if (WHOP_CONFIG.apiKey) {
    try {
      // List the 20 most recent memberships for this company
      const url = new URL('https://api.whop.com/api/v1/memberships')
      url.searchParams.set('status', 'active')
      url.searchParams.set('per_page', '20')
      if (WHOP_CONFIG.productId) {
        url.searchParams.set('product_id', WHOP_CONFIG.productId)
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${WHOP_CONFIG.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      apiStatusCode = res.status

      if (res.ok) {
        const data = await res.json() as {
          data: Array<{
            id: string
            status: string
            user: { id: string; username?: string; email?: string; profile_pic_url?: string }
            product: { id: string; title: string }
            plan: { id: string; name?: string }
            created_at: string
            expires_at: string | null
          }>
        }
        recentMemberships = data.data.map(m => ({
          id: m.id,
          status: m.status,
          productId: m.product.id,
          productTitle: m.product.title,
          planId: m.plan.id,
        }))
      } else {
        const text = await res.text()
        membershipsError = `Whop API returned ${res.status}: ${text.slice(0, 200)}`
      }
    } catch (err) {
      membershipsError = err instanceof Error ? err.message : 'Network error'
    }
  }

  return NextResponse.json({
    ...status,
    checkoutUrl,
    api: {
      status: apiStatusCode,
      error: membershipsError,
    },
    recentMemberships,
    // Include full IDs (not just previews) for admin debugging
    fullConfig: {
      appId: WHOP_CONFIG.appId || null,
      productId: WHOP_CONFIG.productId || null,
      experienceId: WHOP_CONFIG.experienceId || null,
      companyId: WHOP_CONFIG.companyId || null,
      redirectUri: WHOP_CONFIG.redirectUri || null,
      hasClientSecret: !!WHOP_CONFIG.clientSecret,
      hasApiKey: !!WHOP_CONFIG.apiKey,
    },
  })
}
