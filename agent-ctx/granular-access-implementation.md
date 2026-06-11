# Task: Granular Access System Implementation

## Summary
Implemented a comprehensive granular access system for AstroBidhi that replaces the simple premium/unlimited binary with per-analysis-type access, product bundles, and promo codes.

## Files Created
1. `src/app/api/admin/catalog/route.ts` - CRUD for PremiumCatalog (GET list, POST create)
2. `src/app/api/admin/catalog/[analysisType]/route.ts` - Update/Delete catalog items
3. `src/app/api/admin/bundles/route.ts` - CRUD for ProductBundle (GET list with items, POST create with items)
4. `src/app/api/admin/bundles/[bundleId]/route.ts` - Update/Delete bundles with items
5. `src/app/api/admin/promos/route.ts` - CRUD for PromoCode (GET list, POST create)
6. `src/app/api/admin/promos/[promoId]/route.ts` - Update/Delete promo codes
7. `src/app/api/catalog/route.ts` - Public catalog endpoint (no auth, active items only)

## Files Modified
1. `src/lib/db.ts` - Added 5 new tables (PremiumCatalog, ProductBundle, ProductBundleItem, PromoCode, DeviceAccess) with indexes, updated tablesToCheck, added seedDefaultData() function
2. `src/app/api/admin/access/route.ts` - Enhanced to support both legacy (accessLevel) and granular (analysisTypes array) formats, returns both UserAccess and DeviceAccess grants
3. `src/app/api/admin/access/[deviceId]/route.ts` - Enhanced to check/revoke from both UserAccess and DeviceAccess tables
4. `src/app/api/ai-analysis/route.ts` - Replaced checkAdminGrantedAccess with checkDeviceAccess that queries PremiumCatalog + DeviceAccess + UserAccess, removed hardcoded PREMIUM_TYPES
5. `src/app/api/access/route.ts` - Enhanced to return granular access info (grantedTypes, allPremiumAccess, unlimitedAccess)

## Build Status
- Build succeeded with all new routes registered
- Lint errors are pre-existing (in page.tsx, not from this change)
