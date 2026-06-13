import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { rawQuery, rawExecute, initDb } from '@/lib/db'
import { randomUUID } from 'crypto'

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
      // Expired — deactivate
      await rawExecute(`UPDATE HoroscopeSubscription SET isActive = 0 WHERE deviceId = ?`, [deviceId])
      return { isSubscribed: false, expiresAt: sub.expiresAt, daysRemaining: 0 }
    }
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { isSubscribed: true, expiresAt: sub.expiresAt, daysRemaining }
  } catch {
    return { isSubscribed: false, expiresAt: null, daysRemaining: 0 }
  }
}

// ============ Device Access Check (for premium/unlimited users who get free horoscope) ============
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

// ============ AI Provider Functions ============
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini key')
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048, topP: 0.9 },
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
      temperature: 0.8, max_tokens: 2048,
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
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 2048 }),
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
    temperature: 0.8, max_tokens: 2048,
  })
  return completion.choices[0]?.message?.content || ''
}

async function generateHoroscope(prompt: string): Promise<{ text: string; provider: string }> {
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

// ============ Extract Moon Sign & Nakshatra from chart data ============
function extractMoonInfo(chartData: Record<string, unknown>): { moonSign: string; nakshatra: string; currentDasa: string } {
  let moonSign = 'Unknown'
  let nakshatra = 'Unknown'
  let currentDasa = 'Unknown'

  try {
    // Try planets array
    const planets = chartData.planets as Array<Record<string, unknown>> || []
    const moon = planets.find((p: Record<string, unknown>) => p.name === 'Moon' || p.planet === 'Moon')
    if (moon) {
      moonSign = (moon.sign as string) || (moon.rasi as string) || moonSign
      nakshatra = (moon.nakshatra as string) || (moon.star as string) || nakshatra
    }

    // Try dasa info
    const dasas = chartData.dasas as Array<Record<string, unknown>> || []
    const now = new Date()
    for (const d of dasas) {
      const start = new Date(d.start as string || 0)
      const end = new Date(d.end as string || 0)
      if (start <= now && end >= now) {
        currentDasa = `${d.mahadasha || d.planet || 'Unknown'} - ${d.antardasha || d.bhukti || ''}`
        break
      }
    }
  } catch { /* use defaults */ }

  return { moonSign, nakshatra, currentDasa }
}

// ============ Main Handler ============

// GET: Check subscription status
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get('deviceId')
  if (!deviceId) {
    return NextResponse.json({ detail: 'deviceId required' }, { status: 400 })
  }

  const sub = await checkHoroscopeSubscription(deviceId)
  const hasPremiumAccess = await checkDevicePremium(deviceId)

  return NextResponse.json({
    isSubscribed: sub.isSubscribed || hasPremiumAccess,
    expiresAt: sub.expiresAt,
    daysRemaining: sub.daysRemaining,
    priceCents: SUBSCRIPTION_PRICE_CENTS,
    priceFormatted: `$${(SUBSCRIPTION_PRICE_CENTS / 100).toFixed(2)}/month`,
  })
}

// POST: Generate daily horoscope or subscribe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, deviceId, chartData, subscriptionTxId } = body

    if (!deviceId) {
      return NextResponse.json({ detail: 'deviceId required' }, { status: 400 })
    }

    // Action: subscribe
    if (action === 'subscribe') {
      // In production, this would verify payment via Whop/Stripe
      // For now, create a 30-day subscription
      await initDb()
      const id = randomUUID()
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await rawExecute(
        `INSERT INTO HoroscopeSubscription (id, deviceId, isActive, startedAt, expiresAt, createdAt) VALUES (?, ?, 1, datetime('now'), ?, datetime('now'))`,
        [id, deviceId, expiresAt]
      )
      // Also grant horoscope_monthly in DeviceAccess
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

    // Action: generate horoscope
    if (action === 'generate') {
      if (!chartData) {
        return NextResponse.json({ detail: 'chartData required for generation' }, { status: 400 })
      }

      // Check subscription
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

      // Check cache — horoscopes are daily, so cache for the day
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

      // Extract Moon info from chart
      const { moonSign, nakshatra, currentDasa } = extractMoonInfo(chartData)
      const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      // Build prompt
      const prompt = HOROSCOPE_PROMPT
        .replace('{moonSign}', moonSign)
        .replace('{nakshatra}', nakshatra)
        .replace('{currentDasa}', currentDasa)
        .replace('{currentDate}', currentDate)
        .replace('{chartData}', JSON.stringify(chartData).substring(0, 4000))

      // Generate
      const { text, provider } = await generateHoroscope(prompt)

      // Cache the result
      try {
        await initDb()
        const cacheId = randomUUID()
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await rawExecute(
          `INSERT OR REPLACE INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider, createdAt) VALUES (?, ?, 'horoscope_daily', ?, ?, ?, datetime('now'))`,
          [cacheId, cacheKey, JSON.stringify(chartData).substring(0, 2000), text.substring(0, 8000), provider]
        )
      } catch { /* cache write failure */ }

      return NextResponse.json({
        horoscope: text,
        date: today,
        provider,
        moonSign,
        nakshatra,
        cached: false,
      })
    }

    return NextResponse.json({ detail: 'Invalid action. Use "generate" or "subscribe"' }, { status: 400 })
  } catch (error) {
    console.error('[Horoscope] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ detail: 'Failed to generate horoscope' }, { status: 500 })
  }
}
