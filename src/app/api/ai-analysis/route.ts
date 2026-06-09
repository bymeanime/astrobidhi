import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { createHash } from 'crypto'
import { db, rawQuery, rawExecute } from '@/lib/db'

// ============ AI Provider Configuration ============
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const XAI_API_KEY = process.env.XAI_API_KEY || ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'
const XAI_MODEL = 'grok-3-mini-fast'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

type Provider = 'openrouter' | 'groq' | 'xai' | 'gemini' | 'z-ai-sdk'

// ============ Paywall Config ============
// Premium types require subscription in the future; standard types are free (one-time AI call, then cached)
const PREMIUM_TYPES = new Set(['swot_5year', 'cosmic_blueprint', 'shadow_integration'])

// ============ Rate Limit Config ============
// Per-device limits for AI analysis requests
const FREE_CHART_LIMIT = 3        // Free: 3 unique chart readings per device
const FREE_ANALYSIS_PER_CHART = 2 // Free: 2 analysis types per chart
// After limit, user sees paywall. Cached results don't count.

// ============ Cache Key Generator ============
function makeCacheKey(analysisType: string, chartData: Record<string, unknown>): string {
  // Create deterministic hash from birth details + analysis type
  const birthKey = {
    type: analysisType,
    // Use key planet/house positions for uniqueness (not entire chart to avoid minor differences)
    planets: (chartData.planets_data as { Object: string; Rasi: string; SignLonDMS: string; HouseNr: number }[])
      ?.map(p => `${p.Object}:${p.Rasi}:${p.SignLonDMS}:H${p.HouseNr}`).join('|'),
    houses: (chartData.houses_data as { HouseNr: number; Rasi: string; SignLonDMS: string }[])
      ?.map(h => `H${h.HouseNr}:${h.Rasi}:${h.SignLonDMS}`).join('|'),
  }
  return createHash('sha256').update(JSON.stringify(birthKey)).digest('hex').substring(0, 32)
}

// ============ Chart Data Compressor ============
// Reduces chart JSON from ~9500 tokens to ~1500 tokens (84% reduction)
// by stripping redundant fields and keeping only what AI needs for interpretation

interface PlanetRaw {
  Object: string; Rasi: string; isRetroGrade: string | null;
  LonDecDeg: number; SignLonDMS: string; SignLonDecDeg: number;
  LatDMS: string | null; Nakshatra: string; RasiLord: string;
  NakshatraLord: string; SubLord: string; SubSubLord: string; HouseNr: number;
}

interface HouseRaw {
  Object: string; HouseNr: number; Rasi: string;
  LonDecDeg: number; SignLonDMS: string; SignLonDecDeg: number;
  DegSize: number; Nakshatra: string; RasiLord: string;
  NakshatraLord: string; SubLord: string; SubSubLord: string;
}

interface AspectRaw {
  P1: string; P2: string; AspectType: string; AspectDeg: number; AspectOrb: number;
}

// Only keep major aspects with tight orbs (<=8°) — most of the 94 aspects are too wide to matter
const MAJOR_ASPECT_TYPES = new Set(['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'])
const MAX_ORB = 8

// Only Vedic planets for aspect filtering (skip Uranus, Neptune, Pluto, Chiron, Syzygy, Fortuna)
const VEDIC_PLANETS = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Asc'])

