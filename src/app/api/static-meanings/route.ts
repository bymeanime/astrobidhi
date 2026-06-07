import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import path from 'path'
import { db } from '@/lib/db'

const PROJECT_ROOT = process.cwd()
const PYTHON_SCRIPT = path.join(PROJECT_ROOT, 'mini-services', 'vedicastro-api', 'meanings.py')
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'
const TMP_DIR = process.env.TMP_DIR || '/tmp/astrobidi-api'

try { mkdirSync(TMP_DIR, { recursive: true }) } catch {}

// ============ Cache Key Generator ============
function makeMeaningsCacheKey(chartData: Record<string, unknown>): string {
  const key = {
    planets: (chartData.planets_data as { Object: string; Rasi: string; HouseNr: number }[])
      ?.map(p => `${p.Object}:${p.Rasi}:H${p.HouseNr}`).join('|'),
    houses: (chartData.houses_data as { HouseNr: number; Rasi: string }[])
      ?.map(h => `H${h.HouseNr}:${h.Rasi}`).join('|'),
  }
  return createHash('sha256').update(JSON.stringify(key)).digest('hex').substring(0, 32)
}

// ============ Inline Fallback Meanings Generator ============
// Used when Python script is not available (e.g., build path issues on Railway)

const SIGN_LORDS: Record<string, string> = {
  'Aries': 'Mars', 'Taurus': 'Venus', 'Gemini': 'Mercury', 'Cancer': 'Moon',
  'Leo': 'Sun', 'Virgo': 'Mercury', 'Libra': 'Venus', 'Scorpio': 'Mars',
  'Sagittarius': 'Jupiter', 'Capricorn': 'Saturn', 'Aquarius': 'Saturn', 'Pisces': 'Jupiter'
}

const HOUSE_AREAS: Record<string, string[]> = {
  '1': ['Self', 'Appearance', 'Personality', 'Health', 'Vitality'],
  '2': ['Wealth', 'Family', 'Speech', 'Food', 'Values'],
  '3': ['Courage', 'Siblings', 'Communication', 'Short Travel', 'Self-Effort'],
  '4': ['Home', 'Mother', 'Property', 'Education', 'Inner Peace'],
  '5': ['Children', 'Creativity', 'Romance', 'Intelligence', 'Past-Life Merit'],
  '6': ['Health', 'Enemies', 'Debts', 'Service', 'Daily Work'],
  '7': ['Marriage', 'Partnerships', 'Business', 'Foreign Travel', 'Contracts'],
  '8': ['Longevity', 'Transformation', 'Inheritance', 'Occult', 'Sudden Events'],
  '9': ['Dharma', 'Higher Learning', 'Guru', 'Father', 'Fortune'],
  '10': ['Career', 'Reputation', 'Authority', 'Social Status', 'Achievement'],
  '11': ['Gains', 'Friendships', 'Income', 'Aspirations', 'Social Networks'],
  '12': ['Losses', 'Moksha', 'Foreign Lands', 'Sleep', 'Spiritual Liberation'],
}

const HOUSE_SANSKRIT: Record<string, string> = {
  '1': 'Lagna Bhava', '2': 'Dhana Bhava', '3': 'Sahaja Bhava', '4': 'Sukha Bhava',
  '5': 'Putra Bhava', '6': 'Ripu Bhava', '7': 'Kalatra Bhava', '8': 'Ayur Bhava',
  '9': 'Dharma Bhava', '10': 'Karma Bhava', '11': 'Labha Bhava', '12': 'Vyaya Bhava',
}

