import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { rawQuery, rawExecute, initDb } from '@/lib/db'
import { randomUUID } from 'crypto'
import { extractChartInfo, formatChartInfoForPrompt } from '@/lib/chart-info'

// ============ AI Provider Configuration ============
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS = [
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

// ============ In-Memory Cache for Daily Zodiac Predictions ============
let cachedDailyZodiac: { date: string; data: ZodiacPrediction[] } | null = null

// ============ Types ============
interface ZodiacPrediction {
  sign: string
  date: string
  rating: number
  oneLiner: string
  career: string
  love: string
  health: string
  finance: string
  luckyNumber: number
  luckyColor: string
}

const ZODIAC_SIGNS = [
  { sign: 'Aries', symbol: '♈', element: 'Fire' },
  { sign: 'Taurus', symbol: '♉', element: 'Earth' },
  { sign: 'Gemini', symbol: '♊', element: 'Air' },
  { sign: 'Cancer', symbol: '♋', element: 'Water' },
  { sign: 'Leo', symbol: '♌', element: 'Fire' },
  { sign: 'Virgo', symbol: '♍', element: 'Earth' },
  { sign: 'Libra', symbol: '♎', element: 'Air' },
  { sign: 'Scorpio', symbol: '♏', element: 'Water' },
  { sign: 'Sagittarius', symbol: '♐', element: 'Fire' },
  { sign: 'Capricorn', symbol: '♑', element: 'Earth' },
  { sign: 'Aquarius', symbol: '♒', element: 'Air' },
  { sign: 'Pisces', symbol: '♓', element: 'Water' },
]

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

const SUBSCRIPTION_PRICE_CENTS = 499 // $4.99/month
const SUBSCRIPTION_TYPE = 'horoscope_monthly'

// ============ Subscription Check ============
async function checkHoroscopeSubscription(deviceId: string): Promise<{
  isSubscribed: boolean
  expiresAt: string | null
  daysRemaining: number
}> {
  try {
    await initDb()
    const subs = await rawQuery<{
      isActive: number
      expiresAt: string
    }>(
      `SELECT isActive, expiresAt FROM HoroscopeSubscription WHERE deviceId = ? AND isActive = 1 ORDER BY expiresAt DESC LIMIT 1`,
      [deviceId]
    )
    if (subs.length === 0) return { isSubscribed: false, expiresAt: null, daysRemaining: 0 }
    const sub = subs[0]
    const now = new Date()
    const expiry = new Date(sub.expiresAt)
    if (expiry < now) {
      await rawExecute(`UPDATE HoroscopeSubscription SET isActive = 0 WHERE deviceId = ?`, [deviceId])
      return { isSubscribed: false, expiresAt: sub.expiresAt, daysRemaining: 0 }
    }
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { isSubscribed: true, expiresAt: sub.expiresAt, daysRemaining }
  } catch {
    return { isSubscribed: false, expiresAt: null, daysRemaining: 0 }
  }
}

// ============ Device Access Check ============
async function checkDevicePremium(deviceId: string): Promise<boolean> {
  try {
    await initDb()
    const grants = await rawQuery<{ analysisType: string; expiresAt: string | null }>(
      `SELECT analysisType, expiresAt FROM DeviceAccess WHERE deviceId = ?`,
      [deviceId]
    )
    const now = new Date().toISOString()
    const active = grants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)
    return active.some(g => g.analysisType === 'all_premium' || g.analysisType === 'unlimited' || g.analysisType === 'horoscope_monthly')
  } catch {
    return false
  }
}

// ============ Database Cache ============
async function getDbCache(date: string): Promise<ZodiacPrediction[] | null> {
  try {
    await initDb()
    const cacheKey = `daily-horoscope-${date}`
    const rows = await rawQuery<{ result: string }>(
      'SELECT result FROM CachedAnalysis WHERE cacheKey = ?',
      [cacheKey]
    )
    if (rows.length > 0 && rows[0].result) {
      return JSON.parse(rows[0].result) as ZodiacPrediction[]
    }
  } catch (error) {
    console.error('[HOROSCOPE] DB cache read error:', error)
  }
  return null
}

async function setDbCache(date: string, data: ZodiacPrediction[]): Promise<void> {
  try {
    await initDb()
    const cacheKey = `daily-horoscope-${date}`
    const id = randomUUID()
    await rawExecute('DELETE FROM CachedAnalysis WHERE cacheKey = ?', [cacheKey])
    await rawExecute(
      'INSERT INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider) VALUES (?, ?, ?, ?, ?, ?)',
      [id, cacheKey, 'daily_horoscope', '{}', JSON.stringify(data), 'gemini']
    )
  } catch (error) {
    console.error('[HOROSCOPE] DB cache write error:', error)
  }
}

// ============ AI Provider Functions ============
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini key')
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096, topP: 0.9 },
    }),
  })
  if (!response.ok) throw new Error(`Gemini: HTTP ${response.status}`)
  const data = await response.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callGroq(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('No Groq key')
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, max_tokens: 4096,
    }),
  })
  if (!response.ok) throw new Error(`Groq: HTTP ${response.status}`)
  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

