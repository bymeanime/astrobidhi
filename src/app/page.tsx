'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Moon, Star, Compass, Calendar, Eye, Zap,
  ChevronRight, Loader2, AlertCircle, MapPin, Clock,
  Sparkles, BookOpen, ArrowRight, Globe, Mountain,
  Brain, Heart, Briefcase, DollarSign, Flower2, Activity, MessageCircle
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

type PageView = 'home' | 'birth-chart' | 'horary' | 'dasa' | 'planets' | 'aspects' | 'transit' | 'ai-analysis'

type AnalysisType = 'overall' | 'career' | 'relationships' | 'health' | 'finance' | 'spiritual' | 'dasa' | 'horary' | 'swot_5year' | 'cosmic_blueprint' | 'shadow_integration'

const ANALYSIS_TYPES: { id: AnalysisType; label: string; icon: React.ReactNode; desc: string; color: string; category: string }[] = [
  { id: 'overall', label: 'Overall Reading', icon: <Star className="w-5 h-5" />, desc: 'Complete birth chart interpretation covering personality, strengths, and life purpose', color: '#D4A843', category: 'Standard' },
  { id: 'career', label: 'Career & Profession', icon: <Briefcase className="w-5 h-5" />, desc: 'Professional path, suitable fields, career growth periods, and financial prospects', color: '#C9721A', category: 'Standard' },
  { id: 'relationships', label: 'Love & Marriage', icon: <Heart className="w-5 h-5" />, desc: 'Marriage timing, spouse characteristics, compatibility, and relationship dynamics', color: '#9B59B6', category: 'Standard' },
  { id: 'health', label: 'Health & Wellness', icon: <Activity className="w-5 h-5" />, desc: 'Health vulnerabilities, body constitution, and preventive guidance', color: '#2D6A4F', category: 'Standard' },
  { id: 'finance', label: 'Wealth & Finance', icon: <DollarSign className="w-5 h-5" />, desc: 'Income sources, wealth yogas, investment periods, and financial growth', color: '#B33A3A', category: 'Standard' },
  { id: 'spiritual', label: 'Spiritual Growth', icon: <Flower2 className="w-5 h-5" />, desc: 'Dharma, spiritual path, past life karma, and moksha indications', color: '#6B1D1D', category: 'Standard' },
  { id: 'dasa', label: 'Dasa Periods', icon: <Calendar className="w-5 h-5" />, desc: 'Current and upcoming planetary periods with timeline predictions', color: '#34495E', category: 'Standard' },
  { id: 'swot_5year', label: '5-Year SWOT Forecast', icon: <BookOpen className="w-5 h-5" />, desc: 'Comprehensive 5-year career & wealth forecast with SWOT analysis, specific timing, and remedies', color: '#1a5276', category: 'Advanced' },
  { id: 'cosmic_blueprint', label: 'Cosmic Blueprint', icon: <Sparkles className="w-5 h-5" />, desc: 'Premium house-by-house blueprint with Ashtakvarga, Yoga directory, and Harmonized interpretations', color: '#0f0c29', category: 'Advanced' },
  { id: 'shadow_integration', label: 'Shadow Integration', icon: <AlertCircle className="w-5 h-5" />, desc: 'Uncompromising shadow work analysis with Tragic Sublimation, vulnerability map, and integration protocol', color: '#180202', category: 'Advanced' },
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
]

// ============ Components ============

