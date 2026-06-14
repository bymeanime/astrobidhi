'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Star, Compass, Calendar, Sparkles, Brain, Heart, Briefcase,
  DollarSign, Activity, Flower2, BookOpen, Eye, Zap, Shield,
  ChevronRight, ArrowLeft, MessageCircle, Users, GraduationCap,
  Sun, Crown, Clock, Phone, UserCheck, Flame, Gem, RotateCcw,
  Hash
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const WHATSAPP_NUMBER = '9779709735537'

// All analysis types — verified against /api/ai-analysis/route.ts ANALYSIS_PROMPTS
const standardAnalysisTypes = [
  {
    icon: <Star className="w-6 h-6" />,
    title: 'Overall Reading',
    id: 'overall',
    desc: 'Complete birth chart interpretation covering personality, strengths, weaknesses, life purpose, and key planetary influences. Analyzes your Ascendant (Lagna), Moon sign (Rasi), Sun sign, and all planetary placements to give you a holistic understanding of who you are and where your life is headed. This is the foundation reading that sets the context for all other specialized analyses.',
    type: 'Free',
  },
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Career & Profession',
    id: 'career',
    desc: 'Discover your ideal professional path, suitable career fields, growth periods, business vs job indications, and financial prospects. Based on your 10th house (Karma Bhava), Amatyakaraka planet, and Dasa periods affecting career. Learn when promotions, job changes, or entrepreneurial success are most likely, and get remedies for career obstacles.',
    type: 'Free',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Love & Marriage',
    id: 'relationships',
    desc: 'Get insights into marriage timing, spouse characteristics, compatibility analysis, relationship dynamics, and remedies for delays. Analyzed through your 7th house (Kalatra Bhava), Venus, Jupiter, and Navamsha (D9) chart. Understand the nature of your future partner, potential challenges in relationships, and the best periods for love and marriage.',
    type: 'Free',
  },
  {
    icon: <Activity className="w-6 h-6" />,
    title: 'Health & Wellness',
    id: 'health',
    desc: 'Understand your health vulnerabilities, Ayurvedic body constitution (Vata/Pitta/Kapha), potential health issues by house and planet, and preventive remedies. Based on your 6th house (Ripu Bhava), Ascendant lord, and planetary afflictions. Learn which body systems need extra care and when health challenges may arise according to Dasa periods.',
    type: 'Free',
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: 'Wealth & Finance',
    id: 'finance',
    desc: 'Explore your income sources, wealth yogas (Dhana Yogas), investment periods, property prospects, and financial growth timeline. Based on your 2nd house (Dhana Bhava), 11th house (Labha Bhava), and Jupiter placements. Discover when windfalls, property gains, or financial growth are most likely, and which investment strategies align with your chart.',
    type: 'Free',
  },
  {
    icon: <GraduationCap className="w-6 h-6" />,
    title: 'Education & Learning',
    id: 'education',
    desc: 'Discover your ideal academic fields, higher education timing, learning style, and competitive exam prospects. Based on your 4th house (Vidya Bhava), 5th house (Buddhi Bhava), 9th house (higher learning), and Mercury placements. Learn which subjects and career paths align with your natural talents, when academic success is most likely, and remedies for educational obstacles.',
    type: 'Free',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Family & Children',
    id: 'family',
    desc: 'Understand family harmony dynamics, relationship with parents, children prospects, and timing from Putra Bhava (5th house). Analyze the potential for having children, their nature and your bond with them, and family wealth inheritance patterns. Also covers relationships with siblings (3rd house) and mother (4th house), with Jupiter\'s influence on progeny.',
    type: 'Free',
  },
  {
    icon: <Compass className="w-6 h-6" />,
    title: 'Horary (Prasna)',
    id: 'horary',
    desc: 'Get instant answers to specific yes/no questions using the KP system with a number between 1-249. Prasna astrology works by casting a chart for the exact moment the question is asked, providing remarkably accurate answers about timing, outcome, and guidance. Perfect for urgent questions about job interviews, property deals, legal matters, or lost items.',
    type: 'Free',
  },
]

