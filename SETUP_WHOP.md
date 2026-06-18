# Whop Setup Guide for AstroBidhi

AstroBidhi uses Whop as a **private** payment/membership system. Users buy your Whop product, then log into AstroBidhi via OAuth to unlock premium features.

> **Important**: This is **NOT** a Whop App Store listing. No review or approval is required. You are simply using Whop as a payment provider for your own users. The Whop App Store denial email you may have received does **not** affect this integration.

---

## TL;DR (Quick Setup)

1. Verify your Whop company email at https://whop.com
2. Enable Developer Mode at https://whop.com/dashboard/developer
3. Create an OAuth app at https://whop.com/dashboard/developer/apps
4. Create a server-side API key in the same dashboard
5. Create a Product at https://whop.com/dashboard/products
6. Copy 5 values into your `.env` file (see below)
7. Restart your app — done!

---

## Step-by-Step

### Step 1 — Verify your Whop account

1. Go to https://whop.com and sign in (or create an account).
2. Top-right corner → **Settings**.
3. Confirm your company email is verified (check inbox for confirmation email).
4. Under **Company**, fill in your business name and any required details.
5. Optional but recommended: add a payout method so you can actually receive payments.

### Step 2 — Enable Developer Mode

1. Go to https://whop.com/dashboard/developer.
2. Click **Enable Developer Mode** (or similar).
3. After enabling, you should see options to create OAuth apps and API keys.

> If you don't see this option, your account may need email verification or additional company details first.

### Step 3 — Create an OAuth App

1. Go to https://whop.com/dashboard/developer/apps.
2. Click **Create App** (or **New App**).
3. Fill in:
   - **App name**: `AstroBidhi` (or any name you prefer)
   - **App type**: OAuth (with user login) — sometimes called "Web App"
   - **Redirect URI**: `https://YOUR-DEPLOYMENT-URL/api/auth/callback/whop`
     - For Railway production: `https://astrobidhi-production.up.railway.app/api/auth/callback/whop`
     - The URI must use `https://` and must match `WHOP_REDIRECT_URI` in your `.env` exactly.
4. Save the app.
5. On the app details page, copy:
   - **Client ID** → paste into `.env` as `WHOP_APP_ID`
   - **Client Secret** → paste into `.env` as `WHOP_CLIENT_SECRET`
     (only shown once — save it somewhere safe!)

### Step 4 — Create a Server-Side API Key

1. Still in the developer dashboard, find **API Keys** (or **Bearer tokens**).
2. Click **Create API Key** (or similar).
3. Give it a name like `AstroBidhi Server`.
4. Copy the key — it starts with `sk-` or similar.
5. Paste it into `.env` as `WHOP_API_KEY`.

> This key is used server-side only. Never expose it in the browser.

### Step 5 — Create a Product

1. Go to https://whop.com/dashboard/products.
2. Click **Create Product** (or **New Product**).
3. Fill in:
   - **Name**: e.g., `AstroBidhi Premium`
   - **Description**: what members get (unlimited analyses, priority AI, etc.)
   - **Pricing**: e.g., $9/month, $49/year, or one-time $99
   - **Free trial** (optional but recommended): 7 days free
4. Save.
5. Look at the URL of the product page — it will end with `prod_xxxxxxxxx`.
6. Copy that Product ID into `.env` as `WHOP_PRODUCT_ID`.
7. (Optional) On the product page, click **Share** → copy the **Checkout link**.
   Paste it into `.env` as `WHOP_CHECKOUT_URL`. If you skip this, we auto-generate one from the product ID.

### Step 6 — Find Your Company ID (optional but recommended)

1. Go to https://whop.com/dashboard/settings.
2. Find your **Company ID** — looks like `cmp_xxxxxxxxx`.
3. Paste it into `.env` as `WHOP_COMPANY_ID`.
4. This is used as a fallback: if `WHOP_PRODUCT_ID` is ever missing, anyone with a membership under your company will still get access.

### Step 7 — Configure Your `.env`

Your final `.env` should include:

```bash
# Required for login + access checks
WHOP_APP_ID=app_xxxxxxxxxxxxxxxx
WHOP_CLIENT_SECRET=sk_xxxxxxxxxxxxxxxx
WHOP_API_KEY=sk_xxxxxxxxxxxxxxxx
WHOP_PRODUCT_ID=prod_xxxxxxxxxxxxxxxx

# Required for OAuth callback to work
WHOP_REDIRECT_URI=https://your-deployment-url.example.com/api/auth/callback/whop

# Optional but recommended
WHOP_COMPANY_ID=cmp_xxxxxxxxxxxxxxxx
WHOP_CHECKOUT_URL=https://whop.com/checkout/prod_xxxxxxxxxxxxxxxx
WHOP_EXPERIENCE_ID=

# Important: also used to sign Whop session cookies (HMAC)
SESSION_SECRET=a-long-random-string-change-in-production
```

### Step 8 — Deploy & Test

1. Deploy your app (or restart local dev: `bun dev` / `npm run dev`).
2. Visit your site — you should now see **Start Free Trial** and **Buy Now** buttons in the header.
3. Open `/admin` → **Whop** tab. Verify:
   - Overall: ✅ Configured
   - API Health: HTTP 200
   - All env vars show green checkmarks
4. Test the OAuth flow:
   - Click **Start Free Trial** → you'll be redirected to Whop to log in.
   - After logging in, you'll be redirected back to AstroBidhi.
   - If you don't have a membership yet, you'll be sent to the checkout page.

---

## Diagnostic Endpoints

### `/api/whop/setup` (public, no auth)

Returns a JSON object showing which env vars are set and whether the Whop API responds. Use this to verify your setup without exposing secrets:

