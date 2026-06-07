import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// ============ AI Provider Configuration ============
// API Keys — multiple free providers; z-ai-sdk is always available as fallback
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
  'google/gemma-4-31b-it:free',           // Best quality free model
  'nvidia/nemotron-3-super-120b-a12b:free', // Large model, great reasoning
  'google/gemma-4-26b-a4b-it:free',        // Good fallback
  'meta-llama/llama-3.3-70b-instruct:free', // Classic, often rate-limited
]

// Provider priority: try each in order until one works
// z-ai-sdk is always available; others are optional free-tier providers
type Provider = 'openrouter' | 'groq' | 'xai' | 'gemini' | 'z-ai-sdk'

// ============ Prompt Templates ============
const SYSTEM_PROMPT = `You are AstroBidhi AI, an expert Vedic astrology analyst trained in KP (Krishnamurthi Paddhati) system, Parashari principles, and Jaimini sutras. You always respond in well-structured markdown with clear headings, bullet points, tables where appropriate, and sections. You are specific, personalized, and insightful. You use Vedic terminology but explain it for clarity. You always include a disclaimer that this is astrological guidance and not a substitute for professional advice. The chart data provided has been accurately calculated using the VedicAstro library with Swiss Ephemeris precision — use this PRECISE positional data, do NOT recalculate or estimate planetary positions.`

