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
  Coffee, History, RefreshCw, Hash, Gem, UserCheck, RotateCcw, Flame, Users,
  Send, CheckCircle, Instagram, Youtube
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

// ============ Saved Chart Interface ============
interface SavedChart {
  id: string
  name: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  birthMinute: number
  birthCity: string
  birthLat: number
  birthLng: number
  birthUtc: string
  ayanamsa: string
  houseSystem: string
  savedAt: string
}

const SAVED_CHARTS_KEY = 'astrobidhi_saved_charts'

type AnalysisType = 'overall' | 'career' | 'relationships' | 'health' | 'finance' | 'education' | 'family' | 'horary' | 'spiritual' | 'dasa' | 'vedic_master' | 'trik_bhava' | 'forecast_12month' | 'cosmic_love_letter' | 'name_numerology' | 'gemstone_remedy' | 'compatibility_profile' | 'kp_prashna' | 'cosmic_blueprint' | 'shadow_integration' | 'life_decoder' | 'career_destiny' | 'relationship_destiny' | 'soul_purpose' | 'wealth_code' | 'future_timeline' | 'swot_5year' | 'past_life_karma' | 'mangal_dosha' | 'sade_sati'

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

const PREMIUM_ANALYSIS_TYPES = new Set<AnalysisType>(['spiritual', 'dasa', 'vedic_master', 'trik_bhava', 'forecast_12month', 'cosmic_love_letter', 'name_numerology', 'gemstone_remedy', 'compatibility_profile', 'kp_prashna', 'cosmic_blueprint', 'shadow_integration', 'life_decoder', 'career_destiny', 'relationship_destiny', 'soul_purpose', 'wealth_code', 'future_timeline', 'swot_5year', 'past_life_karma', 'mangal_dosha', 'sade_sati'])

// ============ Catalog Context ============
interface CatalogItem {
  id: string
  analysisType: string
  name: string
  description: string | null
  priceCents: number
  originalPriceCents: number | null
  sortOrder: number
}

interface CatalogState {
  catalog: CatalogItem[]
  premiumTypes: Set<string>
  catalogMap: Record<string, CatalogItem>
  loading: boolean
}

const CatalogContext = createContext<CatalogState>({
  catalog: [], premiumTypes: new Set(), catalogMap: {}, loading: true,
})

function useCatalog() {
  return useContext(CatalogContext)
}

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

// ============ Admin-Granted Access Context ============
interface AdminAccessState {
  hasAccess: boolean      // true if device has premium or unlimited access
  accessLevel: 'none' | 'premium' | 'unlimited'
  reason: string | null   // e.g. 'free_trial', 'promo', 'early_adopter'
  expiresAt: string | null
  loading: boolean
}

const AdminAccessContext = createContext<AdminAccessState>({
  hasAccess: false, accessLevel: 'none', reason: null, expiresAt: null, loading: true,
})

function useAdminAccess() {
  return useContext(AdminAccessContext)
}

// Fallback descriptions used when catalog hasn't loaded yet
// These MUST match the descriptions in the PremiumCatalog database / admin panel
const FALLBACK_PREMIUM_DESCRIPTIONS: Record<string, string> = {
  spiritual: 'Dharma, spiritual path, past life karma, and moksha indications',
  dasa: 'Current and upcoming planetary periods with timeline predictions',
  vedic_master: 'Strict Vedic Jyotishi master reading with Parashara/Jaimini/KP systems, divisional charts, yogas, ashtakavarga, and karmic verdict',
  trik_bhava: 'Deep 6th/8th/12th house analysis with karmic-psychological insight, relationship and career snapshots, and future trajectory',
  forecast_12month: '12-month deep forecast covering career shifts, money patterns, emotional cycles, key turning points, love life, and financial outlook',
  swot_5year: 'Comprehensive 5-year career & wealth forecast with SWOT analysis, specific timing, and remedies',
  cosmic_blueprint: 'Premium house-by-house blueprint with Ashtakvarga, Yoga directory, and Harmonized interpretations',
  shadow_integration: 'Uncompromising shadow work analysis with Tragic Sublimation, vulnerability map, and integration protocol',
  life_decoder: 'Combined numerology + life path + personality deep dive with destiny blueprint and single biggest life purpose',
  career_destiny: 'Career destiny finder with natural talents, top 3 destined career paths, growth pattern, and action plan',
  relationship_destiny: 'Deep relationship analysis with compatible partner types, hidden patterns, intimacy blocks, and marriage timeline',
  soul_purpose: 'Soul purpose and life mission with core mission, karmic lessons, daily alignment steps, and on-track indicators',
  wealth_code: 'Wealth and abundance code with money personality, mental blocks, exact wealth attraction strategy, and Dasa-based wealth windows',
  future_timeline: 'Future timeline and 5-year roadmap with key turning points, transformation phases, and age-based life stage analysis',
  education: 'Academic fields, higher education timing, learning style, and competitive exam prospects',
  family: 'Family harmony, relationship with parents, children prospects, and timing from Putra Bhava',
  cosmic_love_letter: 'A poetic love letter from the stars — your love signature, karmic love story, heart\'s timetable, and star blessing',
  name_numerology: 'Vedic name numerology with Chaldeon analysis, birth-name harmony check, and specific correction suggestions',
  gemstone_remedy: 'Personalized gemstone, rudraksha, mantra, fasting, and charity recommendations with monthly remedy calendar',
  compatibility_profile: 'Ideal partner profile from your chart — traits, Nakshatra matches, Mangal Dosha status, and best zodiac matches',
  past_life_karma: 'Past life karmic origins through Rahu-Ketu axis, 12th/8th house debts, Saturn\'s lesson, and liberation path',
  mangal_dosha: 'Complete Mangal Dosha analysis with severity, cancellation checks, marriage impact, and Mars pacification remedies',
  sade_sati: 'Saturn\'s 7.5-year transit analysis — current phase, career/health/relationship impact, key dates, and remedies',
  kp_prashna: 'Advanced KP horary with Sub-Lord theory, ruling planets, precise Yes/No verdict, and specific timing',
}