```bash
curl https://your-deployment-url.example.com/api/whop/setup
```

Example healthy response:

```json
{
  "configured": true,
  "hasAppId": true,
  "hasClientSecret": true,
  "hasApiKey": true,
  "hasProductId": true,
  "hasRedirectUri": true,
  "hasCheckoutUrl": true,
  "appIdPreview": "app_x…abcd",
  "productIdPreview": "prod_x…wxyz",
  "redirectUri": "https://astrobidhi-production.up.railway.app/api/auth/callback/whop",
  "checkoutUrl": "https://whop.com/checkout/prod_xxxxxxxxxxxxxxxx",
  "api": { "reachable": true, "status": 200, "error": null },
  "diagnosis": ["All required env vars are set and the Whop API is reachable. You should be able to log in."],
  "nextSteps": ["Visit your site and click \"Start Free Trial\" to test the OAuth flow."]
}
```

### `/api/admin/whop` (admin auth required)

Returns full config + recent active memberships. Available in the **Admin → Whop** tab.

---

## How the integration works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   User      │         │  AstroBidhi  │         │   Whop      │
│             │         │  (Next.js)   │         │             │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. Click "Buy Now"    │                        │
       │ ────────────────────────────────────────────────▶
       │                       │                        │
       │ 2. Pays on Whop       │                        │
       │ ◀────────────────────────────────────────────────
       │                       │                        │
       │ 3. Click "Start Trial"│                        │
       │ ──────────────▶        │                        │
       │                       │ 4. OAuth redirect ──────▶
       │                       │                        │
       │ ◀────────────── 5. Whop login prompt ───────────
       │                       │                        │
       │ 6. Authorize ──────────────────────────────────▶
       │                       │                        │
       │                       │ ◀── 7. Auth code ───────
       │                       │                        │
       │                       │ 8. Exchange code for token
       │                       │ ──────────────────────▶
       │                       │ ◀── access_token ──────
       │                       │                        │
       │                       │ 9. Check user access   │
       │                       │ ──────────────────────▶
       │                       │ ◀── has_access: true ──
       │                       │                        │
       │ ◀── 10. Set signed    │                        │
       │     session cookie +  │                        │
       │     redirect to home  │                        │
       │                       │                        │
       │ 11. Use premium       │                        │
       │     features 🎉       │                        │
```

### What's stored where

- **Whop session cookie** (`whop_session`): HMAC-signed JSON containing `userId`, `name`, `email`, `picture`, `accessToken`, `refreshToken`, `hasAccess`, `accessLevel`, `expiresAt`. Stored for 30 days, httpOnly, secure in production.
- **AstroBidhi DB** (`UserAccount` table): links `whopUserId` to a `primaryDeviceId` so we can associate analyses with the user.

---

## Troubleshooting

### "Whop integration not configured" error

You're missing `WHOP_APP_ID` or `WHOP_API_KEY`. Run `curl /api/whop/setup` to see exactly which vars are missing.

### OAuth fails with "redirect_uri mismatch"

The `WHOP_REDIRECT_URI` in your `.env` must EXACTLY match what you entered in the Whop OAuth app settings. Check for:
- Trailing slash
- `http://` vs `https://`
- Subdomain differences (e.g., `astrobidhi-production.up.railway.app` vs `astrobidhi.railway.app`)

### After login, user has no access

- Verify `WHOP_PRODUCT_ID` is correct (check Whop dashboard product URL).
- Verify the user actually has an active membership (check Whop dashboard → Memberships).
- Check the **Admin → Whop** tab → **Recent Active Memberships** to see if Whop is returning the membership.
- If you want any user from your company to get access (regardless of product), set `WHOP_COMPANY_ID`.

### "API key rejected (401)"

Your `WHOP_API_KEY` is invalid or expired. Generate a new one in the Whop developer dashboard.

### Free trial not working

Free trials are configured on the **Whop product**, not in AstroBidhi. In Whop Dashboard → Products → your product → Pricing → enable "Free trial" and set duration. Once configured, anyone who signs up via Whop will have `has_access: true` from the moment they complete the trial signup.

### I want to give someone free access without going through Whop

Use the **Admin → Access** tab to grant `premium` or `unlimited` access to a specific device ID. This bypasses Whop entirely.

---

## FAQ

**Q: Do I need to publish to the Whop App Store?**
A: No. This is a private OAuth integration for your own users. App Store listing is a completely separate thing — and AstroBidhi was denied for the App Store, but that denial does **not** affect this private integration.

**Q: Can I use a different payment provider (Stripe, PayPal, etc.)?**
A: Not currently. The code is tightly integrated with Whop's OAuth + access-check API. Adding Stripe would require replacing the entire auth + access layer.

**Q: How much does Whop charge?**
A: Whop takes a percentage of each transaction (typically 3% + $0.30, but check their current pricing). There's no monthly fee for using the OAuth integration.

**Q: Can I have multiple products (e.g., monthly + yearly)?**
A: Yes. Set `WHOP_PRODUCT_ID` to your "primary" product. If you want all products from your company to grant access, set `WHOP_COMPANY_ID` instead (or in addition). For per-product gating, you'd need to extend `checkUserAccess` to query multiple product IDs — out of scope for this guide.

**Q: What if I change my Whop product?**
A: Update `WHOP_PRODUCT_ID` and `WHOP_CHECKOUT_URL` in `.env`, then redeploy. Existing users with the old product will lose access on their next `/api/auth/me` refresh (token expires after 1 hour).

---

## Need more help?

- Whop docs: https://docs.whop.com
- Whop developer dashboard: https://whop.com/dashboard/developer
- AstroBidhi admin diagnostic: visit `/admin` → **Whop** tab
- Public diagnostic: `curl https://your-deployment-url/api/whop/setup`
