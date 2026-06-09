import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import path from 'path'
import { db, rawQuery, rawExecute, initDb } from '@/lib/db'

// Dynamic paths — works in both dev and production (Docker)
const PROJECT_ROOT = process.cwd()
const PYTHON_SCRIPT = path.join(PROJECT_ROOT, 'mini-services', 'vedicastro-api', 'compute.py')
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'
const TMP_DIR = process.env.TMP_DIR || '/tmp/astrobidi-api'

// Ensure tmp directory exists
try { mkdirSync(TMP_DIR, { recursive: true }) } catch {}

// ============ Chart Cache Key Generator ============
// Creates a deterministic hash from birth params so the same chart is never recomputed
function makeChartCacheKey(params: Record<string, unknown>): string {
  const key = {
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    second: params.second,
    utc: params.utc,
    latitude: params.latitude,
    longitude: params.longitude,
    ayanamsa: params.ayanamsa,
    house_system: params.house_system,
  }
  return createHash('sha256').update(JSON.stringify(key)).digest('hex').substring(0, 32)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: routePath } = await params
  const endpoint = routePath.join('/')
  const body = await request.json()

  try {
    // ---- Check chart cache first ----
    // Only cache get_all_horoscope_data and get_chart_data (not horary or transit)
    const cacheableEndpoints = ['get_all_horoscope_data', 'get_chart_data', 'get_dasa_data', 'get_aspects_data']
    if (cacheableEndpoints.includes(endpoint)) {
      try {
        await initDb()
        const cacheKey = makeChartCacheKey(body)

        const cached = await rawQuery<{ chartResult: string }>(
          `SELECT chartResult FROM CachedChart WHERE cacheKey = ?`,
          [cacheKey]
        )

        if (cached.length > 0) {
          console.log(`[Chart] Cache HIT for ${endpoint} (${cacheKey})`)
          const data = JSON.parse(cached[0].chartResult)
          return NextResponse.json(data)
        }

        console.log(`[Chart] Cache MISS for ${endpoint} (${cacheKey}) — will compute`)
      } catch (dbError) {
        console.log('[Chart] Cache read failed, proceeding with computation:', dbError instanceof Error ? dbError.message : 'unknown')
      }
    }

    // ---- Compute chart via Python ----
    const requestId = randomUUID()
    const inputFile = `${TMP_DIR}/req_${requestId}.json`
    const outputFile = `${TMP_DIR}/res_${requestId}.json`

    // Write input to file
    const inputData = JSON.stringify({ endpoint, params: body })
    writeFileSync(inputFile, inputData)

    // Execute Python script
    execSync(
      `${PYTHON_BIN} ${PYTHON_SCRIPT} < ${inputFile} > ${outputFile}`,
      {
        timeout: 120000,
        env: {
          ...process.env,
        },
      }
    )

    // Read output
    const outputData = readFileSync(outputFile, 'utf-8')
    const data = JSON.parse(outputData)

    // Cleanup
    try { unlinkSync(inputFile) } catch {}
    try { unlinkSync(outputFile) } catch {}

    if (data.error) {
      return NextResponse.json({ detail: data.error }, { status: 500 })
    }

    // ---- Save to chart cache ----
    if (cacheableEndpoints.includes(endpoint)) {
      try {
        await initDb()
        const cacheKey = makeChartCacheKey(body)
        await rawExecute(
          `INSERT OR IGNORE INTO CachedChart (id, cacheKey, birthParams, chartResult, createdAt) VALUES (?, ?, ?, ?, datetime('now'))`,
          [randomUUID(), cacheKey, JSON.stringify(body), JSON.stringify(data)]
        )
        console.log(`[Chart] Cached ${endpoint} (${cacheKey})`)
      } catch (dbError) {
        console.log('[Chart] Cache write failed:', dbError instanceof Error ? dbError.message : 'unknown')
      }
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error(`API error for /${endpoint}:`, error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: routePath } = await params
  const endpoint = routePath.join('/')

  if (endpoint === 'health') {
    return NextResponse.json({ status: 'ok' })
  }

  return NextResponse.json({ detail: 'Use POST method' }, { status: 405 })
}
