'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Shield, Lock, Eye, Database, Server, Globe, ArrowLeft, Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PolicyPage() {
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
              <h1 className="text-3xl md:text-5xl font-bold text-gold-light mb-4">Privacy Policy</h1>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
              <p className="text-saffron-light/70 text-sm">Last updated: March 2025</p>
            </motion.div>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="space-y-8">
            {/* Data Collection */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Eye className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">1. Data We Collect</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>We collect the following personal information necessary to provide our astrology services:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Birth Details:</strong> Your name, date of birth, time of birth, and place of birth (latitude/longitude) — essential for generating accurate Vedic birth charts and astrological analyses.</li>
                  <li><strong className="text-maroon">Device Identifiers:</strong> A locally generated device ID stored in your browser for access control, usage tracking, and cache management.</li>
                  <li><strong className="text-maroon">Account Information:</strong> If you sign in via Whop, we store your Whop user ID, name, email, and profile picture as provided by the authentication service.</li>
                  <li><strong className="text-maroon">Contact Form Data:</strong> If you contact us, we store your name, email address, and message content.</li>
                </ul>
              </CardContent>
            </Card>

            {/* How Data Is Used */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">2. How We Use Your Data</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Chart Generation:</strong> Your birth details are used to calculate precise planetary positions, house cusps, and Vimshottari Dasa periods using the VedicAstro engine with Swiss Ephemeris.</li>
                  <li><strong className="text-maroon">AI Analysis:</strong> Compressed chart data is sent to AI providers (Google Gemini, Groq, or OpenRouter) to generate personalized Vedic astrology interpretations.</li>
                  <li><strong className="text-maroon">Caching:</strong> Generated charts and analyses are cached in our database to provide instant access on repeat visits without regenerating.</li>
                  <li><strong className="text-maroon">Access Control:</strong> Device IDs and Whop authentication are used to manage premium feature access and usage limits.</li>
                  <li><strong className="text-maroon">Analytics:</strong> Anonymous usage events are tracked to improve the service experience.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Third-Party Services */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">3. Third-Party Services</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>AstroBidhi integrates with the following third-party services:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Whop:</strong> Used for user authentication and payment processing. Whop&apos;s privacy policy applies to data shared with them. (<a href="https://whop.com/privacy" target="_blank" rel="noopener noreferrer" className="text-saffron hover:underline">whop.com/privacy</a>)</li>
                  <li><strong className="text-maroon">Google Gemini AI:</strong> Compressed chart data is sent to Google&apos;s AI service for generating astrological interpretations. Google&apos;s privacy policy applies. (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-saffron hover:underline">policies.google.com/privacy</a>)</li>
                  <li><strong className="text-marino">VedicAstro / Swiss Ephemeris:</strong> Astronomical calculations are performed locally using the open-source VedicAstro library. No data is sent to external servers for calculations.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Data Storage */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Server className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">4. Data Storage &amp; Security</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Database:</strong> Your data is stored in a secure SQLite/Turso database with encrypted connections in production.</li>
                  <li><strong className="text-maroon">Browser Storage:</strong> Your device ID and preferences are stored in your browser&apos;s localStorage. No sensitive personal data is stored in browser storage.</li>
                  <li><strong className="text-maroon">Data Retention:</strong> Cached charts and analyses are retained indefinitely for your convenience. You may request deletion at any time.</li>
                  <li><strong className="text-maroon">Security:</strong> We implement industry-standard security measures to protect your data. All API communications use HTTPS encryption.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Cookies */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Lock className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">5. Cookies &amp; Local Storage</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Session Cookies:</strong> We use cookies for Whop authentication session management (whop_session cookie).</li>
                  <li><strong className="text-maroon">localStorage:</strong> Device ID, recently used cities, and form preferences are stored locally in your browser for convenience.</li>
                  <li><strong className="text-maroon">No Tracking Cookies:</strong> We do not use third-party tracking cookies or advertising pixels.</li>
                </ul>
              </CardContent>
            </Card>

            {/* User Rights */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">6. Your Rights</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>You have the following rights regarding your personal data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-maroon">Access:</strong> You can request a copy of all personal data we hold about you.</li>
                  <li><strong className="text-maroon">Modification:</strong> You can update or correct your birth details and account information at any time.</li>
                  <li><strong className="text-maroon">Deletion:</strong> You can request complete deletion of your personal data, charts, and analyses from our database.</li>
                  <li><strong className="text-maroon">Opt-Out:</strong> You can clear your browser&apos;s localStorage and cookies to remove locally stored data at any time.</li>
                </ul>
                <p>To exercise any of these rights, please contact us at <a href="mailto:astrobidhi@gmail.com" className="text-saffron hover:underline font-medium">astrobidhi@gmail.com</a>.</p>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-saffron" />
                  <CardTitle className="text-maroon text-lg">7. Contact Us</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                <p>If you have any questions or concerns about this Privacy Policy or how your data is handled, please reach out:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                  <li>Email: <a href="mailto:astrobidhi@gmail.com" className="text-saffron hover:underline font-medium">astrobidhi@gmail.com</a></li>
                  <li>WhatsApp: <a href="https://wa.me/9779709735537" target="_blank" rel="noopener noreferrer" className="text-saffron hover:underline font-medium">+977 9709735537</a></li>
                </ul>
              </CardContent>
            </Card>
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