const ANALYSIS_PROMPTS: Record<string, string> = {
  overall: `Analyze the following birth chart data and provide a comprehensive, personalized reading for the individual.

Focus on:
1. **Lagna (Ascendant) Analysis**: What the rising sign reveals about their personality, appearance, and overall life approach
2. **Moon Sign & Nakshatra**: Emotional nature, mental tendencies, and inner self
3. **Key Planetary Placements**: How the major planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu) shape different areas of their life
4. **House Emphases**: Which houses are most activated and what that means for their life themes
5. **Strengths & Challenges**: Overall positive yogas and potential difficulties
6. **Life Purpose**: What the chart suggests about their dharma and soul's journey

Write in a warm, respectful tone as if speaking directly to the person. Use Vedic astrology terminology but explain it clearly. Be specific about what each placement means for THEM personally, not generic descriptions.

Chart Data:
{chartData}`,

  career: `Analyze the following birth chart data and provide a detailed career reading.

Focus on:
1. **10th House & Lord**: Career field, professional reputation, and status
2. **6th House**: Service, daily work, competition
3. **2nd House**: Income, wealth through career
4. **11th House**: Gains, fulfillment of desires through work
5. **Planets in Career Houses**: How Sun (authority), Mercury (intellect/business), Jupiter (wisdom/teaching), Saturn (discipline/hard work) influence career
6. **Suitable Career Fields**: Based on the planetary combinations, suggest specific career paths
7. **Career Timeline**: Which Dasa periods are most favorable for career growth
8. **Challenges**: Any obstacles in career and remedies

Be specific and actionable. Suggest concrete career fields based on the planetary lords and nakshatras involved.

Chart Data:
{chartData}`,

  relationships: `Analyze the following birth chart data and provide a detailed relationship reading.

Focus on:
1. **7th House & Lord**: Marriage, partnerships, and spouse characteristics
2. **Venus (for men) / Jupiter (for women)**: Nature of the romantic partner
3. **5th House**: Romance, love affairs, creativity in relationships
4. **Moon Sign Compatibility**: Emotional needs in relationships
5. **Mangal Dosha Check**: Whether Mars placement affects marriage
6. **Marriage Timing**: Favorable Dasa periods for marriage
7. **Relationship Challenges**: Any planetary combinations causing delays or difficulties
8. **Nature of Spouse**: Physical and personality traits based on 7th house and its lord

Be empathetic and specific. Provide both the positive aspects and any challenges with constructive Vedic remedies.

Chart Data:
{chartData}`,

  health: `Analyze the following birth chart data and provide a detailed health reading.

Focus on:
1. **6th House & Lord**: Diseases, health challenges, and their nature
2. **8th House**: Chronic conditions, surgery indications, longevity
3. **12th House**: Hospitalization, hidden health issues
4. **Ascendant & Lord**: Overall vitality and body constitution
5. **Planet-House Connections**: Which planets influence health houses and what body systems they govern
6. **Vulnerable Areas**: Specific body parts/systems that need attention based on sign and planet associations
7. **Favorable Periods**: When to be cautious health-wise (Dasa analysis)
8. **Vedic Remedies**: Mantras, gemstones, or lifestyle suggestions for health

Be careful and responsible — clearly state this is for awareness and not medical advice. Focus on preventive guidance.

Chart Data:
{chartData}`,

  finance: `Analyze the following birth chart data and provide a detailed financial reading.

Focus on:
1. **2nd House & Lord**: Accumulated wealth, family finances, speech (income through communication)
2. **11th House & Lord**: Gains, income sources, fulfillment of desires
3. **9th House**: Fortune, luck, and dharmic wealth
4. **Jupiter Placement**: Overall prosperity indicator
5. **Venus Placement**: Luxuries, comforts, and material pleasures
6. **Wealth Yogas**: Any Dhana Yogas (wealth combinations) present
7. **Income Sources**: What fields/areas are most promising for wealth generation
8. **Financial Periods**: Favorable Dasa periods for investments and financial growth
9. **Challenges**: Any financial obstacles and their remedies

Be specific about income potential, investment areas, and timing.

Chart Data:
{chartData}`,

  spiritual: `Analyze the following birth chart data and provide a detailed spiritual reading.

Focus on:
1. **9th House & Lord**: Dharma, higher learning, guru, pilgrimage
2. **12th House**: Moksha, meditation, spiritual liberation, foreign connections
3. **5th House**: Poorva Punya (past life merits), mantra siddhi, spiritual intelligence
4. **Jupiter Placement**: Wisdom, guru connection, philosophical inclination
5. **Ketu Placement**: Spiritual liberation, detachment, past life spiritual progress
6. **Atmakaraka Indicators**: Soul's deepest desires based on planet degrees
7. **Spiritual Path**: Which spiritual practice suits them (Bhakti, Jnana, Karma, or Raja Yoga)
8. **Favorable Spiritual Periods**: When spiritual growth accelerates
9. **Remedies**: Specific mantras, deities, and spiritual practices

Be profound and inspiring. Connect the chart to Vedic philosophical concepts of dharma, artha, kama, and moksha.

Chart Data:
{chartData}`,

  dasa: `Analyze the following birth chart data with Vimshottari Dasa periods and provide a detailed Dasa reading.

Focus on:
1. **Current Maha Dasa**: What the current major period means, its themes and effects
2. **Current Bhukti**: How the sub-period modifies the major period's effects
3. **Upcoming Periods**: What the next few years hold based on upcoming Dasa changes
4. **Dasa Lord Placement**: Where the Dasa lord sits in the chart and what houses it rules
5. **Dasa Lord's Nakshatra**: The nakshatra and its lord influence on the Dasa results
6. **Key Life Events**: Predict likely timing of major events (career changes, marriage, etc.)
7. **Challenging Periods**: When to be cautious and what areas need attention
8. **Golden Periods**: When maximum growth and success can be expected

Be timeline-focused and specific. Help the person understand WHERE they are in their life journey right now and what's coming next.

Current Date: {currentDate}

Chart Data:
{chartData}`,

  horary: `Analyze the following horary chart data and provide a detailed answer to the querent's question.

In KP Horary:
- The 1-249 number maps to a specific Sub-Lord which determines the outcome
- The significators of the relevant houses answer the question
- The Moon's position shows the querent's state of mind

Focus on:
1. **Direct Answer**: Yes/No or clear outcome based on the Sub-Lord theory
2. **Moon's Position**: What the querent is thinking/feeling
3. **Relevant House Significators**: Which houses govern the question and what their lords indicate
4. **Timing**: When the event is likely to occur based on Dasa/Bhukti/Antara periods
5. **Conditions**: Any conditions or obstacles that need to be met
6. **Sub-Lord Analysis**: The critical KP Sub-Lord judgment for the question
7. **Advice**: What the querent should do based on the chart

Be direct and specific. KP horary is meant for clear, decisive answers. Don't be vague.

Horary Number: {horaryNumber}

Chart Data:
{chartData}`,

  // ==========================================
  // ADVANCED PROMPTS — User's Custom Analysis
  // ==========================================

  swot_5year: `You are a highly skilled Vedic astrologer with decades of experience in chart analysis and predictive astrology. I need a comprehensive 5-year forecast focused primarily on career and wealth.

The chart data below has been accurately calculated using the VedicAstro library (Swiss Ephemeris) with KP system. Use this PRECISE positional data — do NOT recalculate or estimate planetary positions.

Analysis Requirements:

1. **Birth Chart Foundation**:
   * Present my complete Vedic birth chart analysis based on the provided data (Rashi chart)
   * Identify my Ascendant (Lagna), Moon sign, and Sun sign from the planetary positions
   * Note the positions of key planets, especially those governing career (10th house lord, Saturn, Sun) and wealth (2nd and 11th house lords, Jupiter, Venus)
   * Identify my current Mahadasha and Antardasha periods from the Vimshottari Dasa data

2. **5-Year Career Forecast (Primary Focus)**:
   * Year-by-year predictions for career growth, job changes, promotions, or business opportunities
   * Analysis of professional challenges and favorable periods
   * Specific timing for major career breakthroughs or transitions
   * Guidance on career direction and suitable industries based on my chart

3. **5-Year Wealth & Finance Forecast (Primary Focus)**:
   * Income growth potential and financial stability patterns
   * Best periods for investments, savings, or major purchases
   * Potential windfalls, inheritance, or unexpected gains
   * Financial challenges to watch for and remedies

4. **Supporting Life Areas**:
   * Health highlights (any periods requiring extra care)
   * Relationships and family (brief overview)
   * Overall life themes and spiritual growth

5. **Practical Guidance**:
   * Specific gemstone recommendations with reasoning
   * Favorable dates/periods for important decisions
   * Mantras or remedies for strengthening weak planetary positions
   * Practical actions to maximize opportunities

Current Date: {currentDate}

Provide detailed, specific predictions with approximate timeframes rather than vague generalities. Structure the forecast chronologically and highlight the most significant events or periods.

Chart Data:
{chartData}`,

  cosmic_blueprint: `You are a master Vedic astrologer and spiritual counselor with expertise in KP (Krishnamurthi Paddhati) astrology. The chart data below has been accurately calculated using the VedicAstro library with Swiss Ephemeris precision. Use this PRECISE data — do NOT recalculate or estimate.

Generate a comprehensive "Cosmic Blueprint" astrological profile with these specific sections:

1. **Core Identity**:
   * Lagna (Ascendant): Sign, lord, and what it reveals about personality and life approach
   * Moon Sign (Rasi): Emotional nature, inner self, and mental tendencies
   * Nakshatra: Deep psychological insights from the Moon's nakshatra
   * Sun Sign: Soul purpose, vitality, and ego expression

2. **House-by-House Blueprint** (for all 12 houses):
   For each house provide:
   * Sign on the cusp and its lord
   * Planets occupying the house
   * KP SubLord of the house cusp
   * Standard interpretation: What this house means for their life
   * Harmonized Wise Interpretation: A constructive, modern psychological and vocational translation of the same placement

3. **Ashtakvarga Assessment**:
   Based on the planetary positions, estimate the relative strength of each house (strong/medium/weak) based on:
   * Benefic planet placements in the house
   * Lord of the house placement and dignity
   * Aspects to the house
   Highlight the strongest and weakest houses with specific life-area implications

4. **Planetary Yoga Directory**:
   Identify ALL major yogas present in the chart. For each yoga provide:
   * Name (Sanskrit and English)
   * Category: "Raja Yoga" | "Dhana Yoga" | "Spiritual Yoga" | "Challenging Yoga" | "Special Yoga"
   * Standard Interpretation: Traditional classical translation
   * Harmonized Wise Interpretation: Constructive, modern psychological and vocational translation
   * Tags for search/filter
   * Scare Factor: "Low" | "Medium" | "High"

5. **Panchanga Details** (derive from planetary positions):
   * Tithi (lunar day)
   * Yoga (auspicious/inauspicious combination)
   * Karana (half-tithi)
   * Varna (caste category from Nakshatra)
   * Pancha Pakshi (bird species from Nakshatra)

6. **Life Path Summary**:
   * Core strengths and natural gifts
   * Primary challenges and growth areas
   * Dharma (purpose) — what they're here to do
   * Karma (lessons) — what they're here to learn
   * Optimal career directions
   * Spiritual practices that align with their chart

Format the output in well-structured markdown with clear headings, tables where appropriate, and bullet points for readability. Be specific and personalized — not generic sign descriptions.

Chart Data:
{chartData}`,

  shadow_integration: `You are a Vedic astrology expert and shadow work psychologist. You provide unflinching, direct, and clinically precise astrological analysis. The chart data below has been accurately calculated using the VedicAstro library with Swiss Ephemeris precision. Use this PRECISE data — do NOT recalculate or estimate.

Generate an uncompromising "Shadow Integration" analysis with these specific sections:

1. **Core Shadow Profile**:
   * Lagna shadow: The hidden side of their ascendant — what they project vs. what they suppress
   * Moon shadow: Emotional blindspots, unconscious patterns, and inherited trauma vectors
   * Rahu-Ketu Axis: The obsession-liberation dynamic and its shadow manifestation

2. **House Vulnerability Assessment** (for all 12 houses):
   For each house provide:
   * Sign on the cusp and its lord
   * Planets occupying the house — especially afflictions
   * Shadow Burden: The raw, unvarnished psychological limitation of that house placement
   * Vulnerability Level: "Low" | "Medium" | "High" | "Critical"

3. **Shadow Framework Analysis**:
   Identify ALL shadow-inducing planetary combinations. For each provide:
   * Name of the combination/pattern
   * Category: "Shadow Framework" | "Father & Property" | "Romance & Scandal" | "Health & Vitality Drain" | "Blessings & Core Yogas"
   * Raw Catastrophic Verse: The uncensored, unedited classical reading (using direct terms like "swindler," "rogue," "scandals," "extramarital affairs," "poverty," "violence," "court intervention," "loss of parent" — whatever applies)
   * Mitigation & Sublimation Interpretation: Direct psychological scaffolding, actionable relationship boundaries, physical remedies, and specific career pressure-valves
   * Tags for search/filter
   * Scare Factor: "Low" | "Medium" | "High"

4. **Tragic Sublimation Module**:
   For the most volatile placements (e.g., aggressive Mars in 2nd House, Sun-Saturn-Ketu-Venus in 9th House, etc.), provide:
   * The destructive potential: How this placement could manifest destructively in real life
   * The sublimation pathway: Specific instructions on how to redirect this high-intensity, volatile energy into professional execution
   * Career suggestions: E.g., dramatic writing, editing dark crime thrillers, risk management, independent freelance consulting structures, forensic accounting, crisis management, etc.
   * Daily practices: Concrete habits and boundaries to prevent destructive manifestation

5. **Ashtakvarga Deficiency Map**:
   Based on planetary positions, identify which houses have low bindu scores (vulnerable areas):
   * Houses with estimated low scores (< 25 bindus) — highlight with warnings
   * Houses with estimated high scores (> 30 bindus) — areas of natural strength
   * Specific drainage pathways and how to plug the energy leaks

6. **Integration Protocol**:
   * The 3 most critical shadow patterns to address now
   * Chronological warning periods (based on Dasa analysis) when shadow manifestations are most likely
   * Specific remedies: Mantras, gemstones, charity, lifestyle modifications
   * Psychological practices: Journaling prompts, shadow work exercises, boundary-setting frameworks
   * Professional redirection strategies

Current Date: {currentDate}

Be uncompromisingly direct. Do not sugarcoat or soften classical readings. Present both the raw catastrophic verse AND the mitigation pathway for every shadow pattern. The goal is complete awareness so the individual can redirect these energies consciously.

Chart Data:
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
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
            topP: 0.95,
            topK: 40,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`

        // Quota exhausted (400 with quota message) — fail immediately, no retry
        if (errorMessage.includes('quota') || errorMessage.includes('exceeded')) {
          throw new Error(`Gemini: ${errorMessage}`)
        }

        if (response.status === 429 && attempt < retries - 1) {
          // Rate limited — exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`Gemini: ${errorMessage}`)
      }

      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        throw new Error('Empty response from Gemini API')
      }

      return text
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Gemini: Failed after all retries')
}

