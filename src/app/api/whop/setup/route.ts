import { NextResponse } from 'next/server'
import { WHOP_CONFIG, getWhopConfigStatus, getCheckoutUrl } from '@/lib/whop'

// GET /api/whop/setup — Public diagnostic endpoint (no secrets exposed)
// Returns which Whop env vars are set + whether the Whop API responds.
// Used by admins to verify their Whop setup without exposing secrets.
export async function GET() {
  const status = getWhopConfigStatus()
  const checkoutUrl = getCheckoutUrl()

  // Try a lightweight ping to the Whop API so we can tell admins if the
  // server-side API key works. We hit the /api/v1/me endpoint which is
  // cheap and requires auth.
  let apiReachable = false
  let apiError: string | null = null
  let apiStatus: number | null = null

  if (WHOP_CONFIG.apiKey) {
    try {
      const res = await fetch('https://api.whop.com/api/v1/me', {
        headers: { Authorization: `Bearer ${WHOP_CONFIG.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      apiStatus = res.status
      // 200 = API key valid; 401 = invalid key; both mean API is reachable
      apiReachable = res.status === 200 || res.status === 401
      if (res.status === 401) {
        apiError = 'API key rejected (401). Check WHOP_API_KEY is a valid server-side key.'
      }
    } catch (err) {
      apiError = err instanceof Error ? err.message : 'Network error reaching api.whop.com'
    }
  }

  // Build a human-friendly diagnosis
  const diagnosis: string[] = []
  if (!status.hasAppId) diagnosis.push('Missing WHOP_APP_ID — create an OAuth app at https://whop.com/dashboard/developer/apps')
  if (!status.hasClientSecret) diagnosis.push('Missing WHOP_CLIENT_SECRET — copy it from your OAuth app settings')
  if (!status.hasApiKey) diagnosis.push('Missing WHOP_API_KEY — generate a server-side API key in your Whop developer dashboard')
  if (!status.hasRedirectUri) diagnosis.push('Missing WHOP_REDIRECT_URI — must match exactly what you entered in the OAuth app')
  if (!status.hasProductId && !status.hasExperienceId && !status.hasCompanyId) {
    diagnosis.push('Missing WHOP_PRODUCT_ID (or WHOP_EXPERIENCE_ID or WHOP_COMPANY_ID) — access checks will always return false')
  }
  if (status.redirectUri && !status.redirectUri.startsWith('https://')) {
    diagnosis.push('WHOP_REDIRECT_URI must use https:// in production (Whop rejects http)')
  }
  if (apiError) diagnosis.push(apiError)
  if (diagnosis.length === 0 && status.configured) {
    diagnosis.push('All required env vars are set and the Whop API is reachable. You should be able to log in.')
  }

  return NextResponse.json({
    ...status,
    checkoutUrl,
    api: {
      reachable: apiReachable,
      status: apiStatus,
      error: apiError,
    },
    diagnosis,
    nextSteps: status.configured
      ? ['Visit your site and click "Start Free Trial" to test the OAuth flow.']
      : ['Set the missing environment variables listed in `diagnosis` above, then redeploy.'],
  })
}