const proAnalysisTypes = [
  {
    icon: <Flower2 className="w-6 h-6" />,
    title: 'Spiritual Growth',
    id: 'spiritual',
    desc: 'Uncover your Dharma (life purpose), spiritual path, past life karma, meditation practices, guru influences, and Moksha indications. Based on your 9th house (Dharma Bhava), 12th house (Moksha Bhava), Ketu, and Jupiter. Learn which spiritual practices resonate with your chart — Bhakti, Jnana, Karma, or Raja yoga — when spiritual awakenings may occur, and karmic patterns from past lives. Includes personalized mantras and spiritual practices.',
    type: 'Pro',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Dasa Periods',
    id: 'dasa',
    desc: 'Get a detailed timeline of your current and upcoming Vimshottari Dasa Maha Dasa and Bhukti (sub-periods) with specific timing, effects, and remedies for challenging periods. The Vimshottari Dasa system is the most important predictive tool in Vedic astrology, revealing exactly when the promises of your birth chart will manifest. Includes Dasa lord placement effects, key life event timing, challenging vs golden periods, and timeline-specific guidance.',
    type: 'Pro',
  },
  {
    icon: <Crown className="w-6 h-6" />,
    title: 'Vedic Master Reading',
    id: 'vedic_master',
    desc: 'The most authoritative reading combining Parashara, Jaimini, and KP systems. Includes Lagna deep analysis with Arudha Lagna, complete planetary summary with dignity and aspects, divisional chart findings (D9 Navamsha, D10 Dashamsha, D12 Dwadamsha), ALL yogas identified with activation status (Raj, Dhana, Daridra, Kemadruma), Ashtakavarga scores, Dasa effects with event timing, blunt strengths & weaknesses with no sugar-coating, and a karmic verdict for this life\'s core lesson. Uses strict sidereal Lahiri ayanamsa.',
    type: 'Pro',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Trik Bhava Analysis',
    id: 'trik_bhava',
    desc: 'Deep analysis of the 6th/8th/12th houses (Dusthana) — the most transformative yet challenging houses. Identifies your dominant Trik energy and its ruling planet\'s influence on your psyche. Covers 6th house (enemies, debts, diseases, service), 8th house (transformation, hidden wealth, chronic issues, sudden events, longevity), 12th house (losses, moksha potential, foreign connections, subconscious patterns). Includes karmic-psychological insights, relationship and career snapshots, and future trajectory for both love and career.',
    type: 'Pro',
  },
  {
    icon: <Sun className="w-6 h-6" />,
    title: '12-Month Forecast',
    id: 'forecast_12month',
    desc: 'A detailed 12-month deep forecast covering current transits affecting your chart right now, career shifts and job changes, money patterns and investment windows, emotional cycles and stress periods, hidden opportunities brewing beneath the surface, key turning points with specific months, love life developments and marriage windows, month-by-month financial outlook, and practical action items for each quarter. References Dasa periods and transits for precise timing.',
    type: 'Pro',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Cosmic Love Letter',
    id: 'cosmic_love_letter',
    desc: 'A poetic love letter from the stars — not a clinical analysis but an intimate, warm reading. Reveals your Cosmic Love Signature (how you love, based on Venus sign, 7th house, and Moon Nakshatra), what the stars whisper about your hidden emotional needs, your karmic love story from past-life connections through the Rahu-Ketu axis, the gap between love you give vs. need, your heart\'s timetable for when love enters and deepens, a letter for your future partner, healing guidance for one relationship wound, and a poetic closing blessing crafted from your chart.',
    type: 'Pro',
  },
  {
    icon: <Hash className="w-6 h-6" />,
    title: 'Name Numerology',
    id: 'name_numerology',
    desc: 'Vedic name numerology using the Chaldeon system. Analyzes your current name\'s numerical value, Lo Shu grid, and destiny/life path/soul urge numbers from your name. Compares with your birth date numerology to assess name-birth harmony. Covers career impact, health impact, and relationship impact of your name number. If needed, provides specific letter addition or change suggestions with numerical reasoning, plus your lucky numbers and colors based on your numerological profile.',
    type: 'Pro',
  },
  {
    icon: <Gem className="w-6 h-6" />,
    title: 'Gemstone & Remedy',
    id: 'gemstone_remedy',
    desc: 'Personalized gemstone, rudraksha, mantra, fasting, and charity recommendations with a monthly remedy calendar. Covers your primary gemstone (based on Ascendant lord — stone, weight, metal, finger, day to wear, mantra), secondary gemstone for weakest benefic, rudraksha recommendation by ruling planet, specific mantras (Lagna lord, Navagraha, problem-specific), fasting days, Daan (charity) guidance, color therapy, gemstones to AVOID (enemy planets, 6/8/12 lords), and a 30-day remedy calendar with specific remedies for each day.',
    type: 'Pro',
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: 'Compatibility Profile',
    id: 'compatibility_profile',
    desc: 'Your ideal partner profile derived directly from your birth chart. Reveals partner traits from your 7th house sign/lord and Venus/Moon positions (physical, emotional, mental traits), Nakshatra-based ideal matches, what you truly need vs. want (Moon emotional needs vs. Venus attraction gap), Mangal Dosha status and impact on partner selection, top 3 Moon sign matches with reasons, red flag patterns your chart attracts, ideal meeting period based on Dasa windows, and one key shift to attract the right partner.',
    type: 'Pro',
  },
]

