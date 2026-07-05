import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { rawQuery, initDb } from '@/lib/db'
import { SUBSCRIPTION_PRICING, getLsVariantIdForTier, getWhopProductIdForTier, type SubscriptionTier, type SubscriptionPeriod } from '@/lib/subscriptions'

// GET /api/admin/subscriptions — Admin-only subscription overview
// Returns:
//   - All 9 tier definitions with prices
//   - Which LS variant IDs are configured (green) vs missing (red)
//   - Which Whop product IDs are configured
//   - Active subscriber count per tier
//   - Recent ChartSubscription records
//   - Revenue summary
export async function GET(request: NextRequest) {
  const isAuthed = await verifyAdminRequest(request)
  if (!isAuthed) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  // Build the 9-tier definition matrix
  const tiers: SubscriptionTier[] = ['pro', 'advanced', 'all_access']
  const periods: SubscriptionPeriod[] = ['monthly', 'yearly', 'lifetime']
  const tierMatrix: Array<{
    tier: SubscriptionTier
    period: SubscriptionPeriod
    priceCents: number
    priceLabel: string
    effectiveMonthly: string
    yearlySavings: number
    chartsPerPeriod: number
    analysesIncluded: ('pro' | 'advanced')[]
    lsVariantId: string | null
    lsConfigured: boolean
    whopProductId: string | null
    whopConfigured: boolean
  }> = []
  for (const tier of tiers) {
    for (const period of periods) {
      const pricing = SUBSCRIPTION_PRICING[tier][period]
      const lsVariantId = getLsVariantIdForTier(tier, period)
      const whopProductId = getWhopProductIdForTier(tier, period)
      tierMatrix.push({
        tier,
        period,
        priceCents: pricing.priceCents,
        priceLabel: pricing.priceLabel,
        effectiveMonthly: pricing.effectiveMonthly,
        yearlySavings: pricing.yearlySavings,
        chartsPerPeriod: pricing.chartsPerPeriod,
        analysesIncluded: pricing.analysesIncluded,
        lsVariantId: lsVariantId || null,
        lsConfigured: !!lsVariantId,
        whopProductId: whopProductId || null,
        whopConfigured: !!whopProductId,
      })
    }
  }

  // Get active subscriber counts per tier from ChartSubscription table
  let subscriberCounts: Record<string, number> = {}
  let recentSubscriptions: Array<{
    subscriptionId: string
    customerEmail: string
    customerName: string | null
    tier: string
    period: string
    provider: string
    status: string
    chartsUsedThisPeriod: number
    chartsPerPeriod: number
    periodEnd: string | null
    createdAt: string
  }> = []
  let totalActiveSubs = 0
  let revenueByTier: Record<string, number> = {}

  try {
    await initDb()
    
    // Count active subscriptions per tier
    const counts = await rawQuery<{ tier: string; cnt: number }>(
      `SELECT tier, COUNT(*) as cnt FROM ChartSubscription 
       WHERE status IN ('active', 'trialing', 'past_due') 
       GROUP BY tier`
    )
    for (const c of counts) {
      subscriberCounts[c.tier] = c.cnt
      totalActiveSubs += c.cnt
    }

    // Get recent 20 subscriptions
    recentSubscriptions = await rawQuery<{
      subscriptionId: string
      customerEmail: string
      customerName: string | null
      tier: string
      period: string
      provider: string
      status: string
      chartsUsedThisPeriod: number
      chartsPerPeriod: number
      periodEnd: string | null
      createdAt: string
    }>(
      `SELECT subscriptionId, customerEmail, customerName, tier, period, 
              provider, status, chartsUsedThisPeriod, chartsPerPeriod, 
              periodEnd, createdAt
       FROM ChartSubscription 
       ORDER BY createdAt DESC 
       LIMIT 20`
    )

    // Calculate revenue by tier (sum of priceCents for active subscriptions)
    for (const tier of tiers) {
      const activeForTier = await rawQuery<{ period: string; cnt: number }>(
        `SELECT period, COUNT(*) as cnt FROM ChartSubscription 
         WHERE tier = ? AND status IN ('active', 'trialing', 'past_due')
         GROUP BY period`,
        [tier]
      )
      let tierRevenue = 0
      for (const a of activeForTier) {
        const pricing = SUBSCRIPTION_PRICING[tier as SubscriptionTier][a.period as SubscriptionPeriod]
        if (pricing) {
          tierRevenue += pricing.priceCents * a.cnt
        }
      }
      revenueByTier[tier] = tierRevenue
    }
  } catch (err) {
    console.error('[Admin Subscriptions] DB query failed:', err)
    // Tables might not exist yet — return what we have
  }

  // Calculate MRR (Monthly Recurring Revenue)
  // Monthly subs: full price
  // Yearly subs: price / 12
  // Lifetime: not recurring (one-time) — exclude from MRR
  let mrr = 0
  try {
    const activeSubs = await rawQuery<{ tier: string; period: string; cnt: number }>(
      `SELECT tier, period, COUNT(*) as cnt FROM ChartSubscription 
       WHERE status IN ('active', 'trialing', 'past_due') AND period != 'lifetime'
       GROUP BY tier, period`
    )
    for (const s of activeSubs) {
      const pricing = SUBSCRIPTION_PRICING[s.tier as SubscriptionTier][s.period as SubscriptionPeriod]
      if (pricing) {
        if (s.period === 'monthly') {
          mrr += pricing.priceCents * s.cnt
        } else if (s.period === 'yearly') {
          mrr += Math.round(pricing.priceCents / 12) * s.cnt
        }
      }
    }
  } catch {}

  return NextResponse.json({
    tierMatrix,
    subscriberCounts,
    totalActiveSubs,
    revenueByTier,
    mrrCents: mrr,
    mrrLabel: `$${(mrr / 100).toFixed(2)}`,
    recentSubscriptions,
  })
}
