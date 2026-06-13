import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { createHash, randomUUID } from 'crypto'
import { rawQuery, rawExecute, initDb } from '@/lib/db'

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
// Premium types are now determined by PremiumCatalog table instead of hardcoded set
// The checkDeviceAccess function queries PremiumCatalog to determine if an analysisType is premium

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

  vedic_master: `Strict Vedic Jyotishi Master Reading (Parashara/Jaimini/KP system — state which you use):
1. Verification: Confirm Lagna degree, verify chart data integrity
2. Lagna Deep Analysis: Ascendant lord, strength, aspects, Arudha Lagna
3. Planetary Summary: Each graha — sign, house, dignity, aspects, retrograde effects
4. Divisional Charts: D9 (Navamsha), D10 (Dashamsha), D12 (Dwadamsha) key findings
5. Yogas: Identify ALL yogas (Raj, Dhana, Daridra, Kemadruma, etc.) with activation status
6. Ashtakavarga: Total & Bhinna scores for key houses
7. Dasa Effects: Current + next 2 Maha periods, event timing
8. Blunt Strengths & Weaknesses: No sugar-coating
9. Karmic Verdict: This life's core lesson and path

Use ONLY sidereal Lahiri ayanamsa. NO Western astrology references.

{chartData}`,

  trik_bhava: `Trik Bhava Deep Analysis (6th/8th/12th houses — Dusthana):
1. Dominant Trik Energy: Which house dominates, ruling planet's influence on psyche
2. 6th House: Enemies, debts, diseases, service — karmic lessons in struggle
3. 8th House: Transformation, hidden wealth, chronic issues, sudden events, longevity indicators
4. 12th House: Losses, moksha potential, foreign connections, sleep, subconscious patterns
5. Karmic-Psychological Insight: How Trik houses shape your inner world
6. Relationship Snapshots (4-5): Honest love judgments based on Trik influences
7. Career Snapshots (4-5): Where struggle transforms into strength
8. Future Love/Marriage Trajectory: When and how Trik energy shifts in relationships
9. Future Career Trajectory: Turning struggles into power
10. Trik Closing: Transform your Dusthana into your greatest gift

{chartData}`,

  forecast_12month: `12-Month Deep Forecast:
1. Current Transits: Major planetary transits affecting your chart NOW
2. Career Shifts: Job changes, promotions, business opportunities in next 12 months
3. Money Patterns: Income trends, investment windows, expense periods
4. Emotional Cycles: Mental health periods, stress windows, joy periods
5. Hidden Opportunities: What's brewing beneath the surface
6. Key Turning Points: Exact months where life pivots
7. Love Life: Relationship developments, marriage windows, singles' prospects
8. Financial Outlook: Month-by-month wealth guidance
9. Practical Action Items: What to DO each quarter

Be specific with months and dates. Reference Dasa periods and transits.

Current Date: {currentDate}

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

  life_decoder: `Life Decoder (Numerology + Chart Deep Dive):
Using birth date for numerology:
1. Life Path Number: Core purpose and destiny
2. Destiny Number: What you're meant to become
3. Soul Urge Number: Inner motivations and desires
Combined with chart analysis:
4. Personality Traits: Confirmed and hidden from chart
5. Hidden Strengths: Talents you don't fully use yet
6. Blindspot Weaknesses: Patterns that sabotage you
7. Destiny Blueprint: The intersection of numbers and planets
8. Single Biggest Life Purpose: One sentence that defines your mission

{chartData}`,

  career_destiny: `Career Destiny Finder:
1. Natural Talents: What you were born to do (chart-based)
2. Decision-Making Style: How you process choices (Mercury/Moon analysis)
3. Top 3 Career/Business Paths: Where extraordinary success is destined — be specific with industries and roles
4. 1 Field to Avoid: Where you'll struggle no matter how hard you try
5. Authority vs Independence: Does your success come through hierarchy or autonomy?
6. Growth Pattern: Linear, exponential, or cyclical — and what it means
7. Timing: When career breakthroughs are most likely (Dasa-based)
8. Action Plan: 3 immediate steps toward your destined career

{chartData}`,

  relationship_destiny: `Deep Relationship Destiny Analysis:
1. Compatible Partner Types: Specific personality traits your chart attracts
2. Love Lessons: What each relationship teaches you (5th/7th/9th house analysis)
3. Hidden Compatibility Patterns: What you truly need vs what you think you want
4. Red Flags You Overlook: Patterns you repeatedly miss in partners
5. Exact Traits of Growth Partner: The partner who accelerates your evolution
6. Trust Patterns: How you give and receive trust (Venus/Moon analysis)
7. Intimacy Blocks: What prevents deep connection
8. Emotional Withdrawal Patterns: When and why you pull away
9. Marriage Timeline: Dasa-based windows for commitment
10. Relationship Remedy: One practice to transform your love life

