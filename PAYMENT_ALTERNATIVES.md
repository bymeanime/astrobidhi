# Payment System Alternatives for AstroBidhi

Whop works, but you've already felt the friction: their App Store denial, the
"creators-only" market positioning, and the relatively high fees. This doc
compares 8 realistic alternatives so you can pick the right one (or stack
several) for AstroBidhi.

> **Bottom line up front**: For a consumer astrology SaaS like AstroBidhi,
> **Stripe Checkout + Stripe Customer Portal** is the strongest primary
> choice. Add **Lemon Squeezy** or **Polar** as a Merchant-of-Record
> alternative if you don't want to handle VAT/tax yourself. Keep **Buy Me a
> Coffee** as a tip jar. See [Recommendation](#recommendation) for the full
> proposed stack.

---

## Background — what AstroBidhi actually needs

Before comparing providers, here's what your payment system must support:

1. **Recurring subscriptions** (monthly/yearly premium)
2. **One-time purchases** (single premium analysis, pay-per-reading)
3. **Free trials** (7-day trial → auto-charge)
4. **Promo codes / discounts**
5. **Email receipts + customer self-service** (cancel, update card)
6. **Global payments** (Nepal, India, US, EU — credit cards + ideally UPI / mobile wallets)
7. **Webhook → unlock premium access** in your DB
8. **Refunds** (mostly admin-initiated)
9. **Tax/VAT handling** if you sell to EU/UK customers
10. **No "App Store" review process** — you must be able to ship without approval

---

## Quick comparison table

| Provider | Best for | Fees | Recurring | MoR* | Nepal/India payout | Setup effort | Lock-in |
|---|---|---|---|---|---|---|---|
| **Stripe** | Primary — full control | 2.9% + $0.30 | ✅ Native | ❌ | ❌ (need US/EU/SG entity) | Medium | Low |
| **Lemon Squeezy** | MoR, sells software globally | 5% + $0.50 | ✅ | ✅ | ✅ (via Payoneer) | Low | Low |
| **Polar** | MoR, modern dev tools | 4% + $0.40 | ✅ | ✅ | ❌ | Low | Low |
| **Paddle** | MoR, enterprise SaaS | 5% + $0.50 | ✅ | ✅ | ❌ | Medium | Medium |
| **Razorpay** | India-focused | 2% domestic | ✅ | ❌ | ✅ (India only) | Medium | Low |
| **Gumroad** | Quick one-time sales | 10% | ✅ | ✅ | ✅ (PayPal) | Trivial | Low |
| **Buy Me a Coffee** | Tip jar / donations | 5% | Optional | ❌ | ✅ | Trivial | None |
| **PayPal** | Fallback / global | 4.4% + fixed | ✅ | ❌ | ✅ | Low | Low |
| **Whop** | (Current) creator/membership | 3% + $0.30 | ✅ | ❌ | ✅ | Low | Low |

*MoR = Merchant of Record (they handle VAT/tax collection & remittance for you)

---

## Detailed breakdown

### 1. Stripe — best primary choice for full control

**Pros:**
- Industry standard, rock-solid reliability, beautiful docs
- Stripe Checkout handles subscriptions, one-time, trials, promo codes, all out of the box
- Stripe Customer Portal lets users self-cancel/update card without your support
- Webhooks are reliable and well-documented
- Supports 135+ currencies, Apple Pay, Google Pay, Klarna, etc.
- Lowest fees of any full-featured provider
- You keep all customer data — easy to migrate away later

**Cons:**
- **Not available in Nepal** — you need a US/EU/UK/Singapore/HK business entity
- You handle VAT/tax yourself (or buy Stripe Tax for +0.5%)
- More code to write than MoR alternatives
- Chargeback fees ($15/dispute)

**What it would take to integrate:**
- Replace `src/lib/whop.ts` with `src/lib/stripe.ts`
- Add Stripe webhook handler at `/api/stripe/webhook`
- Replace OAuth flow with Stripe Checkout Session creation
- Store `stripeCustomerId` + `subscriptionId` in your DB
- Customer portal at `/api/stripe/portal`
- ~1 day of code work if you follow their Next.js guide

**Code outline:**
```typescript
// src/lib/stripe.ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export async function createCheckoutSession(userId: string, priceId: string) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/?payment=cancelled`,
    client_reference_id: userId,
    subscription_data: { trial_period_days: 7 },
  })
}

