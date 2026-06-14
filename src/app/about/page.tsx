'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Star, Compass, Calendar, Sparkles, Brain, Heart, Briefcase,
  DollarSign, Activity, Flower2, BookOpen, Eye, Zap, Shield,
  ChevronRight, ArrowLeft, MessageCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const WHATSAPP_NUMBER = '9779709735537'

const analysisTypes = [
  {
    icon: <Star className="w-6 h-6" />,
    title: 'Overall Reading',
    desc: 'Complete birth chart interpretation covering personality, strengths, weaknesses, life purpose, and key planetary influences. Analyzes Ascendant, Moon sign, Sun sign, and all planetary placements.',
    type: 'Free',
  },
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Career & Profession',
    desc: 'Professional path, suitable career fields, growth periods, business vs job indications, and financial prospects. Based on 10th house, Amatyakaraka, and Dasa periods affecting career.',
    type: 'Free',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Love & Marriage',
    desc: 'Marriage timing, spouse characteristics, compatibility analysis, relationship dynamics, and remedies for delays. Based on 7th house, Venus, Jupiter, and Navamsha chart.',
    type: 'Free',
  },
  {
    icon: <Activity className="w-6 h-6" />,
    title: 'Health & Wellness',
    desc: 'Health vulnerabilities, Ayurvedic body constitution (Vata/Pitta/Kapha), potential health issues by house and planet, and preventive remedies.',
    type: 'Free',
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: 'Wealth & Finance',
    desc: 'Income sources, wealth yogas (Dhana Yogas), investment periods, property prospects, and financial growth timeline. Based on 2nd, 11th houses and Jupiter.',
    type: 'Free',
  },
  {
    icon: <Flower2 className="w-6 h-6" />,
    title: 'Spiritual Growth',
    desc: 'Dharma, spiritual path, past life karma, meditation practices, guru influences, and moksha indications. Based on 9th, 12th houses, Ketu, and Jupiter.',
    type: 'Free',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Dasa Periods',
    desc: 'Current and upcoming Vimshottari Dasa Maha Dasa and Bhukti periods with specific timing, effects, and remedies for challenging periods.',
    type: 'Free',
  },
  {
    icon: <Compass className="w-6 h-6" />,
    title: 'Horary (Prasna)',
    desc: 'Instant answers to specific yes/no questions using the KP system with a number 1-249. Covers timing, outcome, and guidance.',
    type: 'Free',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: '5-Year SWOT Forecast',
    desc: 'Comprehensive 5-year career and wealth forecast with Strengths, Weaknesses, Opportunities, Threats analysis, specific timing for major events, and personalized remedies.',
    type: 'Premium',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Cosmic Blueprint',
    desc: 'Premium house-by-house blueprint with Ashtakvarga scores, Yoga directory (Raja Yoga, Dhana Yoga, etc.), Shadbala strength analysis, and harmonized interpretations across all areas of life.',
    type: 'Premium',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Shadow Integration',
    desc: 'Deep psychological analysis combining Vedic astrology with shadow work. Identifies repressed patterns, vulnerability maps, tragic sublimation themes, and provides an integration protocol for personal transformation.',
    type: 'Premium',
  },
]

