import { NextRequest, NextResponse } from 'next/server'
import { checkLsAccessByEmail, isLsConfigured } from '@/lib/lemonsqueezy'

// GET /api/lemonsqueezy/status?email=user@example.com
// Public endpoint that checks if a given email has an active LS subscription.
//
// Used by the front-end to verify access after the user returns from checkout.
// We don't expose subscription IDs or raw data — just hasAccess + reason.

export async function GET(request: NextRequest) {
  if (!isLsConfigured()) {
    return NextResponse.json({
      configured: false,
      hasAccess: false,
      accessLevel: 'no_access',
      message: 'Lemon Squeezy not configured.',
    })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json(
      { detail: 'email parameter is required' },
      { status: 400 }
    )
  }

  const result = await checkLsAccessByEmail(email)

  return NextResponse.json({
    configured: true,
    email,
    hasAccess: result.hasAccess,
    accessLevel: result.accessLevel,
    reason: result.reason,
    subscription: result.subscription ? {
      status: result.subscription.status,
      statusFormatted: result.subscription.statusFormatted,
      currentPeriodEnd: result.subscription.currentPeriodEnd,
      trialEndsAt: result.subscription.trialEndsAt,
      renewsAt: result.subscription.renewsAt,
      cancelled: result.subscription.cancelled,
    } : null,
  })
}
