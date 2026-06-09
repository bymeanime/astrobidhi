'use client'

import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react'
import { searchCities, getPopularCities, CityEntry } from '@/data/cities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Moon, Star, Compass, Calendar, Eye, Zap,
  ChevronRight, Loader2, AlertCircle, MapPin, Clock,
  Sparkles, BookOpen, ArrowRight, Globe, Mountain,
  Brain, Heart, Briefcase, DollarSign, Flower2, Activity, MessageCircle,
  ChevronDown, Crown, Home as HomeIcon, Orbit, Shield, Lock,
  Share2, Copy, Twitter, Facebook, LogIn, LogOut, User, ExternalLink,
  Coffee, History, RefreshCw
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

// ============ Types ============
interface PlanetData {
  Object: string
  Rasi: string
  isRetroGrade: string | null
  LonDecDeg: number
  SignLonDMS: string
  SignLonDecDeg: number
  Nakshatra: string
  RasiLord: string
  NakshatraLord: string
  SubLord: string
  SubSubLord: string
  HouseNr: number
}

interface HouseData {
  Object: string
  HouseNr: number
  Rasi: string
  LonDecDeg: number
  SignLonDMS: string
  SignLonDecDeg: number
  DegSize: number
  Nakshatra: string
  RasiLord: string
  NakshatraLord: string
  SubLord: string
  SubSubLord: string
}

interface AspectData {
  P1: string
  P2: string
  AspectType: string
  AspectDeg: number
  AspectOrb: number
}

interface DasaData {
  [key: string]: {
    start: string
    end: string
    bhuktis: {
      [key: string]: {
        start: string
        end: string
      }
    }
  }
}

interface HoroscopeData {
  planets_data: PlanetData[]
  houses_data: HouseData[]
  planetary_aspects: AspectData[]
  vimshottari_dasa: DasaData
  rasi_planets: Record<string, { name: string; retrograde: string | null; longitude: string; nakshatra: string; rasiLord: string; nakshatraLord: string; subLord: string; houseNr: number }[]>
  house_chart: Record<number, { rasi: string; longitude: string; nakshatra: string; rasiLord: string; nakshatraLord: string; subLord: string }>
  planet_significators: unknown[]
  house_significators: unknown[]
}

type PageView = 'home' | 'birth-chart' | 'horary' | 'dasa' | 'planets' | 'aspects' | 'transit' | 'ai-analysis' | 'my-analyses'

type AnalysisType = 'overall' | 'career' | 'relationships' | 'health' | 'finance' | 'spiritual' | 'dasa' | 'horary' | 'swot_5year' | 'cosmic_blueprint' | 'shadow_integration'

// ============ Static Meanings Types ============
interface SignHouseMeaning {
  meaning: string
  theme: string
}

interface LordshipMeaning {
  house: number
  meaning: string
}

interface PlanetMeaning {
  sign: string
  house: number
  sign_meaning: SignHouseMeaning
  house_meaning: SignHouseMeaning
  retrograde: SignHouseMeaning | null
  lord_of: number | null
  lordship_meaning: LordshipMeaning | null
}

interface HouseMeaningData {
  name: string
  meaning: string
  areas: string[]
}

interface NakshatraMeaningData {
  meaning: string
  ruler: string
  deity: string
  theme: string
}

interface HouseStaticMeaning {
  rasi: string
  rasi_lord: string
  nakshatra: string
  house_meaning: HouseMeaningData
  nakshatra_meaning: NakshatraMeaningData
  planets_in_house: string[]
}

interface KeyAspectMeaning {
  P1: string
  P2: string
  AspectType: string
  Orb: number
  meaning: string
}

interface StaticMeanings {
  planet_meanings: Record<string, PlanetMeaning>
  house_meanings: Record<string, HouseStaticMeaning>
  key_aspects: KeyAspectMeaning[]
}

const PREMIUM_ANALYSIS_TYPES = new Set<AnalysisType>(['swot_5year', 'cosmic_blueprint', 'shadow_integration'])

// ============ Whop Auth Context ============
interface WhopAuthState {
  authenticated: boolean
  hasAccess: boolean
  accessLevel: string
  user: { id: string; name: string; email: string; picture: string } | null
  loading: boolean
  configured: boolean
}

const WhopAuthContext = createContext<WhopAuthState>({
  authenticated: false, hasAccess: false, accessLevel: 'no_access', user: null, loading: true, configured: false,
})

function useWhopAuth() {
  return useContext(WhopAuthContext)
}

const PREMIUM_DESCRIPTIONS: Record<string, string> = {
  swot_5year: '5-Year Career & Wealth Forecast with year-by-year predictions, SWOT analysis, specific timing windows, and personalized remedies.',
  cosmic_blueprint: 'Complete Cosmic Blueprint with house-by-house analysis, Ashtakvarga bindus, Yoga directory, and Harmonized interpretations.',
  shadow_integration: 'Shadow Integration analysis with vulnerability mapping, Tragic Sublimation pathways, and integration protocol for personal growth.',
}

const ANALYSIS_TYPES: { id: AnalysisType; label: string; icon: React.ReactNode; desc: string; color: string; category: string; isPremium: boolean }[] = [
  { id: 'overall', label: 'Overall Reading', icon: <Star className="w-5 h-5" />, desc: 'Complete birth chart interpretation covering personality, strengths, and life purpose', color: '#D4A843', category: 'Standard', isPremium: false },
  { id: 'career', label: 'Career & Profession', icon: <Briefcase className="w-5 h-5" />, desc: 'Professional path, suitable fields, career growth periods, and financial prospects', color: '#C9721A', category: 'Standard', isPremium: false },
  { id: 'relationships', label: 'Love & Marriage', icon: <Heart className="w-5 h-5" />, desc: 'Marriage timing, spouse characteristics, compatibility, and relationship dynamics', color: '#9B59B6', category: 'Standard', isPremium: false },
  { id: 'health', label: 'Health & Wellness', icon: <Activity className="w-5 h-5" />, desc: 'Health vulnerabilities, body constitution, and preventive guidance', color: '#2D6A4F', category: 'Standard', isPremium: false },
  { id: 'finance', label: 'Wealth & Finance', icon: <DollarSign className="w-5 h-5" />, desc: 'Income sources, wealth yogas, investment periods, and financial growth', color: '#B33A3A', category: 'Standard', isPremium: false },
  { id: 'spiritual', label: 'Spiritual Growth', icon: <Flower2 className="w-5 h-5" />, desc: 'Dharma, spiritual path, past life karma, and moksha indications', color: '#6B1D1D', category: 'Standard', isPremium: false },
  { id: 'dasa', label: 'Dasa Periods', icon: <Calendar className="w-5 h-5" />, desc: 'Current and upcoming planetary periods with timeline predictions', color: '#34495E', category: 'Standard', isPremium: false },
  { id: 'swot_5year', label: '5-Year SWOT Forecast', icon: <BookOpen className="w-5 h-5" />, desc: 'Comprehensive 5-year career & wealth forecast with SWOT analysis, specific timing, and remedies', color: '#1a5276', category: 'Advanced', isPremium: true },
  { id: 'cosmic_blueprint', label: 'Cosmic Blueprint', icon: <Sparkles className="w-5 h-5" />, desc: 'Premium house-by-house blueprint with Ashtakvarga, Yoga directory, and Harmonized interpretations', color: '#0f0c29', category: 'Advanced', isPremium: true },
  { id: 'shadow_integration', label: 'Shadow Integration', icon: <AlertCircle className="w-5 h-5" />, desc: 'Uncompromising shadow work analysis with Tragic Sublimation, vulnerability map, and integration protocol', color: '#180202', category: 'Advanced', isPremium: true },
]

// ============ Constants ============
const RASI_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
const RASI_SANSKRIT = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena']
const RASI_SYMBOLS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

// South Indian chart layout: 4x4 grid, fixed rasi positions
// South Indian: Aries is at position [2,0], going clockwise
const SOUTH_INDIAN_LAYOUT = [
  ['Pisces',    'Aries',    'Taurus',   'Gemini'],
  ['Aquarius',  '',         '',         'Cancer'],
  ['Capricorn', '',         '',         'Leo'],
  ['Sagittarius','Scorpio', 'Libra',   'Virgo'],
]

const AYANAMSA_OPTIONS = [
  { value: 'Lahiri', label: 'Lahiri (Chitra Paksha)' },
  { value: 'Krishnamurti', label: 'Krishnamurti (KP)' },
  { value: 'Raman', label: 'Raman' },
]

const HOUSE_SYSTEMS = [
  { value: 'Placidus', label: 'Placidus' },
  { value: 'Equal', label: 'Equal' },
  { value: 'Whole Sign', label: 'Whole Sign' },
]

const PLANET_COLORS: Record<string, string> = {
  'Sun': '#C9721A',
  'Moon': '#8B8B8B',
  'Mars': '#B33A3A',
  'Mercury': '#2D6A4F',
  'Jupiter': '#D4A843',
  'Venus': '#9B59B6',
  'Saturn': '#34495E',
  'Rahu': '#6B1D1D',
  'Ketu': '#8E44AD',
  'Asc': '#C9721A',
}

// ============ API Helper ============
async function apiCall(endpoint: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `API Error: ${res.status}`)
  }
  return res.json()
}

// ============ Navigation ============
const NAV_ITEMS: { id: PageView; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'home', label: 'Home', icon: <Star className="w-4 h-4" />, desc: 'Welcome' },
  { id: 'birth-chart', label: 'Birth Chart', icon: <Star className="w-4 h-4" />, desc: 'Generate Kundali' },
  { id: 'horary', label: 'Horary', icon: <Compass className="w-4 h-4" />, desc: 'Prasna Chart' },
  { id: 'dasa', label: 'Dasa', icon: <Calendar className="w-4 h-4" />, desc: 'Vimshottari' },
  { id: 'planets', label: 'Planets', icon: <Sparkles className="w-4 h-4" />, desc: 'Positions' },
  { id: 'aspects', label: 'Aspects', icon: <Zap className="w-4 h-4" />, desc: 'Drishti' },
  { id: 'transit', label: 'Transit', icon: <Globe className="w-4 h-4" />, desc: 'Gochara' },
  { id: 'ai-analysis', label: 'AI Analysis', icon: <Brain className="w-4 h-4" />, desc: 'Jyotish AI' },
  { id: 'my-analyses', label: 'My Analyses', icon: <History className="w-4 h-4" />, desc: 'History' },
]

// ============ Components ============

