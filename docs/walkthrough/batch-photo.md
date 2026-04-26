# Batch Photo / Photo Tools -- Walkthrough Findings

## Open (Needs Fix)

None -- all Batch Photo findings have been resolved.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| P4-photo-1 | Batch Photo / Photo Tools | Determine which photo service is the best for us | Backlog | VERIFIED ✅ 2026-04-26 — Cloudinary chosen; CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET all confirmed set in Railway. Background removal/upscale/enhance already built via Cloudinary transforms in handlers-deferred.js. |
| M-35 | Batch Photo | "Remove Background" and "AI Upscale" require AI backend -- unclear error handling | Session 3 | CONFIRMED N/A -- handlers-deferred.js:20641: try/catch wraps API call with toast.error; Cloudinary transforms (e_background_removal, e_upscale) used; errors surface to user |
| L-30 | Batch Photo | "Remove Background"/"AI Upscale" may not have backend support (duplicate of M-35) | Session 4 | CONFIRMED N/A -- duplicate of M-35; same error handling confirmed |