function compressChartData(raw: Record<string, unknown>, analysisType: string): string {
  const planets = (raw.planets_data || []) as PlanetRaw[]
  const houses = (raw.houses_data || []) as HouseRaw[]
  const aspects = (raw.planetary_aspects || []) as AspectRaw[]
  const dasa = raw.vimshottari_dasa as Record<string, unknown> | null

  const lines: string[] = []

  // --- Birth details (if present) ---
  if (raw.birth_details) {
    const bd = raw.birth_details as Record<string, unknown>
    lines.push(`Birth: ${bd.date || ''}, ${bd.time || ''}, TZ ${bd.timezone || ''}`)
    lines.push(`Location: ${bd.latitude || ''}°N, ${bd.longitude || ''}°E`)
    lines.push('')
  }

  // --- Planets — compact one-line format, skip outer planets ---
  lines.push('=== PLANETS ===')
  for (const p of planets) {
    // Skip non-Vedic bodies (Uranus, Neptune, Pluto, Chiron, Syzygy, Fortuna)
    if (!VEDIC_PLANETS.has(p.Object)) continue
    const retro = p.isRetroGrade ? '(R)' : ''
    const name = p.Object === 'Asc' ? 'Ascendant' : p.Object
    lines.push(`${name}: ${p.Rasi} ${p.SignLonDMS}${retro} | ${p.Nakshatra}(NL:${p.NakshatraLord}/SL:${p.SubLord}) | H${p.HouseNr}`)
  }

  // --- Houses — compact one-line format ---
  lines.push('')
  lines.push('=== HOUSES ===')
  for (const h of houses) {
    lines.push(`H${h.HouseNr}: ${h.Rasi} ${h.SignLonDMS} | ${h.Nakshatra}(RL:${h.RasiLord}/NL:${h.NakshatraLord}/SL:${h.SubLord})`)
  }

  // --- Aspects — deduplicated, Vedic planets only, tight orbs ---
  const seen = new Set<string>()
  const importantAspects: AspectRaw[] = []
  for (const a of aspects) {
    // Skip non-Vedic planets in aspects
    if (!VEDIC_PLANETS.has(a.P1) || !VEDIC_PLANETS.has(a.P2)) continue
    if (!MAJOR_ASPECT_TYPES.has(a.AspectType) || a.AspectOrb > MAX_ORB) continue
    // Deduplicate: sort planet names alphabetically to canonicalize pairs
    const pair = [a.P1, a.P2].sort().join('-')
    if (seen.has(pair + a.AspectType)) continue
    seen.add(pair + a.AspectType)
    importantAspects.push(a)
  }
  if (importantAspects.length > 0) {
    lines.push('')
    lines.push('=== KEY ASPECTS ===')
    for (const a of importantAspects) {
      lines.push(`${a.P1} ${a.AspectType} ${a.P2} (${a.AspectOrb.toFixed(1)}°)`)
    }
  }

  // --- Dasa — only current + upcoming periods ---
  if (dasa && typeof dasa === 'object') {
    lines.push('')
    lines.push('=== VIMSHOTTARI DASA ===')
    const compressedDasa = compressDasa(dasa)
    lines.push(...compressedDasa)
  }

  return lines.join('\n')
}

// Compress dasa: only show current + next 2 mahadasas, with their current/upcoming bhuktis
function compressDasa(dasa: Record<string, unknown>): string[] {
  const lines: string[] = []
  const now = new Date()
  const dasaEntries = Object.entries(dasa)

  let foundCurrent = false
  let futureCount = 0

  for (const [dasaLord, dasaData] of dasaEntries) {
    const d = dasaData as { start: string; end: string; bhuktis: Record<string, { start: string; end: string }> }
    const endDate = parseDasaDate(d.end)

    // Skip past dasas (but keep the one that contains now)
    if (endDate < now && !foundCurrent) continue

    if (!foundCurrent) {
      foundCurrent = true
      lines.push(`CURRENT Maha: ${dasaLord} (${d.start} → ${d.end})`)
    } else if (futureCount < 2) {
      futureCount++
      lines.push(`NEXT Maha: ${dasaLord} (${d.start} → ${d.end})`)
    } else {
      break // Only need current + 2 future
    }

    // Show current + upcoming bhuktis within this dasa
    if (d.bhuktis) {
      const bhuktiEntries = Object.entries(d.bhuktis)
      let bhuktiFutureCount = 0
      for (const [bhuktiLord, bhuktiData] of bhuktiEntries) {
        const b = bhuktiData as { start: string; end: string }
        const bEnd = parseDasaDate(b.end)

        if (bEnd < now) continue

        const prefix = bhuktiFutureCount === 0 && foundCurrent ? '  Current Bhukti' : '  Bhukti'
        if (bhuktiFutureCount < 3) {
          lines.push(`${prefix}: ${bhuktiLord} (${b.start} → ${b.end})`)
          bhuktiFutureCount++
        }
      }
    }
  }

  return lines
}

function parseDasaDate(dateStr: string): Date {
  // Format: "DD-MM-YYYY"
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
  }
  return new Date(dateStr)
}

// ============ Prompt Templates (COMPRESSED) ============
// Shortened from ~2500 tokens to ~800 tokens total across all prompts

const SYSTEM_PROMPT = `You are AstroBidhi AI, a Vedic astrology analyst (KP system, Parashari, Jaimini). Respond in structured markdown with headings, bullets, tables. Use Vedic terminology with explanations. Always include a disclaimer. Use the provided chart data precisely—do not recalculate.`

