'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Star, Loader2, Share2, Copy, Twitter, Facebook,
  MessageCircle, ExternalLink, Brain, Eye
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import ReactMarkdown from 'react-markdown'

// ============ Types ============
interface PlanetData {
  Object: string
  Rasi: string
  isRetroGrade: string | null
  SignLonDMS: string
  Nakshatra: string
  HouseNr: number
}

interface SharedData {
  chartParams: Record<string, unknown>
  analysisType: string | null
  includeAnalysis: boolean
  cachedChartData: Record<string, unknown> | null
  cachedAnalysisResult: string | null
  viewCount: number
  createdAt: string
}

// ============ Constants ============
const RASI_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
const RASI_SANSKRIT = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena']
const RASI_SYMBOLS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

const SOUTH_INDIAN_LAYOUT = [
  ['Pisces',    'Aries',    'Taurus',   'Gemini'],
  ['Aquarius',  '',         '',         'Cancer'],
  ['Capricorn', '',         '',         'Leo'],
  ['Sagittarius','Scorpio', 'Libra',   'Virgo'],
]

const PLANET_COLORS: Record<string, string> = {
  'Sun': '#C9721A', 'Moon': '#8B8B8B', 'Mars': '#B33A3A', 'Mercury': '#2D6A4F',
  'Jupiter': '#D4A843', 'Venus': '#9B59B6', 'Saturn': '#34495E', 'Rahu': '#6B1D1D',
  'Ketu': '#8E44AD', 'Asc': '#C9721A',
}

