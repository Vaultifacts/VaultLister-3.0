# VaultLister 3.0 — Marketplace Credential Setup
> How to configure eBay, Poshmark, and Etsy credentials in `.env`.

---

## eBay

eBay uses OAuth 2.0. VaultLister supports both **sandbox** (testing) and **production** (live) environments.

### Step 1 — Create a Developer App

1. Go to [developer.ebay.com](https://developer.ebay.com) and sign in.
2. Navigate to **My Account → Application Keys**.
3. Click **Create a Keyset** → choose `Sandbox` (for testing) or `Production` (for live).
4. Note your **App ID (Client ID)**, **Cert ID (Client Secret)**, and **Dev ID**.

### Step 2 — Configure OAuth Redirect URI

1. In the eBay Developer Portal, open your keyset.
2. Under **User Tokens**, click **Get a Token from eBay via Your Application**.
3. Add your redirect URI: `http://localhost:3000/api/marketplace/ebay/callback`
   (Use your production domain for live deployments.)
4. Copy the **RuName** (eBay name for your redirect URI).

### Step 3 — Set `.env` Variables

```env
# eBay OAuth
EBAY_CLIENT_ID=your-app-id-here
EBAY_CLIENT_SECRET=your-cert-id-here
EBAY_DEV_ID=your-dev-id-here
EBAY_REDIRECT_URI=http://localhost:3000/api/marketplace/ebay/callback
EBAY_RUNAME=your-runame-here

# Set to 'sandbox' for testing, 'production' for live
EBAY_ENVIRONMENT=sandbox
```

### Step 4 — Authorize the App

1. Start the server: `bun run dev`
2. Navigate to **Settings → Connected Accounts** in the VaultLister UI.
3. Click **Connect eBay** → you will be redirected to eBay to grant access.
4. After authorization, your access token and refresh token are stored encrypted in PostgreSQL.

### Notes
- eBay access tokens expire in **2 hours**; VaultLister auto-refreshes using the stored refresh token.
- The sandbox environment uses `api.sandbox.ebay.com` — listings are not visible to real buyers.
- For production, your app must pass eBay's compliance review before going live.

---

## Poshmark

Poshmark does not offer a public OAuth API. VaultLister uses **Playwright browser automation** to authenticate and interact with Poshmark.

### Step 1 — Create a Chrome Profile

Poshmark automation uses a persistent Chrome profile so your session stays logged in between runs.

1. Open Chrome and create a new profile (or use an existing one).
2. Log in to [poshmark.com](https://poshmark.com) in that profile.
3. Complete any CAPTCHA challenges manually during the first login.
4. Note the profile directory path (e.g., `C:\Users\YourName\AppData\Local\Google\Chrome\User Data\Profile 1`).

### Step 2 — Set `.env` Variables

```env
# Poshmark credentials (for initial login via Playwright if session expires)
POSHMARK_EMAIL=your-poshmark-email@example.com
POSHMARK_PASSWORD=your-poshmark-password

# Path to the persistent Chrome profile directory
POSHMARK_CHROME_PROFILE=C:\Users\YourName\AppData\Local\Google\Chrome\User Data\Profile 1
```

### Step 3 — Run Initial Authentication

Start the server (`bun run dev`) then navigate to **Settings → Connected Accounts → Connect Poshmark**.

VaultLister's Playwright bots use `launchPersistentContext` with the Chrome profile, so you remain logged in across automation sessions.

### Notes
- Store the `data/poshmark-profile/` directory (created automatically) to persist the Playwright session.
- The bot respects Poshmark's rate limits — minimum delay between sharing actions is enforced.
- All bot actions are logged to `data/automation-audit.log`.
- Never run two Poshmark automations simultaneously — sessions will conflict.

---

## Etsy

> **Status: BLOCKED** — waiting on Etsy app approval. Check `.env` for your app key.

Etsy uses OAuth 2.0 (PKCE flow). Once your app is approved:

### Step 1 — Create an Etsy App

1. Go to [etsy.com/developers/your-apps](https://www.etsy.com/developers/your-apps).
2. Click **Create New App**.
3. Fill in the app name, description, and callback URL: `http://localhost:3000/api/marketplace/etsy/callback`
4. Submit for approval. Etsy manually reviews new apps — approval typically takes 1–5 business days.

### Step 2 — Set `.env` Variables (after approval)

```env
# Etsy OAuth (PKCE) — set ETSY_API_KEY to the value from your Etsy developer app
ETSY_API_KEY=your-etsy-api-key
ETSY_REDIRECT_URI=http://localhost:3000/api/marketplace/etsy/callback
```

### Step 3 — Authorize the App (after approval)

1. Start the server: `bun run dev`
2. Navigate to **Settings → Connected Accounts** in VaultLister.
3. Click **Connect Etsy** → complete the OAuth flow.

### Notes
- Etsy's OAuth 2.0 uses PKCE — no client secret is required for the authorization request, only for token exchange.
- Etsy access tokens expire in **3600 seconds**; refresh tokens are stored encrypted in PostgreSQL.
- The Etsy integration is currently in stub state — full listing and inventory sync will be enabled once the app is approved.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| eBay: `invalid_grant` on token refresh | Re-authorize via Settings → Connected Accounts |
| Poshmark: bot gets CAPTCHA | Open Chrome manually with the profile, solve CAPTCHA, then retry |
| Poshmark: `Session expired` | Delete `data/poshmark-profile/` and re-authenticate |
| Etsy: `App not approved` | Wait for Etsy approval email; your app key is in `.env` |
| Any marketplace: `Token encryption error` | Verify `OAUTH_ENCRYPTION_KEY` is set in `.env` and is 32+ chars |
