# Task: Implement Free Trial/Access Options for AstroBidhi

## Summary
Implemented two free trial/access options:
- **Option B: Admin-Granted Access via Database** (code changes)
- **Option A: Whop Free Trials / Promo Codes** (documentation + config)

## Files Modified

### 1. `src/lib/db.ts`
- Added `UserAccess` table to `CREATE_TABLES_SQL` with columns: id, deviceId, accessLevel, grantedBy, reason, expiresAt, createdAt
- Added `UserAccess_deviceId_idx` index
- Added `UserAccess` to `tablesToCheck` in `ensureTablesExist()`

### 2. `src/app/api/admin/access/route.ts` (NEW)
- GET: List all access grants (admin-protected)
- POST: Grant access to a device (admin-protected)
- Supports `premium` and `unlimited` access levels
- Handles upsert (update existing active grants)
- Uses `verifyAdminRequest` from `@/lib/admin-auth`
- Uses `rawQuery`/`rawExecute` from `@/lib/db` (NOT Prisma ORM)
- Uses `randomUUID()` from crypto for IDs

### 3. `src/app/api/admin/access/[deviceId]/route.ts` (NEW)
- GET: Check access for a specific device (admin-protected)
- DELETE: Revoke access for a device (admin-protected)
- Filters expired grants, returns effective access level

### 4. `src/app/api/access/route.ts` (NEW)
- GET: Public endpoint for users to check their own access
- Takes `deviceId` as query parameter
- Returns `hasAccess`, `accessLevel`, `reason`, `expiresAt`
- Degrades gracefully on DB error (returns no-access)

### 5. `src/app/api/ai-analysis/route.ts`
- Added `checkAdminGrantedAccess()` helper: queries UserAccess table for device grants
- Added `checkWhopAccess()` helper: checks Whop membership via session cookie
- **Premium gating**: Before AI call, checks if analysis type is premium AND user lacks both Whop and admin access → returns 403 with `premiumRequired: true`
- **Rate limit bypass**: Users with admin-granted `unlimited` access skip device rate limits

### 6. `src/app/page.tsx`
- Added `AdminAccessState` interface and `AdminAccessContext`
- Added `useAdminAccess()` hook
- Main app component: fetches admin access on mount from `/api/access?deviceId=...`
- Provided `AdminAccessContext.Provider` wrapping the app
- `AIAnalysisPanel`: Uses `adminAccess.hasAccess` alongside `whopAuth.hasAccess` for premium checks
- `handleAnalysisClick`: Checks both Whop and admin access before showing premium dialog
- `handleAnalyze`: Checks both access types; handles 403 `premiumRequired` from API
- Premium dialog: Updated to mention admin-granted access, shows admin access status hints
- Premium dialog CTA: Changed from "Get Premium Access" to "Start Free Trial"
- Nav: Shows green badge for admin-granted access (PREMIUM/UNLIMITED) when no Whop access

### 7. `.env.example`
- Added comprehensive comments explaining Whop free trial setup
- Added Whop promo code documentation
- Added admin-granted access alternative documentation

## Build Verification
- `npm --prefix /home/z/my-project/astrobidhi run build` passes successfully
- All new routes visible in build output:
  - `/api/access`
  - `/api/admin/access`
  - `/api/admin/access/[deviceId]`
