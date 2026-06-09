import { NextResponse } from 'next/server'

export async function GET() {
  // Simple health check — just confirms the server is running
  // DB status is checked separately via /api/cache-status
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
