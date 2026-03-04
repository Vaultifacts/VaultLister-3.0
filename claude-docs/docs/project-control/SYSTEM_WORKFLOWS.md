# SYSTEM WORKFLOWS

Generated: 2026-03-04

---

## 1. Local Development Workflow

```
1. Clone repo / pull latest
2. bun install
3. Copy .env.example → .env (configure secrets)
4. bun run db:reset          # Creates SQLite DB + runs all 96 migrations
5. bun run dev               # Starts server on default port
6. Open browser → http://localhost:PORT
```

**Verification:** Server starts without errors; login page renders; can create account.

---

## 2. Database Migration Workflow

```
1. Create migration file: src/backend/db/migrations/NNN_description.sql
   - NNN = next sequential number (currently 097+)
   - Use TEXT for all ID columns (UUIDs)
2. Test migration:
   bun run db:reset           # Drops + recreates from schema.sql + all migrations
3. Verify schema:
   bun run scripts/checkDatabase.js
4. Update schema.sql if adding base tables (rare)
```

**Rules:**
- Migrations are applied in filename order (no rollback mechanism)
- Never modify an existing migration file — create a new one
- Always test with `db:reset` to verify full chain

---

## 3. Feature Implementation Workflow (Three-File Sync)

```
1. BACKEND: Create/modify route in src/backend/routes/
2. BACKEND: Create/modify service in src/backend/services/ (if needed)
3. BACKEND: Add migration if schema change needed
4. FRONTEND — Step A: Edit chunk file
   - handlers-[chunk].js  (event handlers)
   - pages-[chunk].js     (HTML rendering)
5. FRONTEND — Step B: Copy changes to deferred file
   - handlers-deferred.js (source-of-truth for deferred loading)
   - pages-deferred.js    (source-of-truth for deferred loading)
6. FRONTEND — Step C: Copy changes to app.js (monolith fallback)
7. VERIFY: node -c src/frontend/app.js  (syntax check)
8. TEST: bun test src/tests/[relevant].test.js
```

**Critical:** Steps 4–6 MUST stay synchronized. Mismatch = silent UI failures.

---

## 4. Test Workflow

```
# Run full suite
bun run test:all

# Run specific test file
bun test src/tests/[file].test.js

# Run with security disabled (for tests that don't need CSRF/rate limiting)
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun test

# Run E2E tests (requires Playwright browsers)
bun run test:e2e

# Current baseline: 4,898 pass / 372 fail (pre-existing)
```

**Known issues:**
- 372 failures are pre-existing (worker-taskWorker-coverage, CSRF test-mode)
- CSRF test failures are a DISABLE_CSRF configuration issue, not real security bugs
- These failures block CI gates

---

## 5. Deployment Workflow (Docker)

```
1. Build Docker image:
   docker build -t vaultlister .
2. Run container:
   docker-compose up -d
3. Nginx reverse proxy handles SSL termination
4. SQLite data volume mounted for persistence
5. Health check: GET /api/health (if implemented)
```

**Pre-deploy checklist:**
- [ ] All migrations tested with db:reset
- [ ] .env configured with production secrets
- [ ] db:backup run before deploy
- [ ] node -c src/frontend/app.js passes
- [ ] Docker build succeeds locally

---

## 6. Backup & Restore Workflow

```
# Backup
bun run db:backup            # Copies SQLite file to timestamped backup

# Restore
bun run db:restore           # Restores from latest backup

# Manual backup
cp data/vaultlister.db data/vaultlister.db.backup.$(date +%Y%m%d)
```

**Schedule:** Backup before every deploy and daily in production.

---

## 7. Marketplace Integration Workflow

```
1. USER: Configure shop in My Shops (OAuth flow)
   - eBay: Client ID + Client Secret → OAuth2 authorization code flow
   - Etsy: Client ID + Client Secret → OAuth2 PKCE flow
2. SYSTEM: Store encrypted tokens in shops table (AES-256-CBC)
3. USER: Create listing in VaultLister
4. USER: Click "Publish to [Platform]"
5. SYSTEM: POST /api/listings/:id/publish-[platform]
   - Decrypt token from shops table
   - Map VaultLister fields → platform API format
   - Call platform API
   - Store platform_listing_id + platform_url
6. SYSTEM: Background sync workers poll for updates
7. TOKEN REFRESH: tokenRefreshScheduler.js auto-refreshes before expiry
```

**Failure modes:**
- Token expired between UI action and API call → re-auth prompt
- Platform rate limit hit → retry with backoff
- Platform API down → error notification; retry later

---

## 8. Git Workflow

```
# Current state: master branch, 42 commits ahead of origin (UNPUSHED)
# No branching strategy documented — single developer workflow

1. Make changes
2. bun test (verify no regressions)
3. node -c src/frontend/app.js (syntax check)
4. git add <specific-files>
5. git commit -m "[AUTO] conventional commit message"
6. git push origin master (when ready)
```

**Risk:** 42 unpushed commits = significant data loss risk if local disk fails.

---

## 9. AI Feature Workflow

```
1. User triggers AI action (listing gen, image analysis, pricing)
2. Frontend calls API endpoint
3. Route handler calls ai.js service
4. ai.js calls @anthropic-ai/sdk with ANTHROPIC_API_KEY
5. Response parsed and returned to frontend
6. Fallback: If API unavailable, manual entry/editing available
```

**Cost:** Each AI call has API cost. No usage tracking or budget limits currently.

---

## 10. Automation Rule Workflow

```
1. User creates automation rule (conditions + actions)
2. Rule stored in automation_rules table
3. taskWorker.js runs on schedule
4. Worker evaluates rules against current inventory state
5. Matching rules trigger actions (price change, notification, etc.)
6. Execution logged in automation_executions table
7. Duration tracked for performance analysis
```

**Monitoring:** Duration trends chart on automations page; A/B experiments for rule variants.