async function callOpenRouter(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('No OpenRouter key')
  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://astrobidhi.space-z.ai',
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 4096 }),
      })
      if (!response.ok) continue
      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (text) return text
    } catch { continue }
  }
  throw new Error('OpenRouter: All models failed')
}

async function callZaiSDK(prompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8, max_tokens: 4096,
  })
  return completion.choices[0]?.message?.content || ''
}

async function generateWithAI(prompt: string): Promise<{ text: string; provider: string }> {
  const providers: { name: string; fn: () => Promise<string> }[] = [
    { name: 'gemini', fn: () => callGemini(prompt) },
    { name: 'groq', fn: () => callGroq(prompt) },
    { name: 'openrouter', fn: () => callOpenRouter(prompt) },
    { name: 'z-ai-sdk', fn: () => callZaiSDK(prompt) },
  ]
  for (const provider of providers) {
    try {
      const text = await provider.fn()
      if (text) return { text, provider: provider.name }
    } catch (err) {
      console.warn(`[Horoscope] ${provider.name} failed:`, err instanceof Error ? err.message : err)
    }
  }
  throw new Error('All AI providers failed')
}

// ============ Daily Zodiac Predictions (for landing page widget) ============
async function generateDailyZodiacPredictions(): Promise<ZodiacPrediction[]> {
  const today = new Date().toISOString().split('T')[0]

  // Check in-memory cache
  if (cachedDailyZodiac && cachedDailyZodiac.date === today) {
    return cachedDailyZodiac.data
  }

  // Check DB cache
  const dbData = await getDbCache(today)
  if (dbData) {
    cachedDailyZodiac = { date: today, data: dbData }
    return dbData
  }

  // Generate fresh predictions
  const prompt = `You are a Vedic astrologer generating daily horoscope predictions. Today's date is ${today}.

Generate a daily Vedic astrology prediction for ALL 12 zodiac signs based on current planetary transits. For each sign, provide:
- rating: 1-5 (overall day rating, integer)
- oneLiner: A short catchy one-line prediction (max 80 chars)
- career: Career prediction for today (1-2 sentences)
- love: Love/relationship prediction for today (1-2 sentences)
- health: Health prediction for today (1-2 sentences)
- finance: Financial prediction for today (1-2 sentences)
- luckyNumber: A lucky number between 1-99
- luckyColor: A lucky color name

Return ONLY valid JSON as an array of 12 objects, each with: sign, rating, oneLiner, career, love, health, finance, luckyNumber, luckyColor.
Signs in order: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces.
Do NOT include any markdown, backticks, or explanation. Just the raw JSON array.`

  let predictions: ZodiacPrediction[] = []

  try {
    const { text } = await generateWithAI(prompt)
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    predictions = JSON.parse(cleaned) as ZodiacPrediction[]
  } catch (error) {
    console.error('[HOROSCOPE] Daily zodiac AI generation failed:', error)
  }

  // Fallback: generate simple static predictions
  if (predictions.length === 0) {
    console.log('[HOROSCOPE] Using fallback static predictions')
    predictions = ZODIAC_SIGNS.map((z, i) => ({
      sign: z.sign,
      date: today,
      rating: 3 + (i % 3 === 0 ? 1 : 0),
      oneLiner: `A balanced day for ${z.sign}. Focus on your ${z.element.toLowerCase()} energy.`,
      career: 'Steady progress at work. Avoid major decisions today.',
      love: 'Emotional connections deepen. Express your feelings openly.',
      health: 'Stay hydrated and maintain your routine. Light exercise recommended.',
      finance: 'Conservative approach advised. Avoid impulsive purchases.',
      luckyNumber: (i * 7 + 3) % 99 + 1,
      luckyColor: ['Red', 'Green', 'Yellow', 'White', 'Gold', 'Silver', 'Blue', 'Purple', 'Orange', 'Brown', 'Pink', 'Cyan'][i],
    }))
  }

  // Add date to each prediction
  predictions = predictions.map(p => ({ ...p, date: today }))

  // Cache the result
  cachedDailyZodiac = { date: today, data: predictions }
  await setDbCache(today, predictions)

  return predictions
}

// ============ Extract Moon Sign & Nakshatra from chart data ============
// ============ API Handler ============

