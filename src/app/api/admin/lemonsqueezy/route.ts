import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import {
  LS_CONFIG,
  getLsConfigStatus,
  pingLsApi,
  listRecentLsSubscriptions,
  getCheckoutUrl,
} from '@/lib/lemonsqueezy'

// GET /api/admin/lemonsqueezy — Admin-only LS integration status
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const status = getLsConfigStatus()
  const apiHealth = status.hasApiKey ? await pingLsApi() : { reachable: false, status: null, error: 'No API key' }
  const recentSubs = status.configured ? await listRecentLsSubscriptions(20) : []

  // Count by status
  const counts: Record<string, number> = {}
  for (const sub of recentSubs) {
    counts[sub.status] = (counts[sub.status] || 0) + 1
  }

  // Also get a fresh checkout URL test
  const checkoutTest = await getCheckoutUrl()

  return NextResponse.json({
    ...status,
    api: apiHealth,
    recentSubscriptions: recentSubs,
    countsByStatus: counts,
    checkoutUrlWorks: !!checkoutTest.url,
    checkoutUrlError: checkoutTest.error,
    // Full config for admin (no secrets, but full IDs)
    fullConfig: {
      storeId: LS_CONFIG.storeId || null,
      variantId: LS_CONFIG.variantId || null,
      hasApiKey: !!LS_CONFIG.apiKey,
      hasWebhookSecret: !!LS_CONFIG.webhookSecret,
      checkoutUrl: LS_CONFIG.checkoutUrl || null,
    },
  })
}
