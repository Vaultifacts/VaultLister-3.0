# Batch Photo / Photo Tools -- Walkthrough Findings

## Open (Needs Fix)

None -- all Batch Photo findings have been resolved.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| P4-photo-1 | Batch Photo / Photo Tools | Determine which photo service is the best for us | Backlog | VERIFIED ✅ 2026-04-26 — Cloudinary chosen; all 3 vars confirmed set in Railway (cloud name `vaultlister`). Background removal/upscale/enhance built via Cloudinary transforms. |
| P4-photo-2 | Batch Photo / Photo Tools | `image_vault` table missing `cloudinary_public_id` column — AI edits failed with SQL error; images uploaded before fix also caused ENOENT on Railway ephemeral FS | 2026-04-26 code audit | FIXED ✅ — commit 30b0afc9: migration 028 adds column, imageVault.js POST /upload now dual-writes to Cloudinary (fire-and-forget) so new images get `cloudinary_public_id` immediately |
| M-35 | Batch Photo | "Remove Background" and "AI Upscale" require AI backend -- unclear error handling | Session 3 | CONFIRMED N/A -- handlers-deferred.js:20641: try/catch wraps API call with toast.error; Cloudinary transforms (e_background_removal, e_upscale) used; errors surface to user |
| L-30 | Batch Photo | "Remove Background"/"AI Upscale" may not have backend support (duplicate of M-35) | Session 4 | CONFIRMED N/A -- duplicate of M-35; same error handling confirmed |
