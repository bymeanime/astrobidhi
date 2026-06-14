'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { searchCities, getPopularCities, CityEntry } from '@/data/cities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star, Calendar, Clock, Shield, CheckCircle, Users, Phone, Mail,
  Globe, ChevronRight, Sparkles, Heart, Briefcase, Activity, DollarSign,
  Flower2, BookOpen, MapPin, Loader2, AlertCircle, ChevronDown, ArrowRight,
  Video, Award, MessageCircle, Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

// ============ Types ============
interface ReadingTier {
  id: string
  name: string
  price: number
  originalPrice: number
  duration: string
  questions: string
  features: string[]
  highlight: string | null
  badge: string | null
  color: string
  borderColor: string
}

interface BookingFormState {
  customerName: string
  customerEmail: string
  customerPhone: string
  birthDate: string
  birthTime: string
  birthCity: string
  birthLat: number
  birthLng: number
  birthUtc: string
  questions: string
  focusAreas: string[]
  preferredLanguage: string
}

interface BookingResult {
  bookingRef: string
  message: string
}

// ============ Fallback Tiers (used while API loads or if fetch fails) ============
const FALLBACK_TIERS: ReadingTier[] = [
  {
    id: 'basic',
    name: 'Basic Vedic Consultation',
    price: 29.99,
    originalPrice: 49.99,
    duration: '30 min',
    questions: '1 question',
    features: [
      'Basic Dasa analysis',
      'Simple remedies',
      'Birth chart overview',
      'Email summary included',
    ],
    highlight: null,
    badge: null,
    color: 'from-saffron/10 to-temple-bg',
    borderColor: 'border-saffron/30',
  },
  {
    id: 'standard',
    name: 'Standard Vedic Reading',
    price: 49.99,
    originalPrice: 79.99,
    duration: '45 min',
    questions: '3 questions',
    features: [
      'Detailed Dasa + transit analysis',
      'Gemstone recommendations',
      'Nakshatra deep dive',
      'Priority scheduling',
      'Recording included',
    ],
    highlight: null,
    badge: null,
    color: 'from-gold/10 to-temple-bg',
    borderColor: 'border-gold/30',
  },
  {
    id: 'premium',
    name: 'Premium Vedic Consultation',
    price: 79.99,
    originalPrice: 119.99,
    duration: '60 min',
    questions: '5 questions',
    features: [
      'Full Dasa-bhukti analysis',
      'Kundali matching included',
      'Complete remedies protocol',
      'Yoga identification & timing',
      'Priority scheduling',
      'Recording + transcript',
    ],
    highlight: 'Most comprehensive value for serious seekers',
    badge: 'POPULAR',
    color: 'from-maroon/10 to-temple-bg',
    borderColor: 'border-maroon/40',
  },
  {
    id: 'ultimate',
    name: 'Ultimate Vedic Session',
    price: 149.99,
    originalPrice: 219.99,
    duration: '90 min',
    questions: 'Unlimited questions',
    features: [
      'Deep dive into every area of life',
      'Full Kundali + Navamsha analysis',
      'Ashtakvarga scoring',
      'Year-by-year predictions',
      '30-day follow-up support',
      'Personalized remedy kit guide',
      'Priority scheduling',
      'Recording + transcript + PDF report',
    ],
    highlight: 'The most thorough reading we offer',
    badge: 'BEST VALUE',
    color: 'from-temple-red/10 to-temple-bg',
    borderColor: 'border-temple-red/40',
  },
]

const FOCUS_AREAS = [
  { id: 'career', label: 'Career', icon: Briefcase },
  { id: 'relationships', label: 'Relationships', icon: Heart },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'spiritual', label: 'Spiritual Growth', icon: Flower2 },
  { id: 'kundali', label: 'Kundali Matching', icon: Users },
  { id: 'dasa', label: 'Dasa Periods', icon: Calendar },
  { id: 'remedies', label: 'Remedies', icon: Sparkles },
]

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'tamil', label: 'Tamil' },
  { value: 'sanskrit', label: 'Sanskrit' },
  { value: 'marathi', label: 'Marathi' },
]