const ANALYSIS_LABELS: Record<string, string> = {
  overall: 'Overall Reading',
  career: 'Career & Profession',
  relationships: 'Love & Marriage',
  health: 'Health & Wellness',
  finance: 'Wealth & Finance',
  spiritual: 'Spiritual Growth',
  dasa: 'Dasa Periods',
  horary: 'Horary (Prasna)',
  swot_5year: '5-Year SWOT Forecast',
  cosmic_blueprint: 'Cosmic Blueprint',
  shadow_integration: 'Shadow Integration',
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

// ============ Main Component ============
export default function SharedChartPage({ params }: { params: Promise<{ shareId: string }> }) {
  const [shareId, setShareId] = useState<string>('')
  const [sharedData, setSharedData] = useState<SharedData | null>(null)
  const [chartData, setChartData] = useState<Record<string, unknown> | null>(null)
  const [analysisText, setAnalysisText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    params.then(p => setShareId(p.shareId))
  }, [params])

  useEffect(() => {
    if (!shareId) return

    const fetchSharedChart = async () => {
      try {
        // Get shared chart metadata (includes cached chart data and analysis)
        const res = await fetch(`/api/share/${shareId}`)
        if (!res.ok) throw new Error('Shared chart not found')
        const data: SharedData = await res.json()
        setSharedData(data)

        // Use cached chart data if available — avoids re-running Python
        if (data.cachedChartData && data.cachedChartData.planets_data) {
          setChartData(data.cachedChartData)
        } else {
          // Fallback: regenerate chart from birth params
          const chartParams = data.chartParams as Record<string, unknown>
          const isHorary = !!chartParams.horary_number
          const endpoint = isHorary ? 'get_horary_data' : 'get_chart_data'

          try {
            const chart = await apiCall(endpoint, chartParams)
            setChartData(chart)
          } catch (chartErr) {
            console.error('Failed to regenerate chart from params:', chartErr)
          }
        }

        // Use cached analysis result if available — avoids consuming AI credits
        if (data.includeAnalysis && data.cachedAnalysisResult) {
          setAnalysisText(data.cachedAnalysisResult)
        } else if (data.includeAnalysis && data.analysisType && chartData) {
          // Fallback: only call AI if no cached result exists
          // This should rarely happen since we cache on share creation
          try {
            const deviceId = typeof window !== 'undefined'
              ? localStorage.getItem('astrobidi_device_id') || 'shared-viewer'
              : 'shared-viewer'

            const effectiveChartData = data.cachedChartData || chartData
            if (effectiveChartData) {
              const analysisRes = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  analysisType: data.analysisType,
                  chartData: effectiveChartData,
                  deviceId,
                }),
              })

              if (analysisRes.ok) {
                const analysisData = await analysisRes.json()
                setAnalysisText(analysisData.analysis)
              }
            }
          } catch (err) {
            console.error('Failed to fetch analysis for shared chart:', err)
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load shared chart')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedChart()
  }, [shareId])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = sharedData?.analysisType
    ? `Check out my ${ANALYSIS_LABELS[sharedData.analysisType] || sharedData.analysisType} Vedic astrology reading! 🔮 Get yours free at AstroBidhi`
    : 'Check out my Vedic astrology reading! 🔮 Get yours free at AstroBidhi'

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-temple-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-gold animate-pulse-glow mb-4">ॐ</div>
          <p className="text-maroon text-lg flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading shared chart...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-temple-bg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl text-temple-red mb-4">⚠</div>
          <h1 className="text-2xl font-bold text-maroon mb-2">Chart Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a href="/">
            <Button className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white">
              <Star className="w-4 h-4 mr-2" /> Generate Your Own Kundali
            </Button>
          </a>
        </div>
      </div>
    )
  }

  const rasiPlanets = (chartData?.rasi_planets || {}) as Record<string, { name: string; retrograde: string | null; longitude: string; nakshatra: string; rasiLord: string; nakshatraLord: string; subLord: string; houseNr: number }[]>
  const houseChart = (chartData?.house_chart || {}) as Record<number, { rasi: string; longitude: string; nakshatra: string; rasiLord: string; nakshatraLord: string; subLord: string }>

  return (
    <div className="min-h-screen bg-temple-bg">
      {/* Header */}
      <header className="bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <div className="text-2xl text-gold animate-pulse-glow">ॐ</div>
              <div>
                <h1 className="text-xl font-bold text-gold-light tracking-wide">AstroBidhi</h1>
                <p className="text-[10px] text-saffron-light -mt-1 tracking-widest">वैदिक ज्योतिष</p>
              </div>
            </a>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-saffron/30 text-saffron-light text-xs">
                <Eye className="w-3 h-3 mr-1" /> {sharedData?.viewCount || 0} views
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Chart Title */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-maroon flex items-center justify-center gap-2">
              <Star className="w-8 h-8 text-saffron" /> Shared Kundali
            </h2>
            {sharedData?.analysisType && (
              <Badge className="mt-2 bg-saffron text-white">
                {ANALYSIS_LABELS[sharedData.analysisType] || sharedData.analysisType}
              </Badge>
            )}
            <div className="vedic-divider max-w-xs mx-auto my-4" />
          </div>

          {/* Birth Chart */}
          <Card className="border-saffron/20 mb-6">
            <CardHeader>
              <CardTitle className="text-maroon text-base">Birth Chart (Kundali)</CardTitle>
            </CardHeader>
            <CardContent>
              <SouthIndianChart rasiPlanets={rasiPlanets} houseChart={houseChart} />
            </CardContent>
          </Card>

          {/* Analysis */}
          {sharedData?.includeAnalysis && analysisText && (
            <Card className="border-saffron/20 mb-6">
              <CardHeader>
                <CardTitle className="text-maroon flex items-center gap-2">
                  <Brain className="w-5 h-5 text-saffron" />
                  {ANALYSIS_LABELS[sharedData.analysisType || 'overall'] || 'AI Analysis'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none text-sm">
                  <ReactMarkdown>{analysisText}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Share Buttons */}
          <Card className="border-saffron/20 mb-6">
            <CardHeader>
              <CardTitle className="text-maroon flex items-center gap-2">
                <Share2 className="w-5 h-5 text-saffron" /> Share This Chart
              </CardTitle>
              <CardDescription>Share with friends on social media</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="border-saffron/30 hover:bg-saffron/10"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="border-saffron/30 hover:bg-saffron/10">
                    <Twitter className="w-4 h-4 mr-2" /> Twitter
                  </Button>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="border-saffron/30 hover:bg-saffron/10">
                    <Facebook className="w-4 h-4 mr-2" /> Facebook
                  </Button>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="border-vedic-green/30 hover:bg-vedic-green/10">
                    <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                  </Button>
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="border-saffron/30 hover:bg-saffron/10">
                    <ExternalLink className="w-4 h-4 mr-2" /> LinkedIn
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* CTA Banner - Drives new users */}
          <Card className="border-saffron/20 bg-gradient-to-r from-maroon-dark to-maroon text-center overflow-hidden relative">
            {/* Decorative background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-2 left-4 text-6xl text-gold">ॐ</div>
              <div className="absolute bottom-2 right-4 text-6xl text-gold">ॐ</div>
            </div>
            <CardContent className="pt-6 relative z-10">
              <div className="text-5xl text-gold animate-pulse-glow mb-3">ॐ</div>
              <h3 className="text-2xl font-bold text-gold-light mb-2">Get Your Own Free Kundali</h3>
              <p className="text-saffron-light/80 mb-5 text-sm max-w-md mx-auto">
                Generate your free Vedic birth chart with AI-powered analysis for career, relationships, health, and more.
              </p>
              <a href="/">
                <Button className="bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-maroon-dark font-bold px-8 py-6 text-base">
                  <Star className="w-5 h-5 mr-2" /> Get Your Free Kundali Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-8 bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60">
        <div className="vedic-divider" />
        <div className="max-w-5xl mx-auto px-4 py-4 text-center">
          <p className="text-xs">AstroBidhi &bull; Vedic Astrology Wisdom &bull; Powered by VedicAstro & AI</p>
        </div>
      </footer>
    </div>
  )
}
