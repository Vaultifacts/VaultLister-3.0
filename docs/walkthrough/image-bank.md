# Image Bank -- Walkthrough Findings

## Open Items

None -- all Image Bank findings have been resolved.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| M-13 | Image Bank | "5.00 GB free" -- unclear if actual R2 limit or hardcoded | Session 1 | VERIFIED -- storageLimit reads PLAN_STORAGE_GB[tier]: free=0.1GB, starter=1GB, pro=5GB, business=25GB. Live chunk-settings.js confirmed. |

## Extended QA Session Findings (Image Bank Tab)

### Resolved

| Finding | Status |
|---------|--------|
| Quick Photo button is completely non-functional | VERIFIED -- 3d125af -- Quick Photo captures via FileReader base64 |
| AI Auto-Tag modal shows fake hardcoded data with 0 images | VERIFIED -- 3d125af -- AI Auto-Tag now calls real Claude Vision API |
| Cleanup modal shows impossible hardcoded data | VERIFIED -- 3d125af -- Cleanup modal shows real account stats from store |
| Optimize All and Cleanup modals have the same HTML injection rendering bug seen in My Shops | VERIFIED -- 3d125af -- modals rebuilt with correct modal structure |
| Scan Usage silently fails with a backend CSRF token error | VERIFIED -- 3d125af -- CSRF token fetched before API call; error toast shown on failure |
| Page scroll state is not reset on navigation | VERIFIED -- 3d125af -- scroll resets to top on Image Bank navigation |
| Create Folder accepts empty name without validation error | VERIFIED -- 66d02de -- empty name shows toast.error |
| Storage card layout is broken -- text wraps incorrectly | VERIFIED -- 3d125af -- storage stat card replaced with gauge widget |
| Used in Listings: 0 is incorrectly styled as a success/green value | VERIFIED -- 3d125af -- green color applied only when count > 0 |
| The Optimize All modal content is misplaced (listings tool, not image tool) | VERIFIED -- 3d125af -- Optimize All now opens showImageBulkOptimize modal |
| Clicking view toggles (Grid/List) causes unexpected scroll jump | VERIFIED -- 3d125af -- view toggle saves/restores scroll position |
| Select All with 0 images provides no feedback | VERIFIED -- 3d125af -- Select All re-renders with count badge |
| Empty state first images text appears as an incorrectly styled hyperlink | VERIFIED -- 3d125af -- empty state rebuilt; plain paragraph, no link styling |
| Image Bank page title icon is a generic folder icon | VERIFIED -- 3d125af -- page title icon changed to camera/image |
