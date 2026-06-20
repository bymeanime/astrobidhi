# Lemon Squeezy Setup Guide for AstroBidhi

Lemon Squeezy (LS) is a **Merchant of Record** (MoR) payment provider — they
handle global VAT/sales tax for you, accept PayPal + credit cards natively,
and pay out via Payoneer (which works from Nepal) or bank wire.

You can run LS **alongside** Whop — the front-end shows "Buy Now" buttons
for whichever providers are configured. Users who pay via LS get premium
access via the `DeviceAccess` table (same mechanism as admin grants), so
no other code changes are needed.

> **Why use LS instead of (or with) Whop?**
> - VAT/tax handled automatically (huge if you have EU/UK customers)
> - No business entity requirement — individuals can sign up from Nepal
> - PayPal support out of the box
> - Better international payment methods than Whop

---

## TL;DR (Quick Setup)

1. Sign up at https://app.lemonsqueezy.com/signup (instant, no review)
2. Create a Product with a Variant
3. Generate an API key
4. Create a Webhook → copy the signing secret
5. Fill in 5 env vars in `.env`
6. Verify in `/admin` → "Lemon Squeezy" tab

---

## Step-by-Step

### Step 1 — Create a Lemon Squeezy account

1. Go to https://app.lemonsqueezy.com/signup.
2. Sign up with your email (Google account also works).
3. **No approval process** — you're in immediately.
4. Complete your profile (name, store name). You don't need a registered
   business entity — individuals can use LS.

### Step 2 — Create a Product and Variant

1. Go to https://app.lemonsqueezy.com/products.
2. Click **+ New Product**.
3. Fill in:
   - **Name**: e.g., `AstroBidhi Premium`
   - **Description**: what members get (unlimited analyses, priority AI, etc.)
   - **Category**: Software / SaaS
   - **Store**: select your store
