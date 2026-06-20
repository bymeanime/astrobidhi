'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Crown, Check, Sparkles, Brain, Shield, Zap, Star, ArrowLeft,
  ShoppingCart, ExternalLink, Coffee, BookOpen, Hash, AlertCircle, Loader2,
  Gift, Calendar, Infinity as InfinityIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ──────────────────── Types ────────────────────

type SubscriptionTier = 'pro' | 'advanced' | 'all_access'
type SubscriptionPeriod = 'monthly' | 'yearly' | 'lifetime'

interface SubscriptionTierOption {
  tier: SubscriptionTier
  period: SubscriptionPeriod
  variantId?: string
  productId?: string
  checkoutUrl?: string
  pricing: {
    priceCents: number
    priceLabel: string
    effectiveMonthly: string
    yearlySavings: number
    chartsPerPeriod: number
    analysesIncluded: ('pro' | 'advanced')[]
  }
}

interface PaymentConfig {
  whop: {
    configured: boolean
    subscriptionTiers: SubscriptionTierOption[]
  }
  lemonsqueezy: {
    configured: boolean
    hasWebhookSecret: boolean
    subscriptionTiers: SubscriptionTierOption[]
    analysisVariantMappings: Array<{ analysisType: string; variantId: string; source: 'db' | 'env' }>
  }
}

// ──────────────────── Tier display metadata ────────────────────

const TIER_META: Record<SubscriptionTier, {
  label: string
  tagline: string
  icon: React.ReactNode
  color: string
  analysesCount: number
  analysesLabel: string
  popular?: boolean
}> = {
  pro: {
    label: 'Pro',
    tagline: 'For seekers exploring deeper Vedic insights',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'amber',
    analysesCount: 9,
    analysesLabel: '9 Pro analyses',
  },
  advanced: {
    label: 'Advanced',
    tagline: 'For serious students of Jyotish',
    icon: <Brain className="w-5 h-5" />,
    color: 'purple',
    analysesCount: 13,
    analysesLabel: '13 Advanced analyses',
  },
  all_access: {
    label: 'All-Access',
    tagline: 'Everything unlocked — best value',
    icon: <Crown className="w-5 h-5" />,
    color: 'emerald',
    analysesCount: 22,
    analysesLabel: 'All 22 premium analyses',
    popular: true,
  },
}

const PERIOD_META: Record<SubscriptionPeriod, { label: string; sublabel: string; badge?: string }> = {
  monthly: { label: 'Monthly', sublabel: 'Cancel anytime' },
  yearly: { label: 'Yearly', sublabel: 'Best deal — 58% off', badge: 'Save 58%' },
  lifetime: { label: 'Lifetime', sublabel: 'Pay once, own forever', badge: 'Best for pros' },
}

// ──────────────────── Main page ────────────────────