// Fallback prices used when catalog API is unavailable
// These MUST match the PremiumCatalog database seed values (in cents)
const FALLBACK_PREMIUM_PRICES: Record<string, { priceCents: number; originalPriceCents: number | null }> = {
  spiritual: { priceCents: 500, originalPriceCents: 999 },
  dasa: { priceCents: 500, originalPriceCents: 999 },
  vedic_master: { priceCents: 500, originalPriceCents: 999 },
  trik_bhava: { priceCents: 500, originalPriceCents: 999 },
  forecast_12month: { priceCents: 500, originalPriceCents: 999 },
  cosmic_blueprint: { priceCents: 900, originalPriceCents: 1499 },
  shadow_integration: { priceCents: 500, originalPriceCents: 999 },
  life_decoder: { priceCents: 900, originalPriceCents: 1499 },
  career_destiny: { priceCents: 900, originalPriceCents: 1499 },
  relationship_destiny: { priceCents: 900, originalPriceCents: 1499 },
  soul_purpose: { priceCents: 900, originalPriceCents: 1499 },
  wealth_code: { priceCents: 900, originalPriceCents: 1499 },
  future_timeline: { priceCents: 900, originalPriceCents: 1499 },
  swot_5year: { priceCents: 499, originalPriceCents: 999 },
  education: { priceCents: 0, originalPriceCents: null },
  family: { priceCents: 0, originalPriceCents: null },
  cosmic_love_letter: { priceCents: 500, originalPriceCents: 999 },
  name_numerology: { priceCents: 500, originalPriceCents: 999 },
  gemstone_remedy: { priceCents: 500, originalPriceCents: 999 },
  compatibility_profile: { priceCents: 500, originalPriceCents: 999 },
  kp_prashna: { priceCents: 700, originalPriceCents: 1299 },
  past_life_karma: { priceCents: 900, originalPriceCents: 1499 },
  mangal_dosha: { priceCents: 700, originalPriceCents: 1299 },
  sade_sati: { priceCents: 900, originalPriceCents: 1499 },
}

