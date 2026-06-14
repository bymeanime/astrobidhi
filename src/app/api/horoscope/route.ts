import { NextRequest, NextResponse } from 'next/server'
import { rawQuery, rawExecute, initDb } from '@/lib/db'
import { createHash, randomUUID } from 'crypto'

// ============ Gemini API Configuration ============
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

// ============ In-Memory Cache ============
let cachedHoroscope: { date: string; data: ZodiacPrediction[] } | null = null

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
    // Delete any existing entry for this date
    await rawExecute('DELETE FROM CachedAnalysis WHERE cacheKey = ?', [cacheKey])
    await rawExecute(
      'INSERT INTO CachedAnalysis (id, cacheKey, analysisType, chartData, result, provider) VALUES (?, ?, ?, ?, ?, ?)',
      [id, cacheKey, 'daily_horoscope', '{}', JSON.stringify(data), 'gemini']
    )
  } catch (error) {
    console.error('[HOROSCOPE] DB cache write error:', error)
  }
}

// ============ AI Generation ============
async function generateDailyHoroscope(): Promise<ZodiacPrediction[]> {
  const today = new Date().toISOString().split('T')[0]

  // Check in-memory cache
  if (cachedHoroscope && cachedHoroscope.date === today) {
    return cachedHoroscope.data
  }

  // Check DB cache
  const dbData = await getDbCache(today)
  if (dbData) {
    cachedHoroscope = { date: today, data: dbData }
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

  // Try Gemini API
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 4096, topP: 0.95, topK: 40 },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          // Clean up any markdown formatting
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          predictions = JSON.parse(cleaned) as ZodiacPrediction[]
        }
      } else {
        console.error('[HOROSCOPE] Gemini API error:', response.status)
      }
    } catch (error) {
      console.error('[HOROSCOPE] Gemini API call failed:', error)
    }
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
  cachedHoroscope = { date: today, data: predictions }
  await setDbCache(today, predictions)

  return predictions
}

// ============ API Handler ============
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sign = searchParams.get('sign')

    const predictions = await generateDailyHoroscope()

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
  } catch (error) {
    console.error('[HOROSCOPE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate horoscope predictions' },
      { status: 500 }
    )
  }
}
