// Email receipt infrastructure
// Sends custom branded receipt emails from your own domain when users pay.
//
// Currently supports Resend (https://resend.com — free 3000 emails/month,
// no credit card needed, instant signup). If RESEND_API_KEY isn't set,
// all send functions return gracefully without sending — Whop and LS will
// still send their own default receipts.
//
// To enable:
//   1. Sign up at https://resend.com
//   2. Verify your sending domain (e.g., receipts.astrobidhi.com)
//   3. Generate an API key at https://resend.com/api-keys
//   4. Set in .env:
//        RESEND_API_KEY=re_xxxxxxxxxxxx
//        RESEND_FROM_EMAIL=AstroBidhi <receipts@astrobidhi.com>
//        APP_BASE_URL=https://your-deployment-url.example.com

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AstroBidhi <noreply@astrobidhi.com>'
const APP_BASE_URL = process.env.NEXT_PUBLIC_URL || process.env.APP_BASE_URL || ''

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY
}

export function getEmailConfigStatus() {
  return {
    configured: isEmailConfigured(),
    hasApiKey: !!RESEND_API_KEY,
    fromEmail: RESEND_FROM_EMAIL,
    apiKeyPreview: RESEND_API_KEY ? `${RESEND_API_KEY.slice(0, 8)}…${RESEND_API_KEY.slice(-4)}` : null,
  }
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string  // plain-text fallback
}

/**
 * Send an email via Resend. Returns true on success, false on failure.
 * If RESEND_API_KEY is not set, returns true (no-op) without sending.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    // No-op — not configured. Whop/LS default emails still go out.
    return { sent: false, error: 'Email not configured (RESEND_API_KEY missing)' }
  }

  if (!params.to || !params.to.includes('@')) {
    return { sent: false, error: `Invalid recipient: ${params.to}` }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || params.html.replace(/<[^>]+>/g, ''),
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Email] Resend API error:', res.status, errText.slice(0, 300))
      return { sent: false, error: `Resend ${res.status}: ${errText.slice(0, 200)}` }
    }

    return { sent: true }
  } catch (err) {
    console.error('[Email] send failed:', err)
    return { sent: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// ──────────────────── Receipt templates ────────────────────

interface ReceiptItem {
  name: string
  description?: string
  priceCents: number
  quantity?: number
}

interface ReceiptEmailParams {
  customerEmail: string
  customerName?: string
  orderId: string
  items: ReceiptItem[]
  totalCents: number
  currency?: string
  provider: 'lemonsqueezy' | 'whop'
  providerUrl?: string  // link to manage subscription on provider's site
  notes?: string
}

/**
 * Generate an HTML receipt email body matching AstroBidhi's brand
 * (saffron/maroon/temple color palette — matches the main site).
 */