{chartData}`,

  soul_purpose: `Soul Purpose & Life Mission:
1. Core Mission: Why your soul chose this lifetime (9th/12th house + Atmakaraka)
2. Lessons to Learn: Karmic debts and growth edges
3. Contribution to Make: What you're here to give humanity
4. Dharma vs Karma: Your righteous path vs karmic baggage
5. Soul Contracts: Key people and situations pre-arranged
6. Actionable Daily Alignment Steps: 5 things to do every day
7. How to Start Living on Purpose Today: Immediate action plan
8. Signs You're On Track: Indicators of alignment
9. Signs You're Off Track: Warning signals from the universe

{chartData}`,

  wealth_code: `Wealth & Abundance Code:
1. Money Personality: Spender/saver/investor based on chart
2. Mental Blocks Limiting Income: Subconscious patterns from planetary positions
3. Exact Wealth Attraction Strategy: Personalized for your chart (not generic advice)
4. Natural Financial Talents: What makes money come easily to you
5. Mistakes Blocking Growth: Financial self-sabotage patterns
6. Wealth-Building Strategy: Fits your true nature — not someone else's
7. 2nd/11th House Deep Dive: Income sources and gain channels
8. Dhana Yogas: Activation timing and how to maximize
9. Dasa-Based Wealth Windows: When to invest, save, and spend
10. Money Mantra: One guiding principle for your financial life

{chartData}`,

  future_timeline: `Future Timeline & 5-Year Roadmap:
1. Key Turning Points: Past events that shaped you (confirm chart accuracy)
2. Current Phase: Where you are RIGHT NOW in your life cycle
3. Next 5 Years — Year by Year:
   - Year 1: Foundation/shift period
   - Year 2: Growth/expansion
   - Year 3: Breakthrough/crossroads
   - Year 4: Consolidation/mastery
   - Year 5: Harvest/new beginning
4. Transformation Phases: When identity shifts occur
5. Ideal 5-Year Route: Best-case path aligned with your chart
6. Age-Based Life Stage Analysis: What this decade is fundamentally about
7. Unconscious Strengths Being Developed: Skills growing beneath awareness
8. Opportunities Uniquely Positioned For: Advantages only YOU have right now

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