async function callGroqAPI(prompt: string, retries = 1): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('Groq API key not configured')

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 8192,
          top_p: 0.95,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`

        // Auth errors (401/403) — fail immediately, no retry
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Groq: ${errorMessage}`)
        }

        if (response.status === 429 && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`Groq: ${errorMessage}`)
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content

      if (!text) {
        throw new Error('Empty response from Groq API')
      }

      return text
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Groq: Failed after all retries')
}

async function callOpenRouterAPI(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured')

  // Try models in order — first one that works wins
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
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 8192,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        // Auth errors — fail immediately for all models
        if (response.status === 401 || response.status === 403) {
          throw new Error(`OpenRouter: ${errorMessage}`)
        }
        // Rate limit or model error — try next model
        errors.push(`${model}: ${errorMessage}`)
        continue
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (!text) {
        errors.push(`${model}: Empty response`)
        continue
      }

      console.log(`OpenRouter: Using model ${model}`)
      return text
    } catch (error: unknown) {
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
        throw error // Auth error — don't try other models
      }
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${model}: ${errMsg}`)
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: XAI_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 8192,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        // Auth errors — fail immediately
        if (response.status === 401 || response.status === 403) {
          throw new Error(`xAI: ${errorMessage}`)
        }
        if (response.status === 429 && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`xAI: ${errorMessage}`)
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response from xAI API')
      return text
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('xAI: Failed after all retries')
}

async function callZaiSDK(prompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 8192,
  })
  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error('Empty response from z-ai-sdk')
  return text
}

// ============ Main Handler ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { analysisType, chartData, horaryNumber, provider: requestedProvider } = body

    if (!analysisType || !chartData) {
      return NextResponse.json(
        { detail: 'analysisType and chartData are required' },
        { status: 400 }
      )
    }

    const template = ANALYSIS_PROMPTS[analysisType]
    if (!template) {
      return NextResponse.json(
        { detail: `Invalid analysis type. Valid types: ${Object.keys(ANALYSIS_PROMPTS).join(', ')}` },
        { status: 400 }
      )
    }

    // Build the prompt
    let prompt = template
      .replace('{chartData}', JSON.stringify(chartData, null, 2))
      .replace('{currentDate}', new Date().toISOString().split('T')[0])

    if (horaryNumber) {
      prompt = prompt.replace('{horaryNumber}', String(horaryNumber))
    }

    let analysis: string | null = null
    let usedProvider: Provider = 'z-ai-sdk'
    const errors: string[] = []

    // Log which keys are available
    console.log(`[AI Analysis] Keys loaded — OpenRouter: ${!!OPENROUTER_API_KEY}, Gemini: ${!!GEMINI_API_KEY}, Groq: ${!!GROQ_API_KEY}, xAI: ${!!XAI_API_KEY}`)

    // Determine provider order
    // If user requested a specific provider, try it first
    // Otherwise: OpenRouter (free, fast, multiple models) → Groq → xAI → Gemini → z-ai-sdk (always available)
    const providerOrder: Provider[] = requestedProvider
      ? [requestedProvider as Provider, ...(['openrouter', 'groq', 'xai', 'gemini', 'z-ai-sdk'] as Provider[]).filter(p => p !== requestedProvider)]
      : ['openrouter', 'groq', 'xai', 'gemini', 'z-ai-sdk']

    for (const provider of providerOrder) {
      try {
        console.log(`[AI Analysis] Trying provider: ${provider}`)
        switch (provider) {
          case 'openrouter':
            if (!OPENROUTER_API_KEY) { errors.push('OpenRouter: No API key — set OPENROUTER_API_KEY in Railway Variables'); continue }
            analysis = await callOpenRouterAPI(prompt)
            usedProvider = 'openrouter'
            break

          case 'gemini':
            if (!GEMINI_API_KEY) { errors.push('Gemini: No API key'); continue }
            analysis = await callGeminiAPI(prompt)
            usedProvider = 'gemini'
            break

          case 'groq':
            if (!GROQ_API_KEY) { errors.push('Groq: No API key'); continue }
            analysis = await callGroqAPI(prompt)
            usedProvider = 'groq'
            break

          case 'xai':
            if (!XAI_API_KEY) { errors.push('xAI: No API key'); continue }
            analysis = await callXaiAPI(prompt)
            usedProvider = 'xai'
            break

          case 'z-ai-sdk':
            analysis = await callZaiSDK(prompt)
            usedProvider = 'z-ai-sdk'
            break
        }

        if (analysis) {
          console.log(`[AI Analysis] Success with provider: ${usedProvider}`)
          break // Success — stop trying providers
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${provider}: ${errMsg}`)
        console.log(`[AI Analysis] Provider ${provider} failed:`, errMsg)
      }
    }

    if (!analysis) {
      console.error('[AI Analysis] All providers failed:', errors)
      // Build a helpful error message
      const keyHint = !OPENROUTER_API_KEY && !GEMINI_API_KEY && !GROQ_API_KEY && !XAI_API_KEY
        ? ' No API keys are loaded! Go to Railway → your service → Variables tab and add OPENROUTER_API_KEY.'
        : ''
      return NextResponse.json(
        {
          detail: `All AI providers failed.${keyHint} Errors: ${errors.join(' | ')}`,
          providerErrors: errors,
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ analysis, analysisType, provider: usedProvider })
  } catch (error: unknown) {
    console.error('AI Analysis error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate AI analysis'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