export default function AboutPage() {
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
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 text-8xl text-gold animate-spin-slow">☸</div>
            <div className="absolute bottom-10 right-10 text-6xl text-gold animate-spin-slow" style={{ animationDirection: 'reverse' }}>☸</div>
          </div>
          <div className="relative max-w-5xl mx-auto px-4 py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-gold-light/80 text-sm tracking-[0.3em] mb-4 uppercase">About Us</p>
              <h1 className="text-4xl md:text-6xl font-bold text-gold-light mb-4">
                What is <span className="text-saffron-light">AstroBidhi</span>?
              </h1>
              <div className="vedic-divider max-w-xs mx-auto my-6" />
              <p className="text-saffron-light/80 text-lg max-w-3xl mx-auto leading-relaxed">
                AstroBidhi (अस्त्रोबिधि) is a modern Vedic astrology platform that combines the ancient wisdom of
                Jyotish Shastra with cutting-edge AI technology. Generate precise KP birth charts, explore Vimshottari
                Dasa timelines, and receive AI-powered personalized interpretations for every aspect of your life.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Analysis Types */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-maroon mb-2">Our Analysis Offerings</h2>
            <div className="vedic-divider max-w-xs mx-auto my-4" />
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every analysis is generated using your precise birth details with Swiss Ephemeris-level astronomical
              accuracy, then interpreted by advanced AI trained on Vedic astrological principles.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analysisTypes.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Card className="border-saffron/20 hover:border-saffron/50 hover:shadow-lg transition-all h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="text-saffron">{item.icon}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        item.type === 'Premium'
                          ? 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white'
                          : 'bg-saffron/20 text-maroon'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <CardTitle className="text-maroon text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* KP System */}
        <section className="bg-gradient-to-b from-saffron/5 to-transparent py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-maroon mb-4">The KP System (Krishnamurti Paddhati)</h2>
            <div className="vedic-divider max-w-xs mx-auto my-4" />
            <p className="text-muted-foreground leading-relaxed mb-6">
              The Krishnamurthi Paddhati (KP) system, developed by the great astrologer K.S. Krishnamurti,
              revolutionized Vedic astrology with its precise SubLord theory. Unlike traditional Parashari methods,
              KP astrology uses the Placidus house system and a unique 249-subdivision system that provides
              remarkably accurate predictions. The SubLord of a house determines the outcome of matters
              signified by that house, making KP the most precise system for predictive astrology.
            </p>
            <div className="grid grid-cols-3 gap-8 mt-8">
              <div>
                <p className="text-3xl font-bold text-saffron">9</p>
                <p className="text-xs text-muted-foreground mt-1">Navagraha</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-saffron">27</p>
                <p className="text-xs text-muted-foreground mt-1">Nakshatras</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-saffron">249</p>
                <p className="text-xs text-muted-foreground mt-1">KP Sub-divisions</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology & Credits */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-maroon mb-2">Technology & Credits</h2>
            <div className="vedic-divider max-w-xs mx-auto my-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-saffron/20 text-center">
              <CardHeader>
                <Sparkles className="w-10 h-10 text-saffron mx-auto mb-2" />
                <CardTitle className="text-maroon text-lg">VedicAstro Engine</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  Powered by the VedicAstro open-source library with Swiss Ephemeris precision for
                  astronomical calculations — the same ephemeris used by NASA for planetary positions.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="border-saffron/20 text-center">
              <CardHeader>
                <Brain className="w-10 h-10 text-saffron mx-auto mb-2" />
                <CardTitle className="text-maroon text-lg">Google Gemini AI</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  AI-powered interpretations using Google Gemini, trained with Vedic astrological principles
                  and prompts crafted by experienced Jyotish practitioners for authentic, meaningful readings.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="border-saffron/20 text-center">
              <CardHeader>
                <Shield className="w-10 h-10 text-saffron mx-auto mb-2" />
                <CardTitle className="text-maroon text-lg">Swiss Ephemeris</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  Astronomical calculations based on the Swiss Ephemeris (Doris &amp; Alois Treindl),
                  the gold standard in astrological computation with arc-second precision.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
          <div className="text-center mt-10">
            <p className="text-sm text-muted-foreground italic">
              &ldquo;Dedicated to Parashara MahaRishi, the father of Vedic Astrology, and K.S. Krishnamurti,
              the pioneer of the KP System.&rdquo;
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-b from-maroon-dark via-maroon to-maroon-dark py-12">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-gold-light mb-4">Ready to Explore Your Chart?</h2>
            <p className="text-saffron-light/70 mb-6">
              Generate your free birth chart and discover what the cosmos has in store for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/">
                <Button size="lg" className="bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-maroon-dark font-bold px-8 py-6 text-lg">
                  <Star className="w-5 h-5 mr-2" /> Generate Kundali
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%20AstroBidhi`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="border-saffron text-saffron-light hover:bg-saffron/10 px-8 py-6 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" /> WhatsApp Us
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