export function renderReceiptEmail(params: ReceiptEmailParams): { html: string; text: string; subject: string } {
  const currency = params.currency || 'USD'
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''

  const fmt = (cents: number) => `${symbol}${(cents / 100).toFixed(2)}`

  const itemListHtml = params.items.map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f3e8d0;">
        <div style="font-weight: 600; color: #4A0E0E;">${escapeHtml(item.name)}</div>
        ${item.description ? `<div style="font-size: 12px; color: #8b7355; margin-top: 2px;">${escapeHtml(item.description)}</div>` : ''}
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #f3e8d0; text-align: right; color: #4A0E0E; font-weight: 500;">
        ${item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ''}${fmt(item.priceCents)}
      </td>
    </tr>
  `).join('')

  const manageLink = params.providerUrl
    ? `<a href="${escapeHtml(params.providerUrl)}" style="color: #C9721A; font-weight: 500;">Manage your subscription →</a>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AstroBidhi Receipt</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFF8F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #4A0E0E;">

  <div style="max-width: 560px; margin: 0 auto; padding: 24px;">

    <!-- Header with decorative divider -->
    <div style="text-align: center; padding: 20px 0;">
      <div style="font-size: 28px; font-weight: 700; color: #6B1D1D; letter-spacing: 1px;">🕉️ AstroBidhi</div>
      <div style="height: 3px; margin: 12px auto; max-width: 80px; background: repeating-linear-gradient(90deg, #C9721A 0px, #C9721A 4px, #D4A843 4px, #D4A843 8px, #6B1D1D 8px, #6B1D1D 12px, #D4A843 12px, #D4A843 16px);"></div>
      <div style="font-size: 13px; color: #8b7355; margin-top: 4px;">Vedic astrology wisdom, delivered to your inbox</div>
    </div>

    <!-- Body -->
    <div style="background: #ffffff; border: 1px solid #f3e8d0; border-radius: 8px; padding: 28px 24px;">

      <h1 style="font-size: 22px; color: #6B1D1D; margin: 0 0 8px 0; font-weight: 700;">Payment receipt</h1>
      <p style="font-size: 14px; color: #8b7355; margin: 0 0 24px 0;">
        ${params.customerName ? `Hi ${escapeHtml(params.customerName)},` : 'Hi,'}<br>
        Thanks for your purchase! Here's your receipt.
      </p>

      <!-- Order info -->
      <div style="background: #FFF8F0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span style="color: #8b7355;">Order ID</span>
          <span style="font-family: monospace; color: #4A0E0E;">${escapeHtml(params.orderId)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span style="color: #8b7355;">Date</span>
          <span style="color: #4A0E0E;">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span style="color: #8b7355;">Payment method</span>
          <span style="color: #4A0E0E; text-transform: capitalize;">${escapeHtml(params.provider)}</span>
        </div>
      </div>

      <!-- Items table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 0; border-bottom: 2px solid #C9721A; color: #6B1D1D; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
            <th style="text-align: right; padding: 8px 0; border-bottom: 2px solid #C9721A; color: #6B1D1D; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemListHtml}
          <tr>
            <td style="padding: 16px 0 4px 0; font-weight: 700; color: #6B1D1D; font-size: 16px;">Total</td>
            <td style="padding: 16px 0 4px 0; text-align: right; font-weight: 700; color: #6B1D1D; font-size: 16px;">${fmt(params.totalCents)}</td>
          </tr>
        </tbody>
      </table>

      ${params.notes ? `<div style="background: #fff7e6; border-left: 3px solid #D4A843; padding: 12px 16px; margin-top: 20px; font-size: 13px; color: #4A0E0E;">${escapeHtml(params.notes)}</div>` : ''}

      <!-- Call to action -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3e8d0;">
        <p style="font-size: 13px; color: #4A0E0E; margin: 0 0 12px 0;">
          Your premium features are now unlocked. Generate charts, run analyses, and explore your cosmic blueprint anytime.
        </p>
        ${APP_BASE_URL ? `<a href="${escapeHtml(APP_BASE_URL)}" style="display: inline-block; padding: 10px 24px; background: linear-gradient(to right, #C9721A, #D4A843); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Open AstroBidhi →</a>` : ''}
        ${manageLink ? `<div style="margin-top: 12px; font-size: 13px;">${manageLink}</div>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #8b7355;">
      <div style="margin-bottom: 8px;">This receipt was sent because you made a purchase on AstroBidhi.</div>
      <div>© ${new Date().getFullYear()} AstroBidhi · Vedic astrology wisdom</div>
    </div>

  </div>
</body>
</html>`

  const text = `AstroBidhi — Payment Receipt

Hi ${params.customerName || 'there'},

Thanks for your purchase! Here's your receipt.

Order ID: ${params.orderId}
Date: ${new Date().toLocaleString()}
Payment method: ${params.provider}

Items:
${params.items.map(i => `  - ${i.name}: ${fmt(i.priceCents)}`).join('\n')}

Total: ${fmt(params.totalCents)}

${params.notes || ''}

${APP_BASE_URL ? `Open AstroBidhi: ${APP_BASE_URL}` : ''}
${params.providerUrl ? `Manage your subscription: ${params.providerUrl}` : ''}

© ${new Date().getFullYear()} AstroBidhi`

  return {
    html,
    text,
    subject: `AstroBidhi receipt — ${fmt(params.totalCents)} (${params.orderId})`,
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ──────────────────── High-level receipt helpers ────────────────────

/**
 * Send a receipt email for a Lemon Squeezy order/subscription.
 * Called from /api/lemonsqueezy/webhook on `order_created` and `subscription_created`.
 *
 * No-ops gracefully if email isn't configured or recipient email is missing.
 */
export async function sendLsReceiptEmail(params: {
  customerEmail: string
  customerName?: string
  orderId: string
  items: ReceiptItem[]
  totalCents: number
  currency?: string
  providerUrl?: string
  notes?: string
}): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) return { sent: false, error: 'Not configured' }

  const { html, text, subject } = renderReceiptEmail({
    ...params,
    provider: 'lemonsqueezy',
  })

  return sendEmail({ to: params.customerEmail, subject, html, text })
}

/**
 * Send a receipt email for a Whop subscription purchase.
 * Called from /api/whop/webhook on `subscription_created`.
 *
 * No-ops gracefully if email isn't configured or recipient email is missing.
 */
export async function sendWhopReceiptEmail(params: {
  customerEmail: string
  customerName?: string
  orderId: string
  items: ReceiptItem[]
  totalCents: number
  currency?: string
  providerUrl?: string
  notes?: string
}): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) return { sent: false, error: 'Not configured' }

  const { html, text, subject } = renderReceiptEmail({
    ...params,
    provider: 'whop',
  })

  return sendEmail({ to: params.customerEmail, subject, html, text })
}