4. Save the product.
5. After saving, click **+ Add Variant**.
6. Configure the variant:
   - **Name**: e.g., `Monthly`
   - **Pricing**: `Subscription` → $9/month (or whatever you want)
   - **Free trial**: 7 days (optional but recommended)
   - **License keys**: leave off (we're using webhooks, not licenses)
7. Save the variant.
8. Look at the URL of the variant edit page — it ends with something like
   `variants/67890/edit`. Copy that number — that's your **Variant ID**.

> **Tip**: You can also find the Variant ID by going to the product page
> and clicking the variant. The URL contains the ID.

### Step 3 — Generate an API Key

1. Go to https://app.lemonsqueezy.com/settings/api.
2. Click **+ Create API Key**.
3. Name it `AstroBidhi Server`.
4. Copy the key — it starts with `eyJ` (it's a JWT).
5. Paste it into `.env` as `LEMONSQUEEZY_API_KEY`.
6. **Find your Store ID**: go to https://app.lemonsqueezy.com/stores and
   click your store. The URL ends with `/stores/12345` — that number is
   your **Store ID**. Paste it into `.env` as `LEMONSQUEEZY_STORE_ID`.

### Step 4 — Create a Webhook

1. Go to https://app.lemonsqueezy.com/settings/webhooks.
2. Click **+ Add Webhook**.
3. Fill in:
   - **Callback URL**: `https://YOUR-DEPLOYMENT-URL/api/lemonsqueezy/webhook`
     - For Railway production: `https://astrobidhi-production.up.railway.app/api/lemonsqueezy/webhook`
     - Must use `https://` — LS rejects `http://`
   - **Signing secret**: LS auto-generates one. **Copy it now** — you'll need it.
   - **Events to send**: select at minimum:
     - `subscription_created`
     - `subscription_updated`
     - `subscription_cancelled`
     - `subscription_expired`
     - `subscription_paused`
     - `subscription_resumed`
     - `subscription_unpaid`
     - `subscription_trial_ended`
     - `order_created` (for one-time purchases — bundles + single analyses)
     - `order_refunded` (so we can revoke access on refunds)
4. Save the webhook.
5. Paste the signing secret into `.env` as `LEMONSQUEEZY_WEBHOOK_SECRET`.

> **Important**: The webhook secret is shown only once. If you lose it,
> you'll need to delete and recreate the webhook.

### Step 5 — (Optional) Get a Static Checkout URL

This is optional — if you skip it, the app will generate a fresh checkout
URL via the API each time a user clicks "Buy Now", which gives you per-user
customization (email prefill, deviceId tracking) but is slightly slower.

If you want a static URL:
1. Go to your product page in LS dashboard.
2. Click **Share** → copy the **Checkout link**.
3. Paste it into `.env` as `LEMONSQUEEZY_CHECKOUT_URL`.

### Step 6 — Configure Your `.env`

Your LS section in `.env` should look like:

```bash
# Lemon Squeezy
LEMONSQUEEZY_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOi...
LEMONSQUEEZY_STORE_ID=12345
LEMONSQUEEZY_VARIANT_ID=67890
LEMONSQUEEZY_WEBHOOK_SECRET=2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q
LEMONSQUEEZY_CHECKOUT_URL=  # optional, leave blank to auto-generate
NEXT_PUBLIC_URL=https://your-deployment-url.example.com
```

### Step 7 — Deploy & Verify

1. Deploy your app (or restart local dev: `bun dev` / `npm run dev`).
2. Open `/admin` → **Lemon Squeezy** tab.
3. Verify:
   - Overall: ✅ Configured
   - API Health: HTTP 200
   - Webhook: ✅ Secret Set
   - All env vars show green checkmarks
4. Click **Test Checkout** in the Quick Actions area — you should be
   redirected to the LS checkout page (use LS's test card numbers if
   available, otherwise you'll be making a real payment).
5. To test the webhook end-to-end:
   - Use LS's **Send Test Event** button on the webhook settings page.
   - Or complete a real checkout with your own card and check that a row
     appears in the **Recent Subscriptions** table.

---

## Diagnostic Endpoints

### `/api/lemonsqueezy/setup` (public, no auth)

Returns a JSON object showing which env vars are set + whether the LS API
responds + the webhook URL you should register in the LS dashboard:

```bash
curl https://your-deployment-url.example.com/api/lemonsqueezy/setup
```

### `/api/lemonsqueezy/status?email=user@example.com` (public)

Check if a given email has an active LS subscription:

```bash
curl https://your-deployment-url.example.com/api/lemonsqueezy/status?email=user@example.com
```

Returns:
```json
{
  "configured": true,
  "email": "user@example.com",
  "hasAccess": true,
  "accessLevel": "active",
  "reason": null,
  "subscription": {
    "status": "active",
    "statusFormatted": "Active",
    "currentPeriodEnd": "2026-07-19T10:30:00.000000Z",
    "trialEndsAt": null,
    "renewsAt": "2026-07-19T10:30:00.000000Z",
    "cancelled": false
  }
}
```

### `/api/admin/lemonsqueezy` (admin auth required)

Returns full config + recent subscriptions. Available in the **Admin →
Lemon Squeezy** tab.

---

## How the integration works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   User      │         │  AstroBidhi  │         │     LS      │
│             │         │  (Next.js)   │         │             │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. Click "Pay with LS"│                        │
       │ ──────────────▶        │                        │
       │                       │ 2. Create checkout ────▶
       │                       │ ◀── checkout URL ──────│
       │ ◀── redirect to LS ───│                        │
       │                       │                        │
       │ 3. Pay on LS hosted page                       │
       │ ────────────────────────────────────────────────▶
       │                       │                        │
       │ ◀── 4. Redirect back to /?payment=success ─────│
       │                       │                        │
       │                       │ ◀── 5. Webhook event ──│
       │                       │    (subscription_created)
       │                       │                        │
       │                       │ 6. Upsert LsSubscription│
       │                       │    Grant DeviceAccess   │
       │                       │    (source=lemonsqueezy)│
       │                       │                        │
       │ 7. Refresh page → premium features unlocked 🎉 │
       │                       │                        │
       │                       │ 8. (Recurring) Monthly ─│
       │                       │    webhook fires on ────│
       │                       │    renewal, cancel, etc │
```

### What's stored where

- **`LsSubscription` table** (new): one row per LS subscription, keyed by
  `subscriptionId`. Updated on every webhook event.
- **`DeviceAccess` table** (existing, repurposed): when a webhook fires
  with `subscription_created`/`updated` and the user's `deviceId` was
  passed at checkout, we grant them `all_premium` access with
  `source='lemonsqueezy'` and `expiresAt` set to the subscription's
  `currentPeriodEnd` (so it auto-expires if they cancel and the webhook
  revocation logic misses for some reason).

### Why no OAuth (unlike Whop)?

Whop uses OAuth because Whop's product is "log in with Whop to access
your memberships" — they want users to be Whop users first.

Lemon Squeezy doesn't have a "log in with LS" product. Users just pay on
LS's hosted checkout and LS sends webhooks. The user never logs into LS
on your site — they only enter their email + credit card at checkout.

This means **access is determined by webhook state, not by an API call
on every page load** (unlike Whop). This is faster and doesn't depend on
LS's API being up.

---

## Troubleshooting

### "Lemon Squeezy not configured" error

You're missing `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, or
`LEMONSQUEEZY_VARIANT_ID`. Run `curl /api/lemonsqueezy/setup` to see
exactly which vars are missing.

### Webhook returns 401 "Invalid signature"

The `LEMONSQUEEZY_WEBHOOK_SECRET` in your `.env` doesn't match the
signing secret LS shows on the webhook settings page. Re-copy it from
the LS dashboard.

### Webhook returns 200 but no row appears in `LsSubscription`

Check the server logs for `[LS Webhook]` messages. Common causes:
- The `LsSubscription` table doesn't exist (database init failed — check
  the Admin → Database diagnostic)
- The webhook event type isn't one we handle (check `result.eventName`
  in the logs)
- JSON parsing failed (check `result.handled = false` in logs)

### User paid but doesn't have premium access on the site

The webhook fires asynchronously — there can be a few seconds delay
between payment and access being granted. Ask the user to:
1. Wait 30 seconds
2. Refresh the page
3. If still no access, check Admin → Lemon Squeezy tab to see if their
   subscription appears
4. If it appears but they still don't have access, the issue is likely
   that their `deviceId` wasn't passed at checkout (so we couldn't link
   the webhook to their browser). Manually grant them access in
   Admin → Access tab using their deviceId.

