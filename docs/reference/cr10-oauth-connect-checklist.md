# CR-10: OAuth / Connect Flow Verification Checklist

Operator runbook for verifying each platform's connect flow end-to-end on Railway.
Run after setting credentials in Railway environment variables.

---

## Prerequisites (all platforms)

- [ ] `OAUTH_REDIRECT_URI=https://vaultlister.com/oauth-callback` set in Railway
- [ ] Server deployed and healthy (`/api/health` returns 200)
- [ ] Logged in as a real user account (not mock/dev)

---

## eBay — OAuth 2.0 (VERIFIED LIVE 2026-04-22)

**Env vars required:** `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI` (or `OAUTH_REDIRECT_URI`), `EBAY_DELETION_VERIFICATION_TOKEN`

- [ ] `GET /api/oauth/authorize/ebay` redirects to `https://auth.ebay.com/oauth2/authorize`
- [ ] After eBay login, callback lands at `/oauth-callback?code=...&state=...`
- [ ] `GET /api/oauth/callback?platform=ebay&code=...&state=...` returns 200 and stores encrypted tokens
- [ ] My Shops page shows eBay as Connected with username populated
- [ ] `GET /api/oauth/status/ebay` returns `{ connected: true }`

---

## Shopify — OAuth 2.0 (VERIFIED LIVE 2026-04-22)

**Env vars required:** `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`

- [ ] Connect flow initiated with `shop` param: `GET /api/oauth/authorize/shopify?shop=<store>.myshopify.com`
- [ ] Redirects to `https://<store>.myshopify.com/admin/oauth/authorize`
- [ ] Callback stores access token; My Shops shows Shopify Connected
- [ ] `GET /api/oauth/status/shopify` returns `{ connected: true }`

---

## Depop — OAuth 2.0 + PKCE (503 as of 2026-04-22 — recheck after credentials set)

**Env vars required:** `DEPOP_CLIENT_ID`, `DEPOP_CLIENT_SECRET`

- [ ] `GET /api/oauth/authorize/depop` returns 302 redirect (not 503)
  - 503 = `DEPOP_CLIENT_ID` missing or invalid; verify Railway var is set
- [ ] Redirect target is `https://auth.depop.com/oauth2/auth?...&code_challenge=...` (PKCE)
- [ ] After Depop login, callback at `/oauth-callback` exchanges code for tokens
- [ ] Scopes granted: `depop.listings.write`, `depop.listings.read`, `depop.orders.read`, `depop.account.read`
- [ ] My Shops shows Depop Connected with username from `https://partnerapi.depop.com/v1/me/`

---

## Poshmark — Playwright credential flow (no OAuth API)

**Env vars required:** `POSHMARK_USERNAME`, `POSHMARK_PASSWORD`  
**Note:** `POSHMARK_CLIENT_ID` / `POSHMARK_CLIENT_SECRET` are reserved for future official API; current flow is Playwright-based.

- [ ] `POST /api/shops/connect` with `{ platform: "poshmark" }` starts credential auth
- [ ] Browser session established via Playwright bot; session cookie stored encrypted
- [ ] `GET /api/oauth/status/poshmark` returns `{ connected: true, connection_type: "manual" }`
- [ ] My Shops shows Poshmark Connected
- [ ] Automation test: closet share runs without 401/redirect-to-login errors

---

## Mercari — Playwright credential flow (no OAuth API)

**Env vars required:** `MERCARI_USERNAME`, `MERCARI_PASSWORD`

- [ ] `POST /api/shops/connect` with `{ platform: "mercari" }` starts credential auth
- [ ] `GET /api/oauth/status/mercari` returns `{ connected: true, connection_type: "manual" }`
- [ ] My Shops shows Mercari Connected
- [ ] Spot-check: listings sync returns items (not empty array or 401)

---

## Grailed — Playwright credential flow (no OAuth API)

**Env vars required:** `GRAILED_USERNAME`, `GRAILED_PASSWORD`  
**Note:** Grailed promoted from Coming Soon in commit 09d9811c (2026-04-20). Playwright bot only.

- [ ] `POST /api/shops/connect` with `{ platform: "grailed" }` starts credential auth
- [ ] `GET /api/oauth/status/grailed` returns `{ connected: true, connection_type: "manual" }`
- [ ] My Shops shows Grailed Connected

---

## Whatnot — Playwright credential flow (no OAuth API)

**Env vars required:** `WHATNOT_USERNAME`, `WHATNOT_PASSWORD`

- [ ] `POST /api/shops/connect` with `{ platform: "whatnot" }` starts credential auth
- [ ] `GET /api/oauth/status/whatnot` returns `{ connected: true, connection_type: "manual" }`
- [ ] My Shops shows Whatnot Connected

---

## Facebook Marketplace — Playwright + anti-detection (no OAuth API)

**Env vars required:** `FACEBOOK_EMAIL`, `FACEBOOK_PASSWORD`  
**Note:** Anti-detection system active (commit a3688485). `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` are not used.

- [ ] `POST /api/shops/connect` with `{ platform: "facebook" }` starts credential auth
- [ ] `GET /api/oauth/status/facebook` returns `{ connected: true, connection_type: "manual" }`
- [ ] `GET /api/monitoring/anti-detection` returns 200 (not 404) — confirms anti-detection routes live
- [ ] My Shops shows Facebook Marketplace Connected
- [ ] Spot-check: relist bot completes one cycle without CAPTCHA or 2FA challenge

---

## Post-connect smoke test (all platforms)

After connecting any platform:

- [ ] Multi-account isolation warning appears on My Shops page (requires 2+ connected)
- [ ] `GET /api/shops` returns all connected shops with `is_connected: true`
- [ ] Token refresh: wait for access token expiry (or force via `DELETE /api/oauth/token/<platform>` then reconnect) and confirm auto-refresh works
- [ ] Disconnect: `DELETE /api/shops/<platform>` sets `is_connected: false`; reconnect restores it

---

## Failure reference

| Symptom | Likely cause |
|---------|-------------|
| `GET /api/oauth/authorize/<platform>` → 503 | `<PLATFORM>_CLIENT_ID` not set in Railway |
| Callback → 400 "Invalid state" | State token expired (>10 min) or CSRF mismatch |
| Callback → 500 "Token exchange failed" | `<PLATFORM>_CLIENT_SECRET` wrong or redirect URI mismatch |
| Playwright connect hangs | Credentials wrong, 2FA required, or CAPTCHA — check `data/automation-audit.log` |
| `GET /api/oauth/status/<platform>` → `{ connected: false }` after connect | Token storage failed — check server logs for AES-256-GCM errors |