function VedicNav({ currentPage, onNavigate }: { currentPage: PageView; onNavigate: (p: PageView) => void }) {
  const whopAuth = useWhopAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleWhopLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    window.location.reload()
  }

  return (
    <nav className="bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="text-2xl text-gold animate-pulse-glow">ॐ</div>
            <div>
              <h1 className="text-xl font-bold text-gold-light tracking-wide">AstroBidhi</h1>
              <p className="text-[10px] text-saffron-light -mt-1 tracking-widest">वैदिक ज्योतिष</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.filter(n => n.id !== 'home').map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-all ${
                  currentPage === item.id
                    ? 'bg-saffron/20 text-gold-light'
                    : 'text-saffron-light/70 hover:text-gold-light hover:bg-saffron/10'
                }`}
              >
                {item.icon}
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
            {/* Whop Auth Button */}
            {whopAuth.configured && (
              whopAuth.authenticated ? (
                <div className="flex items-center gap-2 ml-2">
                  {whopAuth.hasAccess && (
                    <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-[9px] px-1.5 py-0">
                      <Crown className="w-3 h-3 mr-0.5" /> PRO
                    </Badge>
                  )}
                  <button
                    onClick={() => onNavigate('my-analyses')}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                      currentPage === 'my-analyses'
                        ? 'bg-saffron/20 text-gold-light'
                        : 'text-saffron-light/70 hover:text-gold-light hover:bg-saffron/10'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" /> My Analyses
                  </button>
                  {whopAuth.user?.picture ? (
                    <img src={whopAuth.user.picture} alt="" className="w-6 h-6 rounded-full border border-saffron/30" />
                  ) : (
                    <User className="w-4 h-4 text-saffron-light" />
                  )}
                  <button
                    onClick={handleWhopLogout}
                    disabled={loggingOut}
                    className="flex items-center gap-1 text-saffron-light/60 hover:text-gold-light text-xs transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-2">
                  <a
                    href="/api/auth/whop"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-gradient-to-r from-amber-600 to-yellow-500 text-white hover:from-amber-500 hover:to-yellow-400 font-semibold transition-all"
                  >
                    <Crown className="w-4 h-4" /> Get Pro
                  </a>
                </div>
              )
            )}
          </div>
          <div className="md:hidden">
            <MobileNav currentPage={currentPage} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </nav>
  )
}

function MobileNav({ currentPage, onNavigate }: { currentPage: PageView; onNavigate: (p: PageView) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="text-saffron-light" onClick={() => setOpen(!open)}>
        <Compass className="w-5 h-5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-maroon-dark rounded-lg shadow-xl border border-saffron/20 z-50">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                currentPage === item.id ? 'bg-saffron/20 text-gold-light' : 'text-saffron-light/70 hover:text-gold-light'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VedicFooter() {
  const bmcSlug = typeof window !== 'undefined'
    ? (window as unknown as { __BMC_SLUG__?: string }).__BMC_SLUG__ || 'astrobidhi'
    : 'astrobidhi'

  return (
    <footer className="mt-auto bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60">
      <div className="vedic-divider" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl text-gold animate-pulse-glow">ॐ</span>
            <div>
              <p className="text-gold-light font-semibold text-sm">AstroBidhi</p>
              <p className="text-xs">वैदिक ज्योतिष - Vedic Astrology Wisdom</p>
            </div>
          </div>
          <p className="text-xs text-center">Powered by VedicAstro (Swiss Ephemeris) &bull; KP System &bull; Gemini AI Analysis</p>
          <div className="flex items-center gap-3">
            {/* Buy Me a Coffee Button */}
            <a
              href={`https://buymeacoffee.com/${bmcSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-[#000000] rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Coffee className="w-3.5 h-3.5" /> Buy Me a Coffee
            </a>
            <p className="text-xs">Dedicated to Parashara MahaRishi &amp; K.S. Krishnamurti</p>
            <a href="/admin" className="text-xs text-saffron-light/40 hover:text-gold-light transition-colors">Admin</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ============ South Indian Chart ============
function SouthIndianChart({ rasiPlanets, houseChart }: {
  rasiPlanets: Record<string, { name: string; retrograde: string | null; longitude: string; nakshatra: string; rasiLord: string; nakshatraLord: string; subLord: string; houseNr: number }[]>
  houseChart: Record<number, { rasi: string; longitude: string; nakshatra: string; rasiLord: string; nakshatraLord: string; subLord: string }>
}) {
  const getRasiIndex = (name: string) => RASI_NAMES.indexOf(name)

  return (
    <div className="chart-grid max-w-md mx-auto">
      {SOUTH_INDIAN_LAYOUT.flat().map((rasi, idx) => {
        const rasiIdx = rasi ? getRasiIndex(rasi) : -1
        const planets = rasi ? (rasiPlanets[rasi] || []) : []
        const houseNr = rasi && houseChart
          ? Object.entries(houseChart).find(([_, v]) => v.rasi === rasi)?.[0]
          : null

        return (
          <div key={idx} className={`chart-cell ${rasi ? '' : 'bg-maroon/5'}`}>
            {rasi && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="rasi-name">{RASI_SANSKRIT[rasiIdx]}</span>
                  <span className="text-[9px] text-maroon/50">{RASI_SYMBOLS[rasiIdx]}</span>
                </div>
                {houseNr && (
                  <span className="absolute top-1 right-1 text-[8px] bg-saffron/20 text-maroon px-1 rounded">
                    H{houseNr}
                  </span>
                )}
                <div className="space-y-0.5">
                  {planets.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-0.5">
                      <span className="planet-name" style={{ color: PLANET_COLORS[p.name] || '#4A0E0E' }}>
                        {p.name.substring(0, 3)}
                      </span>
                      {p.retrograde === 'True' && <span className="planet-retro">℞</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============ Birth Chart Form ============
function BirthChartForm({ onSubmit, loading }: {
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
}) {
  const popularCities = getPopularCities()
  const searchRef = useRef<HTMLDivElement>(null)

  const [citySearch, setCitySearch] = useState('')
  const [citySearchResults, setCitySearchResults] = useState<CityEntry[]>([])
  const [selectedCity, setSelectedCity] = useState<CityEntry | null>(null)
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [birthDate, setBirthDate] = useState('1990-06-15')
  const [birthTime, setBirthTime] = useState('10:30')
  const [dontKnowBirthTime, setDontKnowBirthTime] = useState(false)
  const [showManualCoords, setShowManualCoords] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [manualLat, setManualLat] = useState(0)
  const [manualLng, setManualLng] = useState(0)
  const [manualUtc, setManualUtc] = useState('+05:30')
  const [ayanamsa, setAyanamsa] = useState('Lahiri')
  const [houseSystem, setHouseSystem] = useState('Whole Sign')
  const [overrideUtc, setOverrideUtc] = useState('')
  const [useUtcOverride, setUseUtcOverride] = useState(false)

  // Click outside handler for city dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Handle city search input
  const handleCitySearch = useCallback((query: string) => {
    setCitySearch(query)
    if (query.length >= 2) {
      const results = searchCities(query)
      setCitySearchResults(results)
      setShowCityDropdown(results.length > 0)
    } else {
      setCitySearchResults([])
      setShowCityDropdown(false)
    }
  }, [])

  // Select a city from search or popular
  const selectCity = useCallback((city: CityEntry) => {
    setSelectedCity(city)
    setCitySearch(`${city.name}, ${city.country}`)
    setShowCityDropdown(false)
    setShowManualCoords(false)
  }, [])

  // Handle "don't know birth time" checkbox
  useEffect(() => {
    if (dontKnowBirthTime) {
      setBirthTime('12:00')
    }
  }, [dontKnowBirthTime])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [year, month, day] = birthDate.split('-').map(Number)
    const timeToUse = dontKnowBirthTime ? '12:00' : birthTime
    const [hour, minute] = timeToUse.split(':').map(Number)
    const latitude = selectedCity ? selectedCity.lat : manualLat
    const longitude = selectedCity ? selectedCity.lng : manualLng
    const utc = useUtcOverride && overrideUtc ? overrideUtc : (selectedCity ? selectedCity.tz : manualUtc)
    onSubmit({
      year, month, day, hour, minute, second: 0,
      utc, latitude, longitude,
      ayanamsa, house_system: houseSystem,
    })
  }

  // Current effective UTC for display
  const effectiveUtc = useUtcOverride && overrideUtc
    ? overrideUtc
    : (selectedCity ? selectedCity.tz : manualUtc)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ====== City Selection ====== */}
      <Card className="border-saffron/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-maroon flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" /> Where were you born?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* City Search with Dropdown */}
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-saffron/60" />
              <Input
                type="text"
                value={citySearch}
                onChange={e => handleCitySearch(e.target.value)}
                onFocus={() => { if (citySearchResults.length > 0) setShowCityDropdown(true) }}
                placeholder="Search your birth city..."
                className="pl-9 h-10 border-saffron/30 focus:border-saffron"
              />
            </div>
            {/* Search Results Dropdown */}
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
                      <span className="text-muted-foreground text-xs ml-1">• {city.country}</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">UTC {city.tz}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected city info badge */}
          {selectedCity && !showManualCoords && (
            <div className="flex items-center gap-2 p-2.5 bg-saffron/10 rounded-lg text-sm">
              <MapPin className="w-4 h-4 text-saffron shrink-0" />
              <span className="text-maroon font-medium">{selectedCity.name}, {selectedCity.country}</span>
              <span className="text-xs text-muted-foreground ml-1">
                ({selectedCity.lat.toFixed(2)}°, {selectedCity.lng.toFixed(2)}°) • UTC {selectedCity.tz}
              </span>
            </div>
          )}

          {/* Popular Cities Quick-Select */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Popular:</p>
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

          {/* Manual coordinates toggle */}
          {!showManualCoords ? (
            <button
              type="button"
              onClick={() => { setShowManualCoords(true); setSelectedCity(null) }}
              className="text-xs text-saffron hover:text-maroon underline underline-offset-2 transition-colors"
            >
              Enter coordinates manually
            </button>
          ) : (
            <div className="space-y-3 p-3 bg-saffron/5 border border-saffron/10 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-maroon">Manual Coordinates</p>
                <button
                  type="button"
                  onClick={() => setShowManualCoords(false)}
                  className="text-xs text-muted-foreground hover:text-maroon transition-colors"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={manualLat || ''}
                    onChange={e => setManualLat(+e.target.value)}
                    placeholder="e.g. 28.6139"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={manualLng || ''}
                    onChange={e => setManualLng(+e.target.value)}
                    placeholder="e.g. 77.2090"
                    className="h-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">UTC Offset</Label>
                <Input
                  value={manualUtc}
                  onChange={e => setManualUtc(e.target.value)}
                  placeholder="+05:30"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Date & Time ====== */}
      <Card className="border-saffron/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-maroon flex items-center gap-2 text-base">
            <Clock className="w-4 h-4" /> When were you born?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="h-10 border-saffron/30 focus:border-saffron"
              />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={birthTime}
                onChange={e => { if (!dontKnowBirthTime) setBirthTime(e.target.value) }}
                disabled={dontKnowBirthTime}
                className="h-10 border-saffron/30 focus:border-saffron disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Don't know birth time checkbox */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontKnowBirthTime}
                onChange={e => setDontKnowBirthTime(e.target.checked)}
                className="w-4 h-4 rounded border-saffron/40 text-saffron accent-[#D4A843]"
              />
              <span className="text-sm text-maroon">I don&apos;t know my birth time</span>
            </label>
            {dontKnowBirthTime && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Without exact birth time, the Ascendant (Lagna) will be approximate.
                  Your Moon sign and planetary positions remain accurate.
                </p>
              </div>
            )}
          </div>

          {/* UTC offset auto-display */}
          {(selectedCity || showManualCoords) && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">UTC Offset:</span>
              <Badge variant="outline" className="text-xs border-saffron/30 text-maroon font-mono">
                {effectiveUtc}
              </Badge>
              {!useUtcOverride && (
                <button
                  type="button"
                  onClick={() => {
                    setOverrideUtc(effectiveUtc)
                    setUseUtcOverride(true)
                    setShowAdvanced(true)
                  }}
                  className="text-xs text-saffron hover:text-maroon underline underline-offset-2 transition-colors"
                >
                  Override
                </button>
              )}
              {useUtcOverride && (
                <span className="text-[10px] text-amber-600">(overridden)</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Advanced Options (Collapsible) ====== */}
      <Card className="border-saffron/20">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-saffron/5 transition-colors rounded-lg"
        >
          <span className="text-maroon flex items-center gap-2 text-sm font-medium">
            <Star className="w-4 h-4 text-saffron" /> Advanced Options
          </span>
          {showAdvanced
            ? <ChevronDown className="w-4 h-4 text-saffron" />
            : <ChevronRight className="w-4 h-4 text-saffron" />
          }
        </button>
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 space-y-3">
                <div>
                  <Label className="text-xs">Ayanamsa</Label>
                  <Select value={ayanamsa} onValueChange={setAyanamsa}>
                    <SelectTrigger className="h-9 border-saffron/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AYANAMSA_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">House System</Label>
                  <Select value={houseSystem} onValueChange={setHouseSystem}>
                    <SelectTrigger className="h-9 border-saffron/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUSE_SYSTEMS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {useUtcOverride && (
                  <div>
                    <Label className="text-xs">UTC Offset Override</Label>
                    <Input
                      value={overrideUtc}
                      onChange={e => setOverrideUtc(e.target.value)}
                      placeholder="+05:30"
                      className="h-9 border-saffron/30"
                    />
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* ====== Submit Button ====== */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white font-semibold py-5 text-base"
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calculating Chart...</>
        ) : (
          <><Star className="w-5 h-5 mr-2" /> Generate Kundali</>
        )}
      </Button>
    </form>
  )
}

// ============ Dasa Timeline ============
function DasaTimeline({ dasa }: { dasa: DasaData }) {
  const [expandedDasa, setExpandedDasa] = useState<string | null>(null)
  const dasaColors: Record<string, string> = {
    'Rahu': '#8B4513', 'Jupiter': '#D4A843', 'Saturn': '#34495E', 'Mercury': '#2D6A4F',
    'Ketu': '#8E44AD', 'Venus': '#9B59B6', 'Sun': '#C9721A', 'Moon': '#7F8C8D', 'Mars': '#B33A3A',
  }

  return (
    <div className="space-y-2">
      {Object.entries(dasa).map(([name, data]) => (
        <div key={name} className="border border-saffron/20 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedDasa(expandedDasa === name ? null : name)}
            className="w-full flex items-center gap-3 p-3 hover:bg-saffron/5 transition-colors"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dasaColors[name] || '#666' }} />
            <span className="font-semibold text-maroon min-w-[80px]">{name}</span>
            <span className="text-xs text-muted-foreground">{data.start} → {data.end}</span>
            <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${expandedDasa === name ? 'rotate-90' : ''}`} />
          </button>
          {expandedDasa === name && (
            <div className="border-t border-saffron/10 bg-saffron/5 p-3">
              <p className="text-xs font-semibold text-maroon mb-2">Bhuktis (Sub-periods):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(data.bhuktis).map(([bName, bData]) => (
                  <div key={bName} className="flex items-center gap-2 text-xs bg-white/50 rounded p-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dasaColors[bName] || '#666' }} />
                    <span className="font-medium">{name}-{bName}</span>
                    <span className="text-muted-foreground ml-auto">{bData.start} → {bData.end}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============ Planet Table ============
function PlanetTable({ planets }: { planets: PlanetData[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-maroon/5">
            <TableHead className="text-maroon font-semibold">Planet</TableHead>
            <TableHead className="text-maroon font-semibold">Rasi</TableHead>
            <TableHead className="text-maroon font-semibold">Long.</TableHead>
            <TableHead className="text-maroon font-semibold">Nakshatra</TableHead>
            <TableHead className="text-maroon font-semibold">Rasi Lord</TableHead>
            <TableHead className="text-maroon font-semibold">Nak. Lord</TableHead>
            <TableHead className="text-maroon font-semibold">Sub Lord</TableHead>
            <TableHead className="text-maroon font-semibold">House</TableHead>
            <TableHead className="text-maroon font-semibold">Ret.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {planets.map((p, i) => (
            <TableRow key={i} className="hover:bg-saffron/5">
              <TableCell className="font-medium" style={{ color: PLANET_COLORS[p.Object] || '#333' }}>
                {p.Object}
              </TableCell>
              <TableCell>{p.Rasi}</TableCell>
              <TableCell className="font-mono text-xs">{p.SignLonDMS}</TableCell>
              <TableCell>{p.Nakshatra}</TableCell>
              <TableCell>{p.RasiLord}</TableCell>
              <TableCell>{p.NakshatraLord}</TableCell>
              <TableCell>{p.SubLord}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">H{p.HouseNr}</Badge></TableCell>
              <TableCell>{p.isRetroGrade === 'True' ? <span className="text-temple-red font-bold">℞</span> : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============ House Table ============
function HouseTable({ houses }: { houses: HouseData[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-maroon/5">
            <TableHead className="text-maroon font-semibold">House</TableHead>
            <TableHead className="text-maroon font-semibold">Rasi</TableHead>
            <TableHead className="text-maroon font-semibold">Cusp Long.</TableHead>
            <TableHead className="text-maroon font-semibold">Nakshatra</TableHead>
            <TableHead className="text-maroon font-semibold">Rasi Lord</TableHead>
            <TableHead className="text-maroon font-semibold">Nak. Lord</TableHead>
            <TableHead className="text-maroon font-semibold">Sub Lord</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {houses.map((h, i) => (
            <TableRow key={i} className="hover:bg-saffron/5">
              <TableCell className="font-medium text-maroon">{h.HouseNr}</TableCell>
              <TableCell>{h.Rasi}</TableCell>
              <TableCell className="font-mono text-xs">{h.SignLonDMS}</TableCell>
              <TableCell>{h.Nakshatra}</TableCell>
              <TableCell>{h.RasiLord}</TableCell>
              <TableCell>{h.NakshatraLord}</TableCell>
              <TableCell>{h.SubLord}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============ Aspects Grid ============
function AspectsGrid({ aspects }: { aspects: AspectData[] }) {
  const aspectColors: Record<string, string> = {
    'Conjunction': '#C9721A',
    'Opposition': '#B33A3A',
    'Trine': '#2D6A4F',
    'Square': '#D4A843',
    'Sextile': '#9B59B6',
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-maroon/5">
            <TableHead className="text-maroon font-semibold">Planet 1</TableHead>
            <TableHead className="text-maroon font-semibold">Planet 2</TableHead>
            <TableHead className="text-maroon font-semibold">Aspect</TableHead>
            <TableHead className="text-maroon font-semibold">Degrees</TableHead>
            <TableHead className="text-maroon font-semibold">Orb</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aspects.map((a, i) => (
            <TableRow key={i} className="hover:bg-saffron/5">
              <TableCell className="font-medium" style={{ color: PLANET_COLORS[a.P1] || '#333' }}>{a.P1}</TableCell>
              <TableCell className="font-medium" style={{ color: PLANET_COLORS[a.P2] || '#333' }}>{a.P2}</TableCell>
              <TableCell>
                <Badge
                  style={{ backgroundColor: aspectColors[a.AspectType] || '#666', color: '#fff' }}
                  className="text-xs"
                >
                  {a.AspectType}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{a.AspectDeg}°</TableCell>
              <TableCell className="font-mono text-xs">{a.AspectOrb.toFixed(2)}°</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============ Landing Page ============
function LandingPage({ onNavigate }: { onNavigate: (p: PageView) => void }) {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-maroon-dark via-maroon to-saffron/10">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 text-8xl text-gold animate-spin-slow">☸</div>
          <div className="absolute bottom-10 right-10 text-6xl text-gold animate-spin-slow" style={{ animationDirection: 'reverse' }}>☸</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl text-gold/20 animate-pulse-glow">ॐ</div>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-gold-light/80 text-sm tracking-[0.3em] mb-4 uppercase">वैदिक ज्योतिष</p>
            <h1 className="text-5xl md:text-7xl font-bold text-gold-light mb-4">
              Astro<span className="text-saffron-light">Bidhi</span>
            </h1>
            <div className="vedic-divider max-w-xs mx-auto my-6" />
            <p className="text-saffron-light/80 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Unlock the cosmic wisdom of Vedic Astrology. Generate precise KP birth charts,
              Vimshottari Dasa timelines, planetary aspects, and transit reports — then get AI-powered personalized interpretations for every aspect of your life.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              onClick={() => onNavigate('birth-chart')}
              size="lg"
              className="bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-maroon-dark font-bold px-8 py-6 text-lg"
            >
              <Star className="w-5 h-5 mr-2" /> Generate Kundali
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={() => onNavigate('horary')}
              variant="outline"
              size="lg"
              className="border-saffron text-saffron-light hover:bg-saffron/10 px-8 py-6 text-lg"
            >
              <Compass className="w-5 h-5 mr-2" /> Prasna Chart
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-maroon mb-2">Sacred Features</h2>
          <div className="vedic-divider max-w-xs mx-auto my-4" />
          <p className="text-muted-foreground">Powered by the VedicAstro library with Swiss Ephemeris precision</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Star className="w-8 h-8" />, title: 'Birth Chart', desc: 'Generate your complete KP Kundali with South Indian chart layout, planetary positions, and house cusps.', page: 'birth-chart' as PageView },
            { icon: <Compass className="w-8 h-8" />, title: 'Horary (Prasna)', desc: 'Get answers through the ancient Prasna system using a number between 1-249.', page: 'horary' as PageView },
            { icon: <Calendar className="w-8 h-8" />, title: 'Vimshottari Dasa', desc: 'View your complete planetary period timeline with Maha Dasa and Bhukti sub-periods.', page: 'dasa' as PageView },
            { icon: <Sparkles className="w-8 h-8" />, title: 'Planet Positions', desc: 'Detailed planetary positions with Nakshatra, Rasi Lord, Nakshatra Lord, and SubLord.', page: 'planets' as PageView },
            { icon: <Zap className="w-8 h-8" />, title: 'Planetary Aspects', desc: 'Comprehensive aspect analysis including conjunctions, oppositions, trines, and squares.', page: 'aspects' as PageView },
            { icon: <Globe className="w-8 h-8" />, title: 'Transit (Gochara)', desc: 'Current planetary positions and transit analysis for any location on Earth.', page: 'transit' as PageView },
            { icon: <Brain className="w-8 h-8" />, title: 'AI Jyotish Analysis', desc: 'AI-powered interpretations: career, relationships, health, finance, 5-Year SWOT, Cosmic Blueprint, and Shadow Integration.', page: 'ai-analysis' as PageView },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
            >
              <Card
                className="cursor-pointer border-saffron/20 hover:border-saffron/50 hover:shadow-lg transition-all group"
                onClick={() => onNavigate(f.page)}
              >
                <CardHeader>
                  <div className="text-saffron group-hover:text-maroon transition-colors">{f.icon}</div>
                  <CardTitle className="text-maroon">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{f.desc}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* About KP System */}
      <section className="bg-gradient-to-b from-saffron/5 to-transparent py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-maroon mb-4">The KP System</h2>
          <div className="vedic-divider max-w-xs mx-auto my-4" />
          <p className="text-muted-foreground leading-relaxed">
            The Krishnamurthi Paddhati (KP) system, developed by the great astrologer K.S. Krishnamurti,
            revolutionized Vedic astrology with its precise SubLord theory. Unlike traditional Parashari methods,
            KP astrology uses the Placidus house system and a unique 249-subdivision system that provides
            remarkably accurate predictions. AstroBidhi brings this ancient wisdom to your fingertips with
            Swiss Ephemeris-level astronomical precision.
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
    </div>
  )
}

// ============ Transit Page ============
function TransitPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [transitData, setTransitData] = useState<PlanetData[] | null>(null)
  const [form, setForm] = useState({ latitude: 28.6139, longitude: 77.2090, ayanamsa: 'Lahiri', house_system: 'Placidus' })

  const handleTransit = async () => {
    setLoading(true)
    try {
      const data = await apiCall('get_transit_data', form)
      setTransitData(data.planets_data)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to fetch transit data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
          <Globe className="w-8 h-8" /> Gochara (Transit)
        </h2>
        <p className="text-muted-foreground mt-2">Current planetary positions for any location</p>
        <div className="vedic-divider max-w-xs mx-auto my-4" />
      </div>
      <Card className="border-saffron/20 mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input type="number" step="0.01" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input type="number" step="0.01" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Ayanamsa</Label>
              <Select value={form.ayanamsa} onValueChange={v => setForm(f => ({ ...f, ayanamsa: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AYANAMSA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleTransit} disabled={loading} className="w-full bg-saffron hover:bg-saffron-light text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                View Transit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {transitData && (
        <Card className="border-saffron/20">
          <CardHeader>
            <CardTitle className="text-maroon text-base">Current Planetary Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanetTable planets={transitData} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Horary Form (extracted for reuse) ============
function HoraryForm({ onResult }: { onResult: (data: HoroscopeData, num: number) => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    horary_number: 34,
    year: 2024, month: 2, day: 5,
    hour: 9, minute: 5, second: 0,
    utc: '+05:30', latitude: 11.02, longitude: 76.98,
    ayanamsa: 'Krishnamurti', house_system: 'Placidus',
  })

  const handleHorary = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await apiCall('get_horary_data', form)
      onResult(data, form.horary_number)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to generate horary chart', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleHorary} className="space-y-3">
      <div>
        <Label className="text-xs">Horary Number (1-249)</Label>
        <Input type="number" min={1} max={249} value={form.horary_number}
          onChange={e => setForm(f => ({ ...f, horary_number: +e.target.value }))} className="h-9 text-center text-lg font-bold" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Year</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} className="h-9" /></div>
        <div><Label className="text-xs">Month</Label><Input type="number" value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))} className="h-9" /></div>
        <div><Label className="text-xs">Day</Label><Input type="number" value={form.day} onChange={e => setForm(f => ({ ...f, day: +e.target.value }))} className="h-9" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Hour</Label><Input type="number" value={form.hour} onChange={e => setForm(f => ({ ...f, hour: +e.target.value }))} className="h-9" /></div>
        <div><Label className="text-xs">Min</Label><Input type="number" value={form.minute} onChange={e => setForm(f => ({ ...f, minute: +e.target.value }))} className="h-9" /></div>
        <div><Label className="text-xs">UTC</Label><Input value={form.utc} onChange={e => setForm(f => ({ ...f, utc: e.target.value }))} className="h-9" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Latitude</Label><Input type="number" step="0.01" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: +e.target.value }))} className="h-9" /></div>
        <div><Label className="text-xs">Longitude</Label><Input type="number" step="0.01" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: +e.target.value }))} className="h-9" /></div>
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Compass className="w-4 h-4 mr-2" />}
        Generate Prasna Chart
      </Button>
    </form>
  )
}

// ============ AI Analysis Panel ============
function AIAnalysisPanel({ chartData, horaryNumber }: { chartData: HoroscopeData | null; horaryNumber?: number }) {
  const { toast } = useToast()
  const whopAuth = useWhopAuth()
  const [selectedType, setSelectedType] = useState<AnalysisType>('overall')
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [premiumDialogType, setPremiumDialogType] = useState<AnalysisType | null>(null)
  const [limitReached, setLimitReached] = useState<{ type: string; used: number; limit: number } | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const analysisRef = useRef<HTMLDivElement>(null)

  if (!chartData) {
    return (
      <Card className="border-saffron/20 max-w-lg mx-auto">
        <CardContent className="py-12 text-center">
          <Brain className="w-16 h-16 mx-auto mb-4 text-saffron/30" />
          <p className="text-muted-foreground mb-4">Generate a chart first to get AI analysis</p>
        </CardContent>
      </Card>
    )
  }

  // Get or create a persistent device ID (stored in localStorage)
  const getDeviceId = (): string => {
    if (typeof window === 'undefined') return 'server'
    const STORAGE_KEY = 'astrobidi_device_id'
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  }

  const handleAnalysisClick = (typeId: AnalysisType) => {
    if (PREMIUM_ANALYSIS_TYPES.has(typeId)) {
      if (whopAuth.hasAccess) {
        // User has Whop membership — allow premium analysis
        setSelectedType(typeId)
        return
      }
      setPremiumDialogType(typeId)
      return
    }
    setSelectedType(typeId)
  }

  const handleAnalyze = async () => {
    if (PREMIUM_ANALYSIS_TYPES.has(selectedType) && !whopAuth.hasAccess) {
      setPremiumDialogType(selectedType)
      return
    }
    setLoading(true)
    setAnalysis(null)
    try {
      const deviceId = getDeviceId()
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: selectedType,
          chartData,
          horaryNumber,
          deviceId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'AI analysis failed' }))
        // Handle rate limit
        if (res.status === 429 && err.limitReached) {
          setLimitReached({ type: err.limitType, used: err.used, limit: err.limit })
          throw new Error(err.detail)
        }
        throw new Error(err.detail || `Error: ${res.status}`)
      }
      const data = await res.json()
      if (!data.analysis) {
        throw new Error('AI returned an empty response. Please try again.')
      }
      setAnalysis(data.analysis)
      // Show cache status to user
      if (data.cached) {
        const cachedDate = data.cachedAt ? new Date(data.cachedAt).toLocaleDateString() : 'previously'
        toast({ title: 'From Cache', description: `This analysis was cached ${cachedDate}. No AI tokens used!` })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate analysis'
      // Show the actual error from the server (includes which providers failed and why)
      const friendlyMsg = msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? 'Connection lost — the AI is taking too long. Please try again.'
        : msg.includes('No API key')
        ? msg // Show the key hint directly
        : msg
      toast({ title: 'AI Analysis Error', description: friendlyMsg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (analysis && analysisRef.current) {
      analysisRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [analysis])

  // Share chart + analysis
  const handleShare = async (includeAnalysis: boolean) => {
    setShareLoading(true)
    try {
      const deviceId = getDeviceId()
      // Get birth details from the parent's lastFormData or extract from chartData.birth_details
      const birthDetails = chartData.birth_details || {}

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Store actual birth params so the share page can regenerate the chart
          chartParams: birthDetails,
          analysisType: includeAnalysis ? selectedType : null,
          includeAnalysis,
          deviceId,
          // Also pass the computed chart data and analysis result for caching
          // so viewers get results from DB without consuming AI credits
          cachedChartData: chartData,
          cachedAnalysisResult: includeAnalysis && analysis ? analysis : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create share link')
      const data = await res.json()
      const fullUrl = `${window.location.origin}/share/${data.shareId}`
      setShareUrl(fullUrl)
      toast({ title: 'Share link created!', description: 'Copy the link or share on social media' })
    } catch (err: unknown) {
      toast({ title: 'Share Error', description: err instanceof Error ? err.message : 'Failed to create share link', variant: 'destructive' })
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareText = analysis
    ? `Check out my ${ANALYSIS_TYPES.find(t => t.id === selectedType)?.label || 'Vedic astrology'} reading on AstroBidhi!`
    : 'Check out my Vedic astrology birth chart on AstroBidhi!'

  return (
    <div className="space-y-6">
      {/* Analysis Type Selector */}
      <Card className="border-saffron/20">
        <CardHeader>
          <CardTitle className="text-maroon flex items-center gap-2 text-base">
            <Brain className="w-5 h-5 text-saffron" /> AI-Powered Jyotish Analysis
          </CardTitle>
          <CardDescription>
            Get personalized Vedic astrology interpretations powered by AI. Select an aspect of life you want deep insights about.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Standard Analysis Types */}
          <div>
            <p className="text-xs font-semibold text-maroon/60 uppercase tracking-wider mb-2">Standard Analysis</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {ANALYSIS_TYPES.filter(t => t.category === 'Standard').map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? 'border-saffron bg-saffron/10 shadow-md'
                      : 'border-saffron/10 hover:border-saffron/30 hover:bg-saffron/5'
                  }`}
                >
                  <div className="mt-0.5" style={{ color: type.color }}>{type.icon}</div>
                  <div>
                    <p className={`text-sm font-semibold ${selectedType === type.id ? 'text-maroon' : 'text-foreground'}`}>{type.label} {type.isPremium && <span className="text-[9px] bg-gradient-to-r from-amber-600 to-yellow-500 text-white px-1.5 py-0.5 rounded-full ml-1 align-middle">PRO</span>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Analysis Types */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0f0c29' }}>Advanced AI Analysis</p>
              <Badge className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white text-[9px] px-1.5 py-0">AI Powered</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ANALYSIS_TYPES.filter(t => t.category === 'Advanced').map(type => (
                <button
                  key={type.id}
                  onClick={() => handleAnalysisClick(type.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all opacity-75 ${
                    selectedType === type.id
                      ? type.id === 'shadow_integration'
                        ? 'border-red-800 bg-red-950/30 shadow-md'
                        : type.id === 'cosmic_blueprint'
                        ? 'border-indigo-800 bg-indigo-950/30 shadow-md'
                        : 'border-saffron bg-saffron/10 shadow-md'
                      : 'border-saffron/10 hover:border-saffron/30 hover:bg-saffron/5'
                  }`}
                >
                  <div className="mt-0.5 relative" style={{ color: type.color }}>
                    {type.icon}
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-amber-600" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${
                      selectedType === type.id 
                        ? type.id === 'shadow_integration' ? 'text-red-200' : type.id === 'cosmic_blueprint' ? 'text-indigo-200' : 'text-maroon'
                        : 'text-foreground'
                    }`}>{type.label} <span className="text-[9px] bg-gradient-to-r from-amber-600 to-yellow-500 text-white px-1.5 py-0.5 rounded-full ml-1 align-middle font-bold tracking-wide">Premium</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className={`w-full font-semibold py-5 text-base ${
              selectedType === 'cosmic_blueprint'
                ? 'bg-gradient-to-r from-indigo-800 to-purple-900 hover:from-indigo-700 hover:to-purple-800 text-white'
                : selectedType === 'shadow_integration'
                ? 'bg-gradient-to-r from-red-900 to-red-950 hover:from-red-800 hover:to-red-900 text-white'
                : selectedType === 'swot_5year'
                ? 'bg-gradient-to-r from-blue-800 to-indigo-900 hover:from-blue-700 hover:to-indigo-800 text-white'
                : 'bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white'
            }`}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing with AI...</>
            ) : (
              <>{selectedType === 'shadow_integration' ? <AlertCircle className="w-5 h-5 mr-2" /> : selectedType === 'cosmic_blueprint' ? <Sparkles className="w-5 h-5 mr-2" /> : selectedType === 'swot_5year' ? <BookOpen className="w-5 h-5 mr-2" /> : <Brain className="w-5 h-5 mr-2" />} Get {ANALYSIS_TYPES.find(t => t.id === selectedType)?.label}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Premium Dialog */}
      <Dialog open={premiumDialogType !== null} onOpenChange={(open) => { if (!open) setPremiumDialogType(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-maroon">
              <Lock className="w-5 h-5 text-amber-600" />
              Premium Feature
            </DialogTitle>
            <DialogDescription>
              {whopAuth.configured
                ? 'This advanced analysis requires a premium membership via Whop.'
                : 'This advanced analysis requires a premium subscription. Coming soon!'}
            </DialogDescription>
          </DialogHeader>
          {premiumDialogType && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  {ANALYSIS_TYPES.find(t => t.id === premiumDialogType)?.label}
                </p>
                <p className="text-sm text-amber-800">
                  {PREMIUM_DESCRIPTIONS[premiumDialogType]}
                </p>
              </div>
              {whopAuth.configured && !whopAuth.authenticated && (
                <div className="rounded-lg border border-saffron/30 bg-saffron/5 p-4">
                  <p className="text-sm font-semibold text-maroon mb-2">Unlock all premium features:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>5-Year SWOT Forecast</li>
                    <li>Cosmic Blueprint</li>
                    <li>Shadow Integration</li>
                    <li>Unlimited chart readings</li>
                    <li>All 10 analysis types</li>
                    <li>Priority AI response</li>
                  </ul>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Premium features include deeper analysis, extended timelines, and advanced yogic interpretations.</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPremiumDialogType(null)}
              className="flex-1 sm:flex-none"
            >
              Close
            </Button>
            {whopAuth.configured ? (
              <a
                href="/api/auth/whop"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-semibold px-4 py-2 h-10 transition-all"
              >
                <Crown className="w-4 h-4" /> Get Premium Access
              </a>
            ) : (
              <Button
                onClick={() => setPremiumDialogType(null)}
                className="flex-1 sm:flex-none bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-1" /> Notify Me
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Limit Dialog */}
      <Dialog open={limitReached !== null} onOpenChange={(open) => { if (!open) setLimitReached(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-maroon">
              <Shield className="w-5 h-5 text-saffron" />
              Free Limit Reached
            </DialogTitle>
            <DialogDescription>
              {limitReached?.type === 'charts'
                ? `You've used ${limitReached.used} of ${limitReached.limit} free chart readings.`
                : `You've used ${limitReached?.used} of ${limitReached?.limit} free analyses for this chart.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-saffron/30 bg-saffron/5 p-4">
              <p className="text-sm font-semibold text-maroon mb-2">What you've used so far:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>3 free chart readings per device</li>
                <li>2 analysis types per chart</li>
              </ul>
              <p className="text-sm font-semibold text-maroon mt-3 mb-2">Upgrade for unlimited:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Unlimited chart readings</li>
                <li>All 10 analysis types</li>
                <li>Priority AI response</li>
                <li>Cached results always free</li>
              </ul>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Crown className="w-4 h-4" />
              <span>{whopAuth.configured ? 'Upgrade via Whop to unlock unlimited access.' : 'Subscription coming soon! Cached results are always accessible for free.'}</span>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setLimitReached(null)}
              className="flex-1 sm:flex-none"
            >
              Close
            </Button>
            {whopAuth.configured ? (
              <a
                href="/api/auth/whop"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white font-semibold px-4 py-2 h-10 transition-all"
              >
                <Crown className="w-4 h-4" /> Get Unlimited
              </a>
            ) : (
              <Button
                onClick={() => setLimitReached(null)}
                className="flex-1 sm:flex-none bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white font-semibold"
              >
                <Crown className="w-4 h-4 mr-1" /> Get Unlimited
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading State */}
      {loading && (
        <Card className={`border-saffron/20 ${
          selectedType === 'cosmic_blueprint' ? 'border-indigo-800/50 bg-gradient-to-b from-[#0f0c29] via-[#1a1040] to-[#050214]'
          : selectedType === 'shadow_integration' ? 'border-red-900/50 bg-gradient-to-b from-[#0c0101] via-[#180202] to-[#03010c]'
          : selectedType === 'swot_5year' ? 'border-saffron/30 bg-gradient-to-b from-[#1a2332] via-[#1a2a3a] to-[#0f1923]'
          : ''
        }`}>
          <CardContent className="py-12 text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              selectedType === 'cosmic_blueprint' ? 'bg-indigo-900/40'
              : selectedType === 'shadow_integration' ? 'bg-red-900/40'
              : selectedType === 'swot_5year' ? 'bg-blue-900/40'
              : 'bg-saffron/10'
            }`}>
              {selectedType === 'shadow_integration' ? (
                <AlertCircle className="w-8 h-8 text-red-500 animate-pulse" />
              ) : selectedType === 'cosmic_blueprint' ? (
                <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
              ) : selectedType === 'swot_5year' ? (
                <BookOpen className="w-8 h-8 text-blue-400 animate-pulse" />
              ) : (
                <Brain className="w-8 h-8 text-saffron animate-pulse" />
              )}
            </div>
            <p className={`font-semibold text-lg ${
              selectedType === 'cosmic_blueprint' ? 'text-indigo-200'
              : selectedType === 'shadow_integration' ? 'text-red-300'
              : selectedType === 'swot_5year' ? 'text-blue-200'
              : 'text-maroon'
            }`}>
              {selectedType === 'cosmic_blueprint' ? 'Synthesizing Cosmic Blueprint...' 
               : selectedType === 'shadow_integration' ? 'Scanning Shadow Patterns...'
               : selectedType === 'swot_5year' ? 'Computing 5-Year Forecast...'
               : 'AstroBidhi AI is analyzing your chart...'}
            </p>
            <p className={`text-sm mt-2 ${
              selectedType === 'cosmic_blueprint' ? 'text-indigo-300/70'
              : selectedType === 'shadow_integration' ? 'text-red-300/70'
              : selectedType === 'swot_5year' ? 'text-blue-300/70'
              : 'text-muted-foreground'
            }`}>
              {selectedType === 'cosmic_blueprint' ? 'Calculating Ashtakvarga bindus, identifying Yogas, harmonizing interpretations...' 
               : selectedType === 'shadow_integration' ? 'Isolating Saturn-Sun collision indices, scanning ancestral trauma vectors, estimating shadow frameworks...'
               : selectedType === 'swot_5year' ? 'Analyzing career houses, wealth lords, Dasa periods, and financial growth patterns...'
               : <>Interpreting planetary positions, nakshatras, house lords, and KP SubLords for your{' '}
               <span className="font-medium text-maroon">{ANALYSIS_TYPES.find(t => t.id === selectedType)?.label}</span> reading</>}
            </p>
            <div className="flex justify-center gap-1 mt-4">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full ${
                  selectedType === 'cosmic_blueprint' ? 'bg-indigo-400'
                  : selectedType === 'shadow_integration' ? 'bg-red-500'
                  : selectedType === 'swot_5year' ? 'bg-blue-400'
                  : 'bg-saffron'
                }`} style={{ animation: `pulse 1s ease-in-out ${i * 0.3}s infinite` }} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Result */}
      {analysis && !loading && (
        <Card 
          ref={analysisRef}
          className={`overflow-hidden ${
            selectedType === 'cosmic_blueprint'
              ? 'border-indigo-800/50 bg-gradient-to-b from-[#0f0c29] via-[#1a1040] to-[#050214] text-indigo-100'
              : selectedType === 'shadow_integration'
              ? 'border-red-900/50 bg-gradient-to-b from-[#0c0101] via-[#180202] to-[#03010c] text-red-100'
              : selectedType === 'swot_5year'
              ? 'border-saffron/30 bg-gradient-to-b from-[#1a2332] via-[#1a2a3a] to-[#0f1923] text-blue-100'
              : 'border-saffron/20'
          }`}
        >
          <CardHeader className={selectedType === 'cosmic_blueprint' || selectedType === 'shadow_integration' || selectedType === 'swot_5year' ? 'border-b border-white/10' : ''}>
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 text-base ${
                selectedType === 'cosmic_blueprint' ? 'text-indigo-200' 
                : selectedType === 'shadow_integration' ? 'text-red-300'
                : selectedType === 'swot_5year' ? 'text-blue-200'
                : 'text-maroon'
              }`}>
                {ANALYSIS_TYPES.find(t => t.id === selectedType)?.icon}
                {ANALYSIS_TYPES.find(t => t.id === selectedType)?.label}
              </CardTitle>
              <Badge className={`${
                selectedType === 'cosmic_blueprint' 
                  ? 'bg-indigo-900/60 text-indigo-200 border-indigo-700/40'
                  : selectedType === 'shadow_integration'
                  ? 'bg-red-900/60 text-red-200 border-red-700/40'
                  : selectedType === 'swot_5year'
                  ? 'bg-blue-900/60 text-blue-200 border-blue-700/40'
                  : 'bg-saffron/20 text-maroon border-saffron/30'
              }`}>
                <Brain className="w-3 h-3 mr-1" /> AI Analysis
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`prose prose-sm max-w-none ${
              selectedType === 'cosmic_blueprint'
                ? 'prose-invert prose-headings:text-indigo-200 prose-headings:font-semibold prose-p:text-indigo-100/90 prose-p:leading-relaxed prose-li:text-indigo-100/90 prose-strong:text-amber-300 prose-h2:text-lg prose-h2:border-b prose-h2:border-indigo-700/30 prose-h2:pb-2 prose-h3:text-base prose-h3:text-indigo-300 prose-a:text-amber-300'
                : selectedType === 'shadow_integration'
                ? 'prose-invert prose-headings:text-red-300 prose-headings:font-semibold prose-p:text-red-100/90 prose-p:leading-relaxed prose-li:text-red-100/90 prose-strong:text-amber-400 prose-h2:text-lg prose-h2:border-b prose-h2:border-red-800/30 prose-h2:pb-2 prose-h3:text-base prose-h3:text-red-400 prose-a:text-amber-400'
                : selectedType === 'swot_5year'
                ? 'prose-invert prose-headings:text-blue-200 prose-headings:font-semibold prose-p:text-blue-100/90 prose-p:leading-relaxed prose-li:text-blue-100/90 prose-strong:text-amber-300 prose-h2:text-lg prose-h2:border-b prose-h2:border-blue-700/30 prose-h2:pb-2 prose-h3:text-base prose-h3:text-blue-300 prose-a:text-amber-300'
                : 'prose-headings:text-maroon prose-headings:font-semibold prose-p:text-foreground prose-p:leading-relaxed prose-li:text-foreground prose-strong:text-maroon prose-h2:text-lg prose-h2:border-b prose-h2:border-saffron/20 prose-h2:pb-2 prose-h3:text-base'
            }`}>
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
            <div className={`mt-6 pt-4 border-t ${
              selectedType === 'cosmic_blueprint' ? 'border-indigo-700/20'
              : selectedType === 'shadow_integration' ? 'border-red-800/20'
              : selectedType === 'swot_5year' ? 'border-blue-700/20'
              : 'border-saffron/10'
            }`}>
              {/* Share Buttons */}
              <div className="mb-4">
                <p className={`text-xs font-semibold mb-2 ${
                  selectedType === 'cosmic_blueprint' ? 'text-indigo-300'
                  : selectedType === 'shadow_integration' ? 'text-red-300'
                  : selectedType === 'swot_5year' ? 'text-blue-300'
                  : 'text-maroon'
                }`}>Share this reading</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShare(true)}
                    disabled={shareLoading}
                    className={`text-xs ${
                      selectedType === 'cosmic_blueprint' ? 'border-indigo-600/40 text-indigo-200 hover:bg-indigo-900/30'
                      : selectedType === 'shadow_integration' ? 'border-red-600/40 text-red-200 hover:bg-red-900/30'
                      : selectedType === 'swot_5year' ? 'border-blue-600/40 text-blue-200 hover:bg-blue-900/30'
                      : 'border-saffron/30 text-maroon hover:bg-saffron/10'
                    }`}
                  >
                    <Share2 className="w-3 h-3 mr-1" /> Share Chart + Analysis
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShare(false)}
                    disabled={shareLoading}
                    className={`text-xs ${
                      selectedType === 'cosmic_blueprint' ? 'border-indigo-600/40 text-indigo-200 hover:bg-indigo-900/30'
                      : selectedType === 'shadow_integration' ? 'border-red-600/40 text-red-200 hover:bg-red-900/30'
                      : selectedType === 'swot_5year' ? 'border-blue-600/40 text-blue-200 hover:bg-blue-900/30'
                      : 'border-saffron/30 text-maroon hover:bg-saffron/10'
                    }`}
                  >
                    <Star className="w-3 h-3 mr-1" /> Share Chart Only
                  </Button>
                </div>
                {shareUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className={`text-xs h-8 ${
                        selectedType === 'cosmic_blueprint' ? 'bg-indigo-950/50 border-indigo-700/30 text-indigo-200'
                        : selectedType === 'shadow_integration' ? 'bg-red-950/50 border-red-700/30 text-red-200'
                        : selectedType === 'swot_5year' ? 'bg-blue-950/50 border-blue-700/30 text-blue-200'
                        : 'bg-saffron/5 border-saffron/20'
                      }`}
                    />
                    <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 text-xs shrink-0">
                      <Copy className="w-3 h-3 mr-1" /> {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 border-saffron/30">
                        <Twitter className="w-3 h-3" />
                      </Button>
                    </a>
                    <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 border-vedic-green/30">
                        <MessageCircle className="w-3 h-3" />
                      </Button>
                    </a>
                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 border-saffron/30">
                        <Facebook className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                )}
              </div>
              <p className={`text-xs italic ${
                selectedType === 'cosmic_blueprint' ? 'text-indigo-300/50'
                : selectedType === 'shadow_integration' ? 'text-red-300/50'
                : selectedType === 'swot_5year' ? 'text-blue-300/50'
                : 'text-muted-foreground'
              }`}>
                Disclaimer: This AI-generated analysis is based on Vedic astrological principles and is intended for guidance and self-reflection purposes only.
                It should not be considered as professional advice for medical, legal, financial, or other critical decisions.
                Always consult qualified professionals for important life decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ AI Analysis Standalone Page ============
function AIAnalysisPage({ horoscopeData, horaryData, horaryNumber, onNavigate }: {
  horoscopeData: HoroscopeData | null
  horaryData: HoroscopeData | null
  horaryNumber?: number
  onNavigate: (page: PageView) => void
}) {
  const activeData = horoscopeData || horaryData

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
          <Brain className="w-8 h-8" /> AI Jyotish Analysis
        </h2>
        <p className="text-muted-foreground mt-2">Get personalized Vedic astrology interpretations powered by AI</p>
        <div className="vedic-divider max-w-xs mx-auto my-4" />
      </div>

      {!activeData ? (
        <Card className="border-saffron/20 max-w-lg mx-auto">
          <CardContent className="py-12 text-center">
            <Brain className="w-16 h-16 mx-auto mb-4 text-saffron/30" />
            <p className="text-muted-foreground mb-4">Generate a birth chart or horary chart first to get AI analysis</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => onNavigate('birth-chart')} className="bg-saffron hover:bg-saffron-light text-white">
                <Star className="w-4 h-4 mr-1" /> Birth Chart
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <AIAnalysisPanel chartData={activeData} horaryNumber={horaryNumber} />
      )}
    </div>
  )
}

// ============ Placement Meanings Section ============
const ASPECT_TYPE_COLORS: Record<string, string> = {
  'Conjunction': '#C9721A',
  'Opposition': '#B33A3A',
  'Trine': '#2D6A4F',
  'Square': '#D4A843',
  'Sextile': '#9B59B6',
}

function PlacementMeaningsSection({ meanings, loading, error }: { meanings: StaticMeanings | null; loading: boolean; error?: string | null }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="border-saffron/20">
          <CardHeader>
            <CardTitle className="text-maroon flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-saffron" /> Placement Meanings
            </CardTitle>
            <CardDescription>Loading meanings for each planet, house, and nakshatra placement...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2 text-base">
            <AlertCircle className="w-5 h-5" /> Meanings Unavailable
          </CardTitle>
          <CardDescription className="text-red-700">
            Could not load placement meanings. This is a server-side issue — the chart data was generated successfully but the meanings lookup failed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-100 rounded-md p-3 text-xs font-mono text-red-800 break-all">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!meanings) return null

  const { planet_meanings, house_meanings, key_aspects } = meanings
  const planetEntries = Object.entries(planet_meanings)
  const houseEntries = Object.entries(house_meanings).sort(([a], [b]) => Number(a) - Number(b))

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <Card className="border-saffron/20 bg-gradient-to-r from-saffron/5 via-transparent to-maroon/5">
        <CardHeader>
          <CardTitle className="text-maroon flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-saffron" /> Placement Meanings
          </CardTitle>
          <CardDescription>
            Rich Vedic meanings for every planet placement, house, and nakshatra — no AI tokens needed.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Tabbed Layout for Planets / Houses / Aspects */}
      <Tabs defaultValue="planets" className="w-full">
        <TabsList className="bg-maroon/5 w-full justify-start">
          <TabsTrigger value="planets" className="text-xs sm:text-sm"><Orbit className="w-4 h-4 mr-1" /> Planets ({planetEntries.length})</TabsTrigger>
          <TabsTrigger value="houses" className="text-xs sm:text-sm"><HomeIcon className="w-4 h-4 mr-1" /> Houses ({houseEntries.length})</TabsTrigger>
          {key_aspects.length > 0 && (
            <TabsTrigger value="aspects" className="text-xs sm:text-sm"><Zap className="w-4 h-4 mr-1" /> Aspects ({key_aspects.length})</TabsTrigger>
          )}
        </TabsList>

        {/* Planet Meanings */}
        <TabsContent value="planets">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planetEntries.map(([planetName, data]) => (
              <Card key={planetName} className="border-saffron/20 hover:border-saffron/40 transition-colors overflow-hidden">
                {/* Planet Header */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold" style={{ color: PLANET_COLORS[planetName] || '#4A0E0E' }}>
                      {planetName}
                    </span>
                    <span className="text-sm text-muted-foreground">in</span>
                    <Badge className="bg-saffron/20 text-maroon border-saffron/30 text-xs">{data.sign}</Badge>
                    <Badge variant="outline" className="text-xs border-saffron/30 text-maroon">House {data.house}</Badge>
                    {data.retrograde && (
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5">℞ Retrograde</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {data.sign_meaning?.theme && (
                      <Badge className="bg-gradient-to-r from-saffron/80 to-gold/80 text-white text-[10px] px-2 py-0">
                        <Crown className="w-3 h-3 mr-1" />{data.sign_meaning.theme}
                      </Badge>
                    )}
                    {data.house_meaning?.theme && (
                      <Badge className="bg-gradient-to-r from-maroon/80 to-maroon-dark/80 text-white text-[10px] px-2 py-0">
                        <Shield className="w-3 h-3 mr-1" />{data.house_meaning.theme}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Planet Body */}
                <CardContent className="pt-0 pb-4 space-y-3">
                  {data.sign_meaning?.meaning && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-saffron font-semibold mb-1">In {data.sign}</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{data.sign_meaning.meaning}</p>
                    </div>
                  )}
                  {data.house_meaning?.meaning && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-maroon font-semibold mb-1">In House {data.house}</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{data.house_meaning.meaning}</p>
                    </div>
                  )}
                  {data.retrograde && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-md px-3 py-2 border border-red-200 dark:border-red-900/30">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold">Retrograde Effect</p>
                        {data.retrograde.theme && (
                          <Badge className="bg-red-200/60 text-red-800 text-[9px] px-1.5 py-0">{data.retrograde.theme}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-red-800/80 dark:text-red-300/70 leading-relaxed">{typeof data.retrograde === 'string' ? data.retrograde : data.retrograde.meaning}</p>
                    </div>
                  )}
                  {data.lordship_meaning && (
                    <div className="bg-saffron/5 rounded-md px-3 py-2 border border-saffron/10">
                      <p className="text-[10px] uppercase tracking-wider text-maroon font-semibold mb-1">
                        Lord of House {data.lordship_meaning.house}
                      </p>
                      <p className="text-xs text-foreground/70 leading-relaxed">{data.lordship_meaning.meaning}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* House Meanings */}
        <TabsContent value="houses">
          <Accordion type="multiple" className="w-full space-y-2">
            {houseEntries.map(([houseNum, data]) => (
              <AccordionItem key={houseNum} value={`house-${houseNum}`} className="border border-saffron/20 rounded-lg overflow-hidden bg-white/50 dark:bg-white/5 px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-saffron/20 text-maroon font-bold text-sm">
                      {houseNum}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-maroon text-sm">{data.house_meaning?.name || `House ${houseNum}`}</span>
                        <Badge variant="outline" className="text-[10px] border-saffron/30 text-maroon">{data.rasi}</Badge>
                        <span className="text-[10px] text-muted-foreground">Lord: {data.rasi_lord}</span>
                      </div>
                      {data.planets_in_house?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {data.planets_in_house.map(p => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-saffron/10" style={{ color: PLANET_COLORS[p] || '#4A0E0E' }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {/* Key Areas */}
                  {data.house_meaning?.areas && data.house_meaning.areas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {data.house_meaning.areas.map((area, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] bg-saffron/10 text-maroon border-saffron/20">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* House Meaning */}
                  {data.house_meaning?.meaning && (
                    <p className="text-xs text-foreground/80 leading-relaxed">{data.house_meaning.meaning}</p>
                  )}
                  {/* Nakshatra Info */}
                  {data.nakshatra_meaning && (
                    <div className="bg-gradient-to-r from-saffron/5 to-maroon/5 rounded-md px-3 py-2 border border-saffron/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-3 h-3 text-saffron" />
                        <span className="text-xs font-semibold text-maroon">{data.nakshatra}</span>
                        {data.nakshatra_meaning.theme && (
                          <Badge className="bg-gradient-to-r from-saffron/60 to-gold/60 text-white text-[9px] px-1.5 py-0">
                            {data.nakshatra_meaning.theme}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 mb-1">
                        <span className="text-[10px] text-muted-foreground">Ruler: <strong className="text-foreground">{data.nakshatra_meaning.ruler}</strong></span>
                        <span className="text-[10px] text-muted-foreground">Deity: <strong className="text-foreground">{data.nakshatra_meaning.deity}</strong></span>
                      </div>
                      {data.nakshatra_meaning.meaning && (
                        <p className="text-xs text-foreground/70 leading-relaxed">{data.nakshatra_meaning.meaning}</p>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* Key Aspects */}
        {key_aspects.length > 0 && (
          <TabsContent value="aspects">
            <div className="space-y-3">
              {key_aspects.map((aspect, i) => (
                <Card key={i} className="border-saffron/20 overflow-hidden">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-medium text-sm" style={{ color: PLANET_COLORS[aspect.P1] || '#333' }}>{aspect.P1}</span>
                      <Badge
                        style={{ backgroundColor: ASPECT_TYPE_COLORS[aspect.AspectType] || '#666', color: '#fff' }}
                        className="text-[10px] px-2"
                      >
                        {aspect.AspectType}
                      </Badge>
                      <span className="font-medium text-sm" style={{ color: PLANET_COLORS[aspect.P2] || '#333' }}>{aspect.P2}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">Orb: {aspect.Orb.toFixed(1)}°</span>
                    </div>
                    {aspect.meaning && (
                      <p className="text-xs text-foreground/80 leading-relaxed">{aspect.meaning}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ============ Main App ============
// ============ My Analyses Page ============
function MyAnalysesPage() {
  const whopAuth = useWhopAuth()
  const { toast } = useToast()
  const [analyses, setAnalyses] = useState<{
    totalAnalyses: number
    charts: Array<{
      birthDetails: Record<string, unknown>
      analyses: Array<{ id: string; type: string; cacheKey: string; createdAt: string; hasResult: boolean; provider: string | null }>
    }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewingAnalysis, setViewingAnalysis] = useState<{ result: string; type: string; cachedAt: string } | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (!whopAuth.authenticated) {
      setLoading(false)
      return
    }
    let cancelled = false
    fetch('/api/my-analyses')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then(data => {
        if (!cancelled) setAnalyses(data)
      })
      .catch(err => {
        console.error('My analyses fetch error:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [whopAuth.authenticated])

  const handleLinkDevice = async () => {
    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') || '' : ''
    if (!deviceId) return
    setLinking(true)
    try {
      const res = await fetch('/api/my-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Analyses Linked', description: `Linked ${data.linked} past analyses to your account!` })
        // Refresh analyses
        const refreshRes = await fetch('/api/my-analyses')
        const refreshData = await refreshRes.json()
        setAnalyses(refreshData)
      }
    } catch (err) {
      toast({ title: 'Link Failed', description: 'Could not link past analyses', variant: 'destructive' })
    } finally {
      setLinking(false)
    }
  }

  const handleViewAnalysis = async (cacheKey: string, type: string) => {
    setLoadingAnalysis(cacheKey)
    try {
      const res = await fetch(`/api/my-analyses/${cacheKey}`)
      if (!res.ok) throw new Error('Failed to fetch analysis')
      const data = await res.json()
      setViewingAnalysis({ result: data.result, type: data.analysisType, cachedAt: data.cachedAt })
    } catch (err) {
      toast({ title: 'Error', description: 'Could not load this analysis. It may have expired from cache.', variant: 'destructive' })
    } finally {
      setLoadingAnalysis(null)
    }
  }

  // Not authenticated
  if (!whopAuth.authenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-saffron/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-saffron" />
        </div>
        <h2 className="text-3xl font-bold text-maroon mb-3">My Analyses</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Sign in with your Whop account to view your analysis history. All your past readings are saved and accessible anytime.
        </p>
        <a
          href="/api/auth/whop"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-500 text-white hover:from-amber-500 hover:to-yellow-400 font-semibold rounded-lg transition-all"
        >
          <Crown className="w-5 h-5" /> Sign In to View History
        </a>
        {/* Buy Me a Coffee */}
        <div className="mt-8">
          <a
            href="https://buymeacoffee.com/astrobidhi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black rounded-full text-sm font-semibold transition-all"
          >
            <Coffee className="w-4 h-4" /> Support AstroBidhi
          </a>
        </div>
      </div>
    )
  }

  // Viewing a specific analysis
  if (viewingAnalysis) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setViewingAnalysis(null)}
          className="flex items-center gap-1 text-saffron hover:text-gold-light text-sm mb-4 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to My Analyses
        </button>
        <Card className="border-saffron/20">
          <CardHeader>
            <CardTitle className="text-maroon flex items-center gap-2">
              <Brain className="w-5 h-5" /> {viewingAnalysis.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Analysis
            </CardTitle>
            <p className="text-xs text-muted-foreground">Cached on {new Date(viewingAnalysis.cachedAt).toLocaleDateString()}</p>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{viewingAnalysis.result}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 text-saffron animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading your analysis history...</p>
      </div>
    )
  }

  // Analyses list
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
          <History className="w-8 h-8" /> My Analyses
        </h2>
        <p className="text-muted-foreground mt-2">Your complete analysis history — accessible anytime</p>
        <div className="vedic-divider max-w-xs mx-auto my-4" />
      </div>

      {/* Link Past Analyses */}
      <Card className="border-saffron/20 mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-maroon text-sm">Link Past Device Analyses</h3>
              <p className="text-xs text-muted-foreground mt-1">Import analyses from this device into your account</p>
            </div>
            <Button
              onClick={handleLinkDevice}
              disabled={linking}
              size="sm"
              className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white"
            >
              {linking ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              {linking ? 'Linking...' : 'Link Device'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!analyses || analyses.totalAnalyses === 0 ? (
        <Card className="border-saffron/20">
          <CardContent className="py-12 text-center">
            <Brain className="w-12 h-12 text-saffron/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-maroon mb-2">No Analyses Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Your AI-powered Vedic astrology analyses will appear here once you generate them.
              Try generating a birth chart and running an AI analysis!
            </p>
            {/* Buy Me a Coffee */}
            <a
              href="https://buymeacoffee.com/astrobidhi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black rounded-full text-sm font-semibold transition-all"
            >
              <Coffee className="w-4 h-4" /> Support AstroBidhi
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">{analyses.totalAnalyses} total analyses across {analyses.charts.length} chart(s)</p>
          {analyses.charts.map((chart, idx) => (
            <Card key={idx} className="border-saffron/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-maroon text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-saffron" />
                  Chart #{idx + 1}
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    {chart.birthDetails?.year && `${chart.birthDetails.year}-${chart.birthDetails.month}-${chart.birthDetails.day}`}
                    {chart.birthDetails?.latitude != null && ` | ${chart.birthDetails.latitude}°N, ${chart.birthDetails.longitude}°E`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {chart.analyses.map((analysis, aIdx) => {
                    const analysisInfo = ANALYSIS_TYPES.find(a => a.id === analysis.type)
                    const isLoading = loadingAnalysis === analysis.cacheKey
                    return (
                      <div key={aIdx} className="flex items-center justify-between p-3 bg-saffron/5 rounded-lg hover:bg-saffron/10 transition-colors">
                        <div className="flex items-center gap-3">
                          {analysisInfo?.icon || <Brain className="w-4 h-4 text-saffron" />}
                          <div>
                            <p className="text-sm font-medium text-maroon">{analysisInfo?.label || analysis.type}</p>
                            <p className="text-xs text-muted-foreground">{new Date(analysis.createdAt).toLocaleDateString()} {analysis.provider && `via ${analysis.provider}`}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading || !analysis.hasResult}
                          onClick={() => handleViewAnalysis(analysis.cacheKey, analysis.type)}
                          className="border-saffron/30 text-maroon hover:bg-saffron/10"
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                          <span className="ml-1">View</span>
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Buy Me a Coffee CTA */}
      <div className="mt-8 text-center">
        <a
          href="https://buymeacoffee.com/astrobidhi"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black rounded-full font-semibold transition-all shadow-sm hover:shadow-md"
        >
          <Coffee className="w-5 h-5" /> Buy Me a Coffee
        </a>
        <p className="text-xs text-muted-foreground mt-2">Support the development of AstroBidhi</p>
      </div>
    </div>
  )
}

// ============ Buy Me a Coffee Floating Widget ============
function BuyMeACoffeeWidget() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <a
        href="https://buymeacoffee.com/astrobidhi"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-3 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-black rounded-full font-semibold shadow-lg hover:shadow-xl transition-all group"
      >
        <Coffee className="w-5 h-5 group-hover:animate-bounce" />
        <span className="hidden sm:inline text-sm">Support Us</span>
      </a>
    </div>
  )
}

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageView>('home')
  const { toast } = useToast()
  const [horoscopeData, setHoroscopeData] = useState<HoroscopeData | null>(null)
  const [horaryData, setHoraryData] = useState<HoroscopeData | null>(null)
  const [horaryNumber, setHoraryNumber] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [staticMeanings, setStaticMeanings] = useState<StaticMeanings | null>(null)
  const [staticMeaningsLoading, setStaticMeaningsLoading] = useState(false)
  const [staticMeaningsError, setStaticMeaningsError] = useState<string | null>(null)
  const [horaryMeanings, setHoraryMeanings] = useState<StaticMeanings | null>(null)
  const [horaryMeaningsLoading, setHoraryMeaningsLoading] = useState(false)
  const [horaryMeaningsError, setHoraryMeaningsError] = useState<string | null>(null)

  // Store the last form data (birth params) for sharing — needed to regenerate chart from share link
  const [lastFormData, setLastFormData] = useState<Record<string, unknown> | null>(null)

  // Whop auth state
  const [whopAuth, setWhopAuth] = useState<WhopAuthState>({
    authenticated: false, hasAccess: false, accessLevel: 'no_access', user: null, loading: true, configured: false,
  })

  // Fetch Whop auth state on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          const authState = {
            authenticated: data.authenticated || false,
            hasAccess: data.hasAccess || false,
            accessLevel: data.accessLevel || 'no_access',
            user: data.user || null,
            loading: false,
            configured: data.configured === true,
          }
          setWhopAuth(authState)

          // Auto-link device analyses on first Whop login
          if (data.authenticated) {
            const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') || '' : ''
            if (deviceId) {
              fetch('/api/my-analyses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId }),
              }).catch(() => {}) // Fire and forget
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWhopAuth(prev => ({ ...prev, loading: false, configured: false }))
        }
      })
    return () => { cancelled = true }
  }, [])

  // Auto-fetch static meanings when horoscopeData changes
  useEffect(() => {
    if (!horoscopeData) {
      setStaticMeanings(null)
      setStaticMeaningsError(null)
      return
    }
    let cancelled = false
    setStaticMeaningsLoading(true)
    setStaticMeaningsError(null)
    fetch('/api/static-meanings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(horoscopeData),
    })
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error((errData as { detail?: string }).detail || `Error ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        if (!cancelled) setStaticMeanings(data)
      })
      .catch(err => {
        console.warn('Static meanings fetch failed:', err)
        if (!cancelled) setStaticMeaningsError(err instanceof Error ? err.message : 'Failed to load meanings')
      })
      .finally(() => {
        if (!cancelled) setStaticMeaningsLoading(false)
      })
    return () => { cancelled = true }
  }, [horoscopeData])

  // Auto-fetch static meanings when horaryData changes
  useEffect(() => {
    if (!horaryData) {
      setHoraryMeanings(null)
      setHoraryMeaningsError(null)
      return
    }
    let cancelled = false
    setHoraryMeaningsLoading(true)
    setHoraryMeaningsError(null)
    fetch('/api/static-meanings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(horaryData),
    })
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error((errData as { detail?: string }).detail || `Error ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        if (!cancelled) setHoraryMeanings(data)
      })
      .catch(err => {
        console.warn('Horary static meanings fetch failed:', err)
        if (!cancelled) setHoraryMeaningsError(err instanceof Error ? err.message : 'Failed to load meanings')
      })
      .finally(() => {
        if (!cancelled) setHoraryMeaningsLoading(false)
      })
    return () => { cancelled = true }
  }, [horaryData])

  const handleGenerateChart = useCallback(async (formData: Record<string, unknown>) => {
    setLoading(true)
    try {
      const data = await apiCall('get_all_horoscope_data', formData)
      setHoroscopeData(data)
      setLastFormData(formData)
      if (currentPage === 'birth-chart') {
        toast({ title: 'Chart Generated', description: 'Your Kundali has been calculated successfully!' })
      }
      // Track analytics event
      try {
        const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') || '' : ''
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'chart_generation',
            deviceId,
            metadata: { type: 'birth_chart', ayanamsa: formData.ayanamsa },
          }),
        }).catch(() => {}) // Fire and forget
      } catch {}
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate chart',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [currentPage, toast])

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <LandingPage onNavigate={setCurrentPage} />

      case 'my-analyses':
        return <MyAnalysesPage />

      case 'birth-chart':
        return (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
                <Star className="w-8 h-8" /> Birth Chart (Kundali)
              </h2>
              <p className="text-muted-foreground mt-2">Enter birth details to generate your Vedic horoscope</p>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>

            {!horoscopeData ? (
              <BirthChartForm onSubmit={handleGenerateChart} loading={loading} />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-maroon">Your Kundali</h3>
                  <Button variant="outline" size="sm" onClick={() => { setHoroscopeData(null); setStaticMeanings(null) }} className="border-saffron text-maroon">
                    Generate New Chart
                  </Button>
                </div>

                <Tabs defaultValue="chart" className="w-full">
                  <TabsList className="bg-maroon/5">
                    <TabsTrigger value="chart"><Eye className="w-4 h-4 mr-1" /> Chart</TabsTrigger>
                    <TabsTrigger value="planets"><Sparkles className="w-4 h-4 mr-1" /> Planets</TabsTrigger>
                    <TabsTrigger value="houses"><Sparkles className="w-4 h-4 mr-1" /> Houses</TabsTrigger>
                    <TabsTrigger value="meanings"><BookOpen className="w-4 h-4 mr-1" /> Meanings</TabsTrigger>
                    <TabsTrigger value="dasa"><Calendar className="w-4 h-4 mr-1" /> Dasa</TabsTrigger>
                    <TabsTrigger value="aspects"><Zap className="w-4 h-4 mr-1" /> Aspects</TabsTrigger>
                    <TabsTrigger value="ai"><Brain className="w-4 h-4 mr-1" /> AI</TabsTrigger>
                  </TabsList>

                  <TabsContent value="chart">
                    <Card className="border-saffron/20">
                      <CardHeader>
                        <CardTitle className="text-maroon text-base">South Indian Chart</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SouthIndianChart rasiPlanets={horoscopeData.rasi_planets} houseChart={horoscopeData.house_chart} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="planets">
                    <Card className="border-saffron/20">
                      <CardHeader>
                        <CardTitle className="text-maroon text-base">Planetary Positions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PlanetTable planets={horoscopeData.planets_data} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="houses">
                    <Card className="border-saffron/20">
                      <CardHeader>
                        <CardTitle className="text-maroon text-base">House Cusps</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <HouseTable houses={horoscopeData.houses_data} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="dasa">
                    <Card className="border-saffron/20">
                      <CardHeader>
                        <CardTitle className="text-maroon text-base">Vimshottari Dasa</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DasaTimeline dasa={horoscopeData.vimshottari_dasa} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="aspects">
                    <Card className="border-saffron/20">
                      <CardHeader>
                        <CardTitle className="text-maroon text-base">Planetary Aspects</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <AspectsGrid aspects={horoscopeData.planetary_aspects} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="meanings">
                    <PlacementMeaningsSection meanings={staticMeanings} loading={staticMeaningsLoading} error={staticMeaningsError} />
                  </TabsContent>

                  <TabsContent value="ai">
                    <AIAnalysisPanel chartData={horoscopeData} />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )

      case 'horary':
        return (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
                <Compass className="w-8 h-8" /> Prasna (Horary) Chart
              </h2>
              <p className="text-muted-foreground mt-2">Enter a number between 1-249 to generate a KP horary chart</p>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card className="border-saffron/20">
                  <CardHeader>
                    <CardTitle className="text-maroon text-base">Horary Input</CardTitle>
                    <CardDescription>Enter the number that comes to mind (1-249)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HoraryForm 
                      onResult={(data, num) => { setHoraryData(data); setHoraryNumber(num) }} 
                    />
                  </CardContent>
                </Card>
              </div>
              <div className="lg:col-span-2">
                {horaryData ? (
                  <div className="space-y-6">
                    <Card className="border-saffron/20">
                      <CardHeader>
                        <CardTitle className="text-maroon text-base">Prasna Chart {horaryNumber ? `— Horary #${horaryNumber}` : ''}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SouthIndianChart rasiPlanets={horaryData.rasi_planets} houseChart={horaryData.house_chart} />
                      </CardContent>
                    </Card>
                    <Card className="border-saffron/20">
                      <CardHeader><CardTitle className="text-maroon text-base">Planetary Positions</CardTitle></CardHeader>
                      <CardContent>
                        <PlanetTable planets={horaryData.planets_data} />
                      </CardContent>
                    </Card>
                    <PlacementMeaningsSection meanings={horaryMeanings} loading={horaryMeaningsLoading} error={horaryMeaningsError} />
                    <AIAnalysisPanel chartData={horaryData} horaryNumber={horaryNumber} />
                  </div>
                ) : (
                  <Card className="border-saffron/20 h-full flex items-center justify-center">
                    <CardContent className="py-20 text-center text-muted-foreground">
                      <Compass className="w-16 h-16 mx-auto mb-4 text-saffron/30" />
                      <p>Enter a horary number and generate your Prasna chart</p>
                      <p className="text-xs mt-2">The number should be the first that comes to your mind</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )

      case 'dasa':
        return (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
                <Calendar className="w-8 h-8" /> Vimshottari Dasa
              </h2>
              <p className="text-muted-foreground mt-2">Generate a birth chart first to view the Dasa timeline</p>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>
            {!horoscopeData ? (
              <Card className="border-saffron/20 max-w-lg mx-auto">
                <CardContent className="py-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-saffron/30" />
                  <p className="text-muted-foreground mb-4">Generate a birth chart first to view Dasa periods</p>
                  <Button onClick={() => setCurrentPage('birth-chart')} className="bg-saffron hover:bg-saffron-light text-white">
                    Go to Birth Chart
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-saffron/20">
                <CardHeader>
                  <CardTitle className="text-maroon text-base">Vimshottari Dasa Timeline</CardTitle>
                  <CardDescription>Click on any Maha Dasa to expand its Bhukti periods</CardDescription>
                </CardHeader>
                <CardContent>
                  <DasaTimeline dasa={horoscopeData.vimshottari_dasa} />
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 'planets':
        return (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
                <Sparkles className="w-8 h-8" /> Planet Positions
              </h2>
              <p className="text-muted-foreground mt-2">Detailed planetary positions with KP lords</p>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>
            {!horoscopeData ? (
              <Card className="border-saffron/20 max-w-lg mx-auto">
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-saffron/30" />
                  <p className="text-muted-foreground mb-4">Generate a birth chart first to view planetary positions</p>
                  <Button onClick={() => setCurrentPage('birth-chart')} className="bg-saffron hover:bg-saffron-light text-white">
                    Go to Birth Chart
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="border-saffron/20">
                  <CardHeader><CardTitle className="text-maroon text-base">Planet Data</CardTitle></CardHeader>
                  <CardContent><PlanetTable planets={horoscopeData.planets_data} /></CardContent>
                </Card>
                <Card className="border-saffron/20">
                  <CardHeader><CardTitle className="text-maroon text-base">House Cusp Data</CardTitle></CardHeader>
                  <CardContent><HouseTable houses={horoscopeData.houses_data} /></CardContent>
                </Card>
              </div>
            )}
          </div>
        )

      case 'aspects':
        return (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
                <Zap className="w-8 h-8" /> Planetary Aspects (Drishti)
              </h2>
              <p className="text-muted-foreground mt-2">Aspect relationships between planets in your chart</p>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
            </div>
            {!horoscopeData ? (
              <Card className="border-saffron/20 max-w-lg mx-auto">
                <CardContent className="py-12 text-center">
                  <Zap className="w-16 h-16 mx-auto mb-4 text-saffron/30" />
                  <p className="text-muted-foreground mb-4">Generate a birth chart first to view aspects</p>
                  <Button onClick={() => setCurrentPage('birth-chart')} className="bg-saffron hover:bg-saffron-light text-white">
                    Go to Birth Chart
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-saffron/20">
                <CardContent className="pt-6">
                  <AspectsGrid aspects={horoscopeData.planetary_aspects} />
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 'transit':
        return <TransitPage />

      case 'ai-analysis':
        return <AIAnalysisPage horoscopeData={horoscopeData} horaryData={horaryData} horaryNumber={horaryNumber} onNavigate={setCurrentPage} />

      default:
        return <LandingPage onNavigate={setCurrentPage} />
    }
  }

  return (
    <WhopAuthContext.Provider value={whopAuth}>
    <div className="min-h-screen flex flex-col bg-temple-bg">
      <VedicNav currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <VedicFooter />
        <BuyMeACoffeeWidget />
    </div>
    </WhopAuthContext.Provider>
  )
}