### Free trial not working

Free trials are configured on the **LS variant**, not in AstroBidhi.
In LS Dashboard → Products → your product → variant → enable "Free trial"
and set duration. Once configured, anyone who subscribes will be in
`on_trial` status for that period — the webhook grants them full premium
access immediately, and LS will charge them automatically when the trial
ends.

### I want to give someone free access without going through LS

Use the **Admin → Access** tab to grant `premium` or `unlimited` access
to a specific device ID. This bypasses LS entirely (and Whop, too).

---

## LS vs Whop — which should I use?

| Aspect | Whop | Lemon Squeezy |
|---|---|---|
| Approval needed? | No (private use) | No |
| Works from Nepal? | ✅ | ✅ (via Payoneer) |
| OAuth login flow? | ✅ | ❌ (webhooks only) |
| VAT/tax handled? | ❌ (you handle) | ✅ (MoR) |
| PayPal support | ❌ | ✅ |
| Fee | 3% + $0.30 | 5% + $0.50 |
| Free trials | ✅ (on product) | ✅ (on variant) |
| Promo codes | ✅ | ✅ |
| Customer portal | Whop.com | LS dashboard |
| Setup time | ~10 min | ~15 min |

**Recommendation**: Start with whichever feels easier. If you have
international customers (especially EU/UK), LS is much better — the VAT
handling alone saves you 10+ hours of tax compliance work per year.
If you're mostly selling to US customers, Whop is slightly cheaper.

You can also **run both** — give users the choice at checkout. Most
won't care which provider they use, but having both gives you
redundancy (if one provider has an outage, the other still works).

---

## FAQ

**Q: Can I migrate existing Whop users to LS?**
A: Yes, but it's manual. Export your Whop members (via Whop API), then
   email each one a unique LS checkout link with a 100%-off promo code
   for the first month (so they don't pay twice). When they pay via LS,
   the webhook grants them LS-based access; their old Whop access
   remains valid until their Whop subscription naturally expires.

**Q: What happens if a user has both Whop and LS access?**
A: They get premium access — the access-check is "OR" across all
   sources. When one expires/cancels, the other still grants access.

**Q: How much does LS cost?**
A: 5% + $0.50 per transaction. No monthly fee. So a $9 subscription
   costs you $0.95 in fees (you receive $8.05).

**Q: When does LS pay out?**
A: Default payout schedule is every 2 weeks, but you can change it to
   weekly or daily in LS settings. Payouts go to Payoneer (recommended
   for Nepal) or direct bank wire (limited countries).

**Q: Can I sell one-time analyses (not subscriptions) via LS?**
A: Yes — create a "one-time payment" variant in LS instead of a
   subscription variant. The webhook will still fire
   `order_created` (we currently don't handle that event, but it's
   trivial to add — just edit `processLsWebhookEvent` in
   `src/lib/lemonsqueezy.ts`). For now, focus on subscriptions.

---

## Need more help?

- LS docs: https://docs.lemonsqueezy.com
- LS API reference: https://docs.lemonsqueezy.com/api
- LS webhook events: https://docs.lemonsqueezy.com/api/webhooks
- AstroBidhi admin diagnostic: visit `/admin` → **Lemon Squeezy** tab
- Public diagnostic: `curl https://your-deployment-url/api/lemonsqueezy/setup`
