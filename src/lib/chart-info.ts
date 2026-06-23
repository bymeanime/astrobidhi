// Shared chart-data extraction helpers
//
// The chart data returned from the Python vedicastro service uses specific
// field names (planets_data, Object, Rasi, Nakshatra, vimshottari_dasa, etc.)
// that differ from what the AI prompt code was originally looking for.
//
// This module is the single source of truth for extracting human-readable
// astrological facts (Moon sign, Nakshatra, current Dasa period, etc.) from
// the raw chart data, so the horoscope endpoint and the AI chat endpoint
// both get the same correct values.

interface PlanetRaw {
  Object: string        // Planet name, e.g., "Moon", "Sun", "Mars"
  Rasi: string          // Sign name, e.g., "Aries", "Taurus"
  Nakshatra: string     // Nakshatra name, e.g., "Ashwini", "Bharani"
  RasiLord: string
  NakshatraLord: string
  SubLord: string
  HouseNr: number
  isRetroGrade?: string | null
  LonDecDeg?: number
  SignLonDMS?: string
  SignLonDecDeg?: number
  SubSubLord?: string
}

interface DasaPeriod {
  planet: string        // Mahadasha lord
  start: string
  end: string
  bhuktis: Record<string, { start: string; end: string }>
}

interface ChartDataRaw {
  planets_data?: PlanetRaw[]
  houses_data?: unknown[]
  planetary_aspects?: unknown[]
  vimshottari_dasa?: Record<string, DasaPeriod>
  rasi_planets?: Record<string, unknown>
  house_chart?: Record<number, unknown>
  // Some flows also pass birth_details as a sibling field
  birth_details?: {
    date?: string
    time?: string
    timezone?: string
    latitude?: number | string
    longitude?: number | string
  }
  [key: string]: unknown
}

export interface ExtractedChartInfo {
  moonSign: string       // Rasi of the Moon, e.g., "Cancer"
  nakshatra: string      // Nakshatra of the Moon, e.g., "Pushya"
  moonNakshatraLord: string  // Ruler of the Moon's nakshatra
  moonRasiLord: string   // Ruler of the Moon's sign
  moonHouseNr: number | null  // Which house the Moon sits in
  currentDasa: string    // Current Mahadasha - Bhukti, e.g., "Venus - Sun"
  currentDasaPlanet: string  // Just the Mahadasha lord
  currentBhukti: string  // Just the Bhukti lord
  ascendant: string      // Lagna sign
  sunSign: string        // Sun's sign (for reference)
  allPlanets: Array<{ name: string; sign: string; nakshatra: string; house: number; retrograde: boolean }>
}

/**
 * Extract human-readable astrological facts from chart data so the AI prompt
 * has concrete values instead of "Unknown".
 *
 * Returns sensible defaults if a field can't be found (rather than throwing),
 * so the AI always gets a complete prompt.
 */