const ANALYSIS_TYPES: { id: AnalysisType; label: string; icon: React.ReactNode; desc: string; color: string; category: string; isPremium: boolean; priceCents: number; originalPriceCents: number | null }[] = [
  // Standard (Free)
  { id: 'overall', label: 'Overall Reading', icon: <Star className="w-5 h-5" />, desc: 'Complete birth chart interpretation covering personality, strengths, and life purpose', color: '#D4A843', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'career', label: 'Career & Profession', icon: <Briefcase className="w-5 h-5" />, desc: 'Professional path, suitable fields, career growth periods, and financial prospects', color: '#C9721A', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'relationships', label: 'Love & Marriage', icon: <Heart className="w-5 h-5" />, desc: 'Marriage timing, spouse characteristics, compatibility, and relationship dynamics', color: '#9B59B6', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'health', label: 'Health & Wellness', icon: <Activity className="w-5 h-5" />, desc: 'Health vulnerabilities, body constitution, and preventive guidance', color: '#2D6A4F', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'finance', label: 'Wealth & Finance', icon: <DollarSign className="w-5 h-5" />, desc: 'Income sources, wealth yogas, investment periods, and financial growth', color: '#B33A3A', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'education', label: 'Education & Learning', icon: <BookOpen className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.education, color: '#1B6B93', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'family', label: 'Family & Children', icon: <Users className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.family, color: '#6B4E71', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  { id: 'horary', label: 'Horary (Prasna)', icon: <Compass className="w-5 h-5" />, desc: 'Quick Yes/No answer using KP Sub-Lord theory for one burning question', color: '#5B2C6F', category: 'Standard', isPremium: false, priceCents: 0, originalPriceCents: null },
  // Pro ($5 each)
  { id: 'spiritual', label: 'Spiritual Growth', icon: <Flower2 className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.spiritual, color: '#6B1D1D', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.spiritual.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.spiritual.originalPriceCents },
  { id: 'dasa', label: 'Dasa Periods', icon: <Calendar className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.dasa, color: '#34495E', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.dasa.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.dasa.originalPriceCents },
  { id: 'vedic_master', label: 'Vedic Master Reading', icon: <Crown className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.vedic_master, color: '#8B6914', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.vedic_master.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.vedic_master.originalPriceCents },
  { id: 'trik_bhava', label: 'Trik Bhava Analysis', icon: <Shield className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.trik_bhava, color: '#5B2C6F', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.trik_bhava.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.trik_bhava.originalPriceCents },
  { id: 'forecast_12month', label: '12-Month Forecast', icon: <Orbit className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.forecast_12month, color: '#1a5276', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.forecast_12month.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.forecast_12month.originalPriceCents },
  { id: 'cosmic_love_letter', label: 'Cosmic Love Letter', icon: <Heart className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.cosmic_love_letter, color: '#C0392B', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.cosmic_love_letter.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.cosmic_love_letter.originalPriceCents },
  { id: 'name_numerology', label: 'Name Numerology', icon: <Hash className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.name_numerology, color: '#2E4053', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.name_numerology.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.name_numerology.originalPriceCents },
  { id: 'gemstone_remedy', label: 'Gemstone & Remedy', icon: <Gem className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.gemstone_remedy, color: '#1ABC9C', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.gemstone_remedy.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.gemstone_remedy.originalPriceCents },
  { id: 'compatibility_profile', label: 'Compatibility Profile', icon: <UserCheck className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.compatibility_profile, color: '#E74C3C', category: 'Pro', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.compatibility_profile.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.compatibility_profile.originalPriceCents },
  // Advanced (Variable pricing — NOT $9 flat)
  { id: 'cosmic_blueprint', label: 'Cosmic Blueprint', icon: <Sparkles className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.cosmic_blueprint, color: '#0f0c29', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.cosmic_blueprint.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.cosmic_blueprint.originalPriceCents },
  { id: 'shadow_integration', label: 'Shadow Integration', icon: <AlertCircle className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.shadow_integration, color: '#180202', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.shadow_integration.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.shadow_integration.originalPriceCents },
  { id: 'life_decoder', label: 'Life Decoder', icon: <Brain className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.life_decoder, color: '#2E4053', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.life_decoder.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.life_decoder.originalPriceCents },
  { id: 'career_destiny', label: 'Career Destiny', icon: <Briefcase className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.career_destiny, color: '#7D6608', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.career_destiny.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.career_destiny.originalPriceCents },
  { id: 'relationship_destiny', label: 'Relationship Destiny', icon: <Heart className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.relationship_destiny, color: '#78281F', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.relationship_destiny.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.relationship_destiny.originalPriceCents },
  { id: 'soul_purpose', label: 'Soul Purpose', icon: <Flower2 className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.soul_purpose, color: '#1B4F72', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.soul_purpose.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.soul_purpose.originalPriceCents },
  { id: 'wealth_code', label: 'Wealth Code', icon: <DollarSign className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.wealth_code, color: '#7D6608', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.wealth_code.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.wealth_code.originalPriceCents },
  { id: 'future_timeline', label: 'Future Timeline', icon: <Orbit className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.future_timeline, color: '#4A235A', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.future_timeline.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.future_timeline.originalPriceCents },
  { id: 'swot_5year', label: '5-Year SWOT Forecast', icon: <BookOpen className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.swot_5year, color: '#1a5276', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.swot_5year.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.swot_5year.originalPriceCents },
  { id: 'kp_prashna', label: 'KP Prashna (Advanced)', icon: <Compass className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.kp_prashna, color: '#8E44AD', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.kp_prashna.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.kp_prashna.originalPriceCents },
  { id: 'past_life_karma', label: 'Past Life Karma', icon: <RotateCcw className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.past_life_karma, color: '#4A235A', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.past_life_karma.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.past_life_karma.originalPriceCents },
  { id: 'mangal_dosha', label: 'Mangal Dosha Report', icon: <Flame className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.mangal_dosha, color: '#B33A3A', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.mangal_dosha.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.mangal_dosha.originalPriceCents },
  { id: 'sade_sati', label: 'Sade Sati Report', icon: <Clock className="w-5 h-5" />, desc: FALLBACK_PREMIUM_DESCRIPTIONS.sade_sati, color: '#2C3E50', category: 'Advanced', isPremium: true, priceCents: FALLBACK_PREMIUM_PRICES.sade_sati.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.sade_sati.originalPriceCents },
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
  { value: 'Krishnamurti', label: 'Krishnamurti (KP) — Default' },
  { value: 'Lahiri', label: 'Lahiri (Chitra Paksha)' },
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
  const adminAccess = useAdminAccess()
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
            <a
              href="/reading"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-gradient-to-r from-amber-600 to-yellow-500 text-white hover:from-amber-500 hover:to-yellow-400 font-semibold transition-all ml-1"
            >
              <BookOpen className="w-4 h-4" /> Book a Reading
            </a>
            {/* Social Contact Buttons */}
            <a
              href="https://wa.me/977979735537"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm bg-[#25D366] text-white hover:bg-[#25D366]/90 transition-all ml-1"
              title="Chat on WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61590513489073"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm bg-[#1877F2] text-white hover:bg-[#1877F2]/90 transition-all"
              title="Follow on Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>
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
                    <Crown className="w-4 h-4" /> Start Free Trial
                  </a>
                </div>
              )
            )}
            {/* Admin-Granted Access Badge (shown when Whop not configured or not authenticated, but device has admin access) */}
            {!whopAuth.hasAccess && adminAccess.hasAccess && (
              <Badge className="bg-gradient-to-r from-emerald-600 to-green-500 text-white text-[9px] px-1.5 py-0 ml-1">
                <Shield className="w-3 h-3 mr-0.5" /> {adminAccess.accessLevel === 'unlimited' ? 'UNLIMITED' : 'PREMIUM'}
              </Badge>
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
          <a
            href="/reading"
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 font-semibold"
          >
            <BookOpen className="w-4 h-4" /> Book a Reading
          </a>
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
            {/* WhatsApp */}
            <a
              href="https://wa.me/977979735537"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            {/* Facebook */}
            <a
              href="https://www.facebook.com/profile.php?id=61590513489073"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Facebook className="w-3.5 h-3.5" /> Facebook
            </a>
            {/* Telegram */}
            <a
              href="https://t.me/astrobidhi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0088CC] hover:bg-[#0088CC]/90 text-white rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Send className="w-3.5 h-3.5" /> Telegram
            </a>
            {/* Instagram */}
            <a
              href="https://www.instagram.com/astrobidhi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 text-white rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Instagram className="w-3.5 h-3.5" /> Instagram
            </a>
            {/* TikTok */}
            <a
              href="https://www.tiktok.com/@astrobidhi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#000000] hover:bg-[#000000]/90 text-white rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.79a8.18 8.18 0 004.76 1.52V6.86a4.84 4.84 0 01-1-.17z"/></svg> TikTok
            </a>
            {/* YouTube */}
            <a
              href="https://www.youtube.com/@astrobidhi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Youtube className="w-3.5 h-3.5" /> YouTube
            </a>
            {/* Buy Me a Coffee Button */}
            <a
              href={`https://buymeacoffee.com/${bmcSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFDD00] hover:bg-[#FFDD00]/90 text-[#000000] rounded-full text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Coffee className="w-3.5 h-3.5" /> Coffee
            </a>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 mt-3 pt-3 border-t border-saffron-light/10">
          <p className="text-xs">Dedicated to Parashara MahaRishi &amp; K.S. Krishnamurti</p>
          <a href="/admin" className="text-xs text-saffron-light/40 hover:text-gold-light transition-colors">Admin</a>
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
function BirthChartForm({ onSubmit, loading, onSaveChart }: {
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
  onSaveChart?: (chart: SavedChart) => void
}) {
  const { toast } = useToast()
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
  const [ayanamsa, setAyanamsa] = useState('Krishnamurti') // KP system as default
  const [houseSystem, setHouseSystem] = useState('Whole Sign')
  const [overrideUtc, setOverrideUtc] = useState('')
  const [useUtcOverride, setUseUtcOverride] = useState(false)
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([])
  const [showSavedCharts, setShowSavedCharts] = useState(false)

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

  // Load saved charts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_CHARTS_KEY)
      if (stored) {
        setSavedCharts(JSON.parse(stored))
      }
    } catch {}
  }, [])

  // Load a saved chart into the form
  const loadSavedChart = (chart: SavedChart) => {
    setBirthDate(`${chart.birthYear}-${String(chart.birthMonth).padStart(2, '0')}-${String(chart.birthDay).padStart(2, '0')}`)
    setBirthTime(`${String(chart.birthHour).padStart(2, '0')}:${String(chart.birthMinute).padStart(2, '0')}`)
    setAyanamsa(chart.ayanamsa)
    setHouseSystem(chart.houseSystem)
    // Set city info
    if (chart.birthCity) {
      setCitySearch(chart.birthCity)
    }
    setManualLat(chart.birthLat)
    setManualLng(chart.birthLng)
    setManualUtc(chart.birthUtc)
    // If we have lat/lng, use manual coords
    if (chart.birthLat !== 0 || chart.birthLng !== 0) {
      setSelectedCity(null)
      setShowManualCoords(true)
    }
    setShowSavedCharts(false)
    toast({ title: 'Chart Loaded', description: `${chart.name} loaded into form` })
  }

  // Delete a saved chart
  const deleteSavedChart = (chartId: string) => {
    const updated = savedCharts.filter(c => c.id !== chartId)
    setSavedCharts(updated)
    localStorage.setItem(SAVED_CHARTS_KEY, JSON.stringify(updated))
    toast({ title: 'Chart Deleted', description: 'Saved chart removed' })
  }

  // Save current chart data
  const handleSaveChart = () => {
    const [year, month, day] = birthDate.split('-').map(Number)
    const timeToUse = dontKnowBirthTime ? '12:00' : birthTime
    const [hour, minute] = timeToUse.split(':').map(Number)
    const latitude = selectedCity ? selectedCity.lat : manualLat
    const longitude = selectedCity ? selectedCity.lng : manualLng
    const utc = useUtcOverride && overrideUtc ? overrideUtc : (selectedCity ? selectedCity.tz : manualUtc)
    const cityName = selectedCity ? `${selectedCity.name}, ${selectedCity.country}` : `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const chart: SavedChart = {
      id: crypto.randomUUID(),
      name: `${cityName} - ${monthNames[month - 1]} ${day} ${year}`,
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthHour: hour,
      birthMinute: minute,
      birthCity: cityName,
      birthLat: latitude,
      birthLng: longitude,
      birthUtc: utc,
      ayanamsa,
      houseSystem,
      savedAt: new Date().toISOString(),
    }
    const updated = [...savedCharts, chart]
    setSavedCharts(updated)
    localStorage.setItem(SAVED_CHARTS_KEY, JSON.stringify(updated))
    onSaveChart?.(chart)
    toast({ title: 'Chart Saved', description: `${chart.name} saved for quick access` })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [year, month, day] = birthDate.split('-').map(Number)
    const timeToUse = dontKnowBirthTime ? '12:00' : birthTime
    const [hour, minute] = timeToUse.split(':').map(Number)
    const latitude = selectedCity ? selectedCity.lat : manualLat
    const longitude = selectedCity ? selectedCity.lng : manualLng
    const utc = useUtcOverride && overrideUtc ? overrideUtc : (selectedCity ? selectedCity.tz : manualUtc)
    const cityName = selectedCity ? `${selectedCity.name}, ${selectedCity.country}` : `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
    onSubmit({
      year, month, day, hour, minute, second: 0,
      utc, latitude, longitude,
      ayanamsa, house_system: houseSystem,
      cityName,
    })
  }

  // Current effective UTC for display
  const effectiveUtc = useUtcOverride && overrideUtc
    ? overrideUtc
    : (selectedCity ? selectedCity.tz : manualUtc)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ====== Saved Charts ====== */}
      {savedCharts.length > 0 && (
        <Card className="border-saffron/20">
          <button
            type="button"
            onClick={() => setShowSavedCharts(!showSavedCharts)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-saffron/5 transition-colors rounded-lg"
          >
            <span className="text-maroon flex items-center gap-2 text-sm font-medium">
              <History className="w-4 h-4 text-saffron" /> Saved Charts ({savedCharts.length})
            </span>
            {showSavedCharts
              ? <ChevronDown className="w-4 h-4 text-saffron" />
              : <ChevronRight className="w-4 h-4 text-saffron" />
            }
          </button>
          <AnimatePresence>
            {showSavedCharts && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 space-y-2 max-h-48 overflow-y-auto">
                  {savedCharts.map(chart => (
                    <div key={chart.id} className="flex items-center gap-2 p-2 bg-saffron/5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => loadSavedChart(chart)}
                        className="flex-1 text-left text-sm text-maroon hover:text-saffron transition-colors"
                      >
                        <span className="font-medium">{chart.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{chart.ayanamsa}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedChart(chart.id)}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Delete saved chart"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  ))}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

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

      {/* ====== Submit & Save Buttons ====== */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white font-semibold py-5 text-base"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calculating Chart...</>
          ) : (
            <><Star className="w-5 h-5 mr-2" /> Generate Kundali</>
          )}
        </Button>
        <Button
          type="button"
          onClick={handleSaveChart}
          variant="outline"
          className="px-4 border-saffron/30 text-maroon hover:bg-saffron/10"
          title="Save chart data for quick access later"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </Button>
      </div>
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
  const [form, setForm] = useState({ latitude: 28.6139, longitude: 77.2090, ayanamsa: 'Krishnamurti', house_system: 'Placidus' }) // KP default

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
    ayanamsa: 'Krishnamurti', house_system: 'Placidus', // KP system default
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
  const adminAccess = useAdminAccess()
  const catalog = useCatalog()
  const [selectedType, setSelectedType] = useState<AnalysisType>('overall')
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [premiumDialogType, setPremiumDialogType] = useState<AnalysisType | null>(null)
  const [limitReached, setLimitReached] = useState<{ type: string; used: number; limit: number } | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const analysisRef = useRef<HTMLDivElement>(null)

  // Chat follow-up states
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatLimitReached, setChatLimitReached] = useState(false)
  const [chatUsedCount, setChatUsedCount] = useState(0)

  // Build dynamic analysis types by merging static ANALYSIS_TYPES with catalog data
  // This means admin changes to names, descriptions, prices, and new items reflect on the main page
  const dynamicAnalysisTypes = React.useMemo(() => {
    // Helper: determine category from price (Pro = $5/500¢, Advanced = $9+/900+¢)
    const getCategoryFromPrice = (cents: number): string => {
      if (cents === 0) return 'Standard'
      if (cents <= 500) return 'Pro'
      return 'Advanced'
    }
    const types = ANALYSIS_TYPES.map(t => {
      const catItem = catalog.catalogMap[t.id]
      const priceCents = catItem?.priceCents || t.priceCents || 0
      return {
        ...t,
        // Override with catalog data if available, otherwise use hardcoded defaults from ANALYSIS_TYPES
        label: catItem?.name || t.label,
        desc: catItem?.description || t.desc,
        isPremium: catalog.premiumTypes.has(t.id) || t.isPremium,
        priceCents,
        originalPriceCents: catItem?.originalPriceCents || t.originalPriceCents || null,
        // Update category based on actual price from catalog
        category: catItem?.priceCents ? getCategoryFromPrice(catItem.priceCents) : t.category,
      }
    })
    // Add any NEW premium catalog items that aren't in the static list (e.g., admin-added types)
    for (const item of catalog.catalog) {
      if (item.analysisType.startsWith('reading_')) continue // reading types are on /reading page
      if (!types.find(t => t.id === item.analysisType)) {
        types.push({
          id: item.analysisType as AnalysisType,
          label: item.name,
          icon: <Sparkles className="w-5 h-5" />,
          desc: item.description || '',
          color: '#6B1D1D',
          category: getCategoryFromPrice(item.priceCents),
          isPremium: true,
          priceCents: item.priceCents,
          originalPriceCents: item.originalPriceCents,
        })
      }
    }
    return types
  }, [catalog])

  // Helper: get description for a premium type (from catalog or fallback)
  const getPremiumDescription = (typeId: string): string => {
    return catalog.catalogMap[typeId]?.description || FALLBACK_PREMIUM_DESCRIPTIONS[typeId] || 'Premium AI-powered analysis with detailed insights and remedies.'
  }

  // Helper: get price for a premium type (from catalog or fallback)
  const getPremiumPrice = (typeId: string): { priceCents: number; originalPriceCents: number | null } => {
    const catItem = catalog.catalogMap[typeId]
    if (catItem && catItem.priceCents > 0) {
      return { priceCents: catItem.priceCents, originalPriceCents: catItem.originalPriceCents }
    }
    return FALLBACK_PREMIUM_PRICES[typeId] || { priceCents: 0, originalPriceCents: null }
  }

  // Helper: format price from cents
  const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`

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
    if (catalog.premiumTypes.has(typeId) || PREMIUM_ANALYSIS_TYPES.has(typeId)) {
      if (whopAuth.hasAccess || adminAccess.hasAccess) {
        // User has Whop membership OR admin-granted access — allow premium analysis
        setSelectedType(typeId)
        return
      }
      setPremiumDialogType(typeId)
      return
    }
    setSelectedType(typeId)
  }

  const handleAnalyze = async () => {
    if ((catalog.premiumTypes.has(selectedType) || PREMIUM_ANALYSIS_TYPES.has(selectedType)) && !whopAuth.hasAccess && !adminAccess.hasAccess) {
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
        // Handle premium required (403)
        if (res.status === 403 && err.premiumRequired) {
          setPremiumDialogType(selectedType)
          throw new Error(err.detail || 'Premium access required')
        }
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

  // ============ AI Chat Follow-up ============
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !chartData || !selectedType) return
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      const deviceId = getDeviceId()
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          analysisType: selectedType,
          analysisResult: analysis,
          chartData,
          deviceId,
          conversationHistory: chatMessages.slice(-6), // last 3 exchanges
        }),
      })

      if (res.status === 403) {
        const data = await res.json()
        if (data.limitReached) {
          setChatLimitReached(true)
          setChatUsedCount(data.usedCount || 3)
        }
        setChatLoading(false)
        return
      }

      if (!res.ok) throw new Error('Chat request failed')
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not process your question. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const shareText = analysis
    ? `Check out my ${dynamicAnalysisTypes.find(t => t.id === selectedType)?.label || 'Vedic astrology'} reading on AstroBidhi!`
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
            <p className="text-xs font-semibold text-maroon/60 uppercase tracking-wider mb-2">Standard Analysis — Free</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {dynamicAnalysisTypes.filter(t => t.category === 'Standard').map(type => (
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
                    <p className={`text-sm font-semibold ${selectedType === type.id ? 'text-maroon' : 'text-foreground'}`}>{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pro Analysis Types */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pro Analysis</p>
              <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-[9px] px-1.5 py-0 font-bold tracking-wide">PRO</Badge>
              <span className="text-[10px] text-amber-600 font-medium">$5 each</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {dynamicAnalysisTypes.filter(t => t.category === 'Pro').map(type => (
                <button
                  key={type.id}
                  onClick={() => handleAnalysisClick(type.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? 'border-amber-500 bg-amber-50 shadow-md'
                      : 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                >
                  <div className="mt-0.5 relative" style={{ color: type.color }}>
                    {type.icon}
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-amber-600" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${selectedType === type.id ? 'text-amber-900' : 'text-foreground'}`}>{type.label} <span className="text-[9px] bg-gradient-to-r from-amber-600 to-yellow-500 text-white px-1.5 py-0.5 rounded-full ml-1 align-middle font-bold tracking-wide">PRO</span>{type.priceCents > 0 && <span className="text-[10px] text-amber-700 ml-1.5 font-semibold">{formatPrice(type.priceCents)}</span>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Analysis Types */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A235A' }}>Advanced AI Analysis</p>
              <Badge className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white text-[9px] px-1.5 py-0 font-bold tracking-wide">ADVANCED</Badge>
              <span className="text-[10px] text-purple-700 font-medium">$9 each</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {dynamicAnalysisTypes.filter(t => t.category === 'Advanced').map(type => (
                <button
                  key={type.id}
                  onClick={() => handleAnalysisClick(type.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? 'border-purple-600 bg-purple-50 shadow-md'
                      : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50/50'
                  }`}
                >
                  <div className="mt-0.5 relative" style={{ color: type.color }}>
                    {type.icon}
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-purple-600" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${selectedType === type.id ? 'text-purple-900' : 'text-foreground'}`}>{type.label} <span className="text-[9px] bg-gradient-to-r from-purple-800 to-indigo-900 text-white px-1.5 py-0.5 rounded-full ml-1 align-middle font-bold tracking-wide">ADVANCED</span>{type.priceCents > 0 && <span className="text-[10px] text-purple-700 ml-1.5 font-semibold">{formatPrice(type.priceCents)}</span>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 mt-4">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-400 rounded-full flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900">Get a Personal Vedic Reading</h3>
                    <p className="text-xs text-amber-700">With certified Jyotish astrologers</p>
                  </div>
                </div>
                <p className="text-sm text-amber-800 mb-3">
                  Connect with experienced Vedic astrologers for an in-person consultation. Get answers to your questions, detailed Dasa analysis, Kundali matching, and personalized remedies.
                </p>
                <a href="/reading" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-500 text-white rounded-lg text-sm font-semibold hover:from-amber-500 hover:to-yellow-400 transition-all">
                  Book a Reading <ArrowRight className="w-4 h-4" />
                </a>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-amber-700">Or reach us directly:</span>
                  <a href="https://wa.me/977979735537" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-[#25D366] text-white rounded text-xs font-medium hover:bg-[#25D366]/90 transition-all">
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </a>
                  <a href="https://www.facebook.com/profile.php?id=61590513489073" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-[#1877F2] text-white rounded text-xs font-medium hover:bg-[#1877F2]/90 transition-all">
                    <Facebook className="w-3 h-3" /> Facebook
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className={`w-full font-semibold py-5 text-base ${
              selectedType === 'cosmic_blueprint' || dynamicAnalysisTypes.find(t => t.id === selectedType)?.category === 'Advanced'
                ? 'bg-gradient-to-r from-purple-800 to-indigo-900 hover:from-purple-700 hover:to-indigo-800 text-white'
                : dynamicAnalysisTypes.find(t => t.id === selectedType)?.category === 'Pro'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white'
                : 'bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white'
            }`}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing with AI...</>
            ) : (
              <>{selectedType === 'shadow_integration' ? <AlertCircle className="w-5 h-5 mr-2" /> : selectedType === 'cosmic_blueprint' ? <Sparkles className="w-5 h-5 mr-2" /> : selectedType === 'swot_5year' ? <BookOpen className="w-5 h-5 mr-2" /> : dynamicAnalysisTypes.find(t => t.id === selectedType)?.category === 'Pro' ? <Crown className="w-5 h-5 mr-2" /> : dynamicAnalysisTypes.find(t => t.id === selectedType)?.category === 'Advanced' ? <Sparkles className="w-5 h-5 mr-2" /> : <Brain className="w-5 h-5 mr-2" />} Get {dynamicAnalysisTypes.find(t => t.id === selectedType)?.label}</>
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
                ? 'This advanced analysis requires a premium membership via Whop, or admin-granted access.'
                : 'This advanced analysis requires a premium subscription. Coming soon!'}
            </DialogDescription>
          </DialogHeader>
          {premiumDialogType && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  {dynamicAnalysisTypes.find(t => t.id === premiumDialogType)?.label}
                  {(() => {
                    const price = getPremiumPrice(premiumDialogType)
                    if (price.priceCents > 0) {
                      return <span className="ml-2 text-amber-700">{formatPrice(price.priceCents)}{price.originalPriceCents ? <span className="text-xs line-through text-muted-foreground ml-1">{formatPrice(price.originalPriceCents)}</span> : null}</span>
                    }
                    return null
                  })()}
                </p>
                <p className="text-sm text-amber-800">
                  {getPremiumDescription(premiumDialogType)}
                </p>
              </div>
              {whopAuth.configured && !whopAuth.authenticated && (
                <div className="rounded-lg border border-saffron/30 bg-saffron/5 p-4">
                  <p className="text-sm font-semibold text-maroon mb-2">Unlock all premium features:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {catalog.catalog.filter(c => !c.analysisType.startsWith('reading_') && c.priceCents > 0).map(c => (
                      <li key={c.analysisType}>{c.name} — {formatPrice(c.priceCents)}</li>
                    ))}
                    <li>Unlimited chart readings</li>
                    <li>Priority AI response</li>
                  </ul>
                </div>
              )}
              {/* Admin access hint */}
              {!adminAccess.hasAccess && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Free trial access:</strong> Admins can grant free premium or unlimited access to your device.
                    Contact support or use an admin-granted promo code to unlock premium features without payment.
                  </p>
                </div>
              )}
              {adminAccess.hasAccess && adminAccess.reason && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs text-green-800">
                    <strong>Admin access active:</strong> Your device has {adminAccess.accessLevel} access
                    ({adminAccess.reason}). You should be able to use premium features.
                    {adminAccess.expiresAt && ` Expires: ${new Date(adminAccess.expiresAt).toLocaleDateString()}`}
                  </p>
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
                <Crown className="w-4 h-4" /> Start Free Trial
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
               <span className="font-medium text-maroon">{dynamicAnalysisTypes.find(t => t.id === selectedType)?.label}</span> reading</>}
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
                {dynamicAnalysisTypes.find(t => t.id === selectedType)?.icon}
                {dynamicAnalysisTypes.find(t => t.id === selectedType)?.label}
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

      {/* AI Chat Follow-up */}
      {analysis && !loading && (
        <Card className="border-saffron/20 mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-maroon flex items-center gap-2 text-sm">
              <MessageCircle className="w-4 h-4" /> Ask a Follow-up Question
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {chatLimitReached 
                ? `Free limit reached (${chatUsedCount}/3). Upgrade for unlimited follow-ups.`
                : `Free: 3 follow-up questions per analysis • Premium: Unlimited`}
            </p>
          </CardHeader>
          <CardContent>
            {/* Chat Messages */}
            {chatMessages.length > 0 && (
              <div className="max-h-64 overflow-y-auto mb-3 space-y-2">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`p-2.5 rounded-lg text-sm ${
                    msg.role === 'user' 
                      ? 'bg-saffron/10 text-maroon ml-8' 
                      : 'bg-muted text-foreground mr-8'
                  }`}>
                    <p className="text-xs font-semibold mb-1">{msg.role === 'user' ? 'You' : 'AstroBidhi AI'}</p>
                    <div className="prose prose-xs max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-muted mr-8 p-2.5 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Chat Input */}
            {!chatLimitReached ? (
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit() } }}
                  placeholder="Ask about your chart, a specific planet, timing, remedies..."
                  disabled={chatLoading}
                  className="text-sm h-9"
                />
                <Button
                  onClick={handleChatSubmit}
                  disabled={chatLoading || !chatInput.trim()}
                  size="sm"
                  className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white h-9"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div>
                  <p className="text-sm font-semibold text-amber-800">Follow-up limit reached</p>
                  <p className="text-xs text-amber-600">Upgrade to Premium for unlimited questions</p>
                </div>
                <a
                  href="/api/auth/whop"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-saffron to-maroon text-white text-xs font-semibold rounded-md"
                >
                  <Crown className="w-3 h-3" /> Upgrade
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Horoscope Widget ============
function HoroscopeWidget({ chartData }: { chartData: HoroscopeData | null }) {
  const [horoscopeResult, setHoroscopeResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [daysLeft, setDaysLeft] = useState(0)
  const [price, setPrice] = useState('$4.99/month')
  const { toast } = useToast()

  useEffect(() => {
    if (!chartData) return
    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') || '' : ''
    fetch(`/api/horoscope?deviceId=${encodeURIComponent(deviceId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setIsSubscribed(d.isSubscribed)
          setDaysLeft(d.daysRemaining || 0)
          setPrice(d.priceFormatted || '$4.99/month')
        }
      })
      .catch(() => {})
  }, [chartData])

  const generate = async () => {
    if (!chartData) return
    setIsLoading(true)
    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') || '' : ''
    try {
      const res = await fetch('/api/horoscope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', deviceId, chartData }),
      })
      if (res.status === 403) { setIsSubscribed(false); setIsLoading(false); return }
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setHoroscopeResult(data.horoscope)
      setIsSubscribed(true)
    } catch { setHoroscopeResult(null) }
    finally { setIsLoading(false) }
  }

  const subscribe = async () => {
    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') || '' : ''
    try {
      const res = await fetch('/api/horoscope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', deviceId }),
      })
      if (res.ok) {
        setIsSubscribed(true)
        setDaysLeft(30)
        toast({ title: 'Subscribed!', description: 'Daily horoscope subscription active for 30 days.' })
        generate()
      }
    } catch {
      toast({ title: 'Error', description: 'Could not activate subscription', variant: 'destructive' })
    }
  }

  if (!chartData) return null

  return (
    <Card className="border-saffron/20 overflow-hidden mt-8">
      <CardHeader className="bg-gradient-to-r from-maroon/10 via-saffron/10 to-maroon/10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-maroon flex items-center gap-2">
              <Sun className="w-5 h-5 text-saffron" /> Daily Horoscope
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Personalized daily reading based on your birth chart</p>
          </div>
          {isSubscribed && daysLeft > 0 && (
            <Badge className="bg-vedic-green/20 text-vedic-green border-vedic-green/30">
              <CheckCircle className="w-3 h-3 mr-1" /> {daysLeft} days left
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {horoscopeResult ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{horoscopeResult}</ReactMarkdown>
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-saffron animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Generating your personalized horoscope...</p>
          </div>
        ) : isSubscribed ? (
          <div className="py-6 text-center">
            <Sun className="w-12 h-12 text-saffron/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Get your personalized horoscope for today</p>
            <Button onClick={generate} className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white">
              <Sun className="w-4 h-4 mr-2" /> Generate Today&apos;s Horoscope
            </Button>
          </div>
        ) : (
          <div className="py-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-saffron/30 rounded-lg p-6 text-center">
              <Sun className="w-12 h-12 text-saffron mx-auto mb-3" />
              <h3 className="text-lg font-bold text-maroon mb-2">Daily Horoscope Subscription</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get a personalized daily horoscope based on your unique birth chart — not generic zodiac readings. Updated every day with current planetary transits.
              </p>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-maroon">{price}</p>
                  <p className="text-xs text-muted-foreground">30 days of daily readings</p>
                </div>
              </div>
              <ul className="text-sm text-left max-w-xs mx-auto space-y-1 mb-4">
                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-vedic-green shrink-0" /> Personalized to YOUR birth chart</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-vedic-green shrink-0" /> Moon sign &amp; Nakshatra-based</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-vedic-green shrink-0" /> Career, love, health &amp; lucky guidance</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-vedic-green shrink-0" /> Updated daily with transit insights</li>
              </ul>
              <Button onClick={subscribe} className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white font-semibold px-8">
                <Crown className="w-4 h-4 mr-2" /> Subscribe Now — {price}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
      <HoroscopeWidget chartData={activeData} />
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
                    const analysisInfo = dynamicAnalysisTypes.find(a => a.id === analysis.type)
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

  // ---- Persist birth chart in localStorage ----
  useEffect(() => {
    if (horoscopeData && lastFormData) {
      try {
        localStorage.setItem('astrobidi_saved_chart', JSON.stringify({ chartData: horoscopeData, formData: lastFormData, savedAt: new Date().toISOString() }))
      } catch {}
    } else if (!horoscopeData) {
      // Chart was cleared — remove from localStorage
      try { localStorage.removeItem('astrobidi_saved_chart') } catch {}
    }
  }, [horoscopeData, lastFormData])

  // ---- Restore birth chart from localStorage on mount ----
  useEffect(() => {
    try {
      const saved = localStorage.getItem('astrobidi_saved_chart')
      if (saved) {
        const parsed = JSON.parse(saved) as { chartData: HoroscopeData; formData: Record<string, unknown>; savedAt: string }
        if (parsed.chartData && parsed.formData) {
          setHoroscopeData(parsed.chartData)
          setLastFormData(parsed.formData)
        }
      }
    } catch {}
  }, [])

  // Whop auth state
  const [whopAuth, setWhopAuth] = useState<WhopAuthState>({
    authenticated: false, hasAccess: false, accessLevel: 'no_access', user: null, loading: true, configured: false,
  })

  // Admin-granted access state
  const [adminAccess, setAdminAccess] = useState<AdminAccessState>({
    hasAccess: false, accessLevel: 'none', reason: null, expiresAt: null, loading: true,
  })

  // Dynamic catalog state — initialized with hardcoded defaults so prices show immediately
  // When /api/catalog responds, these defaults get replaced with database values
  const [catalogState, setCatalogState] = useState<CatalogState>(() => {
    const defaultCatalog: CatalogItem[] = [
      { id: 'fallback-swot', analysisType: 'swot_5year', name: '5-Year SWOT Forecast', description: FALLBACK_PREMIUM_DESCRIPTIONS.swot_5year, priceCents: FALLBACK_PREMIUM_PRICES.swot_5year.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.swot_5year.originalPriceCents, sortOrder: 1 },
      { id: 'fallback-cosmic', analysisType: 'cosmic_blueprint', name: 'Cosmic Blueprint', description: FALLBACK_PREMIUM_DESCRIPTIONS.cosmic_blueprint, priceCents: FALLBACK_PREMIUM_PRICES.cosmic_blueprint.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.cosmic_blueprint.originalPriceCents, sortOrder: 2 },
      { id: 'fallback-shadow', analysisType: 'shadow_integration', name: 'Shadow Integration', description: FALLBACK_PREMIUM_DESCRIPTIONS.shadow_integration, priceCents: FALLBACK_PREMIUM_PRICES.shadow_integration.priceCents, originalPriceCents: FALLBACK_PREMIUM_PRICES.shadow_integration.originalPriceCents, sortOrder: 3 },
    ]
    const catalogMap: Record<string, CatalogItem> = {}
    const premiumTypes = new Set<string>()
    for (const item of defaultCatalog) {
      catalogMap[item.analysisType] = item
      premiumTypes.add(item.analysisType)
    }
    return { catalog: defaultCatalog, premiumTypes, catalogMap, loading: true }
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

  // Fetch admin-granted access on mount
  useEffect(() => {
    let cancelled = false
    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('astrobidi_device_id') : null
    if (!deviceId) {
      setAdminAccess(prev => ({ ...prev, loading: false }))
      return
    }
    fetch(`/api/access?deviceId=${encodeURIComponent(deviceId)}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setAdminAccess({
            hasAccess: data.hasAccess || false,
            accessLevel: data.accessLevel || 'none',
            reason: data.reason || null,
            expiresAt: data.expiresAt || null,
            loading: false,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminAccess({ hasAccess: false, accessLevel: 'none', reason: null, expiresAt: null, loading: false })
        }
      })
    return () => { cancelled = true }
  }, [])

  // Fetch premium catalog on mount — this makes the main page dynamic
  // When admin updates catalog (names, descriptions, prices, new items), it reflects here
  useEffect(() => {
    let cancelled = false
    fetch('/api/catalog')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.catalog) {
          const catalog: CatalogItem[] = data.catalog
          const catalogMap: Record<string, CatalogItem> = {}
          const premiumTypes = new Set<string>()
          for (const item of catalog) {
            catalogMap[item.analysisType] = item
            // Any item in PremiumCatalog with a price > 0 is premium (except reading_ types which are handled separately)
            if (item.priceCents > 0 && !item.analysisType.startsWith('reading_')) {
              premiumTypes.add(item.analysisType)
            }
          }
          setCatalogState({ catalog, premiumTypes, catalogMap, loading: false })
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Fall back to static premium types if catalog fetch fails
          setCatalogState(prev => ({ ...prev, loading: false }))
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      // Save chart from lastFormData
                      if (lastFormData) {
                        const saved = JSON.parse(localStorage.getItem(SAVED_CHARTS_KEY) || '[]') as SavedChart[]
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        const cityName = lastFormData.cityName ? String(lastFormData.cityName) : `${Number(lastFormData.latitude).toFixed(2)}°, ${Number(lastFormData.longitude).toFixed(2)}°`
                        const chart: SavedChart = {
                          id: crypto.randomUUID(),
                          name: `${cityName} - ${monthNames[(Number(lastFormData.month) || 1) - 1]} ${lastFormData.day} ${lastFormData.year}`,
                          birthYear: Number(lastFormData.year),
                          birthMonth: Number(lastFormData.month),
                          birthDay: Number(lastFormData.day),
                          birthHour: Number(lastFormData.hour),
                          birthMinute: Number(lastFormData.minute),
                          birthCity: cityName,
                          birthLat: Number(lastFormData.latitude),
                          birthLng: Number(lastFormData.longitude),
                          birthUtc: String(lastFormData.utc),
                          ayanamsa: String(lastFormData.ayanamsa || 'Krishnamurti'),
                          houseSystem: String(lastFormData.house_system || 'Whole Sign'),
                          savedAt: new Date().toISOString(),
                        }
                        // Check if already saved (by matching data)
                        const isDuplicate = saved.some(s => s.birthYear === chart.birthYear && s.birthMonth === chart.birthMonth && s.birthDay === chart.birthDay && s.birthHour === chart.birthHour && s.birthMinute === chart.birthMinute && Math.abs(s.birthLat - chart.birthLat) < 0.01)
                        if (!isDuplicate) {
                          saved.push(chart)
                          localStorage.setItem(SAVED_CHARTS_KEY, JSON.stringify(saved))
                          toast({ title: 'Chart Saved', description: `${chart.name} saved for quick access` })
                        } else {
                          toast({ title: 'Already Saved', description: 'This chart is already in your saved charts' })
                        }
                      }
                    }} className="border-saffron text-maroon">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      Save Chart
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setHoroscopeData(null); setStaticMeanings(null) }} className="border-saffron text-maroon">
                      Generate New Chart
                    </Button>
                  </div>
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
                    <HoroscopeWidget chartData={horoscopeData} />
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
                    <HoroscopeWidget chartData={horaryData} />
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
    <AdminAccessContext.Provider value={adminAccess}>
    <CatalogContext.Provider value={catalogState}>
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
    </CatalogContext.Provider>
    </AdminAccessContext.Provider>
    </WhopAuthContext.Provider>
  )
}