// GET: Daily zodiac predictions (for landing page widget) or subscription status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sign = searchParams.get('sign')
    const deviceId = searchParams.get('deviceId')

    // If sign is specified, return daily zodiac prediction for that sign
    // This is the public endpoint for the landing page widget
    if (sign || !deviceId) {
      const predictions = await generateDailyZodiacPredictions()

      if (sign) {
        const signPrediction = predictions.find(
          p => p.sign.toLowerCase() === sign.toLowerCase()
        )
        if (!signPrediction) {
          return NextResponse.json(
            { error: `Unknown sign: ${sign}. Valid signs: ${ZODIAC_SIGNS.map(z => z.sign).join(', ')}` },
            { status: 400 }
          )
        }
        return NextResponse.json({ prediction: signPrediction })
      }

      return NextResponse.json({ predictions, date: predictions[0]?.date })
    }

    // If deviceId is specified (no sign), check subscription status
    const sub = await checkHoroscopeSubscription(deviceId)
    const hasPremiumAccess = await checkDevicePremium(deviceId)

    return NextResponse.json({
      isSubscribed: sub.isSubscribed || hasPremiumAccess,
      expiresAt: sub.expiresAt,
      daysRemaining: sub.daysRemaining,
      priceCents: SUBSCRIPTION_PRICE_CENTS,
      priceFormatted: `$${(SUBSCRIPTION_PRICE_CENTS / 100).toFixed(2)}/month`,
    })
  } catch (error) {
    console.error('[HOROSCOPE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate horoscope predictions' },
      { status: 500 }
    )
  }
}

// POST: Generate personalized horoscope or subscribe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, deviceId, chartData, subscriptionTxId } = body

    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId required' }, { status: 400 })
    }

    // Action: subscribe
    if (action === 'subscribe') {
      await initDb()
      const id = randomUUID()
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await rawExecute(
        `INSERT INTO HoroscopeSubscription (id, deviceId, isActive, startedAt, expiresAt, createdAt) VALUES (?, ?, 1, datetime('now'), ?, datetime('now'))`,
        [id, deviceId, expiresAt]
      )
      const accessId = randomUUID()
      await rawExecute(
        `INSERT INTO DeviceAccess (id, deviceId, analysisType, source, grantedBy, reason, createdAt) VALUES (?, ?, 'horoscope_monthly', 'subscription', 'system', 'Monthly horoscope subscription', datetime('now'))`,
        [accessId, deviceId]
      )
      return NextResponse.json({
        subscribed: true,
        expiresAt,
        daysRemaining: 30,
      })
    }

    // Action: generate personalized horoscope
    if (action === 'generate') {
      if (!chartData) {
        return NextResponse.json({ detail: 'chartData required for generation' }, { status: 400 })
      }

      const sub = await checkHoroscopeSubscription(deviceId)
      const hasPremiumAccess = await checkDevicePremium(deviceId)
      const isSubscribed = sub.isSubscribed || hasPremiumAccess

      if (!isSubscribed) {
        return NextResponse.json({
          detail: 'Horoscope subscription required',
          subscriptionRequired: true,
          priceCents: SUBSCRIPTION_PRICE_CENTS,
          priceFormatted: `$${(SUBSCRIPTION_PRICE_CENTS / 100).toFixed(2)}/month`,
        }, { status: 403 })
      }

      const today = new Date().toISOString().split('T')[0]
      const cacheKey = `horoscope_${deviceId}_${today}`

      try {
        await initDb()
        const cached = await rawQuery<{ result: string; createdAt: string }>(
          `SELECT result, createdAt FROM CachedAnalysis WHERE cacheKey = ?`,
          [cacheKey]
        )
        if (cached.length > 0) {
          return NextResponse.json({
            horoscope: cached[0].result,
            date: today,
            cached: true,
          })
        }
      } catch { /* cache miss */ }

      // Use the shared chart-info extractor (replaces the buggy extractMoonInfo
      // which was looking for the wrong field names — planets instead of
      // planets_data, name instead of Object, etc.)
      const chartInfo = extractChartInfo(chartData)
      const chartSummary = formatChartInfoForPrompt(chartInfo)
      const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      const prompt = HOROSCOPE_PROMPT
        .replace('{moonSign}', chartInfo.moonSign)
        .replace('{nakshatra}', chartInfo.nakshatra)
        .replace('{currentDasa}', chartInfo.currentDasa)
        .replace('{currentDate}', currentDate)
        .replace('{chartData}', `${chartSummary}\n\nFull Chart JSON (truncated):\n${JSON.stringify(chartData).substring(0, 3000)}`)

      const { text, provider } = await generateWithAI(prompt)

      try {
        await initDb()
        const cacheId = randomUUID()
        await rawExecute(
          `INSERT OR REPLACE INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider, createdAt) VALUES (?, ?, 'horoscope_daily', ?, ?, ?, datetime('now'))`,
          [cacheId, cacheKey, JSON.stringify(chartData).substring(0, 2000), text.substring(0, 8000), provider]
        )
      } catch { /* cache write failure */ }

      return NextResponse.json({
        horoscope: text,
        date: today,
        provider,
        moonSign: chartInfo.moonSign,
        nakshatra: chartInfo.nakshatra,
        currentDasa: chartInfo.currentDasa,
        ascendant: chartInfo.ascendant,
        cached: false,
      })
    }

    return NextResponse.json({ detail: 'Invalid action. Use "generate" or "subscribe"' }, { status: 400 })
  } catch (error) {
    console.error('[Horoscope] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ detail: 'Failed to generate horoscope' }, { status: 500 })
  }
}