export default function PricingPage() {
  const [payment, setPayment] = useState<PaymentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceId, setDeviceId] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setPayment(data.payment || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    if (typeof window !== 'undefined') {
      setDeviceId(localStorage.getItem('astrobidi_device_id') || '')
    }
  }, [])

  const lsTiers = payment?.lemonsqueezy.subscriptionTiers || []
  const whopTiers = payment?.whop.subscriptionTiers || []
  const hasAnyTier = lsTiers.length > 0 || whopTiers.length > 0
  const noPayment = !payment?.whop.configured && !payment?.lemonsqueezy.configured

  // Group tiers by tier type (pro/advanced/all_access) for display
  const tierGroups: SubscriptionTier[] = ['pro', 'advanced', 'all_access']

  return (
    <div className="min-h-screen bg-gradient-to-b from-temple-bg via-temple-bg to-amber-50/30">
      <header className="border-b border-saffron/20 bg-maroon-dark/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gold-light hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to AstroBidhi</span>
          </Link>
          <div className="text-gold-light text-sm font-semibold tracking-wide">
            🕉️ AstroBidhi Pricing
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center mb-12">
          <Badge className="bg-amber-100 text-amber-800 mb-4">3 Subscription Tiers</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-maroon mb-4">Unlock the full power of your chart</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Pick the tier that matches your depth of exploration. Get 2 new charts every month — every analysis you run is cached forever.
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-saffron animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading pricing options…</p>
          </div>
        ) : noPayment ? (
          <Card className="border-amber-200 bg-amber-50 max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-maroon mb-2">Subscriptions coming soon</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We're finalizing our payment setup. In the meantime, you can still generate charts and run free analyses.
              </p>
              <a href="https://buymeacoffee.com/astrobidhi" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black rounded-full text-sm font-semibold transition-all">
                <Coffee className="w-4 h-4" /> Support AstroBidhi
              </a>
            </CardContent>
          </Card>
        ) : !hasAnyTier ? (
          <Card className="border-amber-200 bg-amber-50 max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-maroon mb-2">Subscriptions not yet configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The payment provider is set up but no subscription tiers are configured yet. Please check back soon.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ─────────── Subscription tier cards ─────────── */}
            <section className="mb-16">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-maroon mb-2">Choose your tier</h2>
                <p className="text-sm text-muted-foreground">
                  All tiers include <strong>2 new charts per billing period</strong> + daily horoscope bonus. Cached analyses are viewable forever.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {tierGroups.map((tierKey, idx) => {
                  const meta = TIER_META[tierKey]
                  // Get all periods for this tier
                  const lsTierOptions = lsTiers.filter(t => t.tier === tierKey)
                  const whopTierOptions = whopTiers.filter(t => t.tier === tierKey)
                  const hasThisTier = lsTierOptions.length > 0 || whopTierOptions.length > 0
                  if (!hasThisTier) return null

                  return (
                    <motion.div key={tierKey} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 * idx }}>
                      <Card className={`h-full relative ${meta.popular ? 'border-emerald-500 shadow-lg shadow-emerald-200/50' : 'border-saffron/30'}`}>
                        {meta.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                              ⭐ Best Value
                            </Badge>
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                                meta.color === 'amber' ? 'bg-amber-600' :
                                meta.color === 'purple' ? 'bg-purple-600' : 'bg-emerald-600'
                              }`}>
                                {meta.icon}
                              </div>
                              <CardTitle className="text-xl text-maroon">{meta.label}</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{meta.analysesLabel}</Badge>
                          </div>
                          <CardDescription className="text-xs">{meta.tagline}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {/* Period options */}
                          <div className="space-y-3 mb-5">
                            {(['monthly', 'yearly', 'lifetime'] as const).map((period) => {
                              const lsOpt = lsTierOptions.find(t => t.period === period)
                              const whopOpt = whopTierOptions.find(t => t.period === period)
                              if (!lsOpt && !whopOpt) return null

                              const pricing = (lsOpt || whopOpt)!.pricing
                              const periodMeta = PERIOD_META[period]

                              return (
                                <div key={period} className="border border-saffron/20 rounded-lg p-3 bg-white/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="font-semibold text-maroon text-sm flex items-center gap-1.5">
                                        {period === 'monthly' && <Calendar className="w-3.5 h-3.5" />}
                                        {period === 'yearly' && <Calendar className="w-3.5 h-3.5" />}
                                        {period === 'lifetime' && <InfinityIcon className="w-3.5 h-3.5" />}
                                        {periodMeta.label}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">{periodMeta.sublabel}</div>
                                    </div>
                                    {periodMeta.badge && (
                                      <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300">{periodMeta.badge}</Badge>
                                    )}
                                  </div>
                                  <div className="text-xl font-bold text-maroon mb-2">{pricing.priceLabel}</div>
                                  {period !== 'lifetime' && (
                                    <div className="text-[11px] text-muted-foreground mb-2">
                                      ≈ {pricing.effectiveMonthly}/mo · 2 new charts/mo
                                    </div>
                                  )}
                                  {period === 'lifetime' && (
                                    <div className="text-[11px] text-muted-foreground mb-2">
                                      Unlimited charts forever
                                    </div>
                                  )}

                                  {/* Buy buttons */}
                                  <div className="flex flex-col gap-1.5">
                                    {whopOpt && whopOpt.checkoutUrl && (
                                      <a href={whopOpt.checkoutUrl} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-semibold px-3 py-2 h-9 text-xs transition-all">
                                        <Crown className="w-3.5 h-3.5" /> Subscribe via Whop
                                      </a>
                                    )}
                                    {lsOpt && (
                                      <a href={`/api/lemonsqueezy/checkout?tier=${tierKey}&period=${period}&deviceId=${encodeURIComponent(deviceId)}`} target="_blank" rel="noopener noreferrer" className={`w-full inline-flex items-center justify-center gap-1.5 rounded-md font-semibold px-3 py-2 h-9 text-xs transition-all ${
                                        whopOpt ? 'border border-purple-300 text-purple-700 hover:bg-purple-50' : 'bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white'
                                      }`} title="VAT/tax handled automatically by Lemon Squeezy">
                                        <ShoppingCart className="w-3.5 h-3.5" /> Subscribe via LS
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* What's included */}
                          <div className="text-xs text-muted-foreground pt-3 border-t border-saffron/10">
                            <p className="font-medium text-maroon mb-1">Includes:</p>
                            <ul className="space-y-1">
                              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" /> {meta.analysesLabel}</li>
                              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" /> 2 new charts per billing period</li>
                              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" /> Cached analyses viewable forever</li>
                              <li className="flex items-start gap-1.5"><Gift className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" /> Daily horoscope bonus (free)</li>
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </section>

            {/* ─────────── Daily horoscope bonus callout ─────────── */}
            <section className="mb-12">
              <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-maroon mb-1 flex items-center gap-2">
                        🎁 BONUS: Daily Horoscope (FREE with any subscription)
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Your subscription includes daily + monthly horoscopes at no extra cost. This is a complimentary bonus — when it's working, enjoy it!
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        If horoscope services ever experience downtime or technical issues, your subscription still provides full value through chart analyses. The horoscope is a gift, not a guaranteed service.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ─────────── How the chart budget works ─────────── */}
            <section className="mb-12">
              <Card className="border-saffron/20">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-maroon mb-3 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-saffron" /> How the "2 charts/month" budget works
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-maroon mb-1">✓ What counts as "1 chart"</p>
                      <p className="text-muted-foreground text-xs">
                        Each unique birth-data combination (date, time, place) = 1 chart. You can run every analysis in your tier on that chart — it's still just 1 chart.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-maroon mb-1">✓ Cached = free forever</p>
                      <p className="text-muted-foreground text-xs">
                        Once you generate an analysis, it's cached permanently. Re-viewing it never counts against your budget — even after your subscription ends.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-maroon mb-1">✓ Monthly/yearly = 2 new charts</p>
                      <p className="text-muted-foreground text-xs">
                        Add your chart + your partner's chart = 2 charts. Perfect for couples. Counter resets each billing period.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-maroon mb-1">✓ Lifetime = unlimited</p>
                      <p className="text-muted-foreground text-xs">
                        No chart cap. Add as many charts as you want, forever. Best for professional astrologers and serious students.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ─────────── Trust signals ─────────── */}
            <section className="mb-12 pt-8 border-t border-saffron/20">
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-maroon mb-1">Cancel anytime</p>
                    <p className="text-muted-foreground text-xs">No long-term commitment. Cancel from Whop or Lemon Squeezy's dashboard. Your cached analyses remain accessible forever.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-maroon mb-1">Instant unlock</p>
                    <p className="text-muted-foreground text-xs">Premium features activate within seconds of payment. Webhooks update your access in real-time.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-maroon mb-1">Your data stays yours</p>
                    <p className="text-muted-foreground text-xs">Past analyses are always accessible, even after cancellation. We never delete your charts or readings.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ─────────── FAQ ─────────── */}
            <section className="mt-12 pt-8 border-t border-saffron/20">
              <div className="max-w-3xl mx-auto space-y-4">
                <h3 className="text-xl font-semibold text-maroon text-center mb-4">Frequently asked questions</h3>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">What's included in the free tier?</p>
                    <p className="text-sm text-muted-foreground">3 free charts, 2 analysis types per chart (6 total analyses), all 8 Standard analyses. Cached results are viewable forever.</p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">What happens when I cancel?</p>
                    <p className="text-sm text-muted-foreground">Your subscription stays active until the end of the billing period. After that, you can't generate NEW charts — but every analysis you've already generated remains viewable forever.</p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">Can I upgrade tiers later?</p>
                    <p className="text-sm text-muted-foreground">Yes. Subscribe to a higher tier anytime — your existing analyses stay cached and you'll get access to the additional tier's analyses plus 2 more chart slots per period.</p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">Why is the horoscope "free" — what if it breaks?</p>
                    <p className="text-sm text-muted-foreground">The daily horoscope is a complimentary bonus on top of your subscription. You're paying for chart analyses. If the horoscope service experiences downtime or technical issues, your subscription still provides full value through unlimited chart analyses. We don't guarantee uninterrupted horoscope availability.</p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">Is my payment information secure?</p>
                    <p className="text-sm text-muted-foreground">We never see or store your credit card. All payments are processed by Whop or Lemon Squeezy (both PCI-DSS Level 1 compliant). We only receive your email and a webhook confirming the payment.</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <div className="text-center mt-16">
              <Link href="/">
                <Button size="lg" className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white">
                  <Star className="w-4 h-4 mr-2" /> Generate your free chart
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-3">No credit card needed for the free tier</p>
            </div>
          </>
        )}
      </main>

      <footer className="mt-16 border-t border-saffron/20 bg-maroon-dark/5">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AstroBidhi · Vedic astrology wisdom
        </div>
      </footer>
    </div>
  )
}
