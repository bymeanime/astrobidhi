import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

const PROJECT_ROOT = process.cwd()
const PYTHON_SCRIPT = path.join(PROJECT_ROOT, 'mini-services', 'vedicastro-api', 'meanings.py')
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'
const TMP_DIR = process.env.TMP_DIR || '/tmp/astrobidi-api'

try { mkdirSync(TMP_DIR, { recursive: true }) } catch {}

export async function POST(request: NextRequest) {
  try {
    const chartData = await request.json()

    if (!chartData) {
      return NextResponse.json({ detail: 'chartData is required' }, { status: 400 })
    }

    // Verify Python script exists
    if (!existsSync(PYTHON_SCRIPT)) {
      console.error(`[Meanings] Python script not found at: ${PYTHON_SCRIPT}`)
      return NextResponse.json({
        detail: `Meanings script not found. Path checked: ${PYTHON_SCRIPT}`,
        cwd: PROJECT_ROOT,
        scriptPath: PYTHON_SCRIPT,
      }, { status: 500 })
    }

    const requestId = randomUUID()
    const inputFile = `${TMP_DIR}/req_${requestId}.json`
    const outputFile = `${TMP_DIR}/res_${requestId}.json`

    // Write input to file
    writeFileSync(inputFile, JSON.stringify({ chart_data: chartData }))

    console.log(`[Meanings] Running: ${PYTHON_BIN} ${PYTHON_SCRIPT}`)

    // Execute Python meanings script
    try {
      execSync(
        `${PYTHON_BIN} ${PYTHON_SCRIPT} < ${inputFile} > ${outputFile}`,
        { timeout: 30000, env: { ...process.env } }
      )
    } catch (execError: unknown) {
      console.error('[Meanings] Python execution failed:', execError)
      const stderr = execError instanceof Error ? execError.message : 'Unknown error'
      // Cleanup
      try { unlinkSync(inputFile) } catch {}
      try { unlinkSync(outputFile) } catch {}
      return NextResponse.json({
        detail: 'Python script execution failed',
        error: stderr,
        script: PYTHON_SCRIPT,
        pythonBin: PYTHON_BIN,
      }, { status: 500 })
    }

    // Read output
    let outputData: string
    try {
      outputData = readFileSync(outputFile, 'utf-8')
    } catch (readError) {
      console.error('[Meanings] Failed to read output file:', readError)
      // Cleanup
      try { unlinkSync(inputFile) } catch {}
      return NextResponse.json({ detail: 'Failed to read meanings output' }, { status: 500 })
    }

    // Cleanup
    try { unlinkSync(inputFile) } catch {}
    try { unlinkSync(outputFile) } catch {}

    let data: Record<string, unknown>
    try {
      data = JSON.parse(outputData)
    } catch (parseError) {
      console.error('[Meanings] Failed to parse output as JSON. Output:', outputData.substring(0, 500))
      return NextResponse.json({
        detail: 'Invalid JSON from meanings script',
        output: outputData.substring(0, 500),
      }, { status: 500 })
    }

    if (data.error) {
      return NextResponse.json({ detail: data.error }, { status: 500 })
    }

    console.log(`[Meanings] Success — ${Object.keys(data.planet_meanings || {}).length} planets, ${Object.keys(data.house_meanings || {}).length} houses`)

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('[Meanings] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate static meanings'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