const ASTROLOGERS = [
  {
    name: 'Pandit Ravi Shastri',
    title: 'Vedic Astrologer & Jyotish Acharya',
    bio: '30+ years of practice in Parashari and KP systems. Specializes in career guidance, marriage matching, and Muhurta selection. Former head of Jyotish department at Varanasi Sanskrit University.',
    rating: 4.9,
    reviews: 1247,
    experience: '30 years',
    languages: ['Hindi', 'English', 'Sanskrit'],
    specializations: ['Career', 'Marriage', 'Muhurta'],
  },
  {
    name: 'Dr. Meera Iyer',
    title: 'KP System Specialist & Researcher',
    bio: 'PhD in Vedic Astrology from BHU. Expert in Krishnamurti Paddhati with 20+ years of accurate predictions. Published researcher in Nakshatra-based predictive techniques.',
    rating: 4.8,
    reviews: 892,
    experience: '20 years',
    languages: ['English', 'Hindi', 'Tamil'],
    specializations: ['KP System', 'Health', 'Finance'],
  },
  {
    name: 'Acharya Vikram Bhatt',
    title: 'Nadi Astrology & Remedies Expert',
    bio: 'Trained in traditional Nadi reading techniques with deep expertise in gemstone therapy, mantra prescriptions, and Vastu consultation. 15 years of dedicated practice helping thousands find clarity.',
    rating: 4.9,
    reviews: 634,
    experience: '15 years',
    languages: ['Hindi', 'English', 'Marathi'],
    specializations: ['Nadi', 'Remedies', 'Vastu'],
  },
]

const TRUST_BADGES = [
  { icon: Shield, label: 'Verified Astrologers', desc: 'All astrologers are certified and background-checked' },
  { icon: BookOpen, label: 'Authentic Vedic Tradition', desc: 'Following classical Parashari, KP, and Nadi systems' },
  { icon: Lock, label: 'Confidential Consultations', desc: 'Your data and sessions are fully private' },
  { icon: CheckCircle, label: 'Satisfaction Guarantee', desc: 'Full refund if you are not satisfied' },
]

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Choose Your Tier',
    desc: 'Select a reading package that matches your needs and budget',
    icon: Star,
  },
  {
    step: 2,
    title: 'Submit Birth Details',
    desc: 'Provide your birth information and questions for the astrologer',
    icon: Calendar,
  },
  {
    step: 3,
    title: 'Get Matched',
    desc: 'We match you with the best astrologer for your specific concerns',
    icon: Users,
  },
  {
    step: 4,
    title: 'Attend Your Reading',
    desc: 'Join a live video call for your personal Vedic consultation',
    icon: Video,
  },
]

// ============ Helper ============
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('astrobidhi_device_id')
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    localStorage.setItem('astrobidhi_device_id', id)
  }
  return id
}

// ============ Components ============

