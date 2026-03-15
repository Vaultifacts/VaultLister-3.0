# VaultLister 3.0 — Release Notes

> Version: 1.0.0 | Status: Release Candidate | Date: 2026-03-11

---

## What's In V1.0

These features are fully implemented, tested end-to-end, and verified working.

### Authentication & Security
- JWT access tokens (15-min) + refresh tokens (7-day) with automatic renewal
- bcryptjs password hashing (12 rounds)
- TOTP MFA setup via QR code with backup codes
- Email verification on registration
- CSRF protection on all mutating routes
- Rate limiting (in-memory with Redis acceleration when available)
- Content Security Policy headers
- AES-256-CBC encryption for stored OAuth tokens
- Session tokens in sessionStorage only (never localStorage)
- Audit log for all auth events

### Inventory Management
- Full CRUD for inventory items (title, description, price, cost, condition, size, brand, category, tags)
- Full-text search via SQLite FTS5
- Subtask/checklist support per item
- Image bank with multi-image support per item
- CSV import/export
- Bulk operations (tag, delete, price update)
- Price history tracking

### Cross-Listing — Live Platforms
- **Poshmark** — full OAuth + Playwright publish bot (creates real listings, verified live)
- **eBay** — full OAuth + eBay Inventory API (inventory_item → offer → publishOffer, sandbox-verified)

### Marketplace Automations (Poshmark)
- Closet sharing bot (share all active listings on a schedule)
- Auto-offer rules: configurable accept thresholds (e.g., auto-accept offers ≥ 80% or ≥ 90% of asking price)
- Follow-back automation
- Per-action audit log at `data/automation-audit.log`
- CAPTCHA detection stops the bot immediately

### Offer Management
- Accept, decline, counter offers from any connected platform
- Offer history per listing
- Bulk offer rules

### Sales Tracking
- Record sales manually or sync from connected platforms
- Per-sale profit calculation (sale price − cost − fees − shipping)
- Sales history with filtering and export

### Analytics Dashboard
- Revenue, profit, and sales volume charts (SVG, responsive)
- Platform breakdown
- 30/60/90-day trend comparisons
- 5-minute server-side cache (Cache-Control: private/max-age=300)
- Inventory turnover and days-of-supply forecasts

### AI Tools
- **Listing Generator** — Claude Haiku generates title, description, tags from item details + image analysis (~7s)
- **Image Analyzer** — Claude Vision identifies brand, category, colors from uploaded photos (~4s)
- **Price Predictor** — suggests price from historical sales data; falls back to category averages
- **Vault Buddy** — conversational assistant with real inventory context (Claude Sonnet 4.6 primary; Grok fallback when Claude API key unavailable)

### Image Bank
- Multi-image upload per item
- AI auto-tagging on upload
- Drag-and-drop reorder
- Shared across listings

### Chrome Extension
- Price tracker: scrape competitor listings and log to VaultLister
- Quick-add to inventory from any product page
- Syncs with main app via authenticated API

### Teams
- Create teams, invite members by email
- Role-based access: owner, admin, member
- Team activity log

### Notifications
- Real-time push via WebSocket
- Mark as read (persisted)
- Email polling for marketplace messages (Gmail/Outlook OAuth)

### Orders
- Order tracking with status workflow (pending → shipped → delivered)
- Return management
- Shipment splitting
- Priority flagging
- Sync from eBay (configured accounts)

### Infrastructure
- Bun.js 1.3 runtime (zero Node.js dependency)
- SQLite (WAL mode, FTS5) — local-first, no cloud DB required
- Redis optional (in-memory fallback when Redis unavailable)
- Docker + Nginx production deployment
- Self-signed SSL for local testing; bring your own cert for production
- GitHub Actions CI/CD stubs (deploy workflow in `.github/workflows/deploy.yml`)
- Daily automated database backups via `backup-scheduler` container
- Health endpoints: `/api/health/live`, `/api/health/ready`, `/api/workers/health`
- 5 background workers: task processor, GDPR cleanup, price checker, email polling, token refresh

