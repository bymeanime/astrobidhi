'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Star, Compass, Calendar, Sparkles, Brain, Heart, Briefcase,
  DollarSign, Activity, Flower2, BookOpen, Eye, Zap, Shield,
  ChevronRight, ArrowLeft, MessageCircle, Users, GraduationCap,
  Sun, Crown, Clock, Phone, UserCheck, Flame
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const WHATSAPP_NUMBER = '9779709735537'

const analysisTypes = [
  {
    icon: <Star className="w-6 h-6" />,
    title: 'Overall Reading',
    desc: 'Complete birth chart interpretation covering personality, strengths, weaknesses, life purpose, and key planetary influences. Analyzes your Ascendant (Lagna), Moon sign (Rasi), Sun sign, and all planetary placements to give you a holistic understanding of who you are and where your life is headed. This is the foundation reading that sets the context for all other specialized analyses.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Career & Profession',
    desc: 'Discover your ideal professional path, suitable career fields, growth periods, business vs job indications, and financial prospects. Based on your 10th house (Karma Bhava), Amatyakaraka planet, and Dasa periods affecting career. Learn when promotions, job changes, or entrepreneurial success are most likely, and get remedies for career obstacles.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Love & Marriage',
    desc: 'Get insights into marriage timing, spouse characteristics, compatibility analysis, relationship dynamics, and remedies for delays. Analyzed through your 7th house (Kalatra Bhava), Venus, Jupiter, and Navamsha (D9) chart. Understand the nature of your future partner, potential challenges in relationships, and the best periods for love and marriage.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Activity className="w-6 h-6" />,
    title: 'Health & Wellness',
    desc: 'Understand your health vulnerabilities, Ayurvedic body constitution (Vata/Pitta/Kapha), potential health issues by house and planet, and preventive remedies. Based on your 6th house (Ripu Bhava), Ascendant lord, and planetary afflictions. Learn which body systems need extra care and when health challenges may arise according to Dasa periods.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: 'Wealth & Finance',
    desc: 'Explore your income sources, wealth yogas (Dhana Yogas), investment periods, property prospects, and financial growth timeline. Based on your 2nd house (Dhana Bhava), 11th house (Labha Bhava), and Jupiter placements. Discover when windfalls, property gains, or financial growth are most likely, and which investment strategies align with your chart.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Flower2 className="w-6 h-6" />,
    title: 'Spiritual Growth',
    desc: 'Uncover your Dharma (life purpose), spiritual path, past life karma, meditation practices, guru influences, and Moksha indications. Based on your 9th house (Dharma Bhava), 12th house (Moksha Bhava), Ketu, and Jupiter. Learn which spiritual practices resonate with your chart, when spiritual awakenings may occur, and karmic patterns from past lives.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Dasa Periods',
    desc: 'Get a detailed timeline of your current and upcoming Vimshottari Dasa Maha Dasa and Bhukti (sub-periods) with specific timing, effects, and remedies for challenging periods. The Vimshottari Dasa system is the most important predictive tool in Vedic astrology, revealing exactly when the promises of your birth chart will manifest.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Compass className="w-6 h-6" />,
    title: 'Horary (Prasna)',
    desc: 'Get instant answers to specific yes/no questions using the KP system with a number between 1-249. Prasna astrology works by casting a chart for the exact moment the question is asked, providing remarkably accurate answers about timing, outcome, and guidance. Perfect for urgent questions about job interviews, property deals, legal matters, or lost items.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <GraduationCap className="w-6 h-6" />,
    title: 'Education & Learning',
    desc: 'Discover your ideal academic fields, higher education timing, learning style, and competitive exam prospects. Based on your 4th house (Vidya Bhava), 5th house (Buddhi Bhava), and Mercury placements. Learn which subjects and career paths align with your natural talents, when academic success is most likely, and remedies for educational obstacles.',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Family & Children',
    desc: 'Understand family harmony dynamics, relationship with parents, children prospects, and timing from Putra Bhava (5th house). Analyze the potential for having children, their nature and your bond with them, and family wealth inheritance patterns. Also covers relationships with siblings (3rd house) and mother (4th house).',
    type: 'Free',
    category: 'Standard',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: '5-Year SWOT Forecast',
    desc: 'Comprehensive 5-year career and wealth forecast with Strengths, Weaknesses, Opportunities, Threats analysis, specific timing for major events, and personalized remedies. This premium analysis maps your upcoming Dasa periods against current transits to create a strategic life plan covering career moves, financial decisions, and personal development milestones for the next five years.',
    type: 'Premium',
    category: 'Advanced',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Cosmic Blueprint',
    desc: 'Premium house-by-house blueprint with Ashtakvarga scores, Yoga directory (Raja Yoga, Dhana Yoga, Gajakesari Yoga, etc.), Shadbala planetary strength analysis, and harmonized interpretations across all areas of life. This is the most comprehensive single reading available, giving you a complete map of your cosmic DNA with strength scores for every planet and house.',
    type: 'Premium',
    category: 'Advanced',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Shadow Integration',
    desc: 'Deep psychological analysis combining Vedic astrology with shadow work. Identifies repressed patterns through Rahu/Ketu axis analysis, vulnerability maps from 6th/8th/12th house placements, tragic sublimation themes, and provides an integration protocol for personal transformation. This reading bridges astrology and psychology for profound self-understanding and healing.',
    type: 'Premium',
    category: 'Advanced',
  },
]