function generateInlineMeanings(chartData: Record<string, unknown>) {
  const planets = (chartData.planets_data || []) as { Object: string; Rasi: string; HouseNr: number; isRetroGrade?: string | null; Nakshatra?: string }[]
  const houses = (chartData.houses_data || []) as { HouseNr: number; Rasi: string; Nakshatra?: string }[]
  const aspects = (chartData.planetary_aspects || []) as { P1: string; P2: string; AspectType: string; AspectOrb: number }[]

  // Find which house each planet lords over
  const planetLordOf: Record<string, number> = {}
  for (const h of houses) {
    const lord = SIGN_LORDS[h.Rasi]
    if (lord) planetLordOf[lord] = h.HouseNr
  }

  // Build planet meanings
  const planet_meanings: Record<string, unknown> = {}
  for (const p of planets) {
    const name = p.Object
    const rasi = p.Rasi
    const houseNr = p.HouseNr
    const isRetro = p.isRetroGrade

    const entry: Record<string, unknown> = {
      sign: rasi,
      house: houseNr,
      sign_meaning: { meaning: `${name} in ${rasi} brings the energy of ${name} into the realm of ${rasi}. This placement shapes how ${name}'s qualities express through ${rasi}'s characteristics.`, theme: `${name} in ${rasi}` },
      house_meaning: { meaning: `${name} in House ${houseNr} activates matters of ${HOUSE_AREAS[String(houseNr)]?.join(', ') || 'that area'}. This placement influences how ${name}'s energy manifests in the affairs of this house.`, theme: `${name} in H${houseNr}` },
      retrograde: null,
      lord_of: planetLordOf[name] || null,
      lordship_meaning: null,
    }

    if (isRetro) {
      entry.retrograde = { meaning: `${name} retrograde creates an introspective, revisiting energy. The qualities of ${name} turn inward, requiring deeper reflection and revisiting of past patterns before moving forward.`, theme: `Retrograde ${name}` }
    }

    const lordHouse = planetLordOf[name]
    if (lordHouse) {
      entry.lordship_meaning = {
        house: lordHouse,
        meaning: `As lord of House ${lordHouse}, ${name} brings its energy to matters of ${HOUSE_AREAS[String(lordHouse)]?.join(', ') || 'that area'}.`,
      }
    }

    planet_meanings[name] = entry
  }

  // Build house meanings
  const house_meanings: Record<string, unknown> = {}
  for (const h of houses) {
    const hnr = String(h.HouseNr)
    const rasi = h.Rasi
    const planetsInHouse = planets.filter(p => p.HouseNr === h.HouseNr).map(p => p.Object)

    house_meanings[hnr] = {
      rasi,
      rasi_lord: SIGN_LORDS[rasi] || '',
      nakshatra: h.Nakshatra || '',
      house_meaning: {
        name: HOUSE_SANSKRIT[hnr] || `House ${hnr}`,
        meaning: `The ${hnr} house (${HOUSE_SANSKRIT[hnr] || 'Bhava'}) represents ${HOUSE_AREAS[hnr]?.join(', ') || 'various matters'}. It is one of the key houses in Vedic astrology that shapes specific areas of life experience.`,
        areas: HOUSE_AREAS[hnr] || [],
      },
      nakshatra_meaning: h.Nakshatra ? { meaning: `${h.Nakshatra} nakshatra carries specific energy and characteristics that influence this house.`, ruler: 'See detailed view', deity: 'See detailed view', theme: h.Nakshatra } : null,
      planets_in_house: planetsInHouse,
    }
  }

  // Build key aspect meanings
  const vedicPlanets = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'])
  const majorTypes = new Set(['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'])
  const seenAspects = new Set<string>()
  const key_aspects: unknown[] = []

  for (const a of aspects) {
    if (!vedicPlanets.has(a.P1) || !vedicPlanets.has(a.P2)) continue
    if (!majorTypes.has(a.AspectType) || a.AspectOrb > 8) continue
    const pairKey = [a.P1, a.P2].sort().join('-') + a.AspectType
    if (seenAspects.has(pairKey)) continue
    seenAspects.add(pairKey)

    key_aspects.push({
      P1: a.P1,
      P2: a.P2,
      AspectType: a.AspectType,
      Orb: Math.round(a.AspectOrb * 10) / 10,
      meaning: `${a.P1} ${a.AspectType.toLowerCase()} ${a.P2} — This ${a.AspectType.toLowerCase()} creates a dynamic interaction between ${a.P1}'s energy and ${a.P2}'s energy that shapes significant life patterns.`,
    })
  }

  return { planet_meanings, house_meanings, key_aspects }
}

export async function POST(request: NextRequest) {
  try {
    const chartData = await request.json()

    if (!chartData) {
      return NextResponse.json({ detail: 'chartData is required' }, { status: 400 })
    }

    // ---- Check cache first ----
    const cacheKey = makeMeaningsCacheKey(chartData)
    try {
      const cached = await db.cachedStaticMeanings.findUnique({ where: { cacheKey } })
      if (cached) {
        console.log(`[Meanings] Cache HIT (${cacheKey})`)
        return NextResponse.json(JSON.parse(cached.result))
      }
    } catch (dbError) {
      console.log('[Meanings] Cache read failed (DB not ready?), proceeding with generation')
    }

    // ---- Try Python script first (full meanings) ----
    let data: Record<string, unknown> | null = null
    let usedMethod = 'none'

    if (existsSync(PYTHON_SCRIPT)) {
      const requestId = randomUUID()
      const inputFile = `${TMP_DIR}/req_${requestId}.json`
      const outputFile = `${TMP_DIR}/res_${requestId}.json`

      writeFileSync(inputFile, JSON.stringify({ chart_data: chartData }))

      console.log(`[Meanings] Running Python: ${PYTHON_BIN} ${PYTHON_SCRIPT}`)

      try {
        execSync(
          `${PYTHON_BIN} ${PYTHON_SCRIPT} < ${inputFile} > ${outputFile}`,
          { timeout: 30000, env: { ...process.env } }
        )

        const outputData = readFileSync(outputFile, 'utf-8')
        data = JSON.parse(outputData)
        usedMethod = 'python'

        if (data?.error) {
          console.error('[Meanings] Python script returned error:', data.error)
          data = null
        }
      } catch (execError) {
        console.error('[Meanings] Python execution failed:', execError instanceof Error ? execError.message : 'Unknown')
      } finally {
        try { unlinkSync(inputFile) } catch {}
        try { unlinkSync(outputFile) } catch {}
      }
    } else {
      console.log(`[Meanings] Python script not found at ${PYTHON_SCRIPT}, using inline fallback`)
    }

    // ---- Fallback to inline Node.js meanings if Python failed ----
    if (!data) {
      console.log('[Meanings] Using inline Node.js fallback for meanings generation')
      data = generateInlineMeanings(chartData)
      usedMethod = 'inline'
    }

    console.log(`[Meanings] Success (${usedMethod}) — ${Object.keys(data.planet_meanings || {}).length} planets, ${Object.keys(data.house_meanings || {}).length} houses`)

    // ---- Save to cache ----
    try {
      await db.cachedStaticMeanings.upsert({
        where: { cacheKey },
        create: { cacheKey, result: JSON.stringify(data) },
        update: { result: JSON.stringify(data) },
      })
      console.log(`[Meanings] Cached (${cacheKey})`)
    } catch (dbError) {
      console.log('[Meanings] Cache write failed (DB not ready?), meanings still returned')
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('[Meanings] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate static meanings'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