const advancedAnalysisTypes = [
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Cosmic Blueprint',
    id: 'cosmic_blueprint',
    desc: 'The most comprehensive single reading available — your complete cosmic DNA map. Covers core identity (Lagna, Moon sign/Nakshatra, Sun sign), house-by-house analysis of all 12 houses with sign, lord, occupants, SubLord, and both standard and modern psychological interpretations, Ashtakavarga assessment of house strengths, a complete Planetary Yoga Directory with name, category, standard and wise interpretation, and scare factor, Panchanga details (Tithi, Yoga, Karana), and your life path covering strengths, challenges, dharma, karma, career, and spiritual practices.',
    type: 'Advanced',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Shadow Integration',
    id: 'shadow_integration',
    desc: 'Deep psychological analysis combining Vedic astrology with shadow work. Identifies your core shadow through Lagna shadow, Moon blindspots, and Rahu-Ketu obsession-liberation axis. Maps vulnerability levels for all 12 houses (Low/Medium/High/Critical), provides shadow frameworks with raw classical readings and mitigation/sublimation pathways, reveals tragic sublimation potential (destructive patterns transformed into career strengths and daily practices), creates a deficiency map of energy drainage, and delivers an integration protocol with the top 3 shadows to address, warning periods, remedies, and psychological practices.',
    type: 'Advanced',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Life Decoder',
    id: 'life_decoder',
    desc: 'A combined numerology + life path + personality deep dive. Using your birth date for numerology: Life Path Number (core purpose and destiny), Destiny Number (what you\'re meant to become), and Soul Urge Number (inner motivations and desires). Combined with chart analysis to reveal personality traits confirmed and hidden from your chart, hidden strengths you don\'t fully use yet, blindspot weaknesses that sabotage you, a destiny blueprint at the intersection of numbers and planets, and the single biggest life purpose — one sentence that defines your mission.',
    type: 'Advanced',
  },
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Career Destiny',
    id: 'career_destiny',
    desc: 'Find your destined career path with precision. Reveals your natural talents (what you were born to do), decision-making style (Mercury/Moon analysis), top 3 career/business paths where extraordinary success is destined — with specific industries and roles, one field to avoid where you\'ll struggle no matter how hard you try, whether your success comes through hierarchy or autonomy, your growth pattern (linear, exponential, or cyclical), Dasa-based timing for career breakthroughs, and a 3-step immediate action plan toward your destined career.',
    type: 'Advanced',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Relationship Destiny',
    id: 'relationship_destiny',
    desc: 'The deepest relationship analysis available. Covers compatible partner types with specific personality traits your chart attracts, love lessons from each relationship (5th/7th/9th house analysis), hidden compatibility patterns (what you truly need vs. what you think you want), red flags you repeatedly overlook, exact traits of your growth partner who accelerates your evolution, trust patterns (Venus/Moon analysis), intimacy blocks preventing deep connection, emotional withdrawal patterns and triggers, Dasa-based marriage timeline windows, and one relationship remedy practice to transform your love life.',
    type: 'Advanced',
  },
  {
    icon: <Flower2 className="w-6 h-6" />,
    title: 'Soul Purpose',
    id: 'soul_purpose',
    desc: 'Discover why your soul chose this lifetime. Reveals your core mission (9th/12th house + Atmakaraka), karmic lessons and growth edges, your contribution to humanity, your Dharma vs. Karma balance, soul contracts with key people and situations, 5 actionable daily alignment steps, how to start living on purpose today with an immediate action plan, signs you\'re on track (indicators of alignment), and warning signals that you\'re off track. This reading bridges astrology and existential purpose for profound life direction.',
    type: 'Advanced',
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: 'Wealth Code',
    id: 'wealth_code',
    desc: 'Unlock your personal wealth and abundance code. Identifies your money personality (spender/saver/investor from chart), mental blocks limiting income from subconscious planetary patterns, your exact wealth attraction strategy personalized for your chart, natural financial talents that make money come easily, financial self-sabotage mistakes blocking growth, a wealth-building strategy that fits your true nature, 2nd/11th house deep dive into income sources and gain channels, Dhana Yoga activation timing and maximization, Dasa-based wealth windows for when to invest, save, and spend, and one money mantra guiding principle for your financial life.',
    type: 'Advanced',
  },
  {
    icon: <Sun className="w-6 h-6" />,
    title: 'Future Timeline',
    id: 'future_timeline',
    desc: 'Your future mapped with precision — a 5-year roadmap. Identifies key turning points from past events that shaped you, your current phase in the life cycle, a year-by-year breakdown (Year 1: Foundation/shift, Year 2: Growth/expansion, Year 3: Breakthrough/crossroads, Year 4: Consolidation/mastery, Year 5: Harvest/new beginning), transformation phases when identity shifts occur, the ideal 5-year route aligned with your chart, age-based life stage analysis for this decade, unconscious strengths being developed, and opportunities uniquely positioned for you right now.',
    type: 'Advanced',
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: '5-Year SWOT Forecast',
    id: 'swot_5year',
    desc: 'Comprehensive 5-year career and wealth forecast with Strengths, Weaknesses, Opportunities, Threats analysis, specific timing for major events, and personalized remedies. This analysis maps your chart foundation (Lagna, Moon/Sun signs, career/wealth planet positions, current Dasa), year-by-year career predictions with growth, changes, breakthroughs, and suitable industries, year-by-year wealth predictions with income growth, investment periods, windfalls, and financial challenges, supporting health, relationship, and spiritual highlights, and practical recommendations including gemstones, favorable periods, mantras, and action steps.',
    type: 'Advanced',
  },
  {
    icon: <Compass className="w-6 h-6" />,
    title: 'KP Prashna (Advanced)',
    id: 'kp_prashna',
    desc: 'Advanced KP horary using Krishnamurti Paddhati Sub-Lord theory for one burning question with precise timing. Includes question verification and astrological rephrasing, chart construction from your horary number, significators from ruling planets and Sub-Lords for relevant houses, Sub-Lord judgment on whether the question is favored or denied, ruling planets confirmation (current Lagna lord, Moon sign lord, Moon star lord, day lord), a clear Yes/No verdict with confidence level (High/Medium/Low), conditions for manifestation, timing using Dasa, Bhukti, Antra, and transit confirmations, obstacles that could delay or deny the outcome, and advice on what to DO to improve the outcome.',
    type: 'Advanced',
  },
  {
    icon: <RotateCcw className="w-6 h-6" />,
    title: 'Past Life Karma',
    id: 'past_life_karma',
    desc: 'Discover your past life karmic origins and their influence on this incarnation. Analyzes the Rahu-Ketu axis to identify which past life theme dominates, 12th house past life talents and debts, 8th house karmic debt (transformation, inheritance, chronic patterns), Saturn\'s karmic lesson (where Saturn sits = your specific homework), unfinished business from Moon Nakshatra emotional threads, karmic relationships with past-life connections (5th/9th house lords), karmic rewards from Jupiter\'s placement (blessings earned from past lives), this life\'s karmic purpose — the ONE knot your soul chose to untie, and a liberation path with specific 12th house remedies to clear karmic debt.',
    type: 'Advanced',
  },
  {
    icon: <Flame className="w-6 h-6" />,
    title: 'Mangal Dosha Report',
    id: 'mangal_dosha',
    desc: 'Complete Mangal Dosha analysis with severity assessment, cancellation checks, marriage impact, and Mars pacification remedies. Determines dosha status (Present/Absent), which houses Mars occupies, and degree of severity (Mild/Moderate/Severe). Runs cancellation checks (Mars in own sign/exalted, in Aries/Scorpio/Cancer/Leo, conjunct Jupiter/Sun, aspect from Jupiter). Analyzes impact on marriage (7th house affliction, delay, spouse health, conflict patterns), relationships (aggression, dominance, emotional volatility), and career (competitive drive, authority conflicts). Covers Mangal Dosha matching rules, compatible partner Mars placements, specific mantras, fasting, gemstone, and charity remedies, best Dasa periods for Manglik marriage, and post-marriage harmony practices.',
    type: 'Advanced',
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: 'Sade Sati Report',
    id: 'sade_sati',
    desc: 'Saturn\'s 7.5-year transit analysis — the most transformative period in Vedic astrology. Identifies your current phase (Rising/Peak/Setting), Saturn\'s current transit relative to your natal Moon, and a phase-wise breakdown: Rising (before Moon — mental pressure, anxiety, preparation), Peak (over Moon — maximum intensity, health and career tests, identity crisis), Setting (after Moon — financial strain, gradual relief, lessons integrating). Covers career impact (job changes, delays, blocked promotions, perseverance lessons), health impact (vulnerable areas, chronic issues, mental health periods), relationship impact (family tension, marriage stress, isolation periods), financial impact (expense periods, investment cautions, savings strategy), Dhaiya check (small Sade Sati when Saturn transits 4th or 8th from Moon), key dates when intensity shifts, the silver lining — what Sade Sati gives you that you\'ll be grateful for later, and Saturn-specific remedies (mantras, Shani temple visits, charity, fasting).',
    type: 'Advanced',
  },
]