export async function checkUserAccess(stripeCustomerId: string): Promise<boolean> {
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
  })
  return subs.data.length > 0
}
```

**Verdict:** ✅ **Recommended primary** — if you can register a US LLC or use a Stripe Atlas-equivalent.

---

### 2. Lemon Squeezy — best Merchant-of-Record alternative

**Pros:**
- Handles **global VAT/sales tax** for you (huge — EU + UK + Canada + Australia + 30+ US states)
- Accepts PayPal + credit cards natively
- No business entity requirement — individuals can sign up from Nepal/India
- Pays out via Payoneer (works in Nepal) or bank wire
- Beautiful checkout UI, decent docs
- Lower fees than Paddle (5% vs 5%+extras)
- Webhooks work well
- Built-in license keys, digital downloads, subscriptions
- 5% fee includes the tax handling — net cheaper than Stripe+StripeTax

**Cons:**
- 5% + $0.50 per transaction adds up at high volume
- Customer data lives in their system (GDPR/CCPA — they handle it for you)
- Some customization limits on checkout
- Slower API than Stripe
- Not as widely known — less community content

**What it would take:**
- Sign up at lemonsqueezy.com (instant, no review)
- Create a product + variant
- Use their Checkout overlay (drop-in JS) or hosted checkout URL
- Webhook at `/api/lemonsqueezy/webhook` to unlock access
- ~3-4 hours of integration work

**Verdict:** ✅ **Recommended MoR** — best if you don't want to deal with VAT/tax and you're based in Nepal.

---

### 3. Polar — modern MoR, open-source friendly

**Pros:**
- Newest of the bunch (founded 2023)
- Beautiful developer-first API
- 4% + $0.40 — cheaper than Lemon Squeezy and Paddle
- MoR (handles VAT)
- Native Next.js integration docs
- Built for SaaS — subscriptions, metered billing, one-time, all first-class
- Issue tracking + Discord-like community

**Cons:**
- Young company — less battle-tested than Stripe/Paddle
- Payouts via Stripe Connect (need Stripe account in supported country) — **may not work from Nepal directly**
- Smaller community than Lemon Squeezy
- Some features still in beta (e.g., metered billing)

**Verdict:** ⚠️ Worth watching, but the Stripe Connect payout requirement makes it less accessible from Nepal than Lemon Squeezy.

---

### 4. Paddle — enterprise MoR

**Pros:**
- Most established MoR (founded 2012)
- Full VAT/sales tax compliance in 100+ countries
- Robust subscription management
- Handles invoicing, dunning, retries automatically
- Strong fraud prevention

**Cons:**
- **Strict approval process** — they review your business (similar complaint to Whop)
- 5% + $0.50 is on the higher side
- Checkout UI is more corporate, less customizable
- Slower to integrate than Lemon Squeezy
- Customer support can be slow
- Payouts require business verification

**Verdict:** ⚠️ Skip — too much approval friction for a small astrology app, and you've already had enough of approval processes.

---

### 5. Razorpay — best for India

**Pros:**
- **Indian company** — accepts UPI, RuPay, all Indian payment methods
- Low fees: 2% domestic transactions
- Supports recurring subscriptions via UPI Autopay
- Easy Indian bank account payouts
- Good docs, decent Next.js examples
- Now available in some other Asian countries too

**Cons:**
- **India-only payouts** — you need an Indian business entity
- Limited international payment methods (no Apple Pay, no Klarna, etc.)
- Less polished international checkout
- Tax handling is India-only

**Verdict:** ⚠️ Only if you have an Indian business entity and most of your customers are Indian. Combine with Stripe/Lemon Squeezy for international customers.

---

### 6. Gumroad — quickest to ship, highest fees

**Pros:**
- **Trivial setup** — create account, create product, share link, done in 5 minutes
- MoR (handles VAT)
- Supports subscriptions, one-time, licenses
- Beautiful simple checkout
- Payouts to PayPal/bank in most countries
- No business entity requirement
- Already have a presence in your existing "Support AstroBidhi" button area

**Cons:**
- **10% fee** — highest of any serious option
- Limited customization
- No customer portal (users manage via Gumroad, not your site)
- Webhooks are limited
- Mostly used for digital downloads, not SaaS

**Verdict:** ✅ Good for **quick MVP** or for **single pay-per-reading products** where 10% is acceptable. Not ideal for recurring subscriptions.

---

### 7. Buy Me a Coffee — tip jar / casual support

**Pros:**
- Already integrated in your app (`buymeacoffee.com/astrobidhi`)
- 5% fee, no monthly cost
- Instant payouts to PayPal/bank
- Beautiful UX, supports memberships (recurring)
- No approval process
- Works everywhere

**Cons:**
- Not really a "payment system" — more of a creator-tipping platform
- Limited to BMC's UI — can't embed checkout in your site
- No webhooks (you can't auto-unlock premium features based on BMC payments)
- Memberships have limited customization
- Bad for high-volume SaaS — designed for occasional tips

**Verdict:** ✅ Keep as **a secondary "Support us" channel**. Don't use as primary.

---

### 8. PayPal — global fallback

**Pros:**
- Available in 200+ countries including Nepal
- Trusted brand, especially in Asia
- Supports subscriptions
- Users can pay without an account (guest checkout)
- Lower bar than Stripe for Nepal-based businesses

**Cons:**
- **4.4% + fixed fee** — higher than Stripe
- API is older, clunkier, less well-documented
- Notorious for freezing accounts without warning (especially for new businesses)
- Customer support is poor
- Checkout UI feels dated
- Webhooks unreliable compared to Stripe

**Verdict:** ⚠️ Use only as a **fallback payment option** for users who don't have/want credit cards. Don't build your primary flow on it.

---

### 9. Whop (current) — for context

**Pros:**
- Already integrated ✅
- 3% + $0.30 is competitive
- OAuth + access checks work
- Free trials, promo codes native
- No business entity requirement (works from Nepal)

**Cons:**
- App Store denial doesn't actually affect private use, but the messaging was confusing
- Positioned for "creators/memberships" — not a great fit for a SaaS
- Limited payment methods (no UPI, limited wallets)
- Customer portal is on whop.com, not your domain
- Smaller ecosystem than Stripe

**Verdict:** ⚠️ Keep for now if it works. The integration we just shipped is fine. But if you're going to swap, swap to Stripe + Lemon Squeezy.

---

## Recommendation

### The pragmatic 3-tier stack for AstroBidhi

**Tier 1 — Primary (recurring subscriptions + premium analysis purchases):**
- **Lemon Squeezy** if you want zero tax headaches and you're in Nepal without a US entity
- **Stripe** if you can register a US LLC (Stripe Atlas: $500) — lower fees, more control

**Tier 2 — Tip jar / casual support:**
- Keep **Buy Me a Coffee** — already integrated, costs nothing to keep

**Tier 3 — Region-specific (optional, later):**
- Add **Razorpay** later if you get heavy India traffic and have an Indian entity

### Concrete plan

**Phase 1 (this week):** Stick with Whop. The integration we just shipped works. Configure your Whop product and start collecting your first paying users. Don't switch providers until you have ≥10 paying customers — then you'll know what you actually need.

**Phase 2 (1–2 months in, if Whop feels limiting):** Migrate to Lemon Squeezy. The migration is straightforward:
1. Export your existing Whop members (via Whop API)
2. Set up Lemon Squeezy with the same product structure
3. Send existing members a "click here to migrate your payment" email with a free month as compensation
4. Build a `/api/lemonsqueezy/webhook` handler that mirrors the existing `/api/admin/access` logic — when webhook fires, grant `DeviceAccess` with `source='lemonsqueezy'`

**Phase 3 (if you scale globally and want lower fees):** Get a US LLC via Stripe Atlas ($500, takes ~2 weeks). Migrate from Lemon Squeezy to Stripe. Lemon Squeezy's MoR advantage matters less once you have proper accounting.

### What NOT to do

- ❌ Don't integrate all 9 providers — pick 1-2 and ship
- ❌ Don't try to write your own subscription/recurring billing logic — every provider has battle-tested this, just use their APIs
- ❌ Don't store credit card numbers yourself — PCI compliance is a nightmare, use Stripe/Lemon Squeezy's hosted fields
- ❌ Don't trust the client to verify payment status — always use webhooks (server-to-server) to unlock access

---

## Migration cost estimate (Whop → Lemon Squeezy)

| Item | Effort |
|---|---|
| Read Lemon Squeezy API docs | 2 hours |
| Replace `src/lib/whop.ts` with `src/lib/lemonsqueezy.ts` (same interface) | 3 hours |
| Replace `/api/auth/whop` + `/api/auth/callback/whop` with checkout URL redirect + webhook | 3 hours |
| Update `WhopAuthState` → `PaymentAuthState` in `page.tsx` (rename, no logic change) | 1 hour |
| Add `/api/lemonsqueezy/webhook` route | 2 hours |
| Update admin Whop tab → "Payments" tab | 1 hour |
| Update `.env.example` + SETUP docs | 1 hour |
| Test end-to-end with sandbox account | 2 hours |
| **Total** | **~15 hours / 2 days** |

The HMAC-signed session cookie pattern we built is provider-agnostic — you keep that. The access-check function signature (`checkUserAccess(userId) → boolean`) is provider-agnostic. Only the implementation changes.

---

## How to decide — decision tree

```
Are you based in Nepal without a US/EU business entity?
├── Yes → Lemon Squeezy (primary) + Buy Me a Coffee (tips)
│         (Razorpay later if you open an Indian entity)
└── No (you have or can get a US/EU entity)
    ├── Volume < $10k/mo → Lemon Squeezy (no tax headache)
    └── Volume > $10k/mo → Stripe + Stripe Tax (lower fees at scale)
                              + Lemon Squeezy as MoR fallback for EU
