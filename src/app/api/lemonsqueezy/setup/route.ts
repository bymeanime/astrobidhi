import { NextResponse } from 'next/server'
import { getLsConfigStatus, pingLsApi, getCheckoutUrl } from '@/lib/lemonsqueezy'

// GET /api/lemonsqueezy/setup — Public diagnostic endpoint (no secrets exposed)
// Returns which LS env vars are set + whether the LS API responds.
export async function GET() {
  const status = getLsConfigStatus()

  // Ping LS API to verify the API key works
  let apiHealth = { reachable: false, status: null as number | null, error: null as string | null }
  if (status.hasApiKey) {
    apiHealth = await pingLsApi()
  }

  // Try to generate a checkout URL (without actually creating one if
  // LEMONSQUEEZY_CHECKOUT_URL is set — that path returns instantly)
  const checkoutResult = await getCheckoutUrl()

  // Build diagnosis
  const diagnosis: string[] = []
  if (!status.hasApiKey) diagnosis.push('Missing LEMONSQUEEZY_API_KEY — generate one at https://app.lemonsqueezy.com/settings/api')
  if (!status.hasStoreId) diagnosis.push('Missing LEMONSQUEEZY_STORE_ID — find it in your store URL or via the API')
  if (!status.hasVariantId) diagnosis.push('Missing LEMONSQUEEZY_VARIANT_ID — create a product + variant in your LS dashboard')
  if (!status.hasWebhookSecret) diagnosis.push('Missing LEMONSQUEEZY_WEBHOOK_SECRET — create a webhook in your LS dashboard and copy the signing secret')
  if (apiHealth.error) diagnosis.push(`API check failed: ${apiHealth.error}`)
  if (!checkoutResult.url && !checkoutResult.error) {
    // No URL but no error either — unusual
  } else if (checkoutResult.error) {
    diagnosis.push(`Checkout URL test failed: ${checkoutResult.error}`)
  }
  if (diagnosis.length === 0 && status.configured) {
    diagnosis.push('All required env vars are set. Lemon Squeezy is ready to accept payments.')
  }

  // Webhook URL the user needs to register in LS dashboard
  const webhookUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/api/lemonsqueezy/webhook`
    : 'https://YOUR-DEPLOYMENT-URL/api/lemonsqueezy/webhook'

  return NextResponse.json({
    ...status,
    api: apiHealth,
    webhookUrl,  // Shown to the user so they know what to paste into LS dashboard
    checkoutUrlWorks: !!checkoutResult.url,
    diagnosis,
    nextSteps: status.configured
      ? [
          `1. Register the webhook URL above in your LS dashboard (Settings → Webhooks).`,
          `2. Set LEMONSQUEEZY_WEBHOOK_SECRET to the signing secret LS gives you.`,
          `3. Test the checkout flow by clicking "Buy Now" on your site.`,
        ]
      : ['Set the missing environment variables listed in `diagnosis` above, then redeploy.'],
  })
}