function VedicNav({ currentPage, onNavigate }: { currentPage: PageView; onNavigate: (p: PageView) => void }) {
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
          <p className="text-xs">Dedicated to Parashara MahaRishi &amp; K.S. Krishnamurti</p>
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
  const [form, setForm] = useState({
    year: 1990, month: 6, day: 15,
    hour: 10, minute: 30, second: 0,
    utc: '+05:30', latitude: 11.02, longitude: 76.98,
    ayanamsa: 'Lahiri', house_system: 'Placidus',
    name: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      year: form.year, month: form.month, day: form.day,
      hour: form.hour, minute: form.minute, second: form.second,
      utc: form.utc, latitude: form.latitude, longitude: form.longitude,
      ayanamsa: form.ayanamsa, house_system: form.house_system,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date & Time */}
        <Card className="border-saffron/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-maroon flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" /> Date & Time of Birth
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Year</Label>
              <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Month</Label>
              <Input type="number" min={1} max={12} value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Day</Label>
              <Input type="number" min={1} max={31} value={form.day} onChange={e => setForm(f => ({ ...f, day: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Hour</Label>
              <Input type="number" min={0} max={23} value={form.hour} onChange={e => setForm(f => ({ ...f, hour: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Minute</Label>
              <Input type="number" min={0} max={59} value={form.minute} onChange={e => setForm(f => ({ ...f, minute: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Second</Label>
              <Input type="number" min={0} max={59} value={form.second} onChange={e => setForm(f => ({ ...f, second: +e.target.value }))} className="h-9" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">UTC Offset</Label>
              <Input value={form.utc} onChange={e => setForm(f => ({ ...f, utc: e.target.value }))} placeholder="+05:30" className="h-9" />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="border-saffron/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-maroon flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4" /> Birth Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input type="number" step="0.01" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: +e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input type="number" step="0.01" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: +e.target.value }))} className="h-9" />
            </div>
            <div className="vedic-divider my-3" />
            <div>
              <Label className="text-xs">Ayanamsa</Label>
              <Select value={form.ayanamsa} onValueChange={v => setForm(f => ({ ...f, ayanamsa: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AYANAMSA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">House System</Label>
              <Select value={form.house_system} onValueChange={v => setForm(f => ({ ...f, house_system: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOUSE_SYSTEMS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

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
function AIAnalysisPanel({ chartData, horaryNumber }: { chartData: HoroscopeData; horaryNumber?: number }) {
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<AnalysisType>('overall')
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const analysisRef = useRef<HTMLDivElement>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setAnalysis(null)
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: selectedType,
          chartData,
          horaryNumber,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'AI analysis failed' }))
        throw new Error(err.detail || `Error: ${res.status}`)
      }
      const data = await res.json()
      if (!data.analysis) {
        throw new Error('AI returned an empty response. Please try again.')
      }
      setAnalysis(data.analysis)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate analysis'
      const friendlyMsg = msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? 'Connection lost — the AI is taking too long. Please try again.'
        : msg.includes('503')
        ? 'All AI providers are busy right now. Please wait a moment and try again.'
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
                    <p className={`text-sm font-semibold ${selectedType === type.id ? 'text-maroon' : 'text-foreground'}`}>{type.label}</p>
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
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? type.id === 'shadow_integration'
                        ? 'border-red-800 bg-red-950/30 shadow-md'
                        : type.id === 'cosmic_blueprint'
                        ? 'border-indigo-800 bg-indigo-950/30 shadow-md'
                        : 'border-saffron bg-saffron/10 shadow-md'
                      : 'border-saffron/10 hover:border-saffron/30 hover:bg-saffron/5'
                  }`}
                >
                  <div className="mt-0.5" style={{ color: type.color }}>{type.icon}</div>
                  <div>
                    <p className={`text-sm font-semibold ${
                      selectedType === type.id 
                        ? type.id === 'shadow_integration' ? 'text-red-200' : type.id === 'cosmic_blueprint' ? 'text-indigo-200' : 'text-maroon'
                        : 'text-foreground'
                    }`}>{type.label}</p>
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

// ============ Main App ============
export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageView>('home')
  const { toast } = useToast()
  const [horoscopeData, setHoroscopeData] = useState<HoroscopeData | null>(null)
  const [horaryData, setHoraryData] = useState<HoroscopeData | null>(null)
  const [horaryNumber, setHoraryNumber] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const handleGenerateChart = useCallback(async (formData: Record<string, unknown>) => {
    setLoading(true)
    try {
      const data = await apiCall('get_all_horoscope_data', formData)
      setHoroscopeData(data)
      if (currentPage === 'birth-chart') {
        toast({ title: 'Chart Generated', description: 'Your Kundali has been calculated successfully!' })
      }
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
                  <Button variant="outline" size="sm" onClick={() => setHoroscopeData(null)} className="border-saffron text-maroon">
                    Generate New Chart
                  </Button>
                </div>

                <Tabs defaultValue="chart" className="w-full">
                  <TabsList className="bg-maroon/5">
                    <TabsTrigger value="chart"><Eye className="w-4 h-4 mr-1" /> Chart</TabsTrigger>
                    <TabsTrigger value="planets"><Sparkles className="w-4 h-4 mr-1" /> Planets</TabsTrigger>
                    <TabsTrigger value="houses"><Sparkles className="w-4 h-4 mr-1" /> Houses</TabsTrigger>
                    <TabsTrigger value="dasa"><Calendar className="w-4 h-4 mr-1" /> Dasa</TabsTrigger>
                    <TabsTrigger value="aspects"><Zap className="w-4 h-4 mr-1" /> Aspects</TabsTrigger>
                    <TabsTrigger value="ai"><Brain className="w-4 h-4 mr-1" /> AI Analysis</TabsTrigger>
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
    </div>
  )
}