```

---

## Provider links

| Provider | Sign up | Docs | Pricing |
|---|---|---|---|
| Stripe | https://dashboard.stripe.com/register | https://docs.stripe.com/nextjs | https://stripe.com/pricing |
| Lemon Squeezy | https://www.lemonsqueezy.com/signup | https://docs.lemonsqueezy.com/ | https://www.lemonsqueezy.com/pricing |
| Polar | https://polar.sh/signup | https://docs.polar.sh/ | https://polar.sh/pricing |
| Paddle | https://www.paddle.com/get-started | https://developer.paddle.com/ | https://www.paddle.com/pricing |
| Razorpay | https://razorpay.com/#get-started | https://razorpay.com/docs/ | https://razorpay.com/pricing/ |
| Gumroad | https://gumroad.com/signup | https://help.gumroad.com/developers | https://gumroad.com/pricing |
| Buy Me a Coffee | https://www.buymeacoffee.com/signup | https://developers.buymeacoffee.com/ | https://www.buymeacoffee.com/terms |
| PayPal | https://developer.paypal.com | https://developer.paypal.com/docs/ | https://www.paypal.com/merchantfees |
| Whop | https://whop.com | https://docs.whop.com/ | https://whop.com/pricing/ |

---

## Final note

**You don't need to switch today.** Whop is working. Ship the existing Whop integration, get your first paying customers, learn what they actually want, then decide if a switch is worth it. Provider switching is a 2-day project — small in the grand scheme, but a distraction if you do it before you have product-market fit.

If you do decide to switch later, the architecture we built (signed sessions, `checkUserAccess(userId)` abstraction, admin diagnostic tab) is provider-agnostic. The migration will be a clean swap of one file (`src/lib/whop.ts` → `src/lib/payments.ts`) plus the webhook handler.