// ============ Device Access Helper (Granular) ============
// Checks DeviceAccess table for specific analysisType, 'all_premium', and 'unlimited' grants
// Falls back to UserAccess table for backward compatibility
// Also checks PremiumCatalog to determine if an analysisType is premium
async function checkDeviceAccess(deviceId: string, analysisType: string): Promise<{
  isPremium: boolean
  hasAccess: boolean
  hasAllPremium: boolean
  hasUnlimited: boolean
}> {
  try {
    await initDb()

    // 1. Check PremiumCatalog to determine if this analysisType is premium
    const catalogEntry = await rawQuery<{ id: string; isActive: number }>(
      `SELECT id, isActive FROM PremiumCatalog WHERE analysisType = ?`,
      [analysisType]
    )
    const isPremium = catalogEntry.length > 0 && catalogEntry[0].isActive === 1

    // If not premium, access is free
    if (!isPremium) {
      return { isPremium: false, hasAccess: true, hasAllPremium: false, hasUnlimited: false }
    }

    // 2. Check DeviceAccess table for this specific analysisType
    const deviceAccessGrants = await rawQuery<{
      analysisType: string
      source: string
      expiresAt: string | null
    }>(
      `SELECT analysisType, source, expiresAt FROM DeviceAccess WHERE deviceId = ?`,
      [deviceId]
    )

    const now = new Date().toISOString()
    const activeGrants = deviceAccessGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    // Check for specific type grant
    const hasSpecificAccess = activeGrants.some(g => g.analysisType === analysisType)

    // Check for 'all_premium' grant
    const hasAllPremium = activeGrants.some(g => g.analysisType === 'all_premium')

    // Check for 'unlimited' grant
    const hasUnlimited = activeGrants.some(g => g.analysisType === 'unlimited')

    // If DeviceAccess grants access, return immediately
    if (hasSpecificAccess || hasAllPremium || hasUnlimited) {
      return { isPremium: true, hasAccess: true, hasAllPremium, hasUnlimited }
    }

    // 3. Fall back to UserAccess table for backward compatibility
    const legacyGrants = await rawQuery<{
      accessLevel: string
      expiresAt: string | null
    }>(
      `SELECT accessLevel, expiresAt FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )

    const activeLegacyGrants = legacyGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)

    const legacyUnlimited = activeLegacyGrants.some(g => g.accessLevel === 'unlimited')
    const legacyPremium = legacyUnlimited || activeLegacyGrants.some(g => g.accessLevel === 'premium')

    return {
      isPremium: true,
      hasAccess: legacyPremium,
      hasAllPremium: legacyPremium,
      hasUnlimited: legacyUnlimited,
    }
  } catch {
    // If DB check fails, don't block access — degrade gracefully
    return { isPremium: false, hasAccess: true, hasAllPremium: false, hasUnlimited: false }
  }
}

// ============ Whop Access Helper ============
// Returns whether the user has Whop membership access (premium)
async function checkWhopAccess(request: NextRequest): Promise<boolean> {
  const whopUserId = getWhopUserId(request)
  if (!whopUserId) return false

  try {
    const { checkUserAccess } = await import('@/lib/whop')
    const access = await checkUserAccess(whopUserId)
    return access.hasAccess
  } catch {
    return false
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
    // Check granular device access (queries PremiumCatalog + DeviceAccess + UserAccess)
    const deviceAccess = await checkDeviceAccess(deviceId, analysisType)
    const isPremium = deviceAccess.isPremium

    // Check Whop access as additional channel
    const whopHasAccess = await checkWhopAccess(request)

    const hasPremiumAccess = deviceAccess.hasAccess || whopHasAccess
    const hasUnlimitedAccess = deviceAccess.hasUnlimited || (whopHasAccess && deviceAccess.hasAllPremium)

    // If premium type and no access, return 403
    if (isPremium && !hasPremiumAccess) {
      return NextResponse.json({
        detail: 'This premium analysis requires a subscription or admin-granted access.',
        premiumRequired: true,
        analysisType,
      }, { status: 403 })
    }

    // ---- Rate limit check ----
    // Count unique charts this device has read (non-cached)
    // Count analysis types used per chart for this device
    // Users with any premium/unlimited access bypass rate limits entirely
    const cacheKey = makeCacheKey(analysisType, chartData)

    if (!hasPremiumAccess) {
      try {
        await initDb()

        // Has this device already used an analysis for this exact cacheKey?
        const existingUsage = await rawQuery<{ id: string; cacheKey: string }>(
          `SELECT id, cacheKey FROM DeviceUsage WHERE deviceId = ? AND cacheKey = ? LIMIT 1`,
          [deviceId, cacheKey]
        )

        if (existingUsage.length === 0) {
          // New analysis for this chart — check limits
          // Count unique charts (by distinct cacheKey) this device has used
          const allUsages = await rawQuery<{ cacheKey: string }>(
            `SELECT DISTINCT cacheKey FROM DeviceUsage WHERE deviceId = ?`,
            [deviceId]
          )
          const uniqueCacheKeys = new Set(allUsages.map(u => u.cacheKey))
          const chartsCount = uniqueCacheKeys.size

          // Count how many analysis types this device has used for this chart's cacheKey
          const analysesForThisChart = await rawQuery<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM DeviceUsage WHERE deviceId = ? AND cacheKey = ?`,
            [deviceId, cacheKey]
          )
          const analysesCount = analysesForThisChart[0]?.cnt || 0

          if (chartsCount >= FREE_CHART_LIMIT && !uniqueCacheKeys.has(cacheKey)) {
            // Device has used all free charts AND this is a new chart
            return NextResponse.json({
              detail: `Free limit reached (${FREE_CHART_LIMIT} charts). Subscribe for unlimited readings.`,
              limitReached: true,
              limitType: 'charts',
              limit: FREE_CHART_LIMIT,
              used: chartsCount,
            }, { status: 429 })
          }

          // Check per-chart analysis limit
          if (analysesCount >= FREE_ANALYSIS_PER_CHART) {
            // Device has used all free analysis types for this chart
            return NextResponse.json({
              detail: `Free limit reached (${FREE_ANALYSIS_PER_CHART} analyses per chart). Subscribe for all analysis types.`,
              limitReached: true,
              limitType: 'analyses_per_chart',
              limit: FREE_ANALYSIS_PER_CHART,
              used: analysesCount,
            }, { status: 429 })
          }
        }
      } catch (dbError) {
        console.log('[AI] Rate limit check failed (DB not ready?), proceeding:', dbError instanceof Error ? dbError.message : 'unknown')
      }
    }

    // ---- Cache check ----
    console.log(`[AI] Cache lookup: type=${analysisType}, key=${cacheKey}, forceRefresh=${!!forceRefresh}`)
    if (!forceRefresh) {
      try {
        await initDb()
        const cachedRows = await rawQuery<{
          cacheKey: string; analysisType: string; chartData: string;
          result: string; provider: string; createdAt: string;
        }>(
          `SELECT cacheKey, analysisType, chartData, result, provider, createdAt FROM CachedAnalysis WHERE cacheKey = ?`,
          [cacheKey]
        )
        const cached = cachedRows[0] || null
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
    let cacheWriteSuccess = false
    try {
      await initDb()
      // Use INSERT OR REPLACE for upsert behavior (matches chart caching pattern)
      await rawExecute(
        `INSERT OR REPLACE INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [randomUUID(), cacheKey, analysisType, compressedChart, analysis, usedProvider]
      )
      console.log(`[AI] Cached ${analysisType} (${cacheKey}) via ${usedProvider}`)
      cacheWriteSuccess = true
    } catch (dbError) {
      console.error('[AI] Cache write FAILED (attempt 1):', dbError instanceof Error ? dbError.message : 'unknown')
      // Fallback: try with explicit timestamp
      try {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
        await rawExecute(
          `INSERT OR REPLACE INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), cacheKey, analysisType, compressedChart, analysis, usedProvider, now]
        )
        console.log(`[AI] Cached ${analysisType} (${cacheKey}) via ${usedProvider} (fallback timestamp)`)
        cacheWriteSuccess = true
      } catch (fbError) {
        console.error('[AI] Cache write fallback also FAILED:', fbError instanceof Error ? fbError.message : 'unknown')
      }
    }

    // ---- Verify cache write ----
    if (cacheWriteSuccess) {
      try {
        const verifyRows = await rawQuery<{ cacheKey: string }>(
          `SELECT cacheKey FROM CachedAnalysis WHERE cacheKey = ?`,
          [cacheKey]
        )
        if (verifyRows.length > 0) {
          console.log(`[AI] Cache write VERIFIED for ${analysisType} (${cacheKey})`)
        } else {
          console.error(`[AI] Cache write VERIFICATION FAILED — row not found for ${analysisType} (${cacheKey}). Retrying...`)
          // Retry once more
          try {
            await rawExecute(
              `INSERT OR REPLACE INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
              [randomUUID(), cacheKey, analysisType, compressedChart, analysis, usedProvider]
            )
            console.log(`[AI] Cache retry SUCCEEDED for ${analysisType} (${cacheKey})`)
          } catch (retryError) {
            console.error('[AI] Cache retry FAILED:', retryError instanceof Error ? retryError.message : 'unknown')
          }
        }
      } catch (verifyError) {
        console.error('[AI] Cache verification query FAILED:', verifyError instanceof Error ? verifyError.message : 'unknown')
      }
    }

    // ---- Record device usage ----
    try {
      await initDb()
      const usageId = randomUUID()
      await rawExecute(
        `INSERT INTO DeviceUsage (id, deviceId, analysisType, cacheKey, createdAt) VALUES (?, ?, ?, ?, datetime('now'))`,
        [usageId, deviceId, analysisType, cacheKey]
      )
      console.log(`[AI] Usage recorded: device=${deviceId.substring(0, 8)}..., type=${analysisType}`)
      // Verify usage write
      const verifyUsage = await rawQuery<{ id: string }>(
        `SELECT id FROM DeviceUsage WHERE id = ?`,
        [usageId]
      )
      if (verifyUsage.length === 0) {
        console.error(`[AI] Usage recording VERIFICATION FAILED — retrying with explicit timestamp`)
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
        await rawExecute(
          `INSERT INTO DeviceUsage (id, deviceId, analysisType, cacheKey, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [`du_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, deviceId, analysisType, cacheKey, now]
        )
      }
    } catch (dbError) {
      console.error('[AI] Usage recording FAILED:', dbError instanceof Error ? dbError.message : 'unknown')
      // Fallback: try with explicit timestamp
      try {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
        await rawExecute(
          `INSERT INTO DeviceUsage (id, deviceId, analysisType, cacheKey, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [`du_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, deviceId, analysisType, cacheKey, now]
        )
        console.log(`[AI] Usage recorded (fallback timestamp): device=${deviceId.substring(0, 8)}..., type=${analysisType}`)
      } catch (fbError) {
        console.error('[AI] Usage recording fallback also FAILED:', fbError instanceof Error ? fbError.message : 'unknown')
      }
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