export function extractChartInfo(rawChart: Record<string, unknown> | null | undefined): ExtractedChartInfo {
  const chart = (rawChart || {}) as ChartDataRaw

  const defaultResult: ExtractedChartInfo = {
    moonSign: 'Unknown',
    nakshatra: 'Unknown',
    moonNakshatraLord: 'Unknown',
    moonRasiLord: 'Unknown',
    moonHouseNr: null,
    currentDasa: 'Unknown',
    currentDasaPlanet: 'Unknown',
    currentBhukti: 'Unknown',
    ascendant: 'Unknown',
    sunSign: 'Unknown',
    allPlanets: [],
  }

  if (!chart || typeof chart !== 'object') return defaultResult

  try {
    const planets = Array.isArray(chart.planets_data) ? chart.planets_data : []

    // Find Moon
    const moon = planets.find(p => p?.Object === 'Moon')
    if (moon) {
      defaultResult.moonSign = moon.Rasi || defaultResult.moonSign
      defaultResult.nakshatra = moon.Nakshatra || defaultResult.nakshatra
      defaultResult.moonNakshatraLord = moon.NakshatraLord || defaultResult.moonNakshatraLord
      defaultResult.moonRasiLord = moon.RasiLord || defaultResult.moonRasiLord
      defaultResult.moonHouseNr = typeof moon.HouseNr === 'number' ? moon.HouseNr : null
    }

    // Find Ascendant (Lagna)
    const asc = planets.find(p => p?.Object === 'Asc' || p?.Object === 'Ascendant' || p?.Object === 'Lagna')
    if (asc) {
      defaultResult.ascendant = asc.Rasi || defaultResult.ascendant
    }

    // Find Sun (for reference)
    const sun = planets.find(p => p?.Object === 'Sun')
    if (sun) {
      defaultResult.sunSign = sun.Rasi || defaultResult.sunSign
    }

    // Build all-planets summary (useful for AI prompts)
    defaultResult.allPlanets = planets.map(p => ({
      name: p?.Object || 'Unknown',
      sign: p?.Rasi || 'Unknown',
      nakshatra: p?.Nakshatra || 'Unknown',
      house: typeof p?.HouseNr === 'number' ? p.HouseNr : 0,
      retrograde: !!(p?.isRetroGrade && p.isRetroGrade !== ''),
    }))

    // Extract current Dasa period from vimshottari_dasa
    // Structure: { "Venus": { start, end, bhuktis: { "Sun": { start, end }, ... } }, ... }
    const dasaObj = chart.vimshottari_dasa
    if (dasaObj && typeof dasaObj === 'object') {
      const now = new Date()
      let foundMahadasha = ''
      let foundBhukti = ''

      for (const [mahaLord, period] of Object.entries(dasaObj)) {
        if (!period || typeof period !== 'object') continue
        const mahaStart = new Date(period.start || 0)
        const mahaEnd = new Date(period.end || 0)
        if (mahaStart <= now && mahaEnd >= now) {
          foundMahadasha = mahaLord
          // Find current bhukti within this mahadasha
          const bhuktis = period.bhuktis || {}
          for (const [bhuktiLord, bhuktiPeriod] of Object.entries(bhuktis)) {
            if (!bhuktiPeriod || typeof bhuktiPeriod !== 'object') continue
            const bStart = new Date(bhuktiPeriod.start || 0)
            const bEnd = new Date(bhuktiPeriod.end || 0)
            if (bStart <= now && bEnd >= now) {
              foundBhukti = bhuktiLord
              break
            }
          }
          break
        }
      }

      if (foundMahadasha) {
        defaultResult.currentDasaPlanet = foundMahadasha
        defaultResult.currentBhukti = foundBhukti || 'Unknown'
        defaultResult.currentDasa = foundBhukti
          ? `${foundMahadasha} - ${foundBhukti}`
          : foundMahadasha
      }
    }
  } catch {
    // Swallow errors — return defaults so AI still gets a prompt
  }

  return defaultResult
}

/**
 * Format the extracted chart info as a human-readable block suitable for
 * inclusion in an AI prompt. Use this when you want to add a "Chart Summary"
 * section to a prompt.
 */
export function formatChartInfoForPrompt(info: ExtractedChartInfo): string {
  const lines: string[] = []
  lines.push(`Chart Summary:`)
  lines.push(`- Ascendant (Lagna): ${info.ascendant}`)
  lines.push(`- Moon Sign (Rasi): ${info.moonSign}`)
  lines.push(`- Moon Nakshatra: ${info.nakshatra} (lord: ${info.moonNakshatraLord})`)
  lines.push(`- Moon Sign Lord: ${info.moonRasiLord}`)
  if (info.moonHouseNr !== null) {
    lines.push(`- Moon House: ${info.moonHouseNr}`)
  }
  lines.push(`- Sun Sign: ${info.sunSign}`)
  if (info.currentDasa !== 'Unknown') {
    lines.push(`- Current Dasa: ${info.currentDasa} (Mahadasha: ${info.currentDasaPlanet}, Bhukti: ${info.currentBhukti})`)
  }

  if (info.allPlanets.length > 0) {
    lines.push(`- All Planets:`)
    for (const p of info.allPlanets) {
      const retro = p.retrograde ? ' (R)' : ''
      lines.push(`  · ${p.name}: ${p.sign}${retro}, Nakshatra ${p.nakshatra}, House ${p.house}`)
    }
  }

  return lines.join('\n')
}