const ANALYSIS_PROMPTS: Record<string, string> = {
  overall: `Provide a comprehensive birth chart reading covering: Lagna personality, Moon sign emotional nature, key planetary placements, activated houses, yogas & challenges, and life purpose (dharma). Be personal and specific.

{chartData}`,

  career: `Career reading: 10th house/lord, 6th (service), 2nd (income), 11th (gains). How Sun/Mercury/Jupiter/Saturn influence career. Suggest specific career fields. Dasa periods for career growth. Challenges & remedies.

{chartData}`,

  relationships: `Relationship reading: 7th house/lord, Venus/Jupiter for partner nature, 5th house romance, Moon compatibility, Mangal Dosha check, marriage timing by Dasa, relationship challenges & remedies, spouse traits.

{chartData}`,

  health: `Health reading: 6th house/lord (diseases), 8th (chronic), 12th (hospitalization), Ascendant vitality. Vulnerable body areas by sign/planet. Cautious Dasa periods. Vedic remedies. Note: for awareness, not medical advice.

{chartData}`,

  finance: `Financial reading: 2nd/11th house/lords, 9th (fortune), Jupiter/Venus placements. Dhana Yogas, income sources, investment periods by Dasa, financial challenges & remedies.

{chartData}`,

  spiritual: `Spiritual reading: 9th house/lord (dharma), 12th (moksha), 5th (poorva punya), Jupiter (wisdom), Ketu (liberation). Spiritual path type (Bhakti/Jnana/Karma/Raja). Favorable periods, mantras, practices.

{chartData}`,

  dasa: `Dasa timeline reading: Current Maha & Bhukti themes, upcoming period changes, Dasa lord placement effects, key life event timing, challenging vs golden periods. Be timeline-specific.

Current Date: {currentDate}

{chartData}`,

  horary: `KP Horary answer: Direct Yes/No based on Sub-Lord theory. Moon position (querent mindset), relevant house significators, timing by Dasa/Bhukti, conditions, Sub-Lord judgment, advice.

Horary Number: {horaryNumber}

{chartData}`,

  swot_5year: `5-Year Career & Wealth Forecast (primary focus):
1. Chart foundation: Lagna, Moon/Sun signs, career/wealth planet positions, current Dasa
2. Year-by-year career predictions: growth, changes, breakthroughs, suitable industries
3. Year-by-year wealth: income growth, investment periods, windfalls, financial challenges
4. Supporting: health highlights, relationships, spiritual themes
5. Practical: gemstones, favorable periods, mantras, action steps

Current Date: {currentDate}

{chartData}`,

  cosmic_blueprint: `Cosmic Blueprint profile:
1. Core Identity: Lagna, Moon sign/Nakshatra, Sun sign
2. House-by-House (all 12): sign, lord, occupants, SubLord, standard + modern psychological interpretation
3. Ashtakvarga Assessment: house strengths (strong/medium/weak)
4. Planetary Yoga Directory: all yogas with name, category, standard + wise interpretation, scare factor
5. Panchanga: Tithi, Yoga, Karana from positions
6. Life Path: strengths, challenges, dharma, karma, career, spiritual practices

{chartData}`,

  shadow_integration: `Shadow Integration analysis:
1. Core Shadow: Lagna shadow, Moon blindspots, Rahu-Ketu obsession-liberation
2. House Vulnerability (all 12): shadow burden, vulnerability level (Low/Medium/High/Critical)
3. Shadow Frameworks: each with raw classical reading + mitigation/sublimation pathway, scare factor
4. Tragic Sublimation: destructive potential → sublimation pathway → career suggestions → daily practices
5. Deficiency Map: weak vs strong houses, energy drainage pathways
6. Integration Protocol: top 3 shadows to address, warning periods, remedies, psychological practices

Current Date: {currentDate}

{chartData}`,
}

// ============ Provider Call Functions ============

async function callGeminiAPI(prompt: string, retries = 2): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 4096, topP: 0.95, topK: 40 },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        if (errorMessage.includes('quota') || errorMessage.includes('exceeded')) throw new Error(`Gemini: ${errorMessage}`)
        if (response.status === 429 && attempt < retries - 1) { await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)); continue }
        throw new Error(`Gemini: ${errorMessage}`)
      }

      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Empty response from Gemini')
      return text
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw new Error('Gemini: Failed after retries')
}

