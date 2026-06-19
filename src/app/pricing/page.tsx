'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Crown, Check, Sparkles, Brain, Shield, Zap, Star, ArrowLeft,
  ShoppingCart, ExternalLink, Coffee, BookOpen, Hash, AlertCircle, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ──────────────────── Types ────────────────────

interface PaymentTier {
  tier: 'monthly' | 'yearly' | 'lifetime'
  checkoutUrl: string
  productId?: string
  variantId?: string
  checkoutUrlOverride?: string | null
}

interface AnalysisVariantMapping {
  analysisType: string
  variantId: string
  source: 'db' | 'env'
}

interface PaymentConfig {
  whop: {
    configured: boolean
    checkoutUrl: string | null
    manageUrl: string | null
    tiers: PaymentTier[]
  }
  lemonsqueezy: {
    configured: boolean
    checkoutUrl: string | null
    manageUrl: string | null
    hasWebhookSecret: boolean
    tiers: PaymentTier[]
    analysisVariantMappings: AnalysisVariantMapping[]
  }
}

// ──────────────────── Tier metadata ────────────────────

const TIER_INFO: Record<PaymentTier['tier'], {
  label: string
  badge: string
  priceHint: string
  popular?: boolean
  blurb: string
  features: string[]
}> = {
  monthly: {
    label: 'Monthly',
    badge: 'Most flexible',
    priceHint: '/mo',
    blurb: 'Perfect for trying out all premium features. Cancel anytime.',
    features: [
      'Unlimited birth chart generations',
      'All 10+ premium analysis types',
      'Priority AI response times',
      'Daily horoscope + monthly forecast',
      'Save & share charts with anyone',
      'AI follow-up questions (unlimited)',
    ],
  },
  yearly: {
    label: 'Yearly',
    badge: 'Save ~17%',
    priceHint: '/yr',
    popular: true,
    blurb: 'Best value for committed seekers. Two months free vs monthly.',
    features: [
      'Everything in Monthly, plus:',
      'Priority queue for paid readings',
      'Early access to new analysis types',
      'Exclusive yearly forecast report',
      'Email support within 24 hours',
    ],
  },
  lifetime: {
    label: 'Lifetime',
    badge: 'Pay once',
    priceHint: ' once',
    blurb: 'One payment, premium forever. Ideal for serious practitioners.',
    features: [
      'Everything in Yearly, plus:',
      'All future analysis types included',
      'Lifetime API access (coming soon)',
      'Founder badge on your profile',
      'Direct line to the dev team',
    ],
  },
}

const ANALYSIS_LABELS: Record<string, { label: string; price?: string }> = {
  swot_5year: { label: '5-Year SWOT Forecast', price: '$15' },
  cosmic_blueprint: { label: 'Cosmic Blueprint', price: '$9' },
  shadow_integration: { label: 'Shadow Integration', price: '$9' },
  life_decoder: { label: 'Life Decoder', price: '$12' },
  career_destiny: { label: 'Career Destiny', price: '$12' },
  relationship_destiny: { label: 'Relationship Destiny', price: '$12' },
  soul_purpose: { label: 'Soul Purpose', price: '$15' },
  wealth_code: { label: 'Wealth Code', price: '$15' },
  future_timeline: { label: 'Future Timeline', price: '$15' },
  past_life_karma: { label: 'Past Life Karma', price: '$15' },
  mangal_dosha: { label: 'Mangal Dosha', price: '$7' },
  sade_sati: { label: 'Sade Sati', price: '$7' },
}

