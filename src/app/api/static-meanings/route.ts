import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
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

    const requestId = randomUUID()
    const inputFile = `${TMP_DIR}/req_${requestId}.json`
    const outputFile = `${TMP_DIR}/res_${requestId}.json`

    // Write input to file
    writeFileSync(inputFile, JSON.stringify({ chart_data: chartData }))

    // Execute Python meanings script
    execSync(
      `${PYTHON_BIN} ${PYTHON_SCRIPT} < ${inputFile} > ${outputFile}`,
      { timeout: 30000, env: { ...process.env } }
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

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Static meanings error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate static meanings'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