function ReadingNavbar() {
  return (
    <nav className="bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3">
            <div className="text-2xl text-gold animate-pulse-glow">ॐ</div>
            <div>
              <h1 className="text-xl font-bold text-gold-light tracking-wide">AstroBidhi</h1>
              <p className="text-[10px] text-saffron-light -mt-1 tracking-widest">वैदिक ज्योतिष</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <Badge className="bg-gradient-to-r from-saffron to-gold text-white text-xs px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" /> Personal Readings
            </Badge>
            <a
              href="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-saffron-light/70 hover:text-gold-light hover:bg-saffron/10 transition-all"
            >
              ← Back to App
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}

function ReadingFooter() {
  return (
    <footer className="mt-auto bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60">
      <div className="vedic-divider" />
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg text-gold animate-pulse-glow">ॐ</span>
            <span className="text-gold-light font-semibold text-xs">AstroBidhi</span>
            <span className="text-[10px] text-saffron-light/40">वैदिक ज्योतिष</span>
          </div>
          <p className="text-[10px] text-center text-saffron-light/40">
            Authentic Vedic Consultations &bull; Certified Astrologers &bull; Confidential &bull; Satisfaction Guaranteed
          </p>
          <div className="flex items-center gap-3">
            <a href="/" className="text-[10px] text-saffron-light/50 hover:text-gold-light transition-colors">Back to App</a>
            <span className="text-saffron-light/20">&bull;</span>
            <a href="/admin" className="text-[10px] text-saffron-light/50 hover:text-gold-light transition-colors">Admin</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-dark">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 text-8xl text-gold">ॐ</div>
        <div className="absolute bottom-10 right-10 text-8xl text-gold rotate-12">☸</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] text-gold/30">✦</div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-5xl md:text-7xl text-gold animate-pulse-glow mb-6">ॐ</div>
          <h1 className="text-3xl md:text-5xl font-bold text-gold-light mb-4 tracking-wide">
            Get a Personal Vedic Reading
          </h1>
          <p className="text-lg md:text-xl text-saffron-light/80 max-w-2xl mx-auto mb-8 leading-relaxed">
            Authentic in-person consultations with certified Vedic astrologers.
            Get deep insights into your birth chart, Dasa periods, and personalized remedies
            rooted in the timeless wisdom of Parashara and Jaimini.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#tiers" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
              <Star className="w-5 h-5" /> Choose Your Reading
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#how-it-works" className="inline-flex items-center gap-2 px-6 py-3 border border-saffron/40 text-saffron-light hover:bg-saffron/10 rounded-lg transition-all">
              <BookOpen className="w-5 h-5" /> How It Works
            </a>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-3xl mx-auto">
          {[
            { value: '5,000+', label: 'Readings Done' },
            { value: '4.9★', label: 'Average Rating' },
            { value: '30+', label: 'Years Experience' },
            { value: '98%', label: 'Satisfaction' },
          ].map((stat, i) => (
            <div key={i} className="text-center p-3 bg-white/5 rounded-lg border border-saffron/10">
              <div className="text-xl md:text-2xl font-bold text-gold-light">{stat.value}</div>
              <div className="text-xs text-saffron-light/60">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-20 bg-temple-bg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-maroon mb-3">How It Works</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            From booking to your personal consultation in four simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="relative border-saffron/20 hover:border-saffron/40 transition-all hover:shadow-lg h-full">
                  <CardContent className="p-6 text-center">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-gradient-to-r from-saffron to-gold rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                      {step.step}
                    </div>
                    <div className="w-14 h-14 mx-auto mt-3 mb-4 bg-gradient-to-br from-saffron/20 to-gold/20 rounded-xl flex items-center justify-center">
                      <Icon className="w-7 h-7 text-maroon" />
                    </div>
                    <h3 className="text-base font-semibold text-maroon mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </CardContent>
                  {i < HOW_IT_WORKS_STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 text-saffron/40">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: ReadingTier
  selected: boolean
  onSelect: () => void
}) {
  const discount = Math.round(((tier.originalPrice - tier.price) / tier.originalPrice) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="h-full"
    >
      <Card
        className={`relative h-full cursor-pointer transition-all duration-300 hover:shadow-xl ${
          selected
            ? 'border-maroon shadow-xl ring-2 ring-maroon/40 scale-[1.02]'
            : `hover:border-saffron/50 ${tier.borderColor}`
        }`}
        onClick={onSelect}
      >
        {tier.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-gradient-to-r from-maroon to-temple-red text-white px-4 py-1 text-xs font-bold shadow-lg">
              {tier.badge}
            </Badge>
          </div>
        )}

        <CardHeader className="pb-2 pt-6">
          <CardTitle className="text-lg font-bold text-maroon text-center">{tier.name}</CardTitle>
          <div className="text-center mt-2">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl font-bold text-maroon">${tier.price}</span>
              <span className="text-sm text-muted-foreground line-through">${tier.originalPrice}</span>
            </div>
            <Badge variant="outline" className="mt-1 border-vedic-green/30 text-vedic-green text-xs">
              Save {discount}%
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-2 pb-6">
          <div className="flex items-center justify-center gap-4 mb-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-saffron" /> {tier.duration}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4 text-saffron" /> {tier.questions}
            </span>
          </div>

          <Separator className="mb-4 bg-saffron/20" />

          <ul className="space-y-2 mb-6">
            {tier.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-vedic-green shrink-0 mt-0.5" />
                <span className="text-foreground/80">{feature}</span>
              </li>
            ))}
          </ul>

          {tier.highlight && (
            <p className="text-xs text-center text-maroon/70 italic mb-4">{tier.highlight}</p>
          )}

          <Button
            className={`w-full font-semibold transition-all ${
              selected
                ? 'bg-gradient-to-r from-maroon to-temple-red hover:from-maroon-dark hover:to-maroon text-white'
                : 'bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-white'
            }`}
          >
            {selected ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> Selected</>
            ) : (
              <>Select This Tier</>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ReadingTiersSection({
  selectedTier,
  onSelectTier,
  tiers,
  loading,
}: {
  selectedTier: string | null
  onSelectTier: (id: string) => void
  tiers: ReadingTier[]
  loading: boolean
}) {
  return (
    <section id="tiers" className="py-16 md:py-20 bg-gradient-to-b from-temple-bg to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-maroon mb-3">Choose Your Reading Tier</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            From a quick check-in to a comprehensive life analysis — select the depth that suits your needs
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {[1,2,3,4].map(i => (
              <Card key={i} className="h-80 animate-pulse border-saffron/20">
                <CardHeader className="pb-2 pt-6">
                  <div className="h-5 bg-saffron/20 rounded w-3/4 mx-auto mb-3" />
                  <div className="h-8 bg-saffron/15 rounded w-1/2 mx-auto mb-1" />
                  <div className="h-4 bg-saffron/10 rounded w-1/3 mx-auto" />
                </CardHeader>
                <CardContent className="pt-2 pb-6">
                  <div className="space-y-2">
                    {[1,2,3,4].map(j => (
                      <div key={j} className="h-4 bg-saffron/10 rounded w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                selected={selectedTier === tier.id}
                onSelect={() => onSelectTier(tier.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function BookingFormSection({
  selectedTier,
  form,
  onFormChange,
  focusAreas,
  onToggleFocusArea,
  onSubmit,
  submitting,
  tiers,
}: {
  selectedTier: string | null
  form: BookingFormState
  onFormChange: (field: keyof BookingFormState, value: string | number) => void
  focusAreas: string[]
  onToggleFocusArea: (area: string) => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  tiers: ReadingTier[]
}) {
  const popularCities = getPopularCities()
  const searchRef = useRef<HTMLDivElement>(null)
  const [citySearch, setCitySearch] = useState('')
  const [citySearchResults, setCitySearchResults] = useState<CityEntry[]>([])
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [selectedCity, setSelectedCity] = useState<CityEntry | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCitySearch = useCallback((query: string) => {
    setCitySearch(query)
    onFormChange('birthCity', query)
    if (query.length >= 2) {
      const results = searchCities(query)
      setCitySearchResults(results)
      setShowCityDropdown(results.length > 0)
    } else {
      setCitySearchResults([])
      setShowCityDropdown(false)
    }
  }, [onFormChange])

  const selectCity = useCallback((city: CityEntry) => {
    setSelectedCity(city)
    setCitySearch(`${city.name}, ${city.country}`)
    onFormChange('birthCity', `${city.name}, ${city.country}`)
    onFormChange('birthLat', city.lat)
    onFormChange('birthLng', city.lng)
    onFormChange('birthUtc', city.tz)
    setShowCityDropdown(false)
  }, [onFormChange])

  const tier = tiers.find(t => t.id === selectedTier)

  if (!selectedTier) {
    return (
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="p-8 bg-temple-bg rounded-2xl border border-saffron/20">
            <Star className="w-12 h-12 text-saffron mx-auto mb-4" />
            <h3 className="text-xl font-bold text-maroon mb-2">Select a Reading Tier Above</h3>
            <p className="text-muted-foreground">
              Choose the consultation package that fits your needs, then fill in your details to book.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="booking-form" className="py-16 md:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-maroon mb-3">Book Your Reading</h2>
          <p className="text-muted-foreground">
            Fill in your details to book a <span className="font-semibold text-maroon">{tier?.name}</span>
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card className="border-saffron/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-maroon flex items-center gap-2 text-base">
                <Users className="w-4 h-4" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-sm font-medium text-maroon">
                    Full Name <span className="text-temple-red">*</span>
                  </Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-saffron/60" />
                    <Input
                      id="customerName"
                      value={form.customerName}
                      onChange={e => onFormChange('customerName', e.target.value)}
                      placeholder="Your full name"
                      required
                      className="pl-9 h-10 border-saffron/30 focus:border-saffron"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail" className="text-sm font-medium text-maroon">
                    Email <span className="text-temple-red">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-saffron/60" />
                    <Input
                      id="customerEmail"
                      type="email"
                      value={form.customerEmail}
                      onChange={e => onFormChange('customerEmail', e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="pl-9 h-10 border-saffron/30 focus:border-saffron"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="text-sm font-medium text-maroon">
                  Phone <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-saffron/60" />
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={form.customerPhone}
                    onChange={e => onFormChange('customerPhone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="pl-9 h-10 border-saffron/30 focus:border-saffron"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Birth Details */}
          <Card className="border-saffron/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-maroon flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4" /> Birth Details
              </CardTitle>
              <CardDescription className="text-xs">
                Accurate birth details are essential for precise Vedic calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="text-sm font-medium text-maroon">
                    Date of Birth <span className="text-temple-red">*</span>
                  </Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={e => onFormChange('birthDate', e.target.value)}
                    required
                    className="h-10 border-saffron/30 focus:border-saffron"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthTime" className="text-sm font-medium text-maroon">
                    Time of Birth <span className="text-temple-red">*</span>
                  </Label>
                  <Input
                    id="birthTime"
                    type="time"
                    value={form.birthTime}
                    onChange={e => onFormChange('birthTime', e.target.value)}
                    required
                    className="h-10 border-saffron/30 focus:border-saffron"
                  />
                </div>
              </div>

              {/* City Search */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-maroon">
                  Birth City <span className="text-temple-red">*</span>
                </Label>
                <div className="relative" ref={searchRef}>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-saffron/60" />
                    <Input
                      type="text"
                      value={citySearch}
                      onChange={e => handleCitySearch(e.target.value)}
                      onFocus={() => { if (citySearchResults.length > 0) setShowCityDropdown(true) }}
                      placeholder="Search your birth city..."
                      required
                      className="pl-9 h-10 border-saffron/30 focus:border-saffron"
                    />
                  </div>
                  {showCityDropdown && citySearchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-saffron/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {citySearchResults.map((city, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectCity(city)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-saffron/10 transition-colors text-left border-b border-saffron/5 last:border-b-0"
                        >
                          <MapPin className="w-3.5 h-3.5 text-saffron/60 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-maroon">{city.name}</span>
                            <span className="text-muted-foreground text-xs ml-1">&bull; {city.country}</span>
                          </div>
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">UTC {city.tz}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected city info */}
              {selectedCity && (
                <div className="flex items-center gap-2 p-2.5 bg-saffron/10 rounded-lg text-sm">
                  <MapPin className="w-4 h-4 text-saffron shrink-0" />
                  <span className="text-maroon font-medium">{selectedCity.name}, {selectedCity.country}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({selectedCity.lat.toFixed(2)}&deg;, {selectedCity.lng.toFixed(2)}&deg;) &bull; UTC {selectedCity.tz}
                  </span>
                </div>
              )}

              {/* Popular Cities Quick-Select */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Popular cities:</p>
                <div className="flex flex-wrap gap-1.5">
                  {popularCities.map(city => (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() => selectCity(city)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        selectedCity?.name === city.name
                          ? 'bg-saffron text-white border-saffron shadow-sm'
                          : 'bg-saffron/10 text-maroon border-saffron/20 hover:bg-saffron/20 hover:border-saffron/40'
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consultation Preferences */}
          <Card className="border-saffron/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-maroon flex items-center gap-2 text-base">
                <Globe className="w-4 h-4" /> Consultation Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Preferred Language */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-maroon">Preferred Language</Label>
                <Select
                  value={form.preferredLanguage}
                  onValueChange={val => onFormChange('preferredLanguage', val)}
                >
                  <SelectTrigger className="h-10 border-saffron/30 focus:border-saffron">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <span className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-saffron" /> {lang.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Focus Areas */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-maroon">Specific Concerns</Label>
                <p className="text-xs text-muted-foreground">Select all areas you would like the astrologer to focus on</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {FOCUS_AREAS.map(area => {
                    const Icon = area.icon
                    const isChecked = focusAreas.includes(area.id)
                    return (
                      <label
                        key={area.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-maroon bg-maroon/5 text-maroon'
                            : 'border-saffron/20 hover:border-saffron/40 text-foreground/70'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onToggleFocusArea(area.id)}
                          className="border-saffron/40 data-[state=checked]:bg-maroon data-[state=checked]:border-maroon"
                        />
                        <Icon className={`w-4 h-4 ${isChecked ? 'text-maroon' : 'text-saffron/60'}`} />
                        <span className="text-xs font-medium">{area.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-2">
                <Label htmlFor="questions" className="text-sm font-medium text-maroon">
                  Your Questions / Focus Areas
                </Label>
                <Textarea
                  id="questions"
                  value={form.questions}
                  onChange={e => onFormChange('questions', e.target.value)}
                  placeholder="Describe your questions, concerns, or anything specific you want the astrologer to address..."
                  rows={4}
                  className="border-saffron/30 focus:border-saffron resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  The more detail you provide, the more personalized your reading will be
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Booking Summary & Submit */}
          <Card className="border-maroon/30 bg-gradient-to-br from-maroon/5 to-temple-bg">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-maroon text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold" /> Booking Summary
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reading Tier:</span>
                  <span className="font-semibold text-maroon">{tier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">{tier?.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions:</span>
                  <span className="font-medium">{tier?.questions}</span>
                </div>
                <Separator className="bg-saffron/20" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground line-through">{tier?.originalPrice}</span>
                  <span className="text-xs text-vedic-green font-medium">Save {tier ? Math.round(((tier.originalPrice - tier.price) / tier.originalPrice) * 100) : 0}%</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-bold text-maroon">Total:</span>
                  <span className="font-bold text-maroon">${tier?.price}</span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon-dark text-white font-semibold py-6 text-base shadow-lg hover:shadow-xl transition-all"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Booking Your Reading...</>
                ) : (
                  <><Calendar className="w-5 h-5 mr-2" /> Book My Reading</>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By booking, you agree to our terms of service. Full refund available if not satisfied.
              </p>
            </CardContent>
          </Card>
        </form>
      </div>
    </section>
  )
}

function BookingConfirmation({
  result,
  onReset,
}: {
  result: BookingResult
  onReset: () => void
}) {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-vedic-green/30 bg-gradient-to-br from-vedic-green/5 to-temple-bg">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-vedic-green/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-vedic-green" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-maroon mb-2">Reading Booked!</h2>
                <p className="text-muted-foreground">{result.message}</p>
              </div>

              <div className="p-4 bg-white rounded-lg border border-saffron/20">
                <p className="text-xs text-muted-foreground mb-1">Your Booking Reference</p>
                <p className="text-2xl font-bold font-mono text-maroon tracking-wider">
                  {result.bookingRef}
                </p>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 justify-center">
                  <Mail className="w-4 h-4 text-saffron" />
                  <span>Confirmation sent to your email</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <Clock className="w-4 h-4 text-saffron" />
                  <span>An astrologer will be assigned within 24 hours</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <Video className="w-4 h-4 text-saffron" />
                  <span>You will receive a video call link via email</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-white font-semibold rounded-lg transition-all"
                >
                  <Star className="w-4 h-4" /> Go to Dashboard
                </a>
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="flex-1 border-saffron/30 text-maroon hover:bg-saffron/10"
                >
                  Book Another Reading
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

function AstrologersSection() {
  return (
    <section className="py-16 md:py-20 bg-temple-bg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-maroon mb-3">Our Astrologers</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Certified practitioners with decades of experience in authentic Vedic traditions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ASTROLOGERS.map((astro, i) => (
            <motion.div
              key={astro.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className="border-saffron/20 hover:border-saffron/40 transition-all hover:shadow-lg h-full">
                <CardContent className="p-6">
                  {/* Avatar placeholder */}
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-saffron/20 to-gold/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl text-maroon font-bold">
                      {astro.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>

                  <div className="text-center mb-4">
                    <h3 className="text-base font-bold text-maroon">{astro.name}</h3>
                    <p className="text-xs text-saffron font-medium">{astro.title}</p>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {astro.bio}
                  </p>

                  {/* Rating */}
                  <div className="flex items-center justify-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star
                        key={si}
                        className={`w-4 h-4 ${
                          si < Math.floor(astro.rating)
                            ? 'text-gold fill-gold'
                            : si < astro.rating
                            ? 'text-gold fill-gold/50'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                    <span className="text-sm font-semibold text-maroon ml-1">{astro.rating}</span>
                    <span className="text-xs text-muted-foreground">({astro.reviews})</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-saffron shrink-0" />
                      <span className="text-muted-foreground">Experience:</span>
                      <span className="font-medium text-maroon">{astro.experience}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-saffron shrink-0" />
                      <span className="text-muted-foreground">Languages:</span>
                      <span className="font-medium text-maroon">{astro.languages.join(', ')}</span>
                    </div>
                  </div>

                  {/* Specializations */}
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {astro.specializations.map(spec => (
                      <Badge
                        key={spec}
                        variant="outline"
                        className="text-[10px] border-saffron/30 text-maroon"
                      >
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrustSection() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-maroon mb-3">Why Trust AstroBidhi?</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            We are committed to authenticity, privacy, and your satisfaction
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_BADGES.map((badge, i) => {
            const Icon = badge.icon
            return (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="border-saffron/20 text-center h-full hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-saffron/15 to-gold/15 rounded-xl flex items-center justify-center">
                      <Icon className="w-7 h-7 text-maroon" />
                    </div>
                    <h3 className="font-semibold text-maroon mb-2">{badge.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{badge.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ============ Main Page ============
export default function ReadingPage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [tiers, setTiers] = useState<ReadingTier[]>(FALLBACK_TIERS)
  const [tiersLoading, setTiersLoading] = useState(true)
  const [form, setForm] = useState<BookingFormState>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    birthDate: '',
    birthTime: '',
    birthCity: '',
    birthLat: 0,
    birthLng: 0,
    birthUtc: '',
    questions: '',
    focusAreas: [],
    preferredLanguage: 'english',
  })

  // Fetch live tier prices from the database on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/readings')
        if (!res.ok) throw new Error('Failed to fetch tiers')
        const data = await res.json()
        if (mounted && data.tiers && data.tiers.length > 0) {
          setTiers(data.tiers)
        }
      } catch (err) {
        console.error('[ReadingPage] Failed to load tiers from API, using fallback:', err)
        // Keep FALLBACK_TIERS already set in state
      } finally {
        if (mounted) setTiersLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleFormChange = useCallback((field: keyof BookingFormState, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleToggleFocusArea = useCallback((area: string) => {
    setFocusAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }, [])

  const handleSelectTier = useCallback((id: string) => {
    setSelectedTier(id)
    // Scroll to booking form
    setTimeout(() => {
      document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTier) return

    setSubmitting(true)
    try {
      const deviceId = getOrCreateDeviceId()
      const res = await fetch('/api/readings/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: `reading_${selectedTier}`,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone,
          birthDate: form.birthDate,
          birthTime: form.birthTime,
          birthCity: form.birthCity,
          birthLat: form.birthLat,
          birthLng: form.birthLng,
          birthUtc: form.birthUtc,
          questions: form.questions,
          focusAreas,
          preferredLanguage: form.preferredLanguage,
          deviceId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Booking failed. Please try again.' }))
        throw new Error(err.detail || `Booking failed (${res.status})`)
      }

      const data = await res.json()
      setBookingResult({
        bookingRef: data.bookingRef || data.booking_ref || `AB-${Date.now().toString(36).toUpperCase()}`,
        message: data.message || 'Your Vedic reading has been successfully booked! You will receive a confirmation email with details shortly.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Booking failed. Please try again.'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = useCallback(() => {
    setSelectedTier(null)
    setBookingResult(null)
    setFocusAreas([])
    setForm({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      birthDate: '',
      birthTime: '',
      birthCity: '',
      birthLat: 0,
      birthLng: 0,
      birthUtc: '',
      questions: '',
      focusAreas: [],
      preferredLanguage: 'english',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ReadingNavbar />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {bookingResult ? (
            <BookingConfirmation result={bookingResult} onReset={handleReset} />
          ) : (
            <>
              <HeroSection />
              <HowItWorksSection />
              <ReadingTiersSection selectedTier={selectedTier} onSelectTier={handleSelectTier} tiers={tiers} loading={tiersLoading} />
              <BookingFormSection
                selectedTier={selectedTier}
                form={form}
                onFormChange={handleFormChange}
                focusAreas={focusAreas}
                onToggleFocusArea={handleToggleFocusArea}
                onSubmit={handleSubmit}
                submitting={submitting}
                tiers={tiers}
              />
              <AstrologersSection />
              <TrustSection />
            </>
          )}
        </AnimatePresence>
      </main>

      <ReadingFooter />
    </div>
  )
}
