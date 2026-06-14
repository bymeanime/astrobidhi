'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Clock, CreditCard, Mail, MessageCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function RefundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-temple-bg">
      {/* Nav */}
      <nav className="bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="text-2xl text-gold animate-pulse-glow">ॐ</div>
              <div>
                <h1 className="text-xl font-bold text-gold-light tracking-wide">AstroBidhi</h1>
                <p className="text-[10px] text-saffron-light -mt-1 tracking-widest">वैदिक ज्योतिष</p>
              </div>
            </div>
            <a href="/">
              <Button variant="ghost" size="sm" className="text-saffron-light hover:text-gold-light">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to App
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-maroon-dark via-maroon to-saffron/10">
          <div className="relative max-w-4xl mx-auto px-4 py-12 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Shield className="w-12 h-12 text-gold mx-auto mb-4" />
              <h1 className="text-3xl md:text-5xl font-bold text-gold-light mb-4">Refund Policy</h1>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
              <p className="text-saffron-light/70 text-sm">Your satisfaction is our cosmic commitment</p>
            </motion.div>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="space-y-8">
            {/* Satisfaction Guarantee */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <CardTitle className="text-maroon text-lg">1. 7-Day Satisfaction Guarantee</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  We offer a <strong className="text-maroon">7-day satisfaction guarantee</strong> on all premium analyses.
                  If the AI-generated analysis does not meet your expectations or you feel it doesn&apos;t accurately reflect
                  your birth chart, you are entitled to a full refund within 7 days of purchase.
                </p>
              </CardContent>
            </Card>

            {/* Premium Analyses */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">2. Premium Analysis Refunds</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Full refund</strong> if the AI analysis doesn&apos;t meet your expectations — no questions asked within the 7-day window.</li>
                  <li><strong className="text-maroon">Technical issues:</strong> If there was a technical error in generating your analysis (e.g., incorrect birth chart, failed generation), you&apos;ll receive a full refund or free regeneration.</li>
                  <li><strong className="text-maroon">Partial analysis:</strong> If only part of the analysis was generated due to an error, you can request either a complete regeneration or a full refund.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Reading Cancellations */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">3. Reading Cancellations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">24+ hours before appointment:</strong> Full refund with no cancellation fee.</li>
                  <li><strong className="text-maroon">Less than 24 hours before:</strong> 50% refund or option to reschedule at no extra cost.</li>
                  <li><strong className="text-maroon">No-show:</strong> No refund. However, you may reschedule once at a 50% discount.</li>
                  <li><strong className="text-maroon">After reading is completed:</strong> No refund. The service has been fully rendered.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Non-Refundable */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                  <CardTitle className="text-maroon text-lg">4. Non-Refundable Items</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Free analyses and chart generations (no payment involved).</li>
                  <li>Completed live readings with a Vedic astrologer.</li>
                  <li>Premium analyses beyond the 7-day refund window.</li>
                </ul>
              </CardContent>
            </Card>

            {/* How to Request */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">5. How to Request a Refund</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>To request a refund, please contact us through any of the following methods:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Email:</strong> <a href="mailto:astrobidhi@gmail.com" className="text-saffron hover:underline font-medium">astrobidhi@gmail.com</a> — Include your order details and reason for refund.</li>
                  <li><strong className="text-maroon">WhatsApp:</strong> <a href="https://wa.me/9779709735537" target="_blank" rel="noopener noreferrer" className="text-saffron hover:underline font-medium">+977 9709735537</a> — Send a message with your order details.</li>
                </ul>
                <p className="mt-3">Please include in your refund request:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Your name and email address</li>
                  <li>The analysis type or reading you purchased</li>
                  <li>Date of purchase</li>
                  <li>Reason for the refund request</li>
                </ul>
              </CardContent>
            </Card>

            {/* Processing Time */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">6. Processing Time</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Refund requests are reviewed within <strong className="text-maroon">1-2 business days</strong>.</li>
                  <li>Approved refunds are processed within <strong className="text-maroon">5-10 business days</strong>.</li>
                  <li>Refunds are credited back to the original payment method used for the purchase.</li>
                  <li>You will receive an email confirmation once the refund has been processed.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-b from-saffron/5 to-transparent py-10">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="text-muted-foreground mb-4">
              Have questions about our refund policy? We&apos;re here to help.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="mailto:astrobidhi@gmail.com">
                <Button className="bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-maroon-dark font-semibold">
                  <Mail className="w-4 h-4 mr-2" /> Email Us
                </Button>
              </a>
              <a href="https://wa.me/9779709735537" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-saffron text-maroon hover:bg-saffron/10">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Us
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60">
        <div className="vedic-divider" />
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg text-gold animate-pulse-glow">ॐ</span>
              <span className="text-gold-light font-semibold text-xs">AstroBidhi</span>
              <span className="text-[10px] text-saffron-light/40">वैदिक ज्योतिष</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px]">
              <a href="/about" className="text-saffron-light/50 hover:text-gold-light transition-colors">About</a>
              <span className="text-saffron-light/20">&bull;</span>
              <a href="/contact" className="text-saffron-light/50 hover:text-gold-light transition-colors">Contact</a>
              <span className="text-saffron-light/20">&bull;</span>
              <a href="/policy" className="text-saffron-light/50 hover:text-gold-light transition-colors">Privacy Policy</a>
              <span className="text-saffron-light/20">&bull;</span>
              <a href="/refund" className="text-saffron-light/50 hover:text-gold-light transition-colors">Refund Policy</a>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-[9px] text-saffron-light/30">Powered by VedicAstro (Swiss Ephemeris) &bull; KP System &bull; Gemini AI</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
