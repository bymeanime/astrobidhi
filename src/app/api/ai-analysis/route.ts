import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { createHash, randomUUID } from 'crypto'
import { rawQuery, rawExecute, initDb } from '@/lib/db'
import { decodeSession } from '@/lib/whop'

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

const SYSTEM_PROMPT = `You are AstroBidhi AI, a Vedic astrology analyst (KP system, Parashari, Jaimini). Use the provided chart data precisely—do not recalculate.

FORMATTING GUIDELINES:
- Follow the structure outlined in each specific analysis prompt (some use numbered sections, some use ## headings — follow whichever the prompt provides)
- Use Markdown: **bold** for planet names and key terms, - bullets for lists, ## headings where appropriate
- Use Vedic terminology with brief explanations for non-experts
- Be personal and specific — reference actual placements from the chart data, not generic sign descriptions
- Do NOT wrap your response in code fences
- Do NOT start with "Here is..." or "Sure!..." — go straight to the analysis
- End with: *This analysis is AI-generated Vedic astrological guidance. For major life decisions, please consult a qualified astrologer.*`

const ANALYSIS_PROMPTS: Record<string, string> = {
  overall: `Provide a comprehensive birth chart reading. Structure your response as:

## Core Personality
- Lagna (Ascendant) sign, lord placement, and what it reveals about your outer personality and approach to life
- Moon sign and Nakshatra — your emotional nature, inner self, and mental tendencies
- Sun sign — your ego, vitality, and soul purpose

## Key Planetary Placements
- For each significant planet (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu): sign, house, key dignity, and what it means for you
- Highlight any exalted, debilitated, or retrograde planets

## Activated Houses
- Identify the strongest houses in your chart and what life areas they govern
- Note any house with multiple planet concentrations

## Yogas & Challenges
- Name and explain any major yogas present (Raja Yoga, Dhana Yoga, Gaja Kesari, etc.)
- Identify key challenges (Mangal Dosha, Kaal Sarp, Sade Sati, etc.) and their intensity

## Life Purpose (Dharma)
- What your chart suggests as your soul's mission
- Strengths to lean into and weaknesses to transcend

## Current Dasa Influence
- How your current Mahadasha-Bhukti period is shaping your life right now

Be personal and specific — reference actual placements from the chart data, not generic sign descriptions.

{chartData}`,

  career: `Career & Profession reading. Structure your response as:

## Career Indicators in Your Chart
- 10th house (Karma Bhava): sign, lord placement, and what it says about your ideal profession
- 6th house (service/employment): shows your work environment and daily routine
- 2nd house (income): earning capacity and sources
- 11th house (gains): fulfillment of desires and network success

## Key Career Planets
- **Sun**: authority, government, leadership roles
- **Mercury**: communication, commerce, intellect-based careers
- **Jupiter**: wisdom, teaching, advisory, expansion
- **Saturn**: persistence, structure, delayed but lasting success
- Analyze each based on their placement in your chart

## Recommended Career Fields
- List 4-5 specific industries/roles that align with your chart
- Explain WHY each is a match (which placement supports it)

## Career Growth Periods
- Current Dasa period and its career impact
- Upcoming favorable periods for job changes, promotions, or business launches
- Challenging periods to navigate carefully

## Challenges & Remedies
- Career obstacles indicated in your chart
- Specific Vedic remedies (gemstones, mantras, actions) to strengthen career prospects

Reference actual planet positions and house lords from the chart data.

{chartData}`,

  relationships: `Love & Marriage reading. Structure your response as:

## Relationship Indicators
- 7th house (Kalatra Bhava): sign, lord placement, and what it reveals about your partner and marriage
- Venus (for men) / Jupiter (for women): karaka planets for romance and spouse
- 5th house: romance, courtship, and creative love
- Moon sign: emotional compatibility needs

## Partner Characteristics
- Physical, mental, and professional traits of your likely partner
- Where you might meet them
- Their background or origin

## Marriage Timing
- Current and upcoming Dasa periods favorable for marriage
- Specific age ranges when marriage is most likely
- Any delays indicated and their reasons

## Compatibility Analysis
- What moon sign/nakshatra would be most compatible with yours
- Key qualities to look for in a partner

## Mangal Dosha Check
- Whether Mangal Dosha is present and its intensity
- Cancellations if any
- Remedies if applicable

## Challenges & Remedies
- Relationship obstacles in your chart
- Vedic remedies to harmonize relationships

Reference actual 7th house lord, Venus/Jupiter placement, and Moon Nakshatra from the chart data.

{chartData}`,

  health: `Health & Wellness reading. Structure your response as:

## Health Indicators in Your Chart
- Ascendant (Lagna): overall vitality and body constitution
- 6th house (Roga Bhava): diseases and health challenges
- 8th house: chronic conditions and longevity
- 12th house: hospitalization and hidden ailments

## Vulnerable Body Areas
- Based on your Ascendant sign, which body parts are most sensitive
- Based on afflicted planets, which systems (digestive, nervous, etc.) need care
- Specific health concerns indicated by planet placements in 6th/8th/12th houses

## Cautious Periods
- Dasa periods when health needs extra attention
- Planetary transits that may trigger issues
- Age ranges of vulnerability

## Vedic Remedies
- Gemstones to strengthen benefic health planets
- Mantras for healing
- Lifestyle and dietary recommendations based on your chart

## Constitution Type
- Your Ayurvedic dosha (Vata/Pitta/Kapha) based on chart
- Recommended practices for balance

⚠️ Note: This reading is for awareness and astrological insight, not medical advice. Always consult healthcare professionals for medical concerns.

Reference actual Ascendant, 6th house, and afflicted planets from the chart data.

{chartData}`,

  finance: `Wealth & Finance reading. Structure your response as:

## Wealth Indicators
- 2nd house (Dhana Bhava): accumulated wealth, savings capacity
- 11th house (Labha Bhava): income, gains, and fulfillment of desires
- 9th house (Bhagya): fortune and luck that supports wealth
- Jupiter and Venus placements: karaka planets for prosperity

## Dhana Yogas Present
- Identify any wealth-combination yogas in your chart (Dhana Yoga, Lakshmi Yoga, etc.)
- Explain what each means and how strong it is
- Note any poverty-indicating combinations (Daridra Yoga) and their cancellations

## Income Sources
- Best earning avenues based on your chart (job, business, investments, inheritance, etc.)
- Industries or fields where wealth flows most easily
- Whether you're better suited for earned income or windfall/investment gains

## Favorable Wealth Periods
- Current Dasa period and its financial impact
- Upcoming periods for major income growth or windfalls
- Challenging periods for expenses and losses — plan accordingly

## Investment Guidance
- Best investment types for your chart (real estate, stocks, gold, business, etc.)
- Timing for major purchases or investments

## Financial Challenges & Remedies
- Obstacles to wealth accumulation
- Vedic remedies (gemstones, mantras, charity) to remove financial blockages

Reference actual 2nd/11th house lords, Jupiter/Venus positions, and Dasa periods from the chart data.

{chartData}`,

  spiritual: `Spiritual Growth reading. Structure your response as:

## Spiritual Indicators
- 9th house (Dharma Bhava): your dharma and spiritual inclinations
- 12th house (Moksha Bhava): liberation potential and spiritual practices
- 5th house (Poorva Punya): past life merits shaping your spiritual path
- Jupiter: the guru planet — wisdom and spiritual guidance
- Ketu: the moksha karaka — liberation and detachment

## Your Spiritual Path Type
- Based on your chart, which path suits you best:
  - **Bhakti** (devotion) — if Jupiter/Venus strong and 5th/9th well-placed
  - **Jnana** (knowledge) — if Mercury/Jupiter strong
  - **Karma** (selfless action) — if Saturn/Mars strong
  - **Raja** (meditation/yoga) — if Moon/Sun strong
- Explain why this path fits your chart

## Spiritual Strengths
- Past life spiritual merits (Poorva Punya) indicated
- Natural spiritual gifts (intuition, devotion, discernment, etc.)

## Favorable Spiritual Periods
- Dasa periods when spiritual growth accelerates
- Best times for retreats, pilgrimages, or intensifying practice

## Recommended Practices
- Specific mantras based on your ruling planets
- Gemstones that support spiritual elevation
- Daily practices (meditation, japa, yoga) aligned with your chart
- Pilgrimage or sacred places beneficial for you

## Challenges on the Path
- Spiritual obstacles in your chart (ego, attachment, doubt)
- Remedies to overcome them

Reference actual 9th/12th house, Jupiter/Ketu placements, and current Dasa from the chart data.

{chartData}`,

  dasa: `Dasa Timeline reading. Structure your response as:

## Current Dasa Period
- Mahadasha lord: which planet is currently ruling your life direction
- Bhukti (Antardasha) lord: the sub-period refining the experience
- Overall theme: what this combined period is about
- Started: when this Bhukti began
- Ends: when this Bhukti ends

## Current Themes & Effects
- How the Mahadasha lord's placement (sign, house, aspects) is shaping your life now
- What the Bhukti lord is emphasizing within that
- Areas of life most activated right now
- Psychological and emotional themes

## Key Life Event Timing
- Upcoming Bhukti changes and what each will bring
- Specific windows for: career moves, marriage, property, travel, health
- Reference the dates from the Dasa timeline in the chart data

## Challenging vs Golden Periods
- Identify difficult upcoming periods (especially malefic planet Bhuktis)
- Identify golden windows for major actions
- How to prepare for and navigate each

## Major Upcoming Mahadasha
- Preview the next Mahadasha lord and its theme
- When it begins and how it will shift your life direction

Be specific with dates — reference the actual Dasa timeline from the chart data.

Current Date: {currentDate}

{chartData}`,

  horary: `KP Horary (Prashna) Answer. Structure your response as:

## Question
(Restate the question being answered)

## Direct Answer: YES / NO
(One clear word — no hedging)

## Astrological Reasoning
- Moon position: querent's mindset and the question's emotional context
- Relevant house significators: which houses govern this question
- Sub-Lord judgment: the deciding factor in KP system
- Aspects influencing the outcome

## Timing
- When the answer will manifest (if applicable)
- Dasa/Bhukti periods relevant to timing
- Specific date ranges if determinable

## Conditions
- What needs to happen for the answer to fully manifest
- Obstacles to watch for
- Supporting factors working in your favor

## Advice
- What you should DO based on this reading
- What you should AVOID doing
- Remedies if applicable

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

  education: `Education & Learning reading. Structure your response as:

## Educational Indicators
- 4th house (Vidya Bhava): formal education, schooling environment
- 5th house: intelligence, creativity, grasping power
- 9th house: higher learning, philosophy, research
- Mercury: the karaka for academics and intellect
- 2nd house: early education and speech

## Academic Strengths
- Subjects and fields where you naturally excel
- Your learning style (visual, analytical, memorization, etc.)
- Intellectual gifts indicated by Mercury's placement and aspects

## Recommended Fields of Study
- 3-5 specific academic disciplines aligned with your chart
- Why each is a match (which planetary placement supports it)

## Higher Education Prospects
- Chances for postgraduate studies, research, or foreign education
- 9th house and Jupiter's influence on higher learning
- Whether education abroad is favored

## Competitive Exams & Timing
- Favorable Dasa periods for exams and academic milestones
- Best ages for major educational achievements
- Challenging periods to prepare for

## Remedies for Academic Success
- Mantras for enhancing Mercury and 5th house
- Gemstones for educational progress
- Study practices aligned with your chart

Reference actual 4th/5th/9th house, Mercury placement, and current Dasa from the chart data.

{chartData}`,

  family: `Family & Children reading. Structure your response as:

## Family Indicators
- 4th house (Sukha Bhava): home, mother, domestic happiness
- 5th house (Putra Bhava): children, intelligence, progeny
- 9th house (Bhagya): father, fortune, ancestors
- 3rd house: siblings, courage, neighbors
- Jupiter: karaka for children and family wisdom

## Relationship with Parents
- Mother (4th house/Moon): nature of relationship, harmony level
- Father (9th house/Sun): nature of relationship, blessings
- Any afflictions affecting these relationships and remedies

## Siblings
- 3rd house analysis: number of siblings, relationship quality
- Mars as karaka for siblings

## Children Prospects
- 5th house and Jupiter analysis: prospects for children
- Number of children indicated
- Timing for conception/birth (favorable Dasa periods)
- Any delays or challenges and their remedies

## Family Harmony
- Overall family happiness indicated by 4th house and Moon
- Sources of tension (if any) and how to resolve them
- Strongest family bonds in your chart

## Remedies for Family Peace
- Mantras for strengthening 4th/5th house
- Practices for ancestral blessings (9th house)
- Gemstones for family harmony

Reference actual 4th/5th/9th/3rd house, Jupiter/Moon placements from the chart data.

{chartData}`,

  cosmic_love_letter: `Cosmic Love Letter — The universe speaks to your heart:
1. Cosmic Love Signature: How you love (Venus sign, 7th house, Moon Nakshatra) — poetic, not data
2. What Stars Whisper: Hidden emotional needs you've never spoken
3. Karmic Love Story: Past-life connections (Rahu-Ketu axis through relationship houses)
4. Love You Give vs Need: Venus (expression) vs Moon (nourishment) — the gap
5. Heart's Timetable: When love enters/deepens — Dasa windows with emotional texture
6. Letter for Future Partner: The partner your soul truly calls for
7. Healing the Heart: One relationship wound needing tending + Vedic remedy
8. Star Blessing: Poetic closing blessing crafted from your chart

Tone: Warm, intimate, spiritual. Use "you/your" throughout. No clinical language.

{chartData}`,

  name_numerology: `Vedic Name Numerology & Correction:
1. Current Name Analysis: Chaldeon value, Lo Shu grid, destiny/life path/soul urge numbers from name
2. Birth Date Numerology: Life Path, Destiny, Soul Urge numbers from DOB
3. Name-Birth Harmony: Does your name align with your birth numbers? Gap analysis
4. Career Impact: How your name number affects professional success
5. Health Impact: Name number and vulnerable body areas
6. Relationship Impact: Name number and love/marriage harmony
7. Suggested Correction: If needed, specific letter additions/changes with numerical reasoning
8. Lucky Numbers & Colors: Based on your numerological profile

Use Chaldeon numerology system. Be specific with letter suggestions.

{chartData}`,

  gemstone_remedy: `Gemstone & Remedy Report:
1. Primary Gemstone: Based on Ascendant lord — stone, weight, metal, finger, day to wear, mantra
2. Secondary Gemstone: Based on weakest benefic — same details
3. Rudraksha Recommendation: Mukhi based on ruling planet
4. Mantras: Lagna lord mantra, Navagraha mantra, specific problem mantras
5. Fasting Days: Which day and for which planet
6. Daan (Charity): What to donate, when, to whom — planet-specific
7. Color Therapy: Favorable colors for daily wear by planet
8. Caution: Gemstones to AVOID (enemy planets, 6/8/12 lords)
9. Monthly Remedy Calendar: Which remedy on which day for next 30 days

Current Date: {currentDate}

{chartData}`,

  compatibility_profile: `Ideal Partner Compatibility Profile:
1. Partner Traits from Chart: 7th house sign/lord, Venus/Moon position — physical, emotional, mental traits
2. Nakshatra-Based Partner: Your Nakshatra's ideal match Nakshatras
3. What You Truly Need vs Want: Moon (emotional needs) vs Venus (attraction) gap
4. Mangal Dosha Status: Do you have it? Impact on partner selection
5. Best Zodiac Matches: Top 3 Moon sign matches with reasons
6. Red Flags to Watch: Patterns your chart attracts that harm you
7. Ideal Meeting Period: Dasa-based windows when you're most likely to meet your partner
8. Relationship Advice: One key shift to attract the right partner

{chartData}`,

  past_life_karma: `Past Life Karma Reading:
1. Karmic Origin: Rahu-Ketu axis — which past life theme dominates this incarnation
2. 12th House Past Life: Hidden past-life talents and debts from 12th house/lord
3. 8th House Karmic Debt: Transformation, inheritance, chronic patterns from past lives
4. Saturn's Karmic Lesson: Where Saturn sits = your specific karmic homework
5. Unfinished Business: Moon Nakshatra — the emotional thread from past to present
6. Karmic Relationships: People who carry past-life connections (5th/9th house lords)
7. Karmic Rewards: Jupiter's placement = blessings earned from past lives
8. This Life's Karmic Purpose: The ONE karmic knot your soul chose to untie
9. Liberation Path: Specific practices to clear karmic debt (12th house remedies)

{chartData}`,

  mangal_dosha: `Mangal Dosha Deep Report:
1. Dosha Status: Present/Absent — which houses Mars occupies, degree of severity (Mild/Moderate/Severe)
2. Cancellation Checks: Mars in own sign/exalted, Mars in Aries/Scorpio/Cancer/Leo, conjunct Jupiter/Sun, aspect from Jupiter
3. Impact on Marriage: 7th house affliction, delay in marriage, spouse health, conflict patterns
4. Impact on Relationships: Aggression, dominance patterns, emotional volatility
5. Impact on Career: Competitive drive, conflict with authority — how to channel positively
6. Mangal Dosha Matching Rules: Which partner types neutralize your dosha (Anshik/Purna matching)
7. Dosha Cancellation by Partner: Compatible Mars placements for marriage
8. Remedies: Specific mantras, fasting, gemstone, charity for Mars pacification
9. Marriage Timing: Best Dasa periods for Manglik marriage
10. Post-Marriage Guidance: Practices to maintain harmony after marriage

{chartData}`,

  sade_sati: `Sade Sati Report (Saturn's 7.5-Year Transit):
1. Current Phase: Rising/Peak/Setting — which phase you're in RIGHT NOW
2. Moon Sign Position: Saturn's current transit relative to your natal Moon
3. Phase-wise Breakdown:
   - Rising (before Moon): Mental pressure, anxiety, preparation
   - Peak (over Moon): Maximum intensity, health, career tests, identity crisis
   - Setting (after Moon): Financial strain, gradual relief, lessons integrating
4. Career Impact: Job changes, delays, promotions blocked, lessons in perseverance
5. Health Impact: Vulnerable areas, chronic issues, mental health periods
6. Relationship Impact: Family tension, marriage stress, isolation periods
7. Financial Impact: Expense periods, investment cautions, savings strategy
8. Dhaiya (Small Sade Sati): If Saturn transits 4th or 8th from Moon
9. Key Dates: Exact months when Sade Sati intensifies or shifts
10. Silver Lining: What Sade Sati is giving you that you'll be grateful for later
11. Remedies: Saturn-specific mantras, Shani temple visits, charity, fasting

Current Date: {currentDate}

{chartData}`,

  kp_prashna: `KP Prashna — Advanced Horary (One Burning Question):
Using Krishnamurti Paddhati Sub-Lord theory for precise timing:
1. Question Verification: Rephrase the question astrologically
2. Horary Number: {horaryNumber} — construct chart from this number
3. Significators: Ruling planets, Sub-Lords for relevant houses
4. Sub-Lord Judgment: Whether the Sub-Lord favors or denies the question
5. Ruling Planets: Current Lagna lord, Moon sign lord, Moon star lord, day lord — confirm significators
6. Yes/No Verdict: Clear answer with confidence level (High/Medium/Low)
7. Conditions: What must happen for the answer to manifest
8. Timing: When — using Dasa, Bhukti, Antra, and transit confirmations
9. Obstacles: What could delay or deny the outcome
10. Advice: What to DO to improve the outcome

Be precise. Use KP terminology with explanations. Give specific time frames.

Horary Number: {horaryNumber}

{chartData}`,

  // ═══════════════════════════════════════════════════════════════
  // SPECIALIZED ASTROLOGY BRANCHES (new)
  // ═══════════════════════════════════════════════════════════════

  medical_astrology: `Medical Astrology Deep Dive (Iatromathematics):
1. Body Constitution (Prakriti): Ascendant sign + dominant elements → Ayurvedic dosha (Vata/Pitta/Kapha) with explanation
2. Sign-to-Body Mapping: Your Ascendant, Moon, and Sun signs rule specific body parts — which are strong, which need care
3. Planet-to-Organ Analysis:
   - Sun: Heart, vitality, bones
   - Moon: Mind, fluids, digestion
   - Mars: Blood, muscles, marrow, surgery
   - Mercury: Nervous system, speech, respiratory
   - Jupiter: Liver, pancreas, fat, wisdom
   - Venus: Kidneys, reproductive, throat
   - Saturn: Bones, teeth, chronic illness, joints
   - Rahu: Mysterious/undiagnosed conditions
   - Ketu: Chronic/hidden ailments, healing ability
   Analyze each planet's placement and what it means for your health
4. Disease Tendency by House:
   - 6th house: Acute diseases, enemies to health
   - 8th house: Chronic conditions, surgery, longevity
   - 12th house: Hospitalization, hidden ailments
   Identify afflictions and what they indicate
5. Health Timing by Dasa: Which periods are health-vulnerable, which are healing. Reference the actual Dasa timeline
6. Mental Health Indicators: Moon placement, 4th house (mind), 5th house (intellect), afflictions to Moon/Mercury
7. Nutritional Guidance: Foods that strengthen your weak planets, foods to avoid
8. Gemstone Therapy: Which gemstones support your health, which to avoid
9. Mantra & Remedy: Specific mantras for afflicted planets, Ayurvedic herbs for your dosha
10. Preventive Lifestyle: Daily routines, exercise types, sleep patterns aligned with your chart

⚠️ This reading is for astrological awareness only — always consult healthcare professionals for medical concerns.

{chartData}`,

  ayurvedic_constitution: `Ayurvedic Constitution & Lifestyle (Dosha Analysis):
1. Your Dosha (Prakriti): Determine Vata/Pitta/Kapha dominance from:
   - Ascendant element (fire/earth/air/water/ether)
   - Moon sign element
   - Dominant planets in the chart
   Give a clear primary + secondary dosha
2. Physical Characteristics: Body type, skin, hair, eyes — what your chart says about your physical form
3. Mental & Emotional Temperament: How your dosha affects your thinking, reactions, stress patterns
4. Dietary Recommendations:
   - Foods that balance your dosha
   - Foods that aggravate — avoid these
   - Ideal meal timing and food combinations
   - Specific grains, vegetables, spices, oils for you
5. Lifestyle & Daily Routine (Dinacharya):
   - Best wake/sleep times for your dosha
   - Exercise types (yoga, walking, intense, gentle)
   - Self-care practices (oil massage, meditation type)
   - Seasonal adjustments
6. Herbal Remedies: Ayurvedic herbs that support your weak planets and dosha imbalances
7. Gemstone & Color Therapy: Stones and colors that balance your dosha
8. Disease Prevention: Health vulnerabilities for your dosha type and how to prevent them
9. Seasonal Guidance: How each season affects you (Ritu Sandhi) and what to adjust
10. Spiritual Practices: Meditation style, mantra, yoga type best suited to your dosha

Reference actual Ascendant, Moon sign, and dominant planets from the chart data.

{chartData}`,

  financial_timing: `Financial Astrology & Investment Timing:
1. Wealth Capacity: 2nd/11th house strength, Dhana Yogas, Jupiter/Venus dignity — your overall wealth potential
2. Income vs Investment: Whether you're better suited for earned income (6th/10th) or investment/windfall (8th/11th/9th)
3. Favorable Sectors: Based on your chart, which industries/sectors favor you:
   - Real estate (Mars/Saturn/4th house)
   - Stocks/speculation (Mercury/5th house)
   - Gold/precious metals (Jupiter/Sun)
   - Technology (Rahu/Mercury)
   - Agriculture (Venus/Moon)
   - Healthcare (Sun/Mars/6th)
   Explain which match your chart and why
4. Current Market Alignment: How your current Dasa period affects your financial decisions
5. Investment Timing by Dasa:
   - Best periods for major investments
   - Periods to hold cash and avoid risk
   - Windfall windows (8th/11th activations)
   - Loss-prevention periods (6th/12th activations)
6. Risk Profile: Your chart's risk tolerance — conservative, moderate, or aggressive
7. Debt & Credit: 6th house analysis — tendency toward debt, ability to repay
8. Wealth Blockages: Afflictions blocking money flow and remedies to clear them
9. Multi-Year Wealth Cycle: Map your Dasa timeline to major financial phases
10. Remedies for Prosperity: Gemstones, mantras, charity, and actions that activate wealth

⚠️ This reading is for astrological insight only — not financial advice. Always consult a qualified financial advisor.

Current Date: {currentDate}

{chartData}`,

  electional_astrology: `Electional Astrology (Muhurta) — Finding Auspicious Timing:

Event to Plan: {eventDescription}
Current Date: {currentDate}

1. Event Analysis: What kind of event is this and which houses/planets govern it:
   - Wedding/Marriage → 7th house, Venus, Jupiter
   - Business launch → 10th/11th house, Mercury, Jupiter
   - Property purchase → 4th house, Mars, Venus
   - Travel/Journey → 3rd/9th/12th house, Mercury, Moon
   - Surgery/Medical → 6th/8th house, Mars, Sun
   - Education/Exam → 4th/5th house, Mercury, Jupiter
   - Legal/Court → 6th house, Saturn, Mars
   - Starting a job → 10th/6th house, Sun, Saturn
   - Investment → 2nd/11th house, Jupiter, Venus
   - Other → analyze based on event nature

2. Your Chart's Favorable Periods: Which upcoming Dasa/Bhukti periods support this event
3. Planetary Transits: Current and upcoming transits that favor or hinder this event
4. Recommended Date Windows: 2-3 specific date ranges (within the next 3-6 months) that are most auspicious for this event, with reasoning:
   - Which weekdays are best
   - Which lunar days (Tithi) are favorable
   - Which Nakshatras support the event
   - Avoid periods (Rahu Kaal, eclipses, retrogrades)
5. Time of Day: Best Muhurta (time window) within the recommended dates — exact hours
6. What to Avoid: Periods that would bring failure or obstacles if the event is started then
7. Preparation: What to do before the event to maximize success (remedies, rituals, fasting)
8. Backup Dates: Alternative dates if the primary window isn't feasible

Be specific with dates — reference the current date and calculate forward.

Event Description: {eventDescription}

Current Date: {currentDate}

{chartData}`,

  synastry_compatibility: `Synastry & Relationship Compatibility Analysis (Two-Chart Comparison):

Partner 1 (You): {chartData}

Partner 2 (Your Partner): {partnerChartData}

1. Core Compatibility Score: Rate 1-10 with brief explanation
2. Ascendant Compatibility: How your Lagnas interact — physical attraction, approach to life
3. Moon Sign Synastry: Emotional compatibility — do your Moons support each other?
   - Same element: Natural harmony
   - Compatible elements: Good understanding
   - Conflicting elements: Emotional work needed
4. Sun Sign Dynamics: Ego, identity, life direction alignment
5. Venus-Mars Attraction: Romantic and physical chemistry indicators
6. House Overlays: Where Partner 2's planets fall in Partner 1's houses (and vice versa):
   - Partner 2's planets in your 7th: Strong partnership indicator
   - Partner 2's planets in your 5th: Romance and creativity
   - Partner 2's planets in your 4th: Home and family connection
   - Partner 2's planets in your 1st: Strong influence on your identity
7. Dasa Compatibility: Are your current life periods aligned or conflicting?
8. Strengths of the Relationship: What makes this pairing work well
9. Challenges & Growth Areas: Where friction will occur and how to navigate it
10. Long-Term Potential: Marriage/life-partner indicators — 7th house lord connections, Jupiter blessings
11. Karmic Connection: Rahu-Ketu axis connections between charts — past life bonds
12. Remedies for Harmony: If there are afflictions, what both partners can do to strengthen the bond
13. Best Phases Together: Favorable periods for commitment, marriage, starting a family
14. Advice: Specific guidance for making this relationship thrive

Analyze BOTH charts. Reference actual placements from both Partner 1 and Partner 2 data.

Partner 1 chart: {chartData}

Partner 2 chart: {partnerChartData}`,
}

// ============ Horoscope Prompt (Daily/Monthly Subscription) ============
const HOROSCOPE_PROMPT = `Generate a personalized daily horoscope based on the birth chart. Use Moon sign (Rasi) and current planetary transits.

Include:
1. Today's Vibe: One-line mood/energy summary
2. Career: Work and professional guidance for today
3. Love: Relationship and romantic energy
4. Health: Physical and mental wellness tip
5. Lucky: Color, number, and time for today
6. Caution: One thing to avoid today
7. Affirmation: A personalized Vedic affirmation based on chart

Keep it personal (not generic zodiac), concise, and actionable. Use Dasa period context for deeper insight.

Moon Sign: {moonSign}
Nakshatra: {nakshatra}
Current Dasa: {currentDasa}
Current Date: {currentDate}

{chartData}`

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
          // 8192 is Gemini 2.0 Flash's max output. 4096 was cutting off
          // longer analyses (future_timeline, life_decoder, soul_purpose) mid-sentence.
          generationConfig: { temperature: 0.8, maxOutputTokens: 8192, topP: 0.95, topK: 40 },
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

      // Truncation detection: Gemini returns finishReason === 'MAX_TOKENS'
      // when the output hit the max_tokens limit. Log + append a warning.
      const finishReason = data?.candidates?.[0]?.finishReason
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[AI] Gemini response truncated at 8192 tokens — analysis may be incomplete')
        return text + '\n\n---\n\n*⚠️ Note: This analysis was truncated due to length limits. Some sections may be incomplete. Use the Regenerate button (admin) to try again, or try a different analysis type.*'
      }

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
          // Groq Llama 3.3 70B supports up to 32768 output tokens. Use 8192
          // to be safe and avoid runaway costs while still allowing long analyses.
          temperature: 0.8, max_tokens: 8192, top_p: 0.95,
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

      // Truncation detection: OpenAI-compatible APIs return finish_reason === 'length'
      if (data?.choices?.[0]?.finish_reason === 'length') {
        console.warn('[AI] Groq response truncated at 8192 tokens — analysis may be incomplete')
        return text + '\n\n---\n\n*⚠️ Note: This analysis was truncated due to length limits. Some sections may be incomplete. Use the Regenerate button (admin) to try again, or try a different analysis type.*'
      }

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
          temperature: 0.8, max_tokens: 8192,
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

      // Truncation detection
      if (data?.choices?.[0]?.finish_reason === 'length') {
        console.warn(`[AI] OpenRouter (${model}) response truncated at 8192 tokens — analysis may be incomplete`)
        return text + '\n\n---\n\n*⚠️ Note: This analysis was truncated due to length limits. Some sections may be incomplete. Use the Regenerate button (admin) to try again, or try a different analysis type.*'
      }

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
          temperature: 0.8, max_tokens: 8192,
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

      // Truncation detection
      if (data?.choices?.[0]?.finish_reason === 'length') {
        console.warn('[AI] xAI response truncated at 8192 tokens — analysis may be incomplete')
        return text + '\n\n---\n\n*⚠️ Note: This analysis was truncated due to length limits. Some sections may be incomplete. Use the Regenerate button (admin) to try again, or try a different analysis type.*'
      }

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
    temperature: 0.7, max_tokens: 8192,
  })
  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error('Empty response from z-ai-sdk')

  // Truncation detection (OpenAI-compatible)
  if (completion.choices[0]?.finish_reason === 'length') {
    console.warn('[AI] z-ai-sdk response truncated at 8192 tokens — analysis may be incomplete')
    return text + '\n\n---\n\n*⚠️ Note: This analysis was truncated due to length limits. Some sections may be incomplete. Use the Regenerate button (admin) to try again, or try a different analysis type.*'
  }

  return text
}

// ============ Whop Session Helper ============
function getWhopUserId(request: NextRequest): string | null {
  const cookie = request.cookies.get('whop_session')?.value
  if (!cookie) return null
  const session = decodeSession(cookie)
  return session?.userId || null
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
    const { analysisType, chartData, horaryNumber, provider: requestedProvider, forceRefresh, eventDescription, partnerChartData } = body

    if (!analysisType || !chartData) {
      return NextResponse.json({ detail: 'analysisType and chartData are required' }, { status: 400 })
    }

    const template = ANALYSIS_PROMPTS[analysisType]
    if (!template) {
      return NextResponse.json({ detail: `Invalid analysis type. Valid: ${Object.keys(ANALYSIS_PROMPTS).join(', ')}` }, { status: 400 })
    }

    // Validate required fields for specialized analyses
    if (analysisType === 'electional_astrology' && !eventDescription) {
      return NextResponse.json({ detail: 'eventDescription is required for Electional Astrology. Describe what event you want to plan.' }, { status: 400 })
    }
    if (analysisType === 'synastry_compatibility' && !partnerChartData) {
      return NextResponse.json({ detail: 'partnerChartData is required for Synastry analysis. Please provide your partner\'s birth chart data.' }, { status: 400 })
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

    // ---- Force-refresh guard (admin only) ----
    // forceRefresh bypasses the cache and generates a fresh analysis, which
    // costs an AI API call (~$0.01-0.05). Only allow it for admin devices
    // with 'unlimited' access. Regular users must use the cached version.
    if (forceRefresh && !hasUnlimitedAccess) {
      return NextResponse.json({
        detail: 'Cache regeneration is admin-only. Your existing analysis is cached and will be served.',
        cachedAvailable: true,
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

    // ── New 3-tier subscription chart budget check ──
    // Subscribers get 2 new charts per billing period (lifetime = unlimited).
    // Cached re-analyses (same cacheKey) don't count — those are always free.
    // Bundle/single buyers: 1 chart per purchase (tracked separately).
    let isNewChartForSubscriber = false
    if (hasPremiumAccess) {
      try {
        const { canGenerateNewChart } = await import('@/lib/subscriptions')
        const check = await canGenerateNewChart(deviceId, cacheKey)
        if (!check.allowed && check.reason !== 'cached' && check.reason !== 'no_subscription') {
          // Subscriber hit their chart budget for this period
          return NextResponse.json({
            detail: check.reason === 'subscription_expired'
              ? `Your subscription has expired. Resubscribe to generate new charts. (Cached analyses remain viewable forever.)`
              : `You've used all ${check.subscription?.chartsPerPeriod} new charts for this billing period. Cached analyses remain viewable. Next reset: ${check.subscription?.periodEnd ? new Date(check.subscription.periodEnd).toLocaleDateString() : 'never'}`,
            limitReached: true,
            limitType: 'subscription_chart_budget',
            reason: check.reason,
            chartsUsed: check.subscription?.chartsUsedThisPeriod,
            chartsPerPeriod: check.subscription?.chartsPerPeriod,
            periodEnd: check.subscription?.periodEnd,
            tier: check.subscription?.tier,
          }, { status: 429 })
        }
        // Track whether this was a NEW chart (so we increment the counter later)
        isNewChartForSubscriber = check.reason === 'within_budget' || check.reason === 'grace_period'
      } catch (subCheckErr) {
        console.warn('[AI] Subscription budget check failed (continuing):', subCheckErr instanceof Error ? subCheckErr.message : 'unknown')
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

    // ---- Extract structured chart info ----
    // Pull Moon sign, Nakshatra, Ascendant, current Dasa period, and all
    // planet positions into a clean human-readable summary. This prevents
    // the AI from claiming "your Moon sign is unknown" — it has the
    // extracted values right at the top of the prompt.
    const { extractChartInfo, formatChartInfoForPrompt } = await import('@/lib/chart-info')
    const chartInfo = extractChartInfo(chartData as Record<string, unknown>)
    const chartSummary = formatChartInfoForPrompt(chartInfo)

    // ---- Build prompt ----
    let prompt = template
      .replace('{chartData}', `${chartSummary}\n\n---\n\n${compressedChart}`)
      .replace('{currentDate}', new Date().toISOString().split('T')[0])
    if (horaryNumber) prompt = prompt.replace('{horaryNumber}', String(horaryNumber))
    // Specialized analysis replacements
    if (eventDescription) prompt = prompt.replace(/{eventDescription}/g, String(eventDescription))
    if (partnerChartData) {
      // Compress partner chart data using the same function
      const partnerCompressed = compressChartData(partnerChartData, 'synastry_compatibility')
      const partnerInfo = extractChartInfo(partnerChartData as Record<string, unknown>)
      const partnerSummary = formatChartInfoForPrompt(partnerInfo)
      prompt = prompt.replace(/{partnerChartData}/g, `${partnerSummary}\n\n---\n\n${partnerCompressed}`)
    }

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

      // ── Increment the subscriber's chart budget counter ──
      // Only counts if this was a NEW chart (not cached). On cached re-analysis,
      // canGenerateNewChart returned reason='cached' and we skipped this increment.
      if (isNewChartForSubscriber) {
        try {
          const { incrementChartUsage } = await import('@/lib/subscriptions')
          await incrementChartUsage(deviceId)
        } catch (incErr) {
          // Non-critical — best-effort counter increment
          console.warn('[AI] Failed to increment chart usage counter:', incErr instanceof Error ? incErr.message : 'unknown')
        }
      }

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
