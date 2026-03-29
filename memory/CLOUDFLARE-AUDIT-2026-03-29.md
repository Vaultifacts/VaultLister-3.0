# Cloudflare Audit — VaultLister 3.0
**Date:** 2026-03-29
**Zone:** vaultlister.com (ID: `192676cc9890a1ea9eac28809bf0f265`)
**Account:** `24ca0522bc5466545f4b6e4d8e2bf108`
**Plan:** Free
**Method:** CF API (authenticated via browser session) + dashboard scrape

---

## CRITICAL FAILURES — All Fixed

### C6-FIXED: Server-Side Excludes was ON → now OFF
- **Was:** `server_side_exclude: "on"`
- **Now:** `off` (fixed via API this session, 2026-03-29)
- **Why it mattered:** CF strips portions of HTML from "untrusted" visitors. Could silently remove JS blocks, break SPA rendering for Tor/VPN/headless browser users.

---

## IMPORTANT FAILURES — Fix Soon

### I21-FAIL: R2 CORS Policy not configured
- **Setting:** No CORS rules on `vaultlister-uploads` bucket
- **Required:** Allow `https://vaultlister.com` with GET/PUT methods
- **Why important:** Browser-based image uploads to R2 (presigned URLs, direct PUT from frontend) will fail with a CORS error. The bucket currently has 0 objects — this means uploads are either going through the backend (bypassing CORS) or are completely broken.
- **Fix:** R2 > vaultlister-uploads > Settings > CORS Policy > Add rule:
  ```json
  [{"AllowedOrigins":["https://vaultlister.com"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]
  ```

### I25-FAIL: Rate Limiting at Free Plan Capacity (1/1)
- **Current:** 1 rule: `starts_with("/api/auth/")` — 20 req/10s per IP
- **Missing:** Broad `/api/*` backstop (100 req/10s) to absorb DDoS before Railway
- **Constraint:** Free plan allows only 1 rate limit rule — at capacity
- **Fix:** Upgrade to Pro ($20/mo) to add second rule, OR accept current coverage as sufficient for now

### I14-PARTIAL: WAF Managed Rules — Free Tier Only
- **Current:** "Cloudflare Free Managed Ruleset" auto-protection (no configurable rules)
- **Required:** Full managed ruleset (Pro+)
- **Impact:** No OWASP Core Ruleset, no configurable sensitivity, no per-rule overrides
- **Fix:** Upgrade to Pro for full managed WAF access

### I28-LOW-RISK: Bot Fight Mode vs Chrome Extension / API Consumers
- **Current:** `fight_mode: true`, `enable_js: true`
- **Observed:** 0 suspicious activity events in last 24h — no API consumers being challenged currently
- **Latent risk:** CF may issue JS challenges to programmatic API requests (Chrome extension, automation) if bot score increases
- **Fix (when needed):** Add WAF Custom Rule exception: skip bot checks for `/api/*` requests with `Authorization: Bearer` header
  - Note: 1 of 5 custom rules used — 4 slots remain
- **External webhooks:** eBay webhook callbacks from `216.113.184.10x` to `/api/webhooks/ebay/account-deletion` are passing through fine

---

## NICE-TO-HAVE — Improvements

### N10: Page Shield disabled
- Monitors for malicious third-party scripts injected into pages
- Fix: Security > Page Shield > Enable

### N14: No health check configured
- 0 health checks — relying only on Railway's internal check
- Fix: Traffic > Health Checks > Create for `https://vaultlister.com/api/health`, 60s interval

### N19: R2 no lifecycle rules
- Temp uploads will accumulate indefinitely
- Fix: R2 > vaultlister-uploads > Settings > Object Lifecycle Rules > Add rule: delete `images/*/temp/*` after 24h

### N20: R2 no custom domain
- Images served from `24ca0522bc5466545f4b6e4d8e2bf108.r2.cloudflarestorage.com`
- Fix: Add `images.vaultlister.com` CNAME in DNS pointing to the R2 bucket (CDN caching + clean URLs)