const readingTiers = [
  {
    icon: <Phone className="w-6 h-6" />,
    title: 'Basic Vedic Consultation',
    desc: '30-minute personal reading with a certified Vedic astrologer. Get answers to 1 specific question with basic Dasa period analysis and simple remedies based on your birth chart. Perfect for focused guidance on a single concern like a job opportunity, relationship question, or health worry.',
    price: '$29.99',
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: 'Standard Vedic Reading',
    desc: '45-minute in-depth reading with a senior Vedic astrologer. Ask up to 3 questions covering career, relationships, or health. Includes detailed Dasa analysis, planetary transit impacts, and personalized remedies with gemstone recommendations. Ideal for those seeking guidance across multiple life areas.',
    price: '$49.99',
  },
  {
    icon: <Crown className="w-6 h-6" />,
    title: 'Premium Vedic Consultation',
    desc: '60-minute comprehensive consultation with an expert Vedic astrologer. Up to 5 questions, full Dasa-bhukti analysis, Kundali matching for marriage compatibility, detailed transit forecast, and complete remedies including mantras, gemstones, and rituals. Recommended for serious life decisions and marriage planning.',
    price: '$79.99',
  },
  {
    icon: <Flame className="w-6 h-6" />,
    title: 'Ultimate Vedic Session',
    desc: '90-minute complete life consultation with a master Vedic astrologer. Unlimited questions, full birth chart analysis, Dasa-bhukti-antara deep dive, Kundali matching, Prasna (horary) for urgent questions, yearly forecast, and comprehensive remedies with 30-day follow-up email support. The most thorough reading available.',
    price: '$149.99',
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
                Jyotish Shastra with cutting-edge AI technology. Generate precise KP birth charts using Swiss Ephemeris-level
                astronomical accuracy, explore Vimshottari Dasa timelines, receive AI-powered personalized interpretations
                for every aspect of your life, and book live consultations with certified Vedic astrologers.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Standard (Free) Analysis */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-maroon mb-2">AI-Powered Analysis Offerings</h2>
            <div className="vedic-divider max-w-xs mx-auto my-4" />
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every analysis is generated using your precise birth details with Swiss Ephemeris-level astronomical
              accuracy, then interpreted by advanced AI trained on Vedic astrological principles. We offer 30+
              unique analysis types across three tiers, plus live readings with certified astrologers.
            </p>
          </div>

          {/* Standard */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-saffron/20 text-maroon text-xs">Standard</Badge>
              <span className="text-sm text-muted-foreground">Free AI-powered interpretations included with every birth chart</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardAnalysisTypes.map((item, i) => (
                <motion.div
                  key={item.id}
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
                      <CardTitle className="text-maroon text-sm">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-xs leading-relaxed">{item.desc}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Pro */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-xs">Pro</Badge>
              <span className="text-sm text-muted-foreground">Premium analyses with advanced Vedic techniques and deeper insights</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {proAnalysisTypes.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <Card className="border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all h-full bg-gradient-to-br from-amber-50/50 to-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="text-amber-600">{item.icon}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r from-amber-600 to-yellow-500 text-white">
                          Pro
                        </span>
                      </div>
                      <CardTitle className="text-maroon text-sm">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-xs leading-relaxed">{item.desc}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Advanced */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white text-xs">Advanced</Badge>
              <span className="text-sm text-muted-foreground">Our deepest, most comprehensive analyses with specialized frameworks</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {advancedAnalysisTypes.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <Card className="border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all h-full bg-gradient-to-br from-purple-50/50 to-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="text-purple-700">{item.icon}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r from-purple-800 to-indigo-900 text-white">
                          Advanced
                        </span>
                      </div>
                      <CardTitle className="text-maroon text-sm">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-xs leading-relaxed">{item.desc}</CardDescription>
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
                  elsewhere. Each prediction includes a one-line vibe summary, career guidance, love energy, health
                  tips, lucky color, number, and time, a caution area, and a personalized affirmation. Predictions are
                  cached daily for consistency and refreshed each morning.
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
                  on your natal planets, a Vedic affirmation, and caution areas for the day. It covers today&apos;s
                  overall vibe, career guidance, love and romantic energy, health and wellness tips, your lucky color
                  and number for the day, a specific caution, and a personalized Vedic affirmation. It&apos;s like having
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
              Every reading is conducted live via video call with follow-up notes provided.
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

        {/* Birth Chart Features */}
        <section className="bg-gradient-to-b from-saffron/5 to-transparent py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon mb-2">Birth Chart & Kundali Features</h2>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-saffron/20 text-center">
                <CardHeader>
                  <Star className="w-10 h-10 text-saffron mx-auto mb-2" />
                  <CardTitle className="text-maroon text-lg">South Indian Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    Generate a traditional South Indian style Kundali with all 9 planets (Navagraha),
                    12 houses, planetary aspects (Drishti), and Vimshottari Dasa periods. Supports
                    KP (Krishnamurti), Lahiri, and Raman ayanamsa with Placidus, Equal, or Whole Sign
                    house systems.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-saffron/20 text-center">
                <CardHeader>
                  <Calendar className="w-10 h-10 text-saffron mx-auto mb-2" />
                  <CardTitle className="text-maroon text-lg">Dasa Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    View complete Vimshottari Dasa periods with Maha Dasa, Bhukti (Antardasa),
                    and Pratyantardasa levels. See exact start and end dates for every period,
                    helping you understand when planetary influences activate in your life.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-saffron/20 text-center">
                <CardHeader>
                  <Compass className="w-10 h-10 text-saffron mx-auto mb-2" />
                  <CardTitle className="text-maroon text-lg">Horary (Prasna)</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    Cast a Prasna chart using any number from 1-249 for instant answers to
                    burning questions. Uses KP Sub-Lord theory for precise Yes/No answers with
                    timing, conditions, and guidance. No birth details required — just a question
                    and a number.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-saffron/20 text-center">
                <CardHeader>
                  <Sparkles className="w-10 h-10 text-saffron mx-auto mb-2" />
                  <CardTitle className="text-maroon text-lg">Planets & Aspects</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    Detailed planetary positions with sign, degree, Nakshatra, Sub-Lord, and
                    house placement. View all planetary aspects (Drishti) with orb degrees and
                    meaning. Static meanings provide instant interpretation for every planet-sign
                    and planet-house combination.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-saffron/20 text-center">
                <CardHeader>
                  <Sun className="w-10 h-10 text-saffron mx-auto mb-2" />
                  <CardTitle className="text-maroon text-lg">Transit (Gochara)</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    Check current planetary positions for any location on Earth. See where
                    Saturn, Jupiter, Rahu, and Ketu are transiting and how they affect your
                    natal chart. Essential for understanding Sade Sati, Dhaiya, and other
                    transit-based predictions.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-saffron/20 text-center">
                <CardHeader>
                  <MessageCircle className="w-10 h-10 text-saffron mx-auto mb-2" />
                  <CardTitle className="text-maroon text-lg">AI Chat Follow-Up</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    After any AI analysis, ask follow-up questions about your reading. The AI
                    retains context from your analysis and birth chart, allowing deeper exploration
                    of specific topics, clarification of points, and personalized guidance on
                    remedies and timing.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* KP System */}
        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
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
        </section>

        {/* Technology & Credits */}
        <section className="bg-gradient-to-b from-saffron/5 to-transparent py-16">
          <div className="max-w-4xl mx-auto px-4">
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
                  <CardTitle className="text-maroon text-lg">Multi-Provider AI</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    AI-powered interpretations using Google Gemini, Groq, OpenRouter, xAI, and ZAI SDK
                    with automatic fallback. Prompts are crafted by experienced Jyotish practitioners
                    for authentic, meaningful readings with structured markdown output.
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
      <footer className="mt-auto bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60 pb-24">
        <div className="vedic-divider" />
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg text-gold animate-pulse-glow">ॐ</span>
              <span className="text-gold-light font-semibold text-xs">AstroBidhi</span>
              <span className="text-[10px] text-saffron-light/40">वैदिक ज्योतिष</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]">
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