// ──────────────────── Main page component ────────────────────

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

  const anyWhopTier = payment?.whop.tiers || []
  const anyLsTier = payment?.lemonsqueezy.tiers || []
  const analysisMappings = payment?.lemonsqueezy.analysisVariantMappings || []
  const hasTiers = anyWhopTier.length > 0 || anyLsTier.length > 0
  const hasAnalysisOptions = analysisMappings.length > 0
  const noPayment = !payment?.whop.configured && !payment?.lemonsqueezy.configured

  return (
    <div className="min-h-screen bg-gradient-to-b from-temple-bg via-temple-bg to-amber-50/30">
      {/* Header */}
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <Badge className="bg-amber-100 text-amber-800 mb-4">Premium Membership</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-maroon mb-4">
            Unlock the full power of your chart
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Unlimited AI-powered Vedic astrology analyses, priority response times,
            and access to all 10+ premium reading types. Cancel anytime.
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-saffron animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading pricing options…</p>
          </div>
        ) : noPayment ? (
          /* No payment configured */
          <Card className="border-amber-200 bg-amber-50 max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-maroon mb-2">Subscriptions coming soon</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We're finalizing our payment setup. In the meantime, you can still generate charts
                and run free analyses — and consider supporting us with a coffee.
              </p>
              <a
                href="https://buymeacoffee.com/astrobidhi"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black rounded-full text-sm font-semibold transition-all"
              >
                <Coffee className="w-4 h-4" /> Support AstroBidhi
              </a>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ─────────── Tier cards ─────────── */}
            {hasTiers && (
              <section className="mb-16">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-maroon mb-2">Choose your plan</h2>
                  <p className="text-sm text-muted-foreground">
                    All plans include a 7-day free trial. No card required to start.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {(['monthly', 'yearly', 'lifetime'] as const).map((tierKey) => {
                    const info = TIER_INFO[tierKey]
                    const whopTier = anyWhopTier.find(t => t.tier === tierKey)
                    const lsTier = anyLsTier.find(t => t.tier === tierKey)
                    const hasThisTier = whopTier || lsTier
                    if (!hasThisTier) return null

                    return (
                      <motion.div
                        key={tierKey}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 * (['monthly', 'yearly', 'lifetime'].indexOf(tierKey)) }}
                      >
                        <Card className={`h-full relative ${info.popular ? 'border-amber-500 shadow-lg shadow-amber-200/50' : 'border-saffron/30'}`}>
                          {info.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                                ⭐ Most Popular
                              </Badge>
                            </div>
                          )}
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-xl text-maroon">{info.label}</CardTitle>
                              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">{info.badge}</Badge>
                            </div>
                            <CardDescription className="text-xs">{info.blurb}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {/* Provider buttons */}
                            <div className="space-y-2 mb-5">
                              {whopTier && (
                                <a
                                  href={whopTier.checkoutUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-semibold px-4 py-2.5 h-11 transition-all"
                                >
                                  <Crown className="w-4 h-4" /> Subscribe via Whop
                                </a>
                              )}
                              {lsTier && (
                                <a
                                  href={`/api/lemonsqueezy/checkout?tier=${tierKey}&deviceId=${encodeURIComponent(deviceId)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`w-full inline-flex items-center justify-center gap-1.5 rounded-md font-semibold px-4 py-2.5 h-11 transition-all ${
                                    whopTier
                                      ? 'border border-purple-300 text-purple-700 hover:bg-purple-50'
                                      : 'bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white'
                                  }`}
                                  title="VAT/tax handled automatically by Lemon Squeezy"
                                >
                                  <ShoppingCart className="w-4 h-4" /> Subscribe via Lemon Squeezy
                                </a>
                              )}
                            </div>

                            {/* Features */}
                            <ul className="space-y-2">
                              {info.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                  <span className={i === 0 && feat.includes('Everything') ? 'font-semibold text-maroon' : 'text-foreground/80'}>
                                    {feat}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Fallback: no tiers but provider is configured */}
                {!hasTiers && (payment?.whop.configured || payment?.lemonsqueezy.configured) && (
                  <Card className="border-saffron/30 max-w-2xl mx-auto">
                    <CardContent className="pt-6 text-center">
                      <Crown className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                      <h3 className="text-xl font-semibold text-maroon mb-2">Premium Membership</h3>
                      <p className="text-sm text-muted-foreground mb-5">
                        Unlock all premium features with a single subscription.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        {payment?.whop.configured && payment.whop.checkoutUrl && (
                          <a
                            href={payment.whop.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-semibold px-5 py-2.5 h-11 transition-all"
                          >
                            <Crown className="w-4 h-4" /> Start Free Trial via Whop
                          </a>
                        )}
                        {payment?.lemonsqueezy.configured && (
                          <a
                            href={`/api/lemonsqueezy/checkout?deviceId=${encodeURIComponent(deviceId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-semibold px-5 py-2.5 h-11 transition-all"
                          >
                            <ShoppingCart className="w-4 h-4" /> Pay via Lemon Squeezy
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>
            )}

            {/* ─────────── Per-analysis one-time purchases ─────────── */}
            {hasAnalysisOptions && (
              <section className="mb-12">
                <div className="text-center mb-8">
                  <Badge className="bg-emerald-100 text-emerald-800 mb-3">One-time purchase</Badge>
                  <h2 className="text-2xl font-bold text-maroon mb-2">Or buy individual analyses</h2>
                  <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                    Don't want a subscription? Buy just the analysis you need — yours forever,
                    no recurring charges. Unlocks instantly after checkout.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {analysisMappings.map((mapping) => {
                    const meta = ANALYSIS_LABELS[mapping.analysisType] || { label: mapping.analysisType }
                    return (
                      <Card key={mapping.analysisType} className="border-emerald-200 hover:border-emerald-400 transition-colors">
                        <CardContent className="pt-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-600" />
                              <span className="font-semibold text-sm text-maroon">{meta.label}</span>
                            </div>
                            {meta.price && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300">{meta.price}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-4">
                            One-time purchase. Instant unlock on the device you check out from.
                          </p>
                          <a
                            href={`/api/lemonsqueezy/checkout?analysisType=${encodeURIComponent(mapping.analysisType)}&deviceId=${encodeURIComponent(deviceId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold px-4 py-2 h-10 text-sm transition-all"
                          >
                            <ShoppingCart className="w-4 h-4" /> Buy this analysis
                          </a>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ─────────── Trust signals / FAQ ─────────── */}
            <section className="mt-16 pt-12 border-t border-saffron/20">
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-maroon mb-1">Cancel anytime</p>
                    <p className="text-muted-foreground">
                      No long-term commitment. Cancel from Whop or Lemon Squeezy's dashboard
                      and your access continues until the period ends.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-maroon mb-1">Instant unlock</p>
                    <p className="text-muted-foreground">
                      Premium features activate within seconds of payment. Webhooks update
                      your access in real-time — no waiting, no support tickets.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-maroon mb-1">Your data stays yours</p>
                    <p className="text-muted-foreground">
                      Past analyses are always accessible, even after cancellation. We never
                      delete your charts or readings.
                    </p>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="mt-12 max-w-3xl mx-auto space-y-4">
                <h3 className="text-xl font-semibold text-maroon text-center mb-4">Frequently asked questions</h3>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">What's included in the free tier?</p>
                    <p className="text-sm text-muted-foreground">
                      3 free chart readings per device, 2 analysis types per chart, all cached results
                      forever. Premium unlocks unlimited everything.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">Can I switch between Whop and Lemon Squeezy?</p>
                    <p className="text-sm text-muted-foreground">
                      Yes — both providers run side by side. If you cancel one, your access ends
                      when the billing period expires. You can then subscribe via the other provider.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">Do one-time purchases expire?</p>
                    <p className="text-sm text-muted-foreground">
                      No. Analyses bought individually are yours permanently on the device you
                      checked out from. If you change devices, contact support with your receipt.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardContent className="pt-5">
                    <p className="font-medium text-sm text-maroon mb-1">Is my payment information secure?</p>
                    <p className="text-sm text-muted-foreground">
                      We never see or store your credit card. All payments are processed by Whop
                      or Lemon Squeezy (both PCI-DSS Level 1 compliant). We only receive your
                      email and a webhook confirming the payment.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Footer CTA */}
            <div className="text-center mt-16">
              <Link href="/">
                <Button size="lg" className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white">
                  <Star className="w-4 h-4 mr-2" /> Generate your free chart
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-3">
                No credit card needed for the free tier
              </p>
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