### N21: No notifications configured
- No alerts for DDoS, SSL expiry, billing, or origin health
- Fix: Account > Notifications > Add alerts for: HTTP DDoS Attack, Universal SSL Alert, Billing Usage Alert

### N24: No CAA records
- Any CA can issue certs for vaultlister.com
- Fix: Add DNS CAA record: `0 issue "letsencrypt.org"` (CF uses Let's Encrypt for Universal SSL)

### N-HEADERS: Managed Security Response Headers disabled
- `add_security_headers` managed response header is OFF
- Would automatically add: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 0`
- Fix: Rules > Transform Rules > Managed Transforms > Enable "Add security headers"

---

## ALL PASSING

| # | Setting | Value | Status |
|---|---------|-------|--------|
| C1 | SSL Mode | `strict` (Full Strict) | PASS |
| C2 | Rocket Loader | `off` | PASS |
| C3 | Auto Minify HTML | `off` | PASS |
| C4 | WebSockets | `on` | PASS |
| C5 | Email Obfuscation | `off` | PASS |
| C10 | Always Online | `off` | PASS |
| C11 | Always Use HTTPS | `on` | PASS |
| C12 | Development Mode | `off` | PASS |
| C13 | Snippets | 0 active | PASS |
| I1 | Browser Cache TTL | `0` (respect origin) | PASS |
| I2 | Min TLS Version | `1.2` | PASS |
| I3 | TLS 1.3 | `zrt` (on + 0-RTT) | PASS |
| I4 | HSTS | max-age=31536000, includeSubDomains, preload | PASS |
| I5 | Auto Minify JS | `off` | PASS |
| I6 | Auto Minify CSS | `off` | PASS |
| I7 | Brotli | `on` | PASS |
| I8 | DNS proxy (vaultlister.com) | Proxied (orange cloud) | PASS |
| I8 | DNS proxy (www) | Proxied (orange cloud) | PASS |
| I9 | SPF record | Present (`send` subdomain covers Resend/SES) | PASS |
| I10 | DKIM record | Present (`resend._domainkey`) | PASS |
| I11 | DMARC record | `p=quarantine; adkim=r; aspf=r` | PASS |
| I12 | DNSSEC | `active` | PASS |
| I13 | WAF custom rule | Blocks /.env, /.git, /wp-admin, /xmlrpc.php, /.htaccess, /wp-login.php | PASS |
| I15 | Bot Fight Mode | `fight_mode: true` | PASS |
| I16 | HTTP DDoS protection | ON (default, always active on CF) | PASS |
| I17 | Browser Integrity Check | `on` | PASS |
| I18 | Automatic HTTPS Rewrites | `on` | PASS |
| I20 | www redirect rule | Present (wildcard `https://www.*`) | PASS |
| I23 | 2FA | Enabled (mobile TOTP) | PASS |
| I24 | Tiered Cache | `on` | PASS |
| I26 | Opportunistic Encryption | `on` | PASS |
| I27 | Universal SSL | Active | PASS |
| I29 | Account Members | 1 member (solo admin) | PASS |
| C7-9 | Cache Rules | 2 rules: bypass API/HTML/SW + cache static assets | PASS |
| N1 | Early Hints | `on` | PASS |
| N2 | HTTP/3 (QUIC) | `on` | PASS |
| N3 | 0-RTT | `on` (via `tls_1_3: zrt`) | PASS |
| N4 | IP Geolocation | `on` | PASS |
| N6 | Mirage | `off` | PASS |
| N7 | Polish | `off` | PASS |
| N11 | Security Level | `medium` | PASS |
| N13 | Privacy Pass | `on` | PASS |
| N15 | Web Analytics (RUM) | Enabled | PASS |
| N16 | Visitor Location Headers | `add_visitor_location_headers: enabled` | PASS |
| N18 | Hotlink Protection | `off` | PASS |
| N25 | Page Rules (legacy) | 0 active | PASS |
| N26 | Workers Routes | 0 configured | PASS |
| N27 | Caching Level | `aggressive` = "Standard" in CF UI (query string is cache key) | PASS |

---

## Security Analytics (last 24h)
- Total requests: 10.59k
- Mitigated (blocked/challenged): **61**
- Served by CF edge (cached): 166
- Served by origin: 10.36k
- **Suspicious activity: 0**
- Cache hit rate: ~0.7% (expected — API + HTML bypassed; only 70 static asset hits)
- Top source: IPv6 addresses (likely Railway/Cloudflare infra) + Desktop browsers

---

## DNS Records Summary (13 records)

| Type | Name | Proxied | Notes |
|------|------|---------|-------|
| CNAME | vaultlister.com | YES | → Railway (j0mhkovj.up.railway.app) |
| CNAME | www | YES | → Railway (redirect rule handles www→bare) |
| MX | vaultlister.com | No | sendfeedback-smtp.us-east-1.amazonses.com (p10) |
| MX | vaultlister.com | No | eforward1-5.registrar-servers.com (p10-20, Namecheap forwarding) |
| TXT | _dmarc | No | v=DMARC1; p=quarantine; rua=admin@vaultlister.com |
| TXT | resend._domainkey | No | DKIM for Resend |
| TXT | send | No | v=spf1 include:amazonses.com ~all (Resend sending subdomain) |
| TXT | vaultlister.com | No | v=spf1 include:spf.efwd.registrar-servers.com ~all |
| TXT | _railway-verify | No | Railway domain verification |

**SPF note:** Root domain SPF covers only Namecheap email forwarding. Transactional emails sent via Resend use `send.vaultlister.com` as the envelope sender — that subdomain's SPF covers amazonses.com. DMARC passes via relaxed DKIM alignment. Setup is correct but non-obvious.

**Missing:** No CAA records (N24)

---

## R2 Bucket: vaultlister-uploads
- **Location:** Western North America (WNAM)
- **Created:** Mar 26, 2026
- **Objects:** 0 (empty — uploads not yet in production or going via backend only)
- **Custom domain:** None (using raw R2 URL)
- **CORS policy:** None configured (CRITICAL for browser uploads)
- **Lifecycle rules:** None configured
- **Public Development URL:** Disabled (good)

---

## Codebase Recommendation (from plan)
- **R1:** `server.js:1233` already checks `CF-Connecting-IP` first ✅. `requestLogger.js:23` was missing it — fixed this session (added `cf-connecting-ip` check before `x-forwarded-for`).

---

## Action Priority Queue

| Priority | Action | Where | Effort |
|----------|--------|--------|--------|
| 1 | ~~Turn OFF Server-Side Excludes~~ **DONE** | Fixed via API 2026-03-29 | — |
| 2 | ~~Change Caching Level to Standard~~ **N/A** | `aggressive` = Standard in CF UI | — |
| 3 | **Add R2 CORS policy** | R2 > vaultlister-uploads > Settings | 5 min |
| 4 | **Add Bot Fight Mode WAF exception for auth'd API** | Security > WAF > Custom Rules | 10 min |
| 5 | **Add security response headers (managed transform)** | Rules > Transform Rules | 1 min |
| 6 | **Configure notifications** (DDoS, SSL, billing) | Account > Notifications | 5 min |
| 7 | **Add health check** for /api/health | Traffic > Health Checks | 5 min |
| 8 | **Add CAA record** | DNS > Records | 2 min |
| 9 | **Enable Page Shield** | Security > Page Shield | 30s |
| 10 | **Add CF-Connecting-IP check** to server.js IP extraction | Code: server.js | 10 min |
| 11 | Add R2 lifecycle rules (temp cleanup) | R2 > Settings | 5 min |
| 12 | Add images.vaultlister.com custom domain for R2 | R2 + DNS | 10 min |
| 13 | Upgrade to Pro for full WAF managed rules + extra rate limit rule | Billing | — |