---

## Coming Soon (Stubs Present in Codebase)

These platforms have UI placeholders and route stubs but no working publish implementation yet.

| Platform | Status | Notes |
|----------|--------|-------|
| **Etsy** | OAuth implemented, publish wired | Blocked on Etsy app key approval (pending since 2026-03-09). App key: `1sgc9xd1hwi3zt5k33pn9k7d`. Will be live as soon as Etsy approves. |
| **Mercari** | UI stub only | Greyed-out in cross-lister. No publish bot. |
| **Depop** | UI stub only | Greyed-out in cross-lister. No publish bot. |
| **Grailed** | UI stub only | Greyed-out in cross-lister. No publish bot. |
| **Facebook Marketplace** | UI stub only | Greyed-out in cross-lister. No publish bot. |
| **Whatnot** | UI stub only | Greyed-out in cross-lister. No publish bot. |
| **Shopify** | UI stub only | Greyed-out in cross-lister. No publish bot. |
| **eBay order sync** | Route exists, returns 400 without live creds | `POST /orders/sync/ebay` requires production eBay credentials. Sandbox-verified. |
| **Poshmark auto-offer (buyer-side)** | Counter logic works in DB; live counter not yet verified against Poshmark UI | `bot.counterOffer()` selectors need a real incoming buyer offer to validate. |

---

## Intentionally Excluded from V1.0

These were listed in the original design spec but are not implemented and have no code stubs.

| Feature | Reason |
|---------|--------|
| **AR previews** | Hardware-dependent, requires native mobile app or WebXR. Out of scope for a web-first MVP. |
| **Blockchain verification** | A local SHA-256 hash utility (`blockchain.js`) and `blockchain_hash` column exist in the schema as a stub, but no real on-chain integration is implemented. No user-facing feature. |
| **Whatnot live auctions** | Requires Whatnot seller API access (waitlisted). No API available publicly yet. |

---

## Known Limitations

- **Poshmark** — Canadian account (`poshmark.ca`). US accounts should work but are untested.
- **eBay** — Sandbox-verified. Production listing requires live eBay seller credentials in `.env`.
- **Etsy** — OAuth is implemented correctly (PKCE) but no listings can be created until Etsy approves the app key.
- **Email** — Sending requires SMTP credentials in `.env` (Gmail/Outlook/SMTP). Verification emails are generated but not sent in `NODE_ENV=test`.
- **Marketplace automations** — Run headless Chromium via Playwright. Will break if Poshmark changes their frontend. Monitor after each Poshmark deploy.
- **Redis** — Optional. All features work without Redis using the in-memory fallback; Redis only improves rate-limiter performance at scale.
- **SSL** — Self-signed cert included for local Docker testing. Replace `nginx/ssl/cert.pem` and `nginx/ssl/key.pem` with real certs before public deployment.

---

## Test Coverage

| Suite | Count | Pass | Fail |
|-------|-------|------|------|
| Unit (bun:test) | 4,490 | 4,267 | 223 (external-service-dependent: Anthropic API, SMTP, Notion; 6 async-leak errors) |
| E2E Playwright (chromium + firefox + webkit) | 2,100+ | 2,054+ | 0 skipped / 0 failing (69/69 offer tests pass) |
| Security audit | 63 questions | 63 resolved | 0 |

---

## Deployment

See `docs/ARCHITECTURE.md` for full setup. Quick start:

```bash
# 1. Copy and fill env
cp .env.example .env

# 2. Generate Redis password and add to .env
openssl rand -base64 20   # → REDIS_PASSWORD and REDIS_URL

# 3. Build and start
docker compose build
docker compose --profile production up -d

# 4. Verify
curl http://localhost:3000/api/health/ready
# → {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

Replace `nginx/ssl/cert.pem` + `nginx/ssl/key.pem` with real certificates before exposing to the internet.
