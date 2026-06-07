import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'

const PYTHON_SCRIPT = '/home/z/my-project/mini-services/vedicastro-api/compute.py'
const PYTHON_BIN = '/home/z/.venv/bin/python3'
const TMP_DIR = '/tmp/astrobidi-api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const endpoint = path.join('/')
  const body = await request.json()

  try {
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
          SE_EPHE_PATH: '/home/z/.venv/lib/python3.12/site-packages/flatlib/resources/swefiles',
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
  const { path } = await params
  const endpoint = path.join('/')

  if (endpoint === 'health') {
    return NextResponse.json({ status: 'ok' })
  }

  return NextResponse.json({ detail: 'Use POST method' }, { status: 405 })
}
