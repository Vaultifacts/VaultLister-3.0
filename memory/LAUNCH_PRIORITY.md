# VaultLister — Launch Priority Reference
> **HISTORICAL — Do not use as current task source. Generated 2026-04-11; superseded by `docs/OPEN_ITEMS.md`.**
> **CR-4 (EasyPost) was re-opened 2026-04-22: live verification returned 503 {"error":"EasyPost not configured"}. Ignore "RESOLVED" status below.**
*Generated 2026-04-11 from STATUS.md, LAUNCH_AUDIT_2026-04-03.md, and 17+ walkthrough sessions*

---

## TIER 0 — HARD BLOCKERS
*Resolve these before any acquisition push. Users who sign up now will hit them.*

| ID | Blocker | Type | Status | Next Action |
|----|---------|------|--------|-------------|
| ~~CR-2~~ | ~~`OAUTH_MODE` defaults to `'mock'`~~ | Config | **RESOLVED** | `OAUTH_MODE=real` confirmed in Railway 2026-04-07 |
| CR-3 | Stripe price IDs not configured — billing flow non-functional | Config | ~~**OPEN**~~ **RESOLVED 2026-04-20** | ~~Set `STRIPE_PRICE_ID_STARTER`, `_PRO`, `_BUSINESS` in Railway (user action)~~ — Done |
| CR-4 | EasyPost API key under anti-fraud review — shipping label creation blocked | External | ~~**BLOCKED**~~ **RESOLVED 2026-04-20** | ~~Wait for EasyPost unlock~~ — EASYPOST_API_KEY set in Railway |
| ~~CR-5~~ | ~~eBay bot selector verification~~ | ~~Code~~ | **NOT NEEDED** | eBay cross-listing uses the official Sell API (`ebayPublish.js`), not the bot. Bot is legacy/unused. Do not run it. |
| CR-10 | OAuth/connection flows not all built — Google, eBay, Shopify functional; Poshmark/Mercari/Grailed/Whatnot are Playwright-only (bot credentials); Etsy/Depop/Facebook pending | Code | **PARTIAL** | Build Poshmark credential-connect flow first (highest-volume); Etsy pending API approval; others post-launch |

**Stop/Go Criteria:**
- ~~Do not run acquisition campaigns until CR-2 is resolved~~ — **CR-2 RESOLVED** 2026-04-07
- ~~Do not launch paid plans until CR-3 is resolved (billing is fake)~~ — RESOLVED 2026-04-20
- ~~CR-4 has no unlock action available — do not block launch on it if other tiers are clear~~ — RESOLVED 2026-04-20

---

## TIER 1 — PRODUCT READINESS
*These don't block signup but will hurt activation, conversion, or credibility.*

| Item | Priority | Status | Action |
|------|----------|--------|--------|
| Onboarding first-run test | HIGH | Never tested with a real new account | Create a fresh account, go through onboarding, connect one platform end-to-end — fix what breaks |
| ~~`OAUTH_MODE=real` smoke test~~ | ~~HIGH~~ | **DONE** — confirmed in Railway 2026-04-07 | — |
| Competitive wedge defined | HIGH | Not documented anywhere | Answer "why VaultLister over Vendoo/List Perfectly" before outreach — pick one clear advantage |
| eBay integration | MEDIUM | Uses OAuth REST API — no bot | eBay cross-listing handled by `ebayPublish.js` + `ebaySync.js`; `ebay-bot.js` deleted — NOT NEEDED |
| Unstaged file review | LOW | 3 files modified pre-session 18 | Review `demoData.js`, `listing-generator.js`, `handlers-tools-tasks.js` — commit or discard |

---

## TIER 2 — LAUNCH MOTION
*When Tier 0 is resolved. One solo founder — realistic cadence only.*

### Content
- **1 post/day** (not 2–4) — short-form demos of real product workflows
- Format: pain hook → VaultLister solving it → result → CTA (join beta)
- Batch weekly: 5–7 videos per session, queue for the week
- Platforms: TikTok + Instagram Reels + YouTube Shorts

### Acquisition
- **20–30 direct DMs** to micro-resellers (2k–25k followers) — offer early access
- **2–3 community posts/week** — Reddit reseller subs, Discord servers — useful first, mention product when natural
- **Landing page CTA** — one action only: join beta (already live at vaultlister.com)

### What to have ready before outreach
- One completed competitive wedge answer (see Tier 1)
- One clean demo video showing the actual listing → cross-post workflow
- Beta invite link that actually works (Tier 0 must be resolved first)

---

## TIER 3 — POST-ACTIVATION LIFECYCLE
*Only after you have 50+ activated users and understand why they activated.*

Build in this exact order, stop when you have what you need:

1. **Segmentation** — who activated vs who didn't, and what they have in common
2. **Preview** — what message each user bucket would receive (no sending)
3. **Drafts** — actual reviewable subject/body per bucket
4. **Approval** — human sign-off before anything sends

**Stop here.** Phases 15–20 (simulation → live sends) only if you have a specific reason to send and data to back it up.

---

## DEFER LIST
*Items explicitly not building at launch, and why.*

| Item | Reason |
|------|--------|
| Lifecycle email sends (Phases 15–20) | No activation baseline, no validated message, no reason to risk spam reputation |
| SEO as launch acquisition | 3–6 month payoff minimum — start publishing now, don't count on it at launch |
| Paid advertising | No conversion data, no activation baseline |
| Referral program | No point until activation is reliable and understood |
| Full OAuth for remaining 6 platforms | Build launch platforms (Poshmark, Mercari, Depop) now; Etsy/~~Grailed~~/Shopify/Whatnot/FB post-launch — Grailed now live (09d9811c); Shopify OAuth configured 2026-04-20 |
| EasyPost full integration | Externally blocked; build skeleton when API key arrives |
| AR previews / blockchain verification | V2 — already gated in codebase with "Coming Soon" |
| Etsy OAuth | Explicitly deferred — pending Etsy API approval |
| Firefox/Safari extension | Post-launch |
| Automation phases 8–20 in master doc | Build in order only after activation data exists |

---

## IMMEDIATE NEXT ACTIONS (in order, today)

**User actions (no code needed):**
1. ~~Set `OAUTH_MODE=real` in Railway env vars~~ — **DONE** 2026-04-07
2. ~~Set `STRIPE_PRICE_ID_STARTER`, `_PRO`, `_BUSINESS` in Railway env vars~~ — DONE 2026-04-20
3. Confirm `RESEND_API_KEY` is set — Resend email verified working (session 18)

**Code actions (after Railway env vars are set):**
4. ~~Smoke test `OAUTH_MODE=real`~~ — **DONE** 2026-04-07
5. Test first-run onboarding with a fresh account — find and fix activation blockers
6. Define competitive wedge vs Vendoo/List Perfectly (writing task, not code)
7. Build Poshmark OAuth connection flow (CR-10 partial)

**External:**
8. ~~Monitor EasyPost anti-fraud review — no code action until key is unlocked~~ — RESOLVED 2026-04-20: EASYPOST_API_KEY set in Railway

---

## WHAT THIS DOCUMENT IS NOT

This is not a feature spec, a content calendar, or a lifecycle automation plan. Those live in the master strategy doc.

This is the answer to: *what actually needs to happen before VaultLister can run a real acquisition campaign?*

When all Tier 0 and Tier 1 items are clear: start Tier 2.