const readingTiers = [
  {
    icon: <Phone className="w-6 h-6" />,
    title: 'Basic Vedic Consultation',
    desc: '30-minute personal reading with a certified Vedic astrologer. Get answers to 1 specific question with basic Dasa period analysis and simple remedies based on your birth chart. Perfect for focused guidance on a single concern.',
    price: '$29.99',
    category: 'Reading',
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: 'Standard Vedic Reading',
    desc: '45-minute in-depth reading with a senior Vedic astrologer. Ask up to 3 questions covering career, relationships, or health. Includes detailed Dasa analysis, planetary transit impacts, and personalized remedies with gemstone recommendations.',
    price: '$49.99',
    category: 'Reading',
  },
  {
    icon: <Crown className="w-6 h-6" />,
    title: 'Premium Vedic Consultation',
    desc: '60-minute comprehensive consultation with an expert Vedic astrologer. Up to 5 questions, full Dasa-bhukti analysis, Kundali matching for marriage compatibility, detailed transit forecast, and complete remedies including mantras, gemstones, and rituals.',
    price: '$79.99',
    category: 'Reading',
  },
  {
    icon: <Flame className="w-6 h-6" />,
    title: 'Ultimate Vedic Session',
    desc: '90-minute complete life consultation with a master Vedic astrologer. Unlimited questions, full birth chart analysis, Dasa-bhukti-antara deep dive, Kundali matching, Prasna (horary) for urgent questions, yearly forecast, and comprehensive remedies with 30-day follow-up email support.',
    price: '$149.99',
    category: 'Reading',
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

        {/* AI-Powered Analysis */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-maroon mb-2">AI-Powered Analysis Offerings</h2>
            <div className="vedic-divider max-w-xs mx-auto my-4" />
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every analysis is generated using your precise birth details with Swiss Ephemeris-level astronomical
              accuracy, then interpreted by advanced AI trained on Vedic astrological principles.
            </p>
          </div>

          {/* Standard Analyses */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-saffron/20 text-maroon text-xs">Standard</Badge>
              <span className="text-sm text-muted-foreground">Free AI-powered interpretations included with every birth chart</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {analysisTypes.filter(a => a.category === 'Standard').map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <Card className="border-saffron/20 hover:border-saffron/50 hover:shadow-lg transition-all h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="text-saffron">{item.icon}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-saffron/20 text-maroon">
                          Free
                        </span>
                      </div>
                      <CardTitle className="text-maroon text-base">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Advanced Analyses */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-xs">Advanced</Badge>
              <span className="text-sm text-muted-foreground">Premium in-depth analyses with advanced techniques</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {analysisTypes.filter(a => a.category === 'Advanced').map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <Card className="border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all h-full bg-gradient-to-br from-amber-50/50 to-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="text-amber-600">{item.icon}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r from-amber-600 to-yellow-500 text-white">
                          Premium
                        </span>
                      </div>
                      <CardTitle className="text-maroon text-base">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Daily Horoscope */}
        <section className="bg-gradient-to-b from-saffron/5 to-transparent py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon mb-2">Daily Horoscope</h2>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-maroon mb-3">Free Daily Zodiac Predictions</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Every day, AstroBidhi generates fresh Vedic astrology predictions for all 12 zodiac signs based on
                  current planetary transits (Gochara). Simply select your Moon sign (Rasi) on the home page to see
                  today&apos;s prediction covering career, love, health, and finance, along with your lucky number
                  and color for the day. These predictions are free and available to everyone — no birth chart required.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  The daily horoscope widget uses AI to analyze the current positions of all planets relative to each
                  zodiac sign, providing personalized guidance that goes beyond generic sun-sign horoscopes found
                  elsewhere. Predictions are cached daily for consistency and refreshed each morning.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-maroon mb-3">Personalized Daily Horoscope (Premium)</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  For subscribers, AstroBidhi offers a personalized daily horoscope that uses your actual birth chart
                  data — not just your zodiac sign. This premium service analyzes your Moon sign, Nakshatra, current
                  Dasa period, and planetary transits specific to your chart to provide deeply personal daily guidance.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  The personalized horoscope includes your current Vimshottari Dasa context, specific transit impacts
                  on your natal planets, a Vedic affirmation, and caution areas for the day. It&apos;s like having
                  a personal Jyotish advisor guiding you every morning.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Live Vedic Readings */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-maroon mb-2">Live Vedic Readings</h2>
            <div className="vedic-divider max-w-xs mx-auto my-4" />
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Book a one-on-one consultation with a certified Vedic astrologer for personalized guidance.
              Our astrologers are trained in the Parashari and KP systems with years of practical experience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {readingTiers.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                <Card className="border-saffron/20 hover:border-saffron/50 hover:shadow-lg transition-all h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-saffron">{item.icon}</div>
                        <CardTitle className="text-maroon text-base">{item.title}</CardTitle>
                      </div>
                      <span className="text-lg font-bold text-saffron">{item.price}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                    <a href="/reading" className="mt-3 inline-block">
                      <Button size="sm" className="bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-maroon-dark font-semibold text-xs">
                        Book Now <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </a>
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