async function callGroqAPI(prompt: string, retries = 1): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('Groq API key not configured')

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          temperature: 0.8, max_tokens: 4096, top_p: 0.95,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        if (response.status === 401 || response.status === 403) throw new Error(`Groq: ${errorMessage}`)
        if (response.status === 429 && attempt < retries - 1) { await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)); continue }
        throw new Error(`Groq: ${errorMessage}`)
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response from Groq')
      return text
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw new Error('Groq: Failed after retries')
}

async function callOpenRouterAPI(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured')

  const errors: string[] = []
  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://astrobidhi.space-z.ai',
          'X-Title': 'AstroBidhi',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          temperature: 0.8, max_tokens: 4096,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        if (response.status === 401 || response.status === 403) throw new Error(`OpenRouter: ${errorMessage}`)
        errors.push(`${model}: ${errorMessage}`)
        continue
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (!text) { errors.push(`${model}: Empty response`); continue }
      console.log(`[AI] OpenRouter using ${model}`)
      return text
    } catch (error: unknown) {
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) throw error
      errors.push(`${model}: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }
  throw new Error(`OpenRouter: All models failed — ${errors.join('; ')}`)
}

async function callXaiAPI(prompt: string, retries = 1): Promise<string> {
  if (!XAI_API_KEY) throw new Error('xAI API key not configured')

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(XAI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
        body: JSON.stringify({
          model: XAI_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          temperature: 0.8, max_tokens: 4096,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        if (response.status === 401 || response.status === 403) throw new Error(`xAI: ${errorMessage}`)
        if (response.status === 429 && attempt < retries - 1) { await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)); continue }
        throw new Error(`xAI: ${errorMessage}`)
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response from xAI')
      return text
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw new Error('xAI: Failed after retries')
}

async function callZaiSDK(prompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    temperature: 0.7, max_tokens: 4096,
  })
  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error('Empty response from z-ai-sdk')
  return text
}

// ============ Whop Session Helper ============
function getWhopUserId(request: NextRequest): string | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  try {
    const session = JSON.parse(Buffer.from(cookie, 'base64').toString()) as { userId: string }
    return session.userId || null
  } catch {
    return null
  }
}

// ============ Main Handler ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { analysisType, chartData, horaryNumber, provider: requestedProvider, forceRefresh } = body

    if (!analysisType || !chartData) {
      return NextResponse.json({ detail: 'analysisType and chartData are required' }, { status: 400 })
    }

    const template = ANALYSIS_PROMPTS[analysisType]
    if (!template) {
      return NextResponse.json({ detail: `Invalid analysis type. Valid: ${Object.keys(ANALYSIS_PROMPTS).join(', ')}` }, { status: 400 })
    }

    // ---- Device ID ----
    const deviceId = body.deviceId
    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId is required. Enable localStorage in your browser.' }, { status: 400 })
    }

    // ---- Paywall check ----
    const isPremium = PREMIUM_TYPES.has(analysisType)

    // ---- Rate limit check ----
    // Count unique charts this device has read (non-cached)
    // Count analysis types used per chart for this device
    const cacheKey = makeCacheKey(analysisType, chartData)

    try {
      // Has this device already used an analysis for this exact cacheKey?
      const existingUsage = await db.deviceUsage.findFirst({
        where: { deviceId, cacheKey }
      })

      if (!existingUsage) {
        // New analysis for this chart — check limits
        const uniqueChartsUsed = await db.deviceUsage.groupBy({
          by: ['cacheKey'],
          where: { deviceId },
        })
        const chartsCount = uniqueChartsUsed.length

        // Check per-chart analysis limit
        const analysesForThisChart = await db.deviceUsage.findMany({
          where: { deviceId, cacheKey },
        })

        if (chartsCount >= FREE_CHART_LIMIT && analysesForThisChart.length === 0) {
          // Device has used all free charts AND this is a new chart
          return NextResponse.json({
            detail: `Free limit reached (${FREE_CHART_LIMIT} charts). Subscribe for unlimited readings.`,
            limitReached: true,
            limitType: 'charts',
            limit: FREE_CHART_LIMIT,
            used: chartsCount,
          }, { status: 429 })
        }

        if (analysesForThisChart.length >= FREE_ANALYSIS_PER_CHART) {
          // Device has used all free analysis types for this chart
          return NextResponse.json({
            detail: `Free limit reached (${FREE_ANALYSIS_PER_CHART} analyses per chart). Subscribe for all analysis types.`,
            limitReached: true,
            limitType: 'analyses_per_chart',
            limit: FREE_ANALYSIS_PER_CHART,
            used: analysesForThisChart.length,
          }, { status: 429 })
        }
      }
    } catch (dbError) {
      console.log('[AI] Rate limit check failed (DB not ready?), proceeding:', dbError instanceof Error ? dbError.message : 'unknown')
    }

    // ---- Cache check ----
    console.log(`[AI] Cache lookup: type=${analysisType}, key=${cacheKey}, forceRefresh=${!!forceRefresh}`)
    if (!forceRefresh) {
      try {
        const cached = await db.cachedAnalysis.findUnique({ where: { cacheKey } })
        if (cached) {
          console.log(`[AI] Cache HIT for ${analysisType} (${cacheKey}), saved ${new Date(cached.createdAt).toISOString()}`)

          // Record UserAnalysis for Whop-authenticated users (even on cache hit)
          const whopUserId = getWhopUserId(request)
          if (whopUserId) {
            try {
              const existing = await rawQuery<{ id: string }>(
                `SELECT id FROM UserAnalysis WHERE whopUserId = ? AND cacheKey = ? AND analysisType = ?`,
                [whopUserId, cacheKey, analysisType]
              )
              if (existing.length === 0) {
                const birthDetails = JSON.stringify({
                  year: (chartData as Record<string, unknown>).year || (chartData as Record<string, unknown>).birth_details,
                  month: (chartData as Record<string, unknown>).month,
                  day: (chartData as Record<string, unknown>).day,
                  hour: (chartData as Record<string, unknown>).hour,
                  minute: (chartData as Record<string, unknown>).minute,
                  latitude: (chartData as Record<string, unknown>).latitude,
                  longitude: (chartData as Record<string, unknown>).longitude,
                  utc: (chartData as Record<string, unknown>).utc,
                  ayanamsa: (chartData as Record<string, unknown>).ayanamsa,
                })
                await rawExecute(
                  `INSERT INTO UserAnalysis (id, whopUserId, analysisType, cacheKey, birthDetails, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                  [`ua_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, whopUserId, analysisType, cacheKey, birthDetails]
                )
              }
            } catch {}
          }

          return NextResponse.json({
            analysis: cached.result,
            analysisType: cached.analysisType,
            provider: cached.provider,
            cached: true,
            isPremium,
            cachedAt: cached.createdAt,
          })
        } else {
          console.log(`[AI] Cache MISS for ${analysisType} (${cacheKey}) — will call AI`)
        }
      } catch (dbError) {
        console.log('[AI] Cache read failed (DB not ready?), proceeding with AI call:', dbError instanceof Error ? dbError.message : 'unknown')
      }
    } else {
      console.log(`[AI] Force refresh requested — skipping cache`)
    }

    // ---- COMPRESS chart data ----
    const compressedChart = compressChartData(chartData, analysisType)
    console.log(`[AI] Chart compressed: ${JSON.stringify(chartData).length} → ${compressedChart.length} chars`)

    // ---- Build prompt ----
    let prompt = template
      .replace('{chartData}', compressedChart)
      .replace('{currentDate}', new Date().toISOString().split('T')[0])
    if (horaryNumber) prompt = prompt.replace('{horaryNumber}', String(horaryNumber))

    // ---- Call AI providers ----
    let analysis: string | null = null
    let usedProvider: Provider = 'z-ai-sdk'
    const errors: string[] = []

    console.log(`[AI] Keys — OR:${!!OPENROUTER_API_KEY} GM:${!!GEMINI_API_KEY} GQ:${!!GROQ_API_KEY} xAI:${!!XAI_API_KEY}`)

    const providerOrder: Provider[] = requestedProvider
      ? [requestedProvider as Provider, ...(['openrouter', 'groq', 'xai', 'gemini', 'z-ai-sdk'] as Provider[]).filter(p => p !== requestedProvider)]
      : ['openrouter', 'groq', 'xai', 'gemini', 'z-ai-sdk']

    for (const provider of providerOrder) {
      try {
        switch (provider) {
          case 'openrouter':
            if (!OPENROUTER_API_KEY) { errors.push('OpenRouter: No API key'); continue }
            analysis = await callOpenRouterAPI(prompt)
            usedProvider = 'openrouter'; break
          case 'gemini':
            if (!GEMINI_API_KEY) { errors.push('Gemini: No API key'); continue }
            analysis = await callGeminiAPI(prompt)
            usedProvider = 'gemini'; break
          case 'groq':
            if (!GROQ_API_KEY) { errors.push('Groq: No API key'); continue }
            analysis = await callGroqAPI(prompt)
            usedProvider = 'groq'; break
          case 'xai':
            if (!XAI_API_KEY) { errors.push('xAI: No API key'); continue }
            analysis = await callXaiAPI(prompt)
            usedProvider = 'xai'; break
          case 'z-ai-sdk':
            analysis = await callZaiSDK(prompt)
            usedProvider = 'z-ai-sdk'; break
        }
        if (analysis) { console.log(`[AI] Success: ${usedProvider}`); break }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${provider}: ${errMsg}`)
        console.log(`[AI] ${provider} failed:`, errMsg)
      }
    }

    if (!analysis) {
      const keyHint = !OPENROUTER_API_KEY && !GEMINI_API_KEY && !GROQ_API_KEY && !XAI_API_KEY
        ? ' No API keys loaded! Add OPENROUTER_API_KEY in Railway Variables.'
        : ''
      return NextResponse.json({ detail: `All AI providers failed.${keyHint} Errors: ${errors.join(' | ')}`, providerErrors: errors }, { status: 503 })
    }

    // ---- Save to cache ----
    try {
      await db.cachedAnalysis.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          analysisType,
          chartData: compressedChart,
          result: analysis,
          provider: usedProvider,
        },
        update: {
          result: analysis,
          provider: usedProvider,
        },
      })
      console.log(`[AI] Cached ${analysisType} (${cacheKey}) via ${usedProvider}`)
    } catch (dbError) {
      console.log('[AI] Cache write failed:', dbError instanceof Error ? dbError.message : 'unknown')
    }

    // ---- Record device usage ----
    try {
      await db.deviceUsage.create({
        data: {
          deviceId,
          analysisType,
          cacheKey,
        },
      })
      console.log(`[AI] Usage recorded: device=${deviceId.substring(0, 8)}..., type=${analysisType}`)
    } catch (dbError) {
      console.log('[AI] Usage recording failed:', dbError instanceof Error ? dbError.message : 'unknown')
    }

    // ---- Record UserAnalysis for Whop-authenticated users ----
    const whopUserId = getWhopUserId(request)
    if (whopUserId) {
      try {
        // Extract birth details for display
        const birthDetails = JSON.stringify({
          year: (chartData as Record<string, unknown>).year || (chartData as Record<string, unknown>).birth_details,
          month: (chartData as Record<string, unknown>).month,
          day: (chartData as Record<string, unknown>).day,
          hour: (chartData as Record<string, unknown>).hour,
          minute: (chartData as Record<string, unknown>).minute,
          latitude: (chartData as Record<string, unknown>).latitude,
          longitude: (chartData as Record<string, unknown>).longitude,
          utc: (chartData as Record<string, unknown>).utc,
          ayanamsa: (chartData as Record<string, unknown>).ayanamsa,
        })

        // Check if already linked
        const existing = await rawQuery<{ id: string }>(
          `SELECT id FROM UserAnalysis WHERE whopUserId = ? AND cacheKey = ? AND analysisType = ?`,
          [whopUserId, cacheKey, analysisType]
        )

        if (existing.length === 0) {
          await rawExecute(
            `INSERT INTO UserAnalysis (id, whopUserId, analysisType, cacheKey, birthDetails, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [`ua_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, whopUserId, analysisType, cacheKey, birthDetails]
          )
          console.log(`[AI] UserAnalysis recorded for Whop user ${whopUserId.substring(0, 8)}...`)
        }

        // Upsert UserAccount
        const existingAccount = await rawQuery<{ id: string }>(
          `SELECT id FROM UserAccount WHERE whopUserId = ?`,
          [whopUserId]
        )
        if (existingAccount.length === 0) {
          await rawExecute(
            `INSERT INTO UserAccount (id, whopUserId, primaryDeviceId, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [`uacc_${Date.now()}`, whopUserId, deviceId]
          )
        } else {
          await rawExecute(
            `UPDATE UserAccount SET primaryDeviceId = ?, updatedAt = CURRENT_TIMESTAMP WHERE whopUserId = ?`,
            [deviceId, whopUserId]
          )
        }
      } catch (uaError) {
        console.log('[AI] UserAnalysis recording failed:', uaError instanceof Error ? uaError.message : 'unknown')
      }
    }

    return NextResponse.json({ analysis, analysisType, provider: usedProvider, cached: false, isPremium })
  } catch (error: unknown) {
    console.error('AI Analysis error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate AI analysis'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
