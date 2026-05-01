# VaultLister — Tier 0 Resolution Playbook
> **HISTORICAL — Generated 2026-04-11. Steps may be outdated. Current blockers in `docs/OPEN_ITEMS.md`.**

---

## CR-2 — Set OAUTH_MODE=real
✅ RESOLVED — confirmed in Railway 2026-04-07
**Blocker:** `oauth.js` logs a warning at startup and all 22 OAuth routes fall back to `'mock'` unless this is set. Platform connections return fake tokens.

### Step 1 — Set Railway env var
1. Open Railway dashboard → your VaultLister project
2. Navigate to: **Variables** tab
3. Add variable: `OAUTH_MODE` = `real`
4. Click **Deploy** (Railway redeploys automatically)

### Step 2 — Verify in Railway logs after deploy
Look for the absence of:
```
[OAuth] WARNING: OAUTH_MODE not set — using mock OAuth
[OAuth] WARNING: OAUTH_MODE=mock — OAuth returns fake tokens
```
If neither line appears → real OAuth mode is active.

### Step 3 — Smoke test one OAuth flow
1. Log into vaultlister.com
2. Navigate to My Shops → click **Connect** on eBay
3. Confirm a real eBay OAuth consent screen opens (not an instant fake token)
4. You do not need to complete the flow — just confirm it redirects to eBay's real login

**What failure looks like:** Instant "Connected" without an external redirect → still in mock mode.

---

## CR-3 — Configure Stripe Price IDs ✅ RESOLVED 2026-04-20
> ✅ RESOLVED 2026-04-20 — `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` set in Railway.

**Blocker:** `stripeService.js` reads `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`. All three default to `'price_[tier]_placeholder'`. Checkout will fail with an error until these are set.

### Step 1 — Create products in Stripe Dashboard
1. Go to **dashboard.stripe.com** → Products → **+ Add product**
2. Create 3 products:

| Product Name | Price | Billing |
|---|---|---|
| VaultLister Starter | C$9.00 / month | Recurring, monthly |
| VaultLister Pro | C$19.00 / month | Recurring, monthly |
| VaultLister Business | C$49.00 / month | Recurring, monthly |

3. After creating each product, copy its **Price ID** (format: `price_xxxxxxxxxxxxxxxx`)

> Note: If you want quarterly/yearly prices too, add additional prices to the same product. But get monthly working first.

### Step 2 — Set Railway env vars
In Railway → Variables, add:

```
STRIPE_SECRET_KEY=sk_live_xxxx          (from Stripe → Developers → API keys)
STRIPE_WEBHOOK_SECRET=whsec_xxxx        (from Stripe → Webhooks → your endpoint)
STRIPE_PRICE_STARTER=price_xxxx         (Price ID from Starter product)
STRIPE_PRICE_PRO=price_xxxx             (Price ID from Pro product)
STRIPE_PRICE_BUSINESS=price_xxxx        (Price ID from Business product)
```

> Use `sk_test_` keys while testing, `sk_live_` for real billing.

### Step 3 — Verify startup logs
After deploy, Railway logs should show NO lines like:
```
[Stripe] STRIPE_PRICE_starter is not set or uses a placeholder
```

### Step 4 — Smoke test checkout
1. Log into the app
2. Navigate to Plans & Billing
3. Click **Upgrade** on the Pro plan
4. Confirm Stripe Checkout opens with a real price visible
5. Do not complete payment — just confirm the modal opens without an error toast

**What failure looks like:** Error toast "Stripe is not configured" or checkout fails to open.

---

## CR-4 — EasyPost ✅ RESOLVED 2026-04-20
> ✅ RESOLVED 2026-04-20 — `EASYPOST_API_KEY` set in Railway. EasyPost routes already built (rates, buy, track in shippingLabels.js).

---

## CR-5 — eBay Integration ✅ RESOLVED — OAuth REST API, No Bot Needed
**Status:** eBay cross-listing uses the official eBay Sell API via OAuth REST — implemented in `src/backend/services/platformSync/ebayPublish.js` and `ebaySync.js`. No Playwright bot is required or built.

`worker/bots/ebay-bot.js` has been deleted. Do not rebuild it.

**What's needed for eBay to work in production:**
- Set `OAUTH_MODE=real` in Railway (covered by CR-2)
- Ensure eBay OAuth credentials (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, etc.) are set in Railway `.env`
- User connects their eBay account via the My Shops OAuth flow (covered by CR-10)

---

## CR-10 — Platform OAuth (Poshmark first)
**Blocker:** Google OAuth is working. eBay OAuth is working (real mode, post CR-2). Shopify OAuth configured 2026-04-20. Grailed is live as 7th platform. The remaining 5 platforms have no connect flows built — users see "Coming Soon."

**Launch target: Poshmark + one more** (Mercari or Depop). You do not need all 9 for launch.

### Poshmark
Poshmark has no official OAuth API. Connection uses Playwright credentials flow:

1. Check `worker/bots/poshmark-bot.js` — verify it has a `login()` method with credential storage
2. The "Connect" flow in My Shops should: prompt for Poshmark username/password → validate via bot → save encrypted credentials → mark platform as connected
3. Build/verify: `GET /api/shops/poshmark/auth-url` → shows credential form (not OAuth redirect) → `POST /api/shops/poshmark/connect` with creds → encrypt via AES-256-GCM → store

### eBay (already has OAuth — verify post CR-2)
After setting `OAUTH_MODE=real`:
1. Test the full eBay OAuth flow end-to-end (not just redirect to eBay consent — complete it)
2. Confirm credentials are stored encrypted in the `shops` table

### Remaining platforms (defer)
- Mercari, Depop: build post-launch. ~~Grailed~~: now live (commit 09d9811c)
- Etsy: deferred — pending Etsy API approval
- ~~Shopify~~: OAuth configured 2026-04-20 ✅
- Facebook Marketplace, Whatnot: post-launch

---

## VERIFICATION CHECKLIST
*Run through this after completing each blocker. All must pass before acquisition.*

```
[x] CR-2: Railway logs show no OAUTH_MODE warning after deploy — VERIFIED 2026-04-07
[x] CR-2: My Shops → eBay Connect opens real eBay OAuth screen — VERIFIED 2026-04-07
[x] CR-3: Railway logs show no Stripe placeholder warnings — RESOLVED 2026-04-20
[x] CR-3: Plans & Billing → Upgrade → Stripe Checkout opens with real price — RESOLVED 2026-04-20
[x] CR-4: Shipping feature shows "Coming Soon" (not a crash) — acceptable for launch — RESOLVED 2026-04-20
[x] CR-5: NOT NEEDED — eBay uses OAuth REST API (ebayPublish.js / ebaySync.js); ebay-bot.js deleted
[ ] CR-10: Poshmark connect flow: enter credentials → validated → platform shows Connected
[ ] CR-10: eBay full OAuth: consent → callback → Connected state in My Shops
[ ] Full flow: Create new account → onboarding → connect one platform → create listing → no crashes
```

**Do not start acquisition until all checkboxes above are checked.**
