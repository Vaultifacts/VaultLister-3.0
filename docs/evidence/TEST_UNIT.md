# TEST_UNIT

- Date: 2026-03-05T14:21:34.4826185-07:00
- RepoRoot: C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3
- Command: cmd.exe /d /c "set NODE_ENV=test&&set PORT=3001&&set TEST_BASE_URL=http://localhost:3001&&set DISABLE_RATE_LIMIT=true&&set DISABLE_CSRF=true&& bun test"
- Exit code: 0
- Setup exit code: 0
- Teardown exit code: 0
- Status: PASS

## Output

```
--- Setup Command ---
pre-stop + direct test server start
--- Pre-stop ---
cmd.exe : $ bun scripts/server-manager.js stop
At C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3\runbook\steps\TEST_UNIT.ps1:33 
char:27
+ ...     $preStopOutput = (& cmd.exe /d /c "bun run dev:stop" 2>&1 | Out-S ...
+                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ bun scripts/server-manager.js stop:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Process 104680 is not running. Cleaning up PID file.

--- Start Command ---
Set-Location 'C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3'; $env:NODE_ENV='test'; $env:PORT='3001'; $env:TEST_BASE_URL='http://localhost:3001'; $env:DISABLE_RATE_LIMIT='true'; $env:DISABLE_CSRF='true'; bun run src/backend/server.js

--- Server PID ---
17960

--- Server Logs ---
stdout: C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3\docs\evidence\TEST_UNIT_SERVER.out.log
stderr: C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3\docs\evidence\TEST_UNIT_SERVER.err.log

--- Test Command ---
cmd.exe /d /c "set NODE_ENV=test&&set PORT=3001&&set TEST_BASE_URL=http://localhost:3001&&set DISABLE_RATE_LIMIT=true&&set DISABLE_CSRF=true&& bun test"
bun test v1.3.6 (d530ed99)
cmd.exe : 
At C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3\runbook\steps\TEST_UNIT.ps1:88 
char:24
+ ... stOutput = (& cmd.exe /d /c "set NODE_ENV=test&&set PORT=3001&&set TE ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
src\tests\a-shared-logger.test.js:
(pass) logger object shape > has debug method
(pass) logger object shape > has info method
(pass) logger object shape > has warn method
(pass) logger object shape > has error method
(pass) logger object shape > has request method
(pass) logger object shape > has db method
(pass) logger object shape > has automation method
(pass) logger object shape > has bot method
(pass) logger object shape > has security method
(pass) logger object shape > has performance method
(pass) logger core methods do not throw > debug with message
(pass) logger core methods do not throw > debug with meta object
(pass) logger core methods do not throw > debug with non-object meta
[2026-03-05T21:18:53.571Z] [INFO] test info
(pass) logger core methods do not throw > info with message
[2026-03-05T21:18:53.571Z] [WARN] test warn
(pass) logger core methods do not throw > warn with message
[2026-03-05T21:18:53.571Z] [ERROR] test error
(pass) logger core methods do not throw > error with message only
[2026-03-05T21:18:53.571Z] [ERROR] test {"error":{"message":"sample"}}
(pass) logger core methods do not throw > error with Error object
[2026-03-05T21:18:53.571Z] [ERROR] test {"detail":"extra info"}
(pass) logger core methods do not throw > error with string as second arg
[2026-03-05T21:18:53.571Z] [ERROR] test {"userId":"1","error":{"message":"e"}}
(pass) logger core methods do not throw > error with Error and meta
[2026-03-05T21:18:53.571Z] [INFO] GET /api/test 200 {"durationMs":50}
(pass) logger specialized methods do not throw > request logs HTTP request
(pass) logger specialized methods do not throw > db logs database operation
[2026-03-05T21:18:53.571Z] [INFO] [Automation] sync {"platform":"ebay"}
(pass) logger specialized methods do not throw > automation logs automation action
(pass) logger specialized methods do not throw > bot logs bot action
[2026-03-05T21:18:53.572Z] [WARN] [Security] failed_login {"ip":"1.2.3.4"}
(pass) logger specialized methods do not throw > security logs security event
[2026-03-05T21:18:53.572Z] [WARN] Slow operation: db_query {"durationMs":2000}
(pass) logger specialized methods do not throw > performance logs slow operation (>1s triggers warn)
(pass) logger specialized methods do not throw > performance logs fast operation (<1s triggers debug)
(pass) createLogger factory > returns object with debug/info/warn/error
[2026-03-05T21:18:53.572Z] [INFO] msg {"module":"test"}
[2026-03-05T21:18:53.572Z] [WARN] msg {"module":"test"}
[2026-03-05T21:18:53.572Z] [ERROR] msg {"module":"test","error":{"message":"e"}}
(pass) createLogger factory > child logger methods do not throw
(pass) createLogger factory > creates independent loggers
[2026-03-05T21:18:53.572Z] [INFO] no context
(pass) createLogger factory > works with empty context

src\tests\affiliate-gaps-expanded.test.js:
(pass) Affiliate — Landing Pages > GET /affiliate/landing-pages returns list
(pass) Affiliate — Landing Pages > POST /affiliate/landing-pages creates page
(pass) Affiliate — Landing Pages > PUT /affiliate/landing-pages/:id updates page
(pass) Affiliate — Landing Pages > PUT /affiliate/landing-pages/nonexistent returns 404
(pass) Affiliate — Landing Pages > DELETE /affiliate/landing-pages/:id deletes page
(pass) Affiliate — Landing Pages > DELETE /affiliate/landing-pages/nonexistent returns 404
(pass) Affiliate — Tiers & Earnings > GET /affiliate/tiers returns tier list [16.00ms]
(pass) Affiliate — Tiers & Earnings > GET /affiliate/my-tier returns current user tier
(pass) Affiliate — Tiers & Earnings > GET /affiliate/earnings returns earnings data
(pass) Affiliate — Tiers & Earnings > GET /affiliate/commissions returns commission data
(pass) Affiliate — Tiers & Earnings > GET /affiliate/stats returns affiliate stats
(pass) Affiliate — Auth Guard > GET /affiliate/earnings requires auth

src\tests\affiliate-gaps.test.js:
(pass) Affiliate landing pages > POST /affiliate/landing-pages creates landing page
(pass) Affiliate landing pages > PUT /affiliate/landing-pages/:id nonexistent
(pass) Affiliate landing pages > DELETE /affiliate/landing-pages/:id nonexistent [16.00ms]
(pass) Affiliate commissions > GET /affiliate/commissions returns commission data

src\tests\affiliate.test.js:
(pass) GET /api/affiliate/landing-pages > rejects unauthenticated request
(pass) GET /api/affiliate/landing-pages > returns landing pages for authenticated user
(pass) POST /api/affiliate/landing-pages > rejects unauthenticated request
(pass) POST /api/affiliate/landing-pages > creates landing page with valid body
(pass) POST /api/affiliate/landing-pages > rejects missing required fields
(pass) GET /api/affiliate/tiers > rejects unauthenticated request
(pass) GET /api/affiliate/tiers > returns affiliate tiers
(pass) GET /api/affiliate/my-tier > rejects unauthenticated request
(pass) GET /api/affiliate/my-tier > returns current user tier
(pass) GET /api/affiliate/earnings > rejects unauthenticated request
(pass) GET /api/affiliate/earnings > returns earnings for authenticated user
(pass) GET /api/affiliate/commissions > rejects unauthenticated request
(pass) GET /api/affiliate/commissions > returns commissions list with pagination
(pass) GET /api/affiliate/stats > rejects unauthenticated request [16.00ms]
(pass) GET /api/affiliate/stats > returns affiliate stats for authenticated user

src\tests\ai-expanded.test.js:
(pass) AI - Generate Title > POST /ai/generate-title with details
(pass) AI - Generate Title > POST /ai/generate-title without details returns error
(pass) AI - Generate Description > POST /ai/generate-description returns text
(pass) AI - Generate Tags > POST /ai/generate-tags returns array
(pass) AI - Suggest Price > POST /ai/suggest-price returns price
(pass) AI - Analyze Image > POST /ai/analyze-image with base64
(pass) AI - Analyze Image > POST /ai/analyze-listing-image with image [16.00ms]
(pass) AI - Generate & Optimize Listing > POST /ai/generate-listing with details
(pass) AI - Generate & Optimize Listing > POST /ai/optimize-listing with existing listing
(pass) AI - Bulk Generate > POST /ai/bulk-generate with items
(pass) AI - Bulk Generate > POST /ai/bulk-generate without items returns error
(pass) AI - Detect Duplicates > POST /ai/detect-duplicates returns results
(pass) AI - Sourcing Suggestions > GET /ai/sourcing-suggestions returns suggestions
(pass) AI - Translate & Category > POST /ai/translate with target language
(pass) AI - Translate & Category > POST /ai/category-mapping maps across platforms
(pass) AI - Hashtags & Enhancement > POST /ai/generate-hashtags returns list
(pass) AI - Hashtags & Enhancement > POST /ai/image-enhancement returns suggestions
(pass) AI - Profit & SEO & Categorize > POST /ai/profit-prediction calculates margins
(pass) AI - Profit & SEO & Categorize > POST /ai/seo-optimize returns optimization
(pass) AI - Profit & SEO & Categorize > POST /ai/auto-categorize detects category
(pass) AI - Auth Guards > POST /ai/generate-title without auth returns 401
(pass) AI - Auth Guards > GET /ai/sourcing-suggestions without auth returns 401

src\tests\ai.test.js:
Running AI API tests...
(pass) AI - Analyze Listing Image > POST /ai/analyze-listing-image - should analyze image [1390.00ms]
(pass) AI - Analyze Listing Image > POST /ai/analyze-listing-image - should require image [16.00ms]
(pass) AI - Generate Listing > POST /ai/generate-listing - should generate listing from details
(pass) AI - Generate Title > POST /ai/generate-title - should generate title
(pass) AI - Generate Title > POST /ai/generate-title - should require description or keywords
(pass) AI - Generate Description > POST /ai/generate-description - should generate description
(pass) AI - Generate Description > POST /ai/generate-description - should require title
(pass) AI - Generate Tags > POST /ai/generate-tags - should generate tags
(pass) AI - Generate Tags > POST /ai/generate-tags - should require title or description
(pass) AI - Suggest Price > POST /ai/suggest-price - should suggest price
(pass) AI - Analyze Image > POST /ai/analyze-image - should require image
(pass) AI - Optimize Listing > POST /ai/optimize-listing - should optimize existing listing
(pass) AI - Optimize Listing > POST /ai/optimize-listing - should return 404 for non-existent item
(pass) AI - Bulk Generate > POST /ai/bulk-generate - should generate for multiple items
(pass) AI - Bulk Generate > POST /ai/bulk-generate - should require inventoryIds
(pass) AI - Detect Duplicates > POST /ai/detect-duplicates - should detect duplicates
(pass) AI - Sourcing Suggestions > GET /ai/sourcing-suggestions - should return sourcing suggestions
(pass) AI - Translate > POST /ai/translate - should translate listing [1312.00ms]
(pass) AI - Translate > POST /ai/translate - should require title or description
(pass) AI - Category Mapping > POST /ai/category-mapping - should map categories
(pass) AI - Category Mapping > POST /ai/category-mapping - should require category
(pass) AI - Generate Hashtags > POST /ai/generate-hashtags - should generate hashtags
(pass) AI - Generate Hashtags > POST /ai/generate-hashtags - should require title or description
(pass) AI - Image Enhancement > POST /ai/image-enhancement - should return enhancement suggestions [1282.00ms]
(pass) AI - Image Enhancement > POST /ai/image-enhancement - should require image
(pass) AI - Profit Prediction > POST /ai/profit-prediction - should calculate profit
(pass) AI - Profit Prediction > POST /ai/profit-prediction - should require listPrice
(pass) AI - SEO Optimize > POST /ai/seo-optimize - should optimize for SEO
(pass) AI - SEO Optimize > POST /ai/seo-optimize - should require title
(pass) AI - Auto Categorize > POST /ai/auto-categorize - should auto-categorize item
(pass) AI - Auto Categorize > POST /ai/auto-categorize - should require title or description
(pass) AI - Authentication > POST /ai/generate-title - should require auth
(pass) AI - Authentication > GET /ai/sourcing-suggestions - should require auth

src\tests\analytics-expanded.test.js:
(pass) Analytics - Dashboard Shape > GET /analytics/dashboard returns structured data
(pass) Analytics - Dashboard Shape > GET /analytics/stats returns structured data
(pass) Analytics - Sales > GET /analytics/sales returns sales data
(pass) Analytics - Sales > GET /analytics/sales with period param
(pass) Analytics - Sales > GET /analytics/sales with groupBy param
(pass) Analytics - Inventory & Platforms (tier-gated) > GET /analytics/inventory returns breakdown or 403
(pass) Analytics - Inventory & Platforms (tier-gated) > GET /analytics/platforms returns platform data or 403
(pass) Analytics - Trends & Sustainability > GET /analytics/trends returns trend data or 403
(pass) Analytics - Trends & Sustainability > GET /analytics/trends with period [16.00ms]
(pass) Analytics - Trends & Sustainability > GET /analytics/sustainability returns impact metrics
(pass) Analytics - Custom Metrics CRUD > GET /analytics/custom-metrics returns array or 403
(pass) Analytics - Custom Metrics CRUD > POST /analytics/custom-metrics creates metric
(pass) Analytics - Custom Metrics CRUD > DELETE /analytics/custom-metrics/:id for nonexistent
(pass) Analytics - Digest & Export > GET /analytics/digest-settings returns settings
(pass) Analytics - Digest & Export > POST /analytics/digest-settings saves settings
(pass) Analytics - Digest & Export > POST /analytics/export with type=inventory
(pass) Analytics - Digest & Export > POST /analytics/export without type returns 400
(pass) Analytics - Auth Guards > GET /analytics/dashboard without auth returns 401
(pass) Analytics - Auth Guards > GET /analytics/sales without auth returns 401
(pass) Analytics - Auth Guards > POST /analytics/export without auth returns 401

src\tests\analytics-gaps.test.js:
(pass) Analytics performance > GET /analytics/performance returns data or 403 for basic tier
(pass) Analytics heatmap > GET /analytics/heatmap returns heatmap data
(pass) Analytics heatmap > GET /analytics/heatmap/listings returns listing heatmap
(pass) Analytics heatmap > GET /analytics/heatmap/geography returns geographic heatmap
(pass) Analytics custom metrics > GET /analytics/custom-metrics returns metrics list
(pass) Analytics custom metrics > POST /analytics/custom-metrics creates metric
(pass) Analytics custom metrics > DELETE /analytics/custom-metrics/:id nonexistent
(pass) Analytics digest settings > GET /analytics/digest-settings returns settings
(pass) Analytics digest settings > POST /analytics/digest-settings updates settings
(pass) Analytics export > POST /analytics/export triggers export

src\tests\analytics.test.js:
Running Analytics API tests...
(pass) Analytics - Dashboard > GET /analytics/dashboard - should return dashboard stats
(pass) Analytics - Dashboard > GET /analytics/dashboard?period=30d - should filter by period
(pass) Analytics - Sales > GET /analytics/sales - should return sales analytics
(pass) Analytics - Sales > GET /analytics/sales?groupBy=day - should group by day
(pass) Analytics - Sales > GET /analytics/sales?platform=poshmark - should filter by platform
(pass) Analytics - Inventory > GET /analytics/inventory - should return inventory analytics
(pass) Analytics - Profit & Loss > GET /analytics/profit-loss - should return P&L report
(pass) Analytics - Profit & Loss > GET /analytics/profit-loss?startDate=2024-01-01&endDate=2024-12-31 - should filter 
by date
(pass) Analytics - Platform Performance > GET /analytics/platforms - should return platform comparison
(pass) Analytics - Trends > GET /analytics/trends - should return trend data
(pass) Analytics - Sustainability > GET /analytics/sustainability - should return sustainability metrics
(pass) Analytics - Export > GET /analytics/export?format=csv - should export data as CSV [15.00ms]
(pass) Analytics - Authentication > GET /analytics/dashboard - should require auth

src\tests\api-docs.test.js:
(pass) API Documentation > openapi.yaml exists and is non-empty
(pass) API Documentation > openapi.yaml has valid OpenAPI 3.0 structure [16.00ms]
(pass) API Documentation > openapi.yaml contains all major route groups
(pass) API Documentation > openapi.yaml has at least 300 path entries
(pass) API Documentation > index.html exists and references Swagger UI
(pass) API Documentation > GET /api-docs/openapi.yaml returns 200
(pass) API Documentation > GET /api-docs/index.html returns 200
(pass) API Documentation > openapi.yaml contains all expected tags
(pass) API Documentation > openapi.yaml has reusable component schemas

src\tests\api.test.js:
Running VaultLister API tests...
Make sure the server is running: bun run dev
(pass) Authentication > POST /auth/register - should create new user [219.00ms]
(pass) Authentication > POST /auth/login - should authenticate user [234.00ms]
(pass) Authentication > POST /auth/login - should reject invalid credentials [234.00ms]
(pass) Inventory > GET /inventory - should require authentication
(pass) Inventory > GET /inventory - should return items
(pass) Inventory > POST /inventory - should create item
(pass) Inventory > GET /inventory/stats - should return statistics
(pass) Listings > GET /listings - should return listings
(pass) Analytics > GET /analytics/dashboard - should return dashboard stats [16.00ms]
(pass) Analytics > GET /analytics/sustainability - should return impact data
(pass) Automations > GET /automations - should return rules
(pass) Automations > GET /automations/presets - should return presets
(pass) AI Features > POST /ai/generate-title - should generate title
(pass) AI Features > POST /ai/suggest-price - should suggest price
(pass) Shops > GET /shops - should return connected shops
(pass) Tasks > GET /tasks/queue - should return queue status

src\tests\archive-listing.test.js:
Archive listing tests completed. Run with: bun test src/tests/archive-listing.test.js
(pass) Archive Listing Tests > Archive endpoint sets status to archived
(pass) Archive Listing Tests > Fallback to ended status with note when CHECK constraint fails
(pass) Archive Listing Tests > Unarchive removes archive status and clears deleted_at
(pass) Archive Listing Tests > Unarchive from fallback status removes archive note

src\tests\auditLog.test.js:
(pass) Audit Log - Auth Guard > GET /audit/my-activity without token returns 401
(pass) Audit Log - Auth Guard > GET /audit/logs without token returns 401
(pass) Audit Log - Non-admin Access Denied > GET /audit/logs as regular user returns 403
(pass) Audit Log - Non-admin Access Denied > GET /audit/admin-activity as regular user returns 403
(pass) Audit Log - Non-admin Access Denied > GET /audit/security-alerts as regular user returns 403
(pass) Audit Log - Non-admin Access Denied > GET /audit/compliance-report as regular user returns 403
(pass) Audit Log - Non-admin Access Denied > GET /audit/user/some-id as regular user returns 403
(pass) Audit Log - Non-admin Access Denied > GET /audit/stats as regular user returns 403
(pass) Audit Log - My Activity > GET /audit/my-activity returns 200 with activity array or 500 on schema mismatch
(pass) Audit Log - My Activity > GET /audit/my-activity?days=7 accepts custom days parameter
(pass) Audit Log - My Activity > activity entries have expected fields when endpoint is available [15.00ms]
(pass) Audit Log - Admin Endpoints (demo user) > GET /audit/logs returns 200 or 403 depending on demo user tier
(pass) Audit Log - Admin Endpoints (demo user) > GET /audit/compliance-report returns expected shape when accessible
(pass) Audit Log - Admin Endpoints (demo user) > GET /audit/stats returns expected shape when accessible
(pass) Audit Log - Admin Endpoints (demo user) > GET /audit/security-alerts returns expected shape when accessible
(pass) Audit Log - Admin Endpoints (demo user) > GET /audit/admin-activity returns expected shape when accessible
(pass) Audit Log - Query Filtering > GET /audit/logs?limit=5 returns at most 5 entries
(pass) Audit Log - Query Filtering > GET /audit/logs?category=authentication filters by category
(pass) Audit Log - Query Filtering > GET /audit/logs with offset returns different results (pagination)

src\tests\auth.test.js:
Running Auth API tests...
(pass) Auth - Registration > POST /auth/register - should register new user [219.00ms]
(pass) Auth - Registration > POST /auth/register - should require email, password, username
(pass) Auth - Registration > POST /auth/register - should enforce password requirements
(pass) Auth - Registration > POST /auth/register - should prevent duplicate email
(pass) Auth - Registration > POST /auth/register - should prevent duplicate username
(pass) Auth - Login > POST /auth/login - should login with valid credentials [219.00ms]
(pass) Auth - Login > POST /auth/login - should require email and password
(pass) Auth - Login > POST /auth/login - should reject invalid password [219.00ms]
(pass) Auth - Login > POST /auth/login - should reject non-existent user
(pass) Auth - Token Refresh > POST /auth/refresh - should refresh token [15.00ms]
(pass) Auth - Token Refresh > POST /auth/refresh - should require refresh token
(pass) Auth - Token Refresh > POST /auth/refresh - should reject invalid refresh token
(pass) Auth - Get Current User > GET /auth/me - should return current user
(pass) Auth - Get Current User > GET /auth/me - should require authentication
(pass) Auth - Get Current User > GET /auth/me - should reject invalid token
(pass) Auth - Update Profile > PUT /auth/profile - should update profile
(pass) Auth - Update Profile > PUT /auth/profile - should update preferences
(pass) Auth - Update Profile > PUT /auth/profile - should require authentication
(pass) Auth - Change Password > PUT /auth/password - should change password [657.00ms]
(pass) Auth - Change Password > PUT /auth/password - should require both passwords
(pass) Auth - Change Password > PUT /auth/password - should reject wrong current password [234.00ms]
(pass) Auth - Change Password > PUT /auth/password - should require authentication
(pass) Auth - Logout > POST /auth/logout - should logout successfully
(pass) Auth - Logout > POST /auth/logout - should handle logout without refresh token
(pass) Auth - Token Refresh Security > Refresh token should be invalidated after logout [219.00ms]
(pass) Auth - Token Refresh Security > Expired/invalid access token should return 401

src\tests\authEndpoints.test.js:
(pass) Auth Endpoints - Demo Login > POST /auth/demo-login returns 200 with token
(pass) Auth Endpoints - Demo Login > demo-login response does not leak password_hash
(pass) Auth Endpoints - Demo Login > demo-login token works for authenticated requests
(pass) Auth Endpoints - MFA Verify > POST /auth/mfa-verify with missing fields returns 400
(pass) Auth Endpoints - MFA Verify > POST /auth/mfa-verify with missing code returns 400
(pass) Auth Endpoints - MFA Verify > POST /auth/mfa-verify with missing mfaToken returns 400
(pass) Auth Endpoints - MFA Verify > POST /auth/mfa-verify with invalid mfaToken returns 401
(pass) Auth Endpoints - Sessions List > GET /auth/sessions returns array of sessions
(pass) Auth Endpoints - Sessions List > sessions list includes at least 1 session (current)
(pass) Auth Endpoints - Sessions List > session objects have expected fields
(pass) Auth Endpoints - Sessions List > at most one session is marked current
(pass) Auth Endpoints - Sessions List > sessions list does not leak refresh_token
(pass) Auth Endpoints - Session Revoke > DELETE /auth/sessions/:id revokes a session [234.00ms]
(pass) Auth Endpoints - Session Revoke > DELETE /auth/sessions/:nonexistent returns 404
(pass) Auth Endpoints - Session Revoke > cross-user session revocation is blocked [438.00ms]
(pass) Auth Endpoints - Session Revoke > revoked session disappears from list [469.00ms]
(pass) Auth Endpoints - Session Revoke > DELETE without auth returns 401
(pass) Auth Endpoints - Revoke All Sessions > POST /auth/sessions/revoke-all returns 200 with count [672.00ms]
(pass) Auth Endpoints - Revoke All Sessions > revoke-all leaves at most current session active [671.00ms]
(pass) Auth Endpoints - Revoke All Sessions > revoke-all without auth returns 401
(pass) Auth Endpoints - Password Reset > POST /auth/password-reset returns 200 for valid email
(pass) Auth Endpoints - Password Reset > password-reset returns 200 for nonexistent email (anti-enumeration)
(pass) Auth Endpoints - Password Reset > password-reset returns 200 for missing email (anti-enumeration)
(pass) Auth Endpoints - Password Reset > password-reset returns 200 for invalid email format (anti-enumeration)
(pass) Auth Endpoints - Resend Verification > POST /auth/resend-verification returns 200 for valid email
(pass) Auth Endpoints - Resend Verification > resend-verification returns 200 for nonexistent email (anti-enumeration)
(pass) Auth Endpoints - Resend Verification > resend-verification returns 200 for invalid email (anti-enumeration)
(pass) Auth Endpoints - Auth Guards > GET /auth/sessions without token returns 401
(pass) Auth Endpoints - Auth Guards > GET /auth/me without token returns 401
(pass) Auth Endpoints - Auth Guards > PUT /auth/profile without token returns 401
(pass) Auth Endpoints - Auth Guards > PUT /auth/password without token returns 401

src\tests\automations-expanded.test.js:
(pass) Automations — History > GET /automations/history returns run history
(pass) Automations — History > DELETE /automations/history clears history [16.00ms]
(pass) Automations — Stats > GET /automations/stats returns statistics
(pass) Automations — Run & Toggle > POST /automations/:id/run triggers manual run
(pass) Automations — Run & Toggle > POST /automations/:id/toggle toggles enabled state
(pass) Automations — Run & Toggle > POST /automations/:id/run for nonexistent returns error
(pass) Automations — From Preset > POST /automations/from-preset creates rule from preset
(pass) Automations — From Preset > POST /automations/from-preset without presetId returns error
(pass) Automations — From Preset > POST /automations/from-preset with invalid presetId returns 400
(pass) Automations — Multi-Platform Presets > from-preset accepts poshmark presets (9 IDs)
(pass) Automations — Multi-Platform Presets > from-preset accepts mercari presets (3 IDs)
(pass) Automations — Multi-Platform Presets > from-preset accepts depop presets (3 IDs)
(pass) Automations — Multi-Platform Presets > from-preset accepts grailed presets (3 IDs)
(pass) Automations — Multi-Platform Presets > from-preset accepts facebook presets (3 IDs)
(pass) Automations — Multi-Platform Presets > from-preset accepts whatnot presets (3 IDs)
(pass) Automations — Multi-Platform Presets > from-preset accepts cross_platform presets (4 IDs)
(pass) Automations — Multi-Platform Presets > all 36 preset IDs are recognized (not 400 unknown)
(pass) Automations — Schedule Settings > GET /automations/schedule-settings returns settings
(pass) Automations — Schedule Settings > POST /automations/schedule-settings saves settings
(pass) Automations — Schedule Settings > POST /automations/schedule-settings rejects invalid frequency

src\tests\automations.test.js:
Running Automations API tests...
(pass) Automations - List Rules > GET /automations - should return automation rules
(pass) Automations - List Rules > GET /automations?type=share - should filter by type
(pass) Automations - List Rules > GET /automations?platform=poshmark - should filter by platform
(pass) Automations - List Rules > GET /automations?enabled=true - should filter by enabled status
(pass) Automations - Create Rule > POST /automations - should create automation rule
(pass) Automations - Create Rule > POST /automations - should validate required fields
(pass) Automations - Get Single Rule > GET /automations/:id - should return rule details
(pass) Automations - Get Single Rule > GET /automations/:id - should return 404 for non-existent rule
(pass) Automations - Update Rule > PUT /automations/:id - should update rule
(pass) Automations - Update Rule > PUT /automations/:id/toggle - should toggle rule enabled status
(pass) Automations - Logs > GET /automations/logs - should return automation logs
(pass) Automations - Logs > GET /automations/logs?status=success - should filter logs by status
(pass) Automations - Logs > GET /automations/logs - should support pagination
(pass) Automations - Presets > GET /automations/presets - should return automation presets
(pass) Automations - Delete Rule > DELETE /automations/:id - should delete rule
(pass) Automations - Authentication > GET /automations - should require auth

src\tests\barcode.test.js:
Running Barcode API tests...
(pass) Barcode - Lookup > GET /barcode/lookup/:code - should lookup UPC code
(pass) Barcode - Lookup > GET /barcode/lookup/:code - should handle invalid barcode
(pass) Barcode - Generate > POST /barcode/generate - should generate barcode
(pass) Barcode - Generate > POST /barcode/generate - should generate QR code
(pass) Barcode - Scan History > GET /barcode/history - should return scan history
(pass) Barcode - Authentication > GET /barcode/lookup/:code - should require auth [16.00ms]

src\tests\batchPhoto.test.js:
(pass) Batch Photo - List Jobs > GET /batch-photo/jobs - should return job list [15.00ms]
(pass) Batch Photo - Create Job > POST /batch-photo/jobs - should create batch job
(pass) Batch Photo - Create Job > POST /batch-photo/jobs - should fail without image IDs
(pass) Batch Photo - Create Job > POST /batch-photo/jobs - should fail with empty image IDs
(pass) Batch Photo - Create Job > POST /batch-photo/jobs - should fail without transformations
(pass) Batch Photo - Create Job > POST /batch-photo/jobs - should fail without at least one transformation
(pass) Batch Photo - Create Job > POST /batch-photo/jobs - should limit to 50 images
(pass) Batch Photo - Get Job Details > GET /batch-photo/jobs/:id - should return job with items
(pass) Batch Photo - Get Job Details > GET /batch-photo/jobs/:id - should return 404 for non-existent job
(pass) Batch Photo - Start Job > POST /batch-photo/jobs/:id/start - should start job
(pass) Batch Photo - Start Job > POST /batch-photo/jobs/:id/start - should return 404 for non-existent job
(pass) Batch Photo - Cancel Job > POST /batch-photo/jobs/:id/cancel - should cancel job
(pass) Batch Photo - Cancel Job > POST /batch-photo/jobs/:id/cancel - should return 404 for non-existent job
(pass) Batch Photo - Presets List > GET /batch-photo/presets - should return preset list
(pass) Batch Photo - Create Preset > POST /batch-photo/presets - should create preset
(pass) Batch Photo - Create Preset > POST /batch-photo/presets - should fail without name
(pass) Batch Photo - Create Preset > POST /batch-photo/presets - should fail without transformations
(pass) Batch Photo - Update Preset > PUT /batch-photo/presets/:id - should update preset
(pass) Batch Photo - Update Preset > PUT /batch-photo/presets/:id - should return 404 for non-existent preset
(pass) Batch Photo - Set Default Preset > POST /batch-photo/presets/:id/set-default - should set default preset
(pass) Batch Photo - Set Default Preset > POST /batch-photo/presets/:id/set-default - should return 404 for 
non-existent preset
(pass) Batch Photo - Delete Preset > DELETE /batch-photo/presets/:id - should delete preset
(pass) Batch Photo - Delete Preset > DELETE /batch-photo/presets/:id - should return 404 for non-existent preset
(pass) Batch Photo - Delete Job > DELETE /batch-photo/jobs/:id - should delete job
(pass) Batch Photo - Delete Job > DELETE /batch-photo/jobs/:id - should return 404 for non-existent job

src\tests\billing-expanded.test.js:
(pass) Billing - Auth Guard > POST /billing/change-plan without auth returns 401
(pass) Billing - Prorate > POST /billing/prorate calculates proration
(pass) Billing - Prorate > POST /billing/prorate without required fields returns 400
(pass) Billing - Usage Refresh > POST /billing/usage/refresh recalculates usage
(pass) Billing - Change Plan > POST /billing/change-plan with valid planId
(pass) Billing - Change Plan > POST /billing/change-plan without planId returns 400
(pass) Billing - Change Plan > POST /billing/change-plan with invalid planId returns 400
(pass) Billing - Select Plan > POST /billing/select-plan with valid planId
(pass) Billing - Select Plan > POST /billing/select-plan without planId returns 400

src\tests\billing.test.js:
(pass) GET /api/billing/usage > rejects unauthenticated request
(pass) GET /api/billing/usage > returns current period usage for authenticated user
(pass) GET /api/billing/usage/history > rejects unauthenticated request
(pass) GET /api/billing/usage/history > returns past 6 months of usage history
(pass) POST /api/billing/prorate > rejects unauthenticated request
(pass) POST /api/billing/prorate > calculates proration with valid body
(pass) POST /api/billing/prorate > rejects missing required plan fields
(pass) GET /api/billing/plans > rejects unauthenticated request
(pass) GET /api/billing/plans > returns list of available plans
(pass) POST /api/billing/usage/refresh > rejects unauthenticated request
(pass) POST /api/billing/usage/refresh > triggers usage recalculation from DB [16.00ms]
(pass) POST /api/billing/change-plan > rejects unauthenticated request
(pass) POST /api/billing/change-plan > changes plan with valid planId
(pass) POST /api/billing/change-plan > rejects missing planId
(pass) POST /api/billing/select-plan > rejects unauthenticated request
(pass) POST /api/billing/select-plan > selects plan with valid planId

src\tests\calendar-expanded.test.js:
(pass) Calendar - Auth Guard > GET /calendar without auth returns 401
(pass) Calendar - Auth Guard > POST /calendar/events without auth returns 401
(pass) Calendar - List Events > GET /calendar returns events array [16.00ms]
(pass) Calendar - List Events > GET /calendar with date range
(pass) Calendar - List Events > GET /calendar with type filter
(pass) Calendar - Month Events > GET /calendar/2025/6 returns June events
(pass) Calendar - Month Events > GET /calendar/2025/13 invalid month returns 400
(pass) Calendar - Month Events > GET /calendar/1800/1 invalid year returns 400
(pass) Calendar - Create Event > POST /calendar/events creates event
(pass) Calendar - Create Event > POST /calendar/events without title returns 400
(pass) Calendar - Create Event > POST /calendar/events without date returns 400
(pass) Calendar - Create Event > POST /calendar/events with title over 200 chars returns 400
(pass) Calendar - Create Event > POST /calendar/events with description over 2000 chars returns 400
(pass) Calendar - Get/Update/Delete Event > GET /calendar/events/nonexistent returns 404
(pass) Calendar - Get/Update/Delete Event > PUT /calendar/events/nonexistent returns 404
(pass) Calendar - Get/Update/Delete Event > DELETE /calendar/events/nonexistent returns 404
(pass) Calendar - Sync Settings > GET /calendar/sync-settings returns settings list
(pass) Calendar - Sync Settings > POST /calendar/sync-settings creates sync setting
(pass) Calendar - Sync Settings > POST /calendar/sync-settings with outlook provider
(pass) Calendar - Sync Settings > POST /calendar/sync-settings without provider returns 400
(pass) Calendar - Sync Settings > POST /calendar/sync-settings with invalid provider returns 400
(pass) Calendar - Sync Settings > POST /calendar/sync-settings with invalid frequency returns 400
(pass) Calendar - Sync Settings > DELETE /calendar/sync-settings/nonexistent returns 404

src\tests\calendar.test.js:
(pass) Calendar - Auth Guard > GET /calendar without auth returns 401
(pass) Calendar - Events List > GET /calendar returns events
(pass) Calendar - Events List > GET /calendar with date range filter
(pass) Calendar - Events List > GET /calendar with type filter
(pass) Calendar - Create Event > POST /calendar/events creates event [15.00ms]
(pass) Calendar - Create Event > POST /calendar/events validates required fields
(pass) Calendar - Get Single Event > GET /calendar/events/:id returns event details
(pass) Calendar - Update Event > PUT /calendar/events/:id updates event
(pass) Calendar - Delete Event > DELETE /calendar/events/:id deletes event
(pass) Calendar - Month View > GET /calendar/2024/1 returns month events
(pass) Calendar - Month View > GET /calendar/2024/12 returns month events
(pass) Calendar - Sync Settings > GET /calendar/sync-settings returns 200 with data
(pass) Calendar - Sync Settings > POST /calendar/sync-settings creates sync config
(pass) Calendar - Sync Settings > POST /calendar/sync-settings with invalid provider returns 400
(pass) Calendar - Sync Settings > POST /calendar/sync-settings with invalid frequency returns 400
(pass) Calendar - Sync Settings > DELETE /calendar/sync-settings/nonexistent returns 404

src\tests\chatbot-expanded.test.js:
(pass) Chatbot Expanded - Delete Conversation > DELETE /chatbot/conversations/:id without auth returns 401
(pass) Chatbot Expanded - Delete Conversation > DELETE /chatbot/conversations/nonexistent returns 404
(pass) Chatbot Expanded - Delete Conversation > DELETE /chatbot/conversations/:id for own conversation returns 200
(pass) Chatbot Expanded - Delete Conversation > DELETE /chatbot/conversations/:id for other users conversation returns 
404 [15.00ms]

src\tests\chatbot.test.js:
Running Chatbot API tests...
(pass) Chatbot - Conversations > POST /chatbot/conversations - should create conversation
(pass) Chatbot - Conversations > GET /chatbot/conversations - should list conversations
(pass) Chatbot - Conversations > GET /chatbot/conversations/:id - should get conversation details
(pass) Chatbot - Messages > POST /chatbot/message - should send message and get response [1359.00ms]
(pass) Chatbot - Messages > POST /chatbot/message - should handle follow-up message [1282.00ms]
(pass) Chatbot - Messages > POST /chatbot/message - should reject missing message
(pass) Chatbot - Rating > POST /chatbot/rate - should rate message helpfulness
(pass) Chatbot - Rating > POST /chatbot/rate - should validate rating value
(pass) Chatbot - Authentication > POST /chatbot/conversations - should require auth
(pass) Chatbot - Authentication > POST /chatbot/message - should require auth

src\tests\checklists-expanded.test.js:
(pass) Checklists - Templates > GET /checklists/templates returns available templates
(pass) Checklists - Create from Template > POST /checklists/from-template with valid template_id
(pass) Checklists - Create from Template > POST /checklists/from-template requires template_id
(pass) Checklists - Create from Template > POST /checklists/from-template rejects invalid template
(pass) Checklists - Shares > GET /checklists/shares returns share list
(pass) Checklists - Shares > POST /checklists/share requires shared_with
(pass) Checklists - Shares > POST /checklists/share with valid data
(pass) Checklists - Shares > DELETE /checklists/shares/:id on nonexistent returns 404
(pass) Checklists - Items CRUD > GET /checklists/items returns all items [16.00ms]
(pass) Checklists - Items CRUD > POST /checklists/items creates an item
(pass) Checklists - Items CRUD > POST /checklists/items requires title
(pass) Checklists - Items CRUD > PATCH /checklists/items/:id updates item
(pass) Checklists - Items CRUD > DELETE /checklists/items/:id removes item
(pass) Checklists - Items CRUD > DELETE /checklists/items/nonexistent returns 404
(pass) Checklists - Items by Checklist > GET /checklists/:id/items returns items for checklist
(pass) Checklists - Items by Checklist > GET /checklists/nonexistent/items responds
(pass) Checklists - Auth Guard > POST /checklists without auth returns 401
(pass) Checklists - Auth Guard > GET /checklists/templates is accessible

src\tests\checklists.test.js:
Running Checklists API tests...
(pass) Checklists - List > GET /checklists - should return checklists
(pass) Checklists - Create > POST /checklists - should create checklist
(pass) Checklists - Get Single > GET /checklists/:id - should return checklist details
(pass) Checklists - Update > PUT /checklists/:id - should update checklist
(pass) Checklists - Update > PATCH /checklists/:id/items/:itemIndex - should toggle item
(pass) Checklists - Delete > DELETE /checklists/:id - should delete checklist
(pass) Checklists - Authentication > GET /checklists - should require auth

src\tests\community-expanded.test.js:
(pass) Community Expanded - Delete Post > DELETE /community/posts/:id without auth returns 401
(pass) Community Expanded - Delete Post > DELETE /community/posts/nonexistent returns 404
(pass) Community Expanded - Delete Post > DELETE /community/posts/:id for own post returns success
(pass) Community Expanded - Delete Post > DELETE /community/posts/:id for another users post returns 404

src\tests\community.test.js:
Running Community API tests...
(pass) Community - Posts > POST /community/posts - should create discussion post
(pass) Community - Posts > POST /community/posts - should create success story
(pass) Community - Posts > POST /community/posts - should create tip post
(pass) Community - Posts > GET /community/posts - should list posts
(pass) Community - Posts > GET /community/posts?type=discussion - should filter by type
(pass) Community - Posts > GET /community/posts/:id - should get post details
(pass) Community - Replies > POST /community/posts/:id/replies - should create reply
(pass) Community - Replies > PATCH /community/replies/:id - should update reply
(pass) Community - Reactions > POST /community/posts/:id/react - should add upvote
(pass) Community - Reactions > POST /community/posts/:id/react - should toggle reaction
(pass) Community - Reactions > POST /community/posts/:id/react - should validate reaction type
(pass) Community - Leaderboard > GET /community/leaderboard - should return top sellers
(pass) Community - Leaderboard > GET /community/leaderboard?period=week - should filter by period
(pass) Community - Moderation > POST /community/posts/:id/flag - should flag post
(pass) Community - Moderation > POST /community/posts/:id/flag - should prevent duplicate flags
(pass) Community - Search > GET /community/posts?search=X - should search posts

src\tests\competitorTracking-expanded.test.js:
(pass) Competitor Tracking - Auth Guard > GET /competitor-tracking/keywords without auth returns 401
(pass) Competitor Tracking - Auth Guard > POST /competitor-tracking/keywords/analyze without auth returns 401
(pass) Competitor Tracking - Keywords > GET /competitor-tracking/keywords returns keyword list
(pass) Competitor Tracking - Keyword Analysis > POST /competitor-tracking/keywords/analyze runs analysis
(pass) Competitor Tracking - Keyword Opportunities > GET /competitor-tracking/keywords/opportunities returns 
opportunities
(pass) Competitor Tracking - Keyword Opportunities > GET /competitor-tracking/keywords/opportunities?limit=5 respects 
limit
(pass) Competitor Tracking - Price Intelligence > GET /competitor-tracking/price-intelligence returns pricing data
(pass) Competitor Tracking - Price Intelligence > GET /competitor-tracking/price-intelligence?category=shoes filters 
by category
(pass) Competitor Tracking - Price Intelligence > GET /competitor-tracking/price-intelligence?brand=Nike filters by 
brand
(pass) Competitor Tracking - Price Intelligence Refresh > POST /competitor-tracking/price-intelligence/refresh 
recalculates

src\tests\competitorTracking.test.js:
(pass) GET /api/competitor-tracking/keywords > rejects unauthenticated request
(pass) GET /api/competitor-tracking/keywords > returns keywords list when authenticated
(pass) POST /api/competitor-tracking/keywords/analyze > rejects unauthenticated request
(pass) POST /api/competitor-tracking/keywords/analyze > analyzes titles when authenticated [15.00ms]
(pass) POST /api/competitor-tracking/keywords/analyze > handles empty titles array
(pass) GET /api/competitor-tracking/keywords/opportunities > rejects unauthenticated request
(pass) GET /api/competitor-tracking/keywords/opportunities > returns opportunities with limit param
(pass) GET /api/competitor-tracking/price-intelligence > rejects unauthenticated request
(pass) GET /api/competitor-tracking/price-intelligence > returns price intelligence when authenticated
(pass) GET /api/competitor-tracking/price-intelligence > accepts category filter param
(pass) POST /api/competitor-tracking/price-intelligence/refresh > rejects unauthenticated request
(pass) POST /api/competitor-tracking/price-intelligence/refresh > triggers refresh when authenticated

src\tests\cross-user-auth-expanded.test.js:
(pass) Cross-User — Inventory Isolation > User B cannot see User A inventory items
(pass) Cross-User — Listing Isolation > User B cannot see User A listings
(pass) Cross-User — Automation Isolation > User B gets empty automations (not User A data)
(pass) Cross-User — Report Isolation > User B gets empty reports [16.00ms]
(pass) Cross-User — Webhook Isolation > User B gets empty webhook endpoints
(pass) Cross-User — Notification Isolation > User B gets only own notifications
(pass) Cross-User — Auth Guards > No-auth request is rejected on protected endpoints
(pass) Cross-User — Auth Guards > Invalid token is rejected
(pass) Cross-User — Auth Guards > Expired-format token is rejected
(pass) Cross-User — IDOR Attempts > User B cannot update User A inventory item by guessing ID
(pass) Cross-User — IDOR Attempts > User B cannot delete User A inventory item
(pass) Cross-User — IDOR Read: Inventory Item by ID > User B cannot GET /inventory/:id belonging to User A
(pass) Cross-User — IDOR Read: Order by ID > User B cannot GET /orders/:id belonging to User A

src\tests\cross-user-auth.test.js:
(pass) Cross-User Authorization > User B cannot access User A inventory [16.00ms]
(pass) Cross-User Authorization > User B cannot access User A reports
(pass) Cross-User Authorization > User B cannot access User A webhooks
(pass) Cross-User Authorization > Unauthenticated requests are rejected
(pass) Cross-User Authorization > Invalid token is rejected

src\tests\dataIntegrity.test.js:
(pass) Data Integrity - Soft Delete + Restore > deleted item is no longer accessible via GET [15.00ms]
(pass) Data Integrity - Soft Delete + Restore > restored item returns to inventory
(pass) Data Integrity - Soft Delete + Restore > permanently deleted item is gone from recently-deleted
(pass) Data Integrity - Soft Delete + Restore > restore nonexistent item returns 404
(pass) Data Integrity - Pagination > inventory supports page and limit params
(pass) Data Integrity - Pagination > page beyond total returns empty array
(pass) Data Integrity - Pagination > limit=1 returns at most 1 item
(pass) Data Integrity - Pagination > default pagination returns items
(pass) Data Integrity - Search > search by title returns matching items [16.00ms]
(pass) Data Integrity - Search > search with no matches returns empty array
(pass) Data Integrity - Search > search is case-insensitive
(pass) Data Integrity - Concurrent Writes > sequential rapid POSTs all succeed with unique IDs
(pass) Data Integrity - Concurrent Writes > concurrent updates to same item do not corrupt [16.00ms]
(pass) Data Integrity - Cross-User Isolation > user A cannot see user B items
(pass) Data Integrity - Cross-User Isolation > user A cannot update user B item
(pass) Data Integrity - Cross-User Isolation > user A cannot delete user B item
(pass) Data Integrity - GDPR Deletion Flow > schedule deletion then check status then cancel
(pass) Data Integrity - GDPR Deletion Flow > delete-account requires password [218.00ms]
(pass) Data Integrity - GDPR Deletion Flow > unauthenticated GDPR requests return 401

src\tests\db-connectionPool-coverage.test.js:
(pass) ConnectionPool — init() > double init is a no-op
(pass) ConnectionPool — acquire() > returns an available connection
(pass) ConnectionPool — acquire() > returns first connection as fallback when none available
(pass) ConnectionPool — acquire() > calls init() if not initialized
(pass) ConnectionPool — release() > adds connection back to available
(pass) ConnectionPool — release() > does not duplicate if already in available
(pass) ConnectionPool — release() > can release a connection not originally from the pool
(pass) ConnectionPool — close() > calls close on all connections
(pass) ConnectionPool — close() > resets pool state
(pass) ConnectionPool — close() > is safe to call when already closed
(pass) ConnectionPool — getStats() > returns correct stats with fake connections
(pass) ConnectionPool — getStats() > returns correct available count when all are available
(pass) ConnectionPool — _logQuery() > logs truncated SQL in non-production
(pass) ConnectionPool — _logQuery() > truncates long SQL to 100 chars + ellipsis
(pass) ConnectionPool — _logQuery() > does not log in production
(pass) ProfiledDatabase — get() > acquires connection, prepares, calls stmt.get(), releases
(pass) ProfiledDatabase — get() > calls stmt.get() without spread when no params
(pass) ProfiledDatabase — get() > increments totalQueries
(pass) ProfiledDatabase — get() > releases connection even on error
(pass) ProfiledDatabase — all() > returns array from stmt.all()
(pass) ProfiledDatabase — all() > passes params when non-empty
(pass) ProfiledDatabase — all() > calls without spread when params is empty
(pass) ProfiledDatabase — all() > releases connection on error
(pass) ProfiledDatabase — run() > returns result from stmt.run()
(pass) ProfiledDatabase — run() > passes params when non-empty
(pass) ProfiledDatabase — run() > calls without spread when params is empty
(pass) ProfiledDatabase — run() > releases connection on error
(pass) ProfiledDatabase — exec() > calls db.exec() on the acquired connection
(pass) ProfiledDatabase — exec() > releases connection after exec
(pass) ProfiledDatabase — exec() > releases connection on exec error
(pass) ProfiledDatabase — exec() > increments stats on exec
(pass) ProfiledDatabase — transaction() > wraps fn in a transaction and executes it
(pass) ProfiledDatabase — transaction() > releases connection after transaction
(pass) ProfiledDatabase — transaction() > releases connection on transaction error
(pass) ProfiledDatabase — _profile() slow query path > detects slow queries and increments slowQueries counter 
[203.00ms]
(pass) ProfiledDatabase — _profile() slow query path > logs slow query warning when profiling is enabled [156.00ms]
(pass) ProfiledDatabase — _profile() slow query path > attempts EXPLAIN QUERY PLAN for slow SELECT queries [141.00ms]
(pass) ProfiledDatabase — _profile() slow query path > handles EXPLAIN errors gracefully [156.00ms]
(pass) ProfiledDatabase — _profile() slow query path > does not run EXPLAIN for non-SELECT slow queries [141.00ms]
(pass) ProfiledDatabase — _profile() queryTimes eviction > evicts oldest entry when map reaches 500 distinct patterns
(pass) ProfiledDatabase — _profile() queryTimes eviction > caps per-query samples at 100 [16.00ms]
(pass) ProfiledDatabase — _hashQuery() additional > normalizes mixed whitespace characters
(pass) ProfiledDatabase — _hashQuery() additional > handles query with only placeholders
(pass) ProfiledDatabase — _hashQuery() additional > handles complex nested string literals
(pass) ProfiledDatabase — _hashQuery() additional > handles decimal numbers without integer part
(pass) ProfiledDatabase — getProfilingStats() with data > calculates correct slowQueryPercentage
(pass) ProfiledDatabase — getProfilingStats() with data > calculates correct avgQueryTimeMs
(pass) ProfiledDatabase — getProfilingStats() with data > topSlowQueries sorted by avgMs descending
(pass) ProfiledDatabase — getProfilingStats() with data > topSlowQueries entries have correct count
(pass) ProfiledDatabase — getProfilingStats() with data > limits topSlowQueries to 10
(pass) ProfiledDatabase — getProfilingStats() with data > handles 0 totalQueries without NaN
(pass) ProfiledDatabase — resetProfilingStats() > clears all counters and map
(pass) ProfiledDatabase — resetProfilingStats() > idempotent reset
(pass) Module exports > pool has all expected methods
(pass) Module exports > profiledDb has all expected methods
(pass) Module exports > profiledDb.pool references the pool singleton
(pass) Module exports > default export is profiledDb
(pass) Module exports > queryStats is exported and mutable
(pass) Module exports > queryStats.queryTimes is a Map
(pass) ProfiledDatabase — full lifecycle > get → all → run → exec cycle with fake connections
(pass) ProfiledDatabase — full lifecycle > profiling stats reflect operations after lifecycle

src\tests\db-connectionPool-unit.test.js:
(pass) ConnectionPool — singleton > initial state > pool is not yet initialized (lazy)
(pass) ConnectionPool — singleton > initial state > poolSize is a positive integer
(pass) ConnectionPool — singleton > initial state > connections array is empty before init
(pass) ConnectionPool — singleton > initial state > available array is empty before init
(pass) ConnectionPool — singleton > initial state > waiting array exists and is empty
(pass) ConnectionPool — singleton > initial state > dbPath is a non-empty string
(pass) ConnectionPool — singleton > getStats() > returns an object with poolSize, availableConnections, 
activeConnections
(pass) ConnectionPool — singleton > getStats() > poolSize matches pool.poolSize
(pass) ConnectionPool — singleton > getStats() > availableConnections equals available.length
(pass) ConnectionPool — singleton > getStats() > activeConnections = poolSize - availableConnections
(pass) ConnectionPool — singleton > getStats() > all stat values are non-negative numbers
(pass) ConnectionPool — singleton > release() > pushes a connection back to available
(pass) ConnectionPool — singleton > release() > does not duplicate if connection already in available
(pass) ConnectionPool — singleton > close() > resets initialized flag, connections, and available arrays
(pass) ConnectionPool — singleton > close() > calls close() on every connection
(pass) ConnectionPool — singleton > close() > can be called when already closed (no-op)
(pass) ProfiledDatabase — _hashQuery() > collapses multiple spaces to single space
(pass) ProfiledDatabase — _hashQuery() > collapses tabs and newlines
(pass) ProfiledDatabase — _hashQuery() > trims leading and trailing whitespace
(pass) ProfiledDatabase — _hashQuery() > replaces single-quoted strings with ?
(pass) ProfiledDatabase — _hashQuery() > replaces multiple string literals
(pass) ProfiledDatabase — _hashQuery() > replaces empty string literal
(pass) ProfiledDatabase — _hashQuery() > replaces string with spaces inside
(pass) ProfiledDatabase — _hashQuery() > replaces integers
(pass) ProfiledDatabase — _hashQuery() > replaces decimals
(pass) ProfiledDatabase — _hashQuery() > replaces negative-looking numbers (digits portion)
(pass) ProfiledDatabase — _hashQuery() > replaces 0x-prefixed hex
(pass) ProfiledDatabase — _hashQuery() > replaces lowercase hex
(pass) ProfiledDatabase — _hashQuery() > different UUIDs produce the same hash
(pass) ProfiledDatabase — _hashQuery() > different tables produce different hashes
(pass) ProfiledDatabase — _hashQuery() > different operations produce different hashes
(pass) ProfiledDatabase — _hashQuery() > same query always produces the same hash
(pass) ProfiledDatabase — _hashQuery() > output is at most 120 characters
(pass) ProfiledDatabase — _hashQuery() > short queries are not truncated
(pass) ProfiledDatabase — _hashQuery() > empty string returns empty string
(pass) ProfiledDatabase — _hashQuery() > only whitespace returns empty string
(pass) ProfiledDatabase — _hashQuery() > query with only parameter placeholders is stable
(pass) queryStats object > has expected keys
(pass) queryStats object > queryTimes is a Map
(pass) queryStats object > counters are mutable numbers
(pass) queryStats object > queryTimes Map can store and retrieve entries
(pass) queryStats object > queryTimes.clear() empties the map
(pass) ProfiledDatabase — _profile() tracking > increments totalQueries on each call
(pass) ProfiledDatabase — _profile() tracking > accumulates totalTime
(pass) ProfiledDatabase — _profile() tracking > returns the value from fn
(pass) ProfiledDatabase — _profile() tracking > returns complex objects from fn
(pass) ProfiledDatabase — _profile() tracking > increments errors and re-throws on fn failure
(pass) ProfiledDatabase — _profile() tracking > still increments totalQueries even when fn throws
(pass) ProfiledDatabase — _profile() tracking > still accumulates totalTime even when fn throws
(pass) ProfiledDatabase — _profile() tracking > records per-query times in queryTimes Map
(pass) ProfiledDatabase — _profile() tracking > appends times for repeated identical queries
(pass) ProfiledDatabase — _profile() tracking > stores truncated SQL (up to 120 chars) in queryTimes entry
(pass) ProfiledDatabase — _profile() tracking > caps per-query samples at 100
(pass) ProfiledDatabase — _profile() tracking > evicts oldest query pattern when map exceeds 500 entries
(pass) ProfiledDatabase — _profile() tracking > evicts oldest entry when distinct patterns exceed 500
(pass) ProfiledDatabase — getProfilingStats() > returns correct shape with all expected keys
(pass) ProfiledDatabase — getProfilingStats() > topSlowQueries is an array
(pass) ProfiledDatabase — getProfilingStats() > pool stats are nested inside profiling stats
(pass) ProfiledDatabase — getProfilingStats() > zeroed stats produce sensible defaults
(pass) ProfiledDatabase — getProfilingStats() > reflects query activity after _profile calls
(pass) ProfiledDatabase — getProfilingStats() > avgQueryTimeMs is totalTime / totalQueries
(pass) ProfiledDatabase — getProfilingStats() > slowQueryPercentage is formatted with % suffix
(pass) ProfiledDatabase — getProfilingStats() > topSlowQueries has at most 10 entries
(pass) ProfiledDatabase — getProfilingStats() > topSlowQueries entries have query, avgMs, maxMs, count
(pass) ProfiledDatabase — getProfilingStats() > topSlowQueries sorted by avgMs descending
(pass) ProfiledDatabase — getProfilingStats() > errors count reflected in profiling stats
(pass) ProfiledDatabase — resetProfilingStats() > resets all counters to zero
(pass) ProfiledDatabase — resetProfilingStats() > getProfilingStats reflects reset state
(pass) ProfiledDatabase — resetProfilingStats() > new queries after reset start from zero
(pass) ProfiledDatabase — resetProfilingStats() > reset is idempotent
(pass) Module exports > pool is an object with expected methods
(pass) Module exports > profiledDb is an object with expected methods
(pass) Module exports > profiledDb.pool references the pool singleton
(pass) Module exports > queryStats is a plain object (not a class instance)

src\tests\db-connectionPool.test.js:
(pass) ConnectionPool > getStats > returns pool statistics shape
(pass) ConnectionPool > getStats > poolSize matches configured value
(pass) ProfiledDatabase > _hashQuery > normalizes whitespace
(pass) ProfiledDatabase > _hashQuery > replaces string literals with ?
(pass) ProfiledDatabase > _hashQuery > replaces numeric literals with ?
(pass) ProfiledDatabase > _hashQuery > normalizes different UUIDs to same hash
(pass) ProfiledDatabase > _hashQuery > distinguishes different query structures
(pass) ProfiledDatabase > _hashQuery > truncates to 120 characters
(pass) ProfiledDatabase > _hashQuery > replaces hex literals with ?
(pass) ProfiledDatabase > getProfilingStats > returns profiling statistics shape
(pass) ProfiledDatabase > getProfilingStats > topSlowQueries is an array
(pass) ProfiledDatabase > getProfilingStats > pool stats nested inside profiling stats
(pass) ProfiledDatabase > resetProfilingStats > resets all counters to zero
(pass) ProfiledDatabase > resetProfilingStats > profiling stats reflect reset

src\tests\db-database-models.test.js:
(pass) models CRUD > create inserts a row
(pass) models CRUD > findById retrieves inserted row
(pass) models CRUD > findOne with conditions
(pass) models CRUD > findMany returns array
(pass) models CRUD > findMany with conditions filters
(pass) models CRUD > findMany with orderBy
(pass) models CRUD > findMany with limit
(pass) models CRUD > update modifies row
(pass) models CRUD > count returns total
(pass) models CRUD > count with conditions
(pass) models CRUD > delete removes row
(pass) validateIdentifier (SQL injection prevention) > rejects table name with semicolon
(pass) validateIdentifier (SQL injection prevention) > rejects table name with space
(pass) validateIdentifier (SQL injection prevention) > rejects column name with injection
(pass) validateIdentifier (SQL injection prevention) > rejects table name starting with number
(pass) validateIdentifier (SQL injection prevention) > allows valid identifier with underscores
(pass) query helpers > query.get returns single row
(pass) query helpers > query.all returns array
(pass) query helpers > query.run executes mutations
(pass) query helpers > query.transaction commits on success
(pass) query helpers > query.get with non-array params
(pass) cleanupExpiredData > returns results object [15.00ms]
(pass) cleanupExpiredData > handles missing tables gracefully

src\tests\db-database-unit.test.js:
(pass) default db export > is a Database instance with exec and query methods
(pass) default db export > has WAL journal mode enabled
(pass) default db export > has foreign keys enabled
(pass) default db export > has busy_timeout configured
(pass) query.get > returns null for non-existent row
(pass) query.get > accepts non-array single param
(pass) query.get > works with no params for unparameterized query
(pass) query.get > throws on invalid SQL
(pass) query.all > returns empty array for no matches
(pass) query.all > returns all matching rows
(pass) query.all > accepts non-array single param
(pass) query.all > throws on invalid SQL
(pass) query.run > returns changes count on insert
(pass) query.run > returns 0 changes when deleting nonexistent row
(pass) query.run > accepts non-array single param
(pass) query.run > throws on constraint violation
(pass) query.run > throws on invalid SQL
(pass) query.exec > executes raw DDL statements
(pass) query.exec > executes multiple statements [16.00ms]
(pass) query.exec > throws on invalid SQL
(pass) query.transaction > commits on success
(pass) query.transaction > rolls back on error
(pass) query.transaction > returns the value from the callback function
(pass) models.create > inserts a row and returns changes
(pass) models.create > rejects invalid table name
(pass) models.create > rejects invalid column name in data
(pass) models.findMany advanced > supports offset option
(pass) models.findMany advanced > supports multiple order by columns
(pass) models.findMany advanced > rejects invalid orderBy direction
(pass) models.findMany advanced > filters with multiple conditions
(pass) models.findMany advanced > returns empty array when no matches
(pass) models.findMany advanced > returns all rows when no conditions or options
(pass) models.findOne > finds row with multiple conditions
(pass) models.findOne > returns null for no match
(pass) models.findOne > rejects invalid column names
(pass) models.findById > returns null for nonexistent id
(pass) models.findById > returns the correct row
(pass) models.update > updates multiple fields at once
(pass) models.update > sets updated_at timestamp
(pass) models.update > returns 0 changes for nonexistent id
(pass) models.update > rejects invalid column name in data
(pass) models.delete > returns 1 change for existing row
(pass) models.delete > returns 0 changes for nonexistent row
(pass) models.delete > row is gone after delete
(pass) models.count > counts all rows
(pass) models.count > counts with single condition
(pass) models.count > counts with multiple conditions
(pass) models.count > returns 0 for no matches
(pass) models.count > returns 0 for empty table
(pass) validateIdentifier via models > rejects empty string
(pass) validateIdentifier via models > rejects dash in name
(pass) validateIdentifier via models > rejects dot notation
(pass) validateIdentifier via models > rejects parentheses
(pass) validateIdentifier via models > rejects quotes
(pass) validateIdentifier via models > allows underscored names
(pass) validateIdentifier via models > allows names starting with underscore
(pass) validateIdentifier via models > validates column names in findOne
(pass) validateIdentifier via models > validates column names in findMany
(pass) validateIdentifier via models > validates column names in count
(pass) statement cache > repeated queries use cached statements and return correct results
(pass) statement cache > handles many distinct queries without error
(pass) cleanupExpiredData > returns an object
(pass) cleanupExpiredData > returns numeric values for each table entry
(pass) cleanupExpiredData > includes expected table names
(pass) cleanupExpiredData > handles tables that do not exist (returns 0) [16.00ms]
(pass) cleanupExpiredData > actually deletes expired data from sessions
(pass) cleanupExpiredData > is idempotent — running twice does not error
(pass) initializeDatabase > is an exported function
Seeding help content...
✓ Help content seeded successfully
Checking demo data...
  Reseeding inventory items...
Demo data seed error: FOREIGN KEY constraint failed
(pass) initializeDatabase > returns true on success [343.00ms]
Seeding help content...
✓ Help content seeded successfully
Checking demo data...
  Reseeding inventory items...
Demo data seed error: FOREIGN KEY constraint failed
(pass) initializeDatabase > creates the migrations table [344.00ms]
Seeding help content...
✓ Help content seeded successfully
Checking demo data...
  Reseeding inventory items...
Demo data seed error: FOREIGN KEY constraint failed
(pass) initializeDatabase > records migrations as applied [360.00ms]
Seeding help content...
✓ Help content seeded successfully
Checking demo data...
  Reseeding inventory items...
Demo data seed error: FOREIGN KEY constraint failed
(pass) initializeDatabase > creates core schema tables [375.00ms]
(pass) escapeLike export > is exported as a function
(pass) escapeLike export > escapes percent
(pass) escapeLike export > escapes underscore
(pass) escapeLike export > works in actual LIKE queries
(pass) query.searchInventory > is a function on the query object
(pass) query.searchInventory > returns an array (possibly empty if FTS table missing)
(pass) concurrent operations > handles rapid inserts and reads
(pass) concurrent operations > handles rapid updates
(pass) error propagation > query.get re-throws database errors
(pass) error propagation > query.all re-throws database errors
(pass) error propagation > query.run re-throws database errors
(pass) error propagation > query.exec re-throws database errors
(pass) error propagation > models.create propagates constraint errors

src\tests\db-escapeLike.test.js:
(pass) escapeLike > escapes % wildcard
(pass) escapeLike > escapes _ wildcard
(pass) escapeLike > escapes backslash
(pass) escapeLike > passes through normal string unchanged
(pass) escapeLike > handles empty string
(pass) escapeLike > escapes multiple special characters in one string
(pass) escapeLike > coerces number to string

src\tests\db-init-unit.test.js:
(pass) db/init.js — script structure > file exists and is non-empty
(pass) db/init.js — script structure > imports fs utilities for file cleanup
(pass) db/init.js — script structure > imports path utilities for directory resolution
(pass) db/init.js — script structure > imports initializeDatabase from database.js (dynamic import)
(pass) db/init.js — script structure > calls initializeDatabase()
(pass) db/init.js — script structure > removes existing database file before init
(pass) db/init.js — script structure > removes WAL and SHM sidecar files
(pass) db/init.js — script structure > ensures data directory exists with recursive mkdir
(pass) db/init.js — script structure > uses DB_PATH from env or falls back to data/vaultlister.db
(pass) db/init.js — script structure > logs completion message
(pass) db/seed.js — stub script > file exists and is non-empty
(pass) db/seed.js — stub script > is a minimal file (under 10 lines)
(pass) db/seed.js — stub script > contains a console.log explaining it is a no-op
(pass) db/seed.js — stub script > indicates seeds are applied during db:init
(pass) db/seed.js — stub script > does not import database.js
(pass) db/seed.js — stub script > does not export any functions
(pass) seeds/demoData.js — export shape > exports seedDemoData as a named export
(pass) seeds/demoData.js — export shape > seedDemoData is the only named export
(pass) seeds/demoData.js — export shape > does not have a default export
(pass) seeds/demoData.js — source structure > imports uuid for generating unique IDs
(pass) seeds/demoData.js — source structure > imports query from database.js
(pass) seeds/demoData.js — source structure > defines demo user constants
(pass) seeds/demoData.js — source structure > has a hashPasswordSync helper function
(pass) seeds/demoData.js — source structure > defines seedInventoryItems function
(pass) seeds/demoData.js — source structure > defines seedOrders function
(pass) seeds/demoData.js — source structure > defines seedListings function
(pass) seeds/demoData.js — source structure > defines seedOffers function
(pass) seeds/demoData.js — source structure > defines seedSales function
(pass) seeds/demoData.js — inventory item structure > inventory items have required fields
(pass) seeds/demoData.js — inventory item structure > uses valid condition values
(pass) seeds/demoData.js — inventory item structure > uses valid status values for inventory
(pass) seeds/demoData.js — inventory item structure > SKUs follow VL- prefix convention
(pass) seeds/demoData.js — inventory item structure > has items across multiple categories
(pass) seeds/demoData.js — inventory item structure > has items with quantity 0 (out of stock)
(pass) seeds/demoData.js — inventory item structure > has items with varying quantities
(pass) seeds/demoData.js — inventory item structure > cost_price is always less than list_price in items
(pass) seeds/demoData.js — orders structure > orders have required fields
(pass) seeds/demoData.js — orders structure > orders use valid statuses
(pass) seeds/demoData.js — orders structure > orders use multiple platforms
(pass) seeds/demoData.js — orders structure > pending orders have null tracking info
(pass) seeds/demoData.js — orders structure > delivered orders have shipped_at and delivered_at timestamps
(pass) seeds/demoData.js — orders structure > uses valid shipping providers
(pass) seeds/demoData.js — listings structure > listings have required fields
(pass) seeds/demoData.js — listings structure > includes both fresh and stale listings
(pass) seeds/demoData.js — listings structure > stale listings have low engagement metrics
(pass) seeds/demoData.js — listings structure > seedListings returns listing IDs array
(pass) seeds/demoData.js — offers structure > offers have required fields
(pass) seeds/demoData.js — offers structure > offers use valid statuses
(pass) seeds/demoData.js — offers structure > pending offers have expires_at timestamps
(pass) seeds/demoData.js — offers structure > countered offers include a counter_amount
(pass) seeds/demoData.js — offers structure > accepted and declined offers have responded_at timestamps
(pass) seeds/demoData.js — offers structure > offer_amount is always less than listing_price
(pass) seeds/demoData.js — sales structure > sales have required fields
(pass) seeds/demoData.js — sales structure > sales use valid statuses
(pass) seeds/demoData.js — sales structure > sales span multiple platforms for analytics
(pass) seeds/demoData.js — sales structure > sales include platform fees and shipping costs
(pass) seeds/demoData.js — sales structure > sales are spread over 30 days for analytics
(pass) seeds/helpContent.js — export shape > exports seedHelpContent as a named export
(pass) seeds/helpContent.js — export shape > seedHelpContent is the only named export
(pass) seeds/helpContent.js — export shape > does not have a default export
(pass) seeds/helpContent.js — source structure > imports query from database.js
(pass) seeds/helpContent.js — source structure > defines video tutorials data
(pass) seeds/helpContent.js — source structure > video entries have required fields
(pass) seeds/helpContent.js — source structure > videos cover expected categories
(pass) seeds/helpContent.js — source structure > video IDs follow vid_ prefix convention
(pass) seeds/helpContent.js — source structure > video durations are positive numbers in seconds
(pass) seeds/helpContent.js — source structure > defines FAQ data
(pass) seeds/helpContent.js — source structure > FAQ entries have required fields
(pass) seeds/helpContent.js — source structure > FAQ IDs follow faq_ prefix convention
(pass) seeds/helpContent.js — source structure > FAQs cover expected categories
(pass) seeds/helpContent.js — source structure > defines knowledge base articles data
(pass) seeds/helpContent.js — source structure > article entries have required fields
(pass) seeds/helpContent.js — source structure > article IDs follow art_ prefix convention
(pass) seeds/helpContent.js — source structure > articles have slugs for URL routing
(pass) seeds/helpContent.js — source structure > articles cover different categories
(pass) seeds/helpContent.js — source structure > articles store tags as JSON arrays
(pass) seeds/helpContent.js — source structure > all articles are published
(pass) seeds/helpContent.js — source structure > inserts use INSERT OR IGNORE to handle re-runs
(pass) seeds/helpContent.js — source structure > logs completion message

src\tests\duplicates-expanded.test.js:
(pass) Duplicates — Auth Guard > GET /duplicates without auth returns 401
(pass) Duplicates — Delete > DELETE /duplicates/:id for nonexistent returns 404
(pass) Duplicates — Shape Validation > GET /duplicates returns proper shape
(pass) Duplicates — Shape Validation > GET /duplicates/stats returns stats shape
(pass) Duplicates — Shape Validation > POST /duplicates/check without item_id

src\tests\duplicates.test.js:
Running Duplicates API tests...
(pass) Duplicates - List > GET /duplicates - should list duplicate detections [15.00ms]
(pass) Duplicates - List > GET /duplicates?status=pending - should filter by status [16.00ms]
(pass) Duplicates - Scan > POST /duplicates/scan - should trigger duplicate scan [812.00ms]
(pass) Duplicates - Check > POST /duplicates/check - should check single item for duplicates
(pass) Duplicates - Update Action > PATCH /duplicates/:id - should update user action [16.00ms]
(pass) Duplicates - Stats > GET /duplicates/stats - should return duplicate statistics
(pass) Duplicates - Authentication > GET /duplicates - should require auth

src\tests\e2e-security.test.js:
(pass) E2E: Webhook Lifecycle Security > full webhook create-receive-verify flow [15.00ms]
(pass) E2E: Webhook Lifecycle Security > webhook upsert rotates secret correctly
(pass) E2E: Automation Security Flow > create automation with valid cron and verify isolation
(pass) E2E: Automation Security Flow > cron injection attempts should all fail
(pass) E2E: Report Security Flow > create report and verify data isolation
(pass) E2E: Report Security Flow > SQL injection attempts via custom query should all fail
(pass) E2E: Auth Token Lifecycle > full register-login-refresh-logout flow [453.00ms]
(pass) E2E: Auth Token Lifecycle > password change invalidates old password [1079.00ms]
(pass) E2E: Cross-Resource Isolation > new user starts with empty resources
(pass) E2E: Cross-Resource Isolation > User B cannot modify User A resources via ID guessing

src\tests\e2e.test.js:
Running E2E Workflow tests...
(pass) E2E - Complete Reselling Workflow > Step 1: Create inventory item
(pass) E2E - Complete Reselling Workflow > Step 2: Verify inventory item exists
(pass) E2E - Complete Reselling Workflow > Step 3: Create listing from inventory
(pass) E2E - Complete Reselling Workflow > Step 4: Verify listing is active
(pass) E2E - Complete Reselling Workflow > Step 5: Record a sale
(pass) E2E - Complete Reselling Workflow > Step 6: Update sale to shipped
(pass) E2E - Complete Reselling Workflow > Step 7: Verify analytics updated
(pass) E2E - Complete Reselling Workflow > Step 8: Check inventory quantity reduced
(pass) E2E - User Registration Flow > Step 1: Register new user [219.00ms]
(pass) E2E - User Registration Flow > Step 2: Login with new credentials [203.00ms]
(pass) E2E - User Registration Flow > Step 3: Access protected route with new user
(pass) E2E - Bulk Operations > Should handle bulk inventory creation
(pass) E2E - Search and Filter > Should search inventory by title [16.00ms]
(pass) E2E - Search and Filter > Should filter inventory by category
(pass) E2E - Search and Filter > Should filter inventory by brand

src\tests\ebay-publish.test.js:
(pass) publishListingToEbay — dynamic category resolution > calls taxonomy suggestion API for non-clothing text 
category
(pass) publishListingToEbay — dynamic category resolution > passes numeric category IDs directly without API lookup
(pass) publishListingToEbay — dynamic category resolution > falls back to default category when taxonomy API throws
(pass) publishListingToEbay — dynamic category resolution > falls back to default category when taxonomy API returns 
empty
(pass) publishListingToEbay — dynamic condition resolution > "good" condition picks USED_EXCELLENT when available
(pass) publishListingToEbay — dynamic condition resolution > "good" condition skips unavailable conditions and picks 
first valid [15.00ms]
(pass) publishListingToEbay — dynamic condition resolution > "like_new" condition prefers LIKE_NEW over USED_EXCELLENT
(pass) publishListingToEbay — dynamic condition resolution > "poor" condition picks FOR_PARTS_OR_NOT_WORKING when 
available
(pass) publishListingToEbay — dynamic condition resolution > "poor" condition falls back to USED_ACCEPTABLE when 
FOR_PARTS not in valid set
(pass) publishListingToEbay — dynamic condition resolution > "new" condition picks NEW when available
(pass) publishListingToEbay — dynamic condition resolution > unknown condition string defaults to good preference list
(pass) publishListingToEbay — dynamic condition resolution > uses first valid condition as last resort when nothing in 
preference list matches
(pass) publishListingToEbay — dynamic condition resolution > uses first preference entry when valid conditions returns 
null (API failed)
(pass) publishListingToEbay — happy path > returns offerId, listingId, sku, listingUrl on success
(pass) publishListingToEbay — happy path > throws when price is zero
(pass) publishListingToEbay — happy path > sandbox URL contains sandbox.ebay.com
(pass) publishListingToEbay — happy path > production URL contains www.ebay.com

src\tests\edge-cases.test.js:
(pass) Auth Edge Cases > should reject SQL injection in email field
(pass) Auth Edge Cases > should handle extremely long email
(pass) Auth Edge Cases > should handle empty body on login
(pass) Auth Edge Cases > should handle malformed JSON on login
(pass) Auth Edge Cases > should treat email as case-insensitive [250.00ms]
(pass) Auth Edge Cases > should reject token with tampered payload
(pass) Auth Edge Cases > should reject expired-format token
(pass) Auth Edge Cases > should reject XSS in registration username
(pass) Webhook Edge Cases > should reject webhook endpoint with empty name
(pass) Webhook Edge Cases > should reject webhook endpoint with no URL
(pass) Webhook Edge Cases > should handle webhook upsert (same name updates existing)
(pass) Automation Edge Cases > should reject automation with invalid type
(pass) Automation Edge Cases > should handle automation toggle on non-existent rule
(pass) Automation Edge Cases > should reject cron with command injection via backticks
(pass) Automation Edge Cases > should reject cron with pipe injection
(pass) Report Edge Cases > should handle report with unknown widget type
(pass) Report Edge Cases > should handle report generation with reversed date range
(pass) Report Edge Cases > should handle report generation with malformed dates
(pass) Report Edge Cases > should handle custom query with quoted table names
(pass) Report Edge Cases > should block subquery accessing disallowed tables
(pass) Inventory Edge Cases > should handle zero limit gracefully
(pass) Inventory Edge Cases > should handle string offset gracefully
(pass) Inventory Edge Cases > should handle float limit gracefully [16.00ms]

src\tests\emailMarketing.test.js:
(pass) Email Marketing - Unsubscribe > GET /email-marketing/unsubscribe without auth returns 401
(pass) Email Marketing - Unsubscribe > GET /email-marketing/unsubscribe without params returns error
(pass) Email Marketing - Unsubscribe > GET /email-marketing/unsubscribe with invalid token returns error
(pass) Email Marketing - Unsubscribe > GET /email-marketing/unsubscribe with missing token param returns error
(pass) Email Marketing - Stats (Admin/Enterprise Only) > GET /email-marketing/stats without auth returns 401
(pass) Email Marketing - Stats (Admin/Enterprise Only) > GET /email-marketing/stats as regular user returns 403
(pass) Email Marketing - Stats (Admin/Enterprise Only) > GET /email-marketing/stats as demo user returns 200 or 403
(pass) Email Marketing - Unknown Routes > GET /email-marketing/nonexistent returns 404

src\tests\emailOAuth-expanded.test.js:
(pass) Email OAuth - Providers > GET /email/providers returns supported providers
(pass) Email OAuth - Authorize > GET /email/authorize/gmail returns auth URL or config error
(pass) Email OAuth - Authorize > GET /email/authorize/outlook returns auth URL or config error
(pass) Email OAuth - Accounts > GET /email/accounts returns accounts array
(pass) Email OAuth - Accounts > PUT /email/accounts/:id nonexistent returns 404
(pass) Email OAuth - Accounts > DELETE /email/accounts/:id nonexistent returns 404
(pass) Email OAuth - Sync > POST /email/accounts/:id/sync nonexistent returns 404
(pass) Email OAuth - Auth Guards > GET /email/accounts without auth returns 401
(pass) Email OAuth - Auth Guards > GET /email/authorize/gmail without auth returns 401
(pass) Email OAuth - Auth Guards > DELETE /email/accounts/test without auth returns 401

src\tests\emailOAuth.test.js:
Running Email OAuth API tests...
(pass) Email OAuth - Connect > GET /email/authorize/gmail - should return Gmail OAuth URL [16.00ms]
(pass) Email OAuth - Connect > GET /email/authorize/outlook - should return Outlook OAuth URL
(pass) Email OAuth - Accounts > GET /email/accounts - should list connected email accounts
(pass) Email OAuth - Disconnect > DELETE /email/accounts/:accountId - should disconnect account
(pass) Email OAuth - Settings > GET /email/settings - should return email settings
(pass) Email OAuth - Settings > PUT /email/settings - should update email settings
(pass) Email OAuth - Sync > POST /email/sync - should trigger email sync
(pass) Email OAuth - Parsed Emails > GET /email/parsed - should return parsed sale emails
(pass) Email OAuth - Authentication > GET /email/accounts - should require auth

src\tests\enhancedMFA-expanded.test.js:
(pass) Enhanced MFA Expanded - Auth Guards > POST /mfa/sms/verify-phone without token returns 401
(pass) Enhanced MFA Expanded - Auth Guards > POST /mfa/sms/verify without token returns 401
(pass) Enhanced MFA Expanded - Auth Guards > POST /mfa/webauthn/authenticate/complete without token returns 401
(pass) Enhanced MFA Expanded - SMS Verify Phone > POST /mfa/sms/verify-phone without code returns 400
(pass) Enhanced MFA Expanded - SMS Verify Phone > POST /mfa/sms/verify-phone with wrong code returns 400
(pass) Enhanced MFA Expanded - SMS Verify Phone > POST /mfa/sms/verify-phone after register with wrong code returns 
400 [218.00ms]
(pass) Enhanced MFA Expanded - SMS Verify Code > POST /mfa/sms/verify without code returns 400 or 500
(pass) Enhanced MFA Expanded - SMS Verify Code > POST /mfa/sms/verify with invalid code returns 400 or 500
(pass) Enhanced MFA Expanded - SMS Verify Code > POST /mfa/sms/verify with random numeric code returns 400 or 500
(pass) Enhanced MFA Expanded - WebAuthn Authenticate Complete > POST /mfa/webauthn/authenticate/complete without prior 
start returns 400 [219.00ms]
(pass) Enhanced MFA Expanded - WebAuthn Authenticate Complete > POST /mfa/webauthn/authenticate/complete with empty 
body returns 400
(pass) Enhanced MFA Expanded - WebAuthn Authenticate Complete > POST /mfa/webauthn/authenticate/complete with null 
assertion returns 400
(pass) Enhanced MFA Expanded - WebAuthn Delete Key > DELETE /mfa/webauthn/keys/:id without auth returns 401
(pass) Enhanced MFA Expanded - WebAuthn Delete Key > DELETE /mfa/webauthn/keys/nonexistent returns 200 or 400
(pass) Enhanced MFA Expanded - WebAuthn Delete Key > DELETE /mfa/webauthn/keys/:id for registered key works [219.00ms]

src\tests\enhancedMFA.test.js:
(pass) Enhanced MFA - Auth Guard > GET /mfa/status without token returns 401
(pass) Enhanced MFA - Auth Guard > POST /mfa/backup-codes/generate without token returns 401
(pass) Enhanced MFA - Auth Guard > POST /mfa/disable without token returns 401
(pass) Enhanced MFA - Auth Guard > POST /mfa/sms/register without token returns 401
(pass) Enhanced MFA - Status > GET /mfa/status returns 200 with correct shape
(pass) Enhanced MFA - Status > fresh user has MFA disabled with all methods false
(pass) Enhanced MFA - Backup Codes > POST /mfa/backup-codes/generate returns 10 codes
(pass) Enhanced MFA - Backup Codes > generated codes match XXXX-XXXX hex format
(pass) Enhanced MFA - Backup Codes > GET /mfa/backup-codes/status shows total=10, remaining=10
(pass) Enhanced MFA - Backup Codes > POST /mfa/backup-codes/verify with valid code returns success
(pass) Enhanced MFA - Backup Codes > verifying the same code again fails (already used)
(pass) Enhanced MFA - Backup Codes > POST /mfa/backup-codes/verify with invalid code returns 400
(pass) Enhanced MFA - Backup Codes > low-warning flag appears when remainingCodes < 3
(pass) Enhanced MFA - SMS > POST /mfa/sms/register with short phone returns 400
(pass) Enhanced MFA - SMS > POST /mfa/sms/register with valid 10-digit phone returns 200
(pass) Enhanced MFA - SMS > POST /mfa/sms/register with formatted phone strips non-digits
(pass) Enhanced MFA - SMS > POST /mfa/sms/send without verified phone returns 400
(pass) Enhanced MFA - WebAuthn > POST /mfa/webauthn/register/start returns challenge shape
(pass) Enhanced MFA - WebAuthn > POST /mfa/webauthn/register/complete without prior start returns 400
(pass) Enhanced MFA - WebAuthn > POST /mfa/webauthn/authenticate/start with no keys returns 400
(pass) Enhanced MFA - WebAuthn > GET /mfa/webauthn/keys returns empty array for user with no keys
(pass) Enhanced MFA - Disable > POST /mfa/disable with wrong password returns 400 [125.00ms]
(pass) Enhanced MFA - Disable > POST /mfa/disable with correct password returns 200 [109.00ms]
(pass) Enhanced MFA - Disable > MFA status shows disabled after disabling
(pass) Enhanced MFA - WebAuthn Registration Flow > full register start -> complete cycle works with fake credential
(pass) Enhanced MFA - Unknown Routes > GET /mfa/nonexistent returns 404

src\tests\expenseTracker-expanded.test.js:
(pass) Expense Tracker - Auth Guard > GET /expenses/categories without auth returns 401
(pass) Expense Tracker - Auth Guard > POST /expenses/categories without auth returns 401
(pass) Expense Tracker - Categories List > GET /expenses/categories returns categories
(pass) Expense Tracker - Create Category > POST /expenses/categories creates category
(pass) Expense Tracker - Create Category > POST /expenses/categories without name returns 400
(pass) Expense Tracker - Create Category > POST /expenses/categories with invalid type returns 400
(pass) Expense Tracker - Create Category > POST /expenses/categories with deduction type
(pass) Expense Tracker - Create Category > POST /expenses/categories with cogs type
(pass) Expense Tracker - Create Category > POST /expenses/categories with too-long name returns 400
(pass) Expense Tracker - Tax Report > GET /expenses/tax-report with year and quarter
(pass) Expense Tracker - Tax Report > GET /expenses/tax-report with date range
(pass) Expense Tracker - Tax Report > GET /expenses/tax-report with invalid quarter returns 400
(pass) Expense Tracker - Auto-Categorize > POST /expenses/categorize auto-categorizes transactions

src\tests\expenseTracker.test.js:
(pass) GET /api/expenses/categories > rejects unauthenticated request
(pass) GET /api/expenses/categories > returns categories list when authenticated
(pass) POST /api/expenses/categories > rejects unauthenticated request
(pass) POST /api/expenses/categories > creates category when authenticated with valid body
(pass) POST /api/expenses/categories > rejects missing required fields
(pass) GET /api/expenses/tax-report > rejects unauthenticated request
(pass) GET /api/expenses/tax-report > returns tax report with year and quarter params
(pass) POST /api/expenses/categorize > rejects unauthenticated request
(pass) POST /api/expenses/categorize > responds when authenticated

src\tests\extension-expanded.test.js:
(pass) Extension - Auth Guard > POST /extension/scrape without auth returns 401
(pass) Extension - Scraped Products CRUD > POST /extension/scraped saves a scraped product
(pass) Extension - Scraped Products CRUD > POST /extension/scraped requires title and source [16.00ms]
(pass) Extension - Scraped Products CRUD > DELETE /extension/scraped/:id on nonexistent succeeds silently
(pass) Extension - Price Track (alternate endpoints) > POST /extension/price-track starts tracking
(pass) Extension - Price Track (alternate endpoints) > POST /extension/price-track validates required fields
(pass) Extension - Price Track (alternate endpoints) > POST /extension/price-track rejects negative price
(pass) Extension - Price Track (alternate endpoints) > GET /extension/price-track lists tracked items
(pass) Extension - Price Track (alternate endpoints) > GET /extension/price-track?status=active filters by status
(pass) Extension - Price Track (alternate endpoints) > PATCH /extension/price-track/:id updates target price
(pass) Extension - Price Track (alternate endpoints) > DELETE /extension/price-track/:id removes tracker
(pass) Extension - Sync Process > POST /extension/sync/:id/process on nonexistent
(pass) Extension - Price Tracking Validation > POST /extension/price-tracking rejects NaN price
(pass) Extension - Price Tracking Validation > POST /extension/price-tracking rejects zero price

src\tests\extension.test.js:
Running Chrome Extension API tests...
(pass) Extension - Authentication > POST /extension/auth/verify - should verify extension token
(pass) Extension - Authentication > POST /extension/auth/verify - should reject invalid token
(pass) Extension - Product Scraping > POST /extension/scrape - should scrape Amazon product
(pass) Extension - Product Scraping > POST /extension/scrape - should scrape Nordstrom product
(pass) Extension - Product Scraping > POST /extension/scrape - should validate required fields
(pass) Extension - Product Scraping > GET /extension/scraped - should list scraped products
(pass) Extension - Price Tracking > POST /extension/price-tracking - should start tracking price
(pass) Extension - Price Tracking > GET /extension/price-tracking - should list tracked items
(pass) Extension - Price Tracking > PATCH /extension/price-tracking/:id - should update target price
(pass) Extension - Price Tracking > DELETE /extension/price-tracking/:id - should stop tracking
(pass) Extension - Sync Queue > POST /extension/sync - should add item to sync queue
(pass) Extension - Sync Queue > GET /extension/sync - should get sync queue status
(pass) Extension - Quick Add > POST /extension/quick-add - should add item from extension [15.00ms]
(pass) Extension - Autofill Data > GET /extension/autofill/:itemId - should get autofill data

src\tests\featureFlagsExpanded.test.js:
(pass) Feature Flags Expanded - Response Shape > GET /feature-flags returns { flags } object [16.00ms]
(pass) Feature Flags Expanded - Response Shape > all flag values are booleans
(pass) Feature Flags Expanded - Response Shape > flags object has at least 10 entries [15.00ms]
(pass) Feature Flags Expanded - Known Flags > ui.darkMode exists and is boolean [16.00ms]
(pass) Feature Flags Expanded - Known Flags > ai.listingGenerator exists
(pass) Feature Flags Expanded - Known Flags > integration.whatnot exists [16.00ms]
(pass) Feature Flags Expanded - Known Flags > perf.lazyLoadImages exists [15.00ms]
(pass) Feature Flags Expanded - Known Flags > ui.advancedFilters exists
(pass) Feature Flags Expanded - Known Flags > ui.bulkActions exists [16.00ms]
(pass) Feature Flags Expanded - Known Flags > perf.serviceWorker exists
(pass) Feature Flags Expanded - Consistency > same user gets same flags on consecutive requests [16.00ms]
(pass) Feature Flags Expanded - Consistency > flag keys are dot-delimited strings [15.00ms]
(pass) Feature Flags Expanded - Admin Endpoint > GET /feature-flags/all requires enterprise tier
(pass) Feature Flags Expanded - Admin Endpoint > GET /feature-flags/all returns detailed flags if authorized
(pass) Feature Flags Expanded - Admin Endpoint > unauthenticated /feature-flags/all returns 401

src\tests\feedback-expanded.test.js:
(pass) Feedback - Auth Guard > POST /feedback without auth returns 401
(pass) Feedback - Auth Guard > GET /feedback without auth returns 401
(pass) Feedback - Submit > POST /feedback with valid data creates feedback
(pass) Feedback - Submit > POST /feedback without required fields returns 400
(pass) Feedback - Submit > POST /feedback with bug type [15.00ms]
(pass) Feedback - List & Get > GET /feedback returns user feedback list
(pass) Feedback - List & Get > GET /feedback/:id returns feedback details
(pass) Feedback - Trending & Analytics > GET /feedback/trending returns top-voted feedback
(pass) Feedback - Trending & Analytics > GET /feedback/analytics returns feedback stats
(pass) Feedback - Trending & Analytics > GET /feedback/similar?q=test returns similar items
(pass) Feedback - User Feedback > GET /feedback/user returns current user feedback
(pass) Feedback - Responses Thread > GET /feedback/:id/responses returns response thread
(pass) Feedback - Responses Thread > POST /feedback/:id/responses adds a response
(pass) Feedback - Voting > POST /feedback/vote/:id votes on feedback
(pass) Feedback - Voting > POST /feedback/vote/nonexistent returns 404
(pass) Feedback - Voting > User B can vote on User A feedback
(pass) Feedback - Delete > DELETE /feedback/nonexistent returns 404
(pass) Feedback - Delete > DELETE /feedback/:id deletes own feedback

src\tests\feedback-gaps-expanded.test.js:
(pass) Feedback — List & Read > GET /feedback returns list
(pass) Feedback — List & Read > GET /feedback/user returns current user feedback
(pass) Feedback — List & Read > GET /feedback/trending returns trending feedback
(pass) Feedback — List & Read > GET /feedback/analytics returns analytics data
(pass) Feedback — List & Read > GET /feedback/similar?q=test returns similar feedback
(pass) Feedback — Create & Vote > POST /feedback creates new feedback
No feedback created
(pass) Feedback — Create & Vote > GET /feedback/:id returns single feedback
No feedback created
(pass) Feedback — Create & Vote > POST /feedback/vote/:id votes on feedback
No feedback created
(pass) Feedback — Create & Vote > GET /feedback/:id/responses returns thread
No feedback created
(pass) Feedback — Create & Vote > POST /feedback/:id/responses adds response
No feedback created
(pass) Feedback — Create & Vote > DELETE /feedback/:id deletes feedback
(pass) Feedback — Auth Guard > GET /feedback requires auth

src\tests\feedback-gaps.test.js:
(pass) Feedback admin status update > PUT /feedback/:id nonexistent feedback returns 404 or 403

src\tests\feedback.test.js:
(pass) Feedback - Auth Guard > POST /feedback without auth returns 401
(pass) Feedback - Auth Guard > GET /feedback without auth returns 401
(pass) Feedback - Submit > valid feature feedback returns 201
(pass) Feedback - Submit > missing required fields returns 400
(pass) Feedback - Submit > bug report type returns 201
(pass) Feedback - List & Get > GET /feedback returns 200 with feedback array
(pass) Feedback - List & Get > GET /feedback/:id returns own feedback
(pass) Feedback - List & Get > GET /feedback/:id from other user returns 403 or 404
(pass) Feedback - Trending & Similar > GET /feedback/trending returns trending data
(pass) Feedback - Trending & Similar > GET /feedback/similar?q=test returns similar items
(pass) Feedback - User & Analytics > GET /feedback/user returns user feedback
(pass) Feedback - User & Analytics > GET /feedback/analytics returns analytics object
(pass) Feedback - Responses Thread > GET /feedback/:id/responses returns 200
(pass) Feedback - Responses Thread > POST /feedback/:id/responses adds response [16.00ms]
(pass) Feedback - Voting > POST /feedback/vote/:id toggles vote
(pass) Feedback - Voting > POST /feedback/vote/nonexistent returns 404
(pass) Feedback - Delete > DELETE /feedback/nonexistent returns 404
(pass) Feedback - Delete > DELETE /feedback/:id deletes own feedback

src\tests\financials-gaps.test.js:
(pass) Financials email-parse > POST /financials/email-parse returns 501 not implemented [16.00ms]
(pass) Financials categorization rules > GET /financials/categorization-rules returns list
(pass) Financials categorization rules > POST /financials/categorization-rules creates rule
(pass) Financials categorization rules > DELETE /financials/categorization-rules/:id nonexistent
(pass) Financials auto-categorize > POST /financials/auto-categorize runs categorization
(pass) Financials transaction split > POST /financials/transactions/:id/split nonexistent tx
(pass) Financials recurring templates > GET /financials/recurring-templates returns list
(pass) Financials recurring templates > POST /financials/recurring-templates creates template
(pass) Financials recurring templates > DELETE /financials/recurring-templates/:id nonexistent
(pass) Financials recurring templates > POST /financials/recurring-templates/:id/execute nonexistent
(pass) Financials transaction attachments > GET /financials/transactions/:id/attachments nonexistent tx
(pass) Financials transaction attachments > POST /financials/transactions/:id/attachments nonexistent tx
(pass) Financials transaction attachments > DELETE /financials/transactions/:id/attachments/:aid nonexistent
(pass) Financials platform fees > GET /financials/platform-fees returns fees
(pass) Financials platform fees > GET /financials/platform-fees/summary returns summary
(pass) Financials transaction audit > GET /financials/transactions/:id/audit nonexistent tx
(pass) Financials transaction update > PUT /financials/transactions/:id nonexistent

src\tests\financials.test.js:
(pass) Financials API Tests > Authentication Requirements > GET /financials/purchases - should require authentication
(pass) Financials API Tests > Authentication Requirements > GET /financials/accounts - should require authentication
(pass) Financials API Tests > Authentication Requirements > GET /financials/transactions - should require 
authentication
(pass) Financials API Tests > Chart of Accounts > GET /financials/accounts - should return accounts list
(pass) Financials API Tests > Chart of Accounts > POST /financials/accounts - should create new account
(pass) Financials API Tests > Chart of Accounts > POST /financials/accounts - should validate account type
(pass) Financials API Tests > Chart of Accounts > GET /financials/accounts/:id - should return single account
(pass) Financials API Tests > Chart of Accounts > PUT /financials/accounts/:id - should update account
(pass) Financials API Tests > Chart of Accounts > POST /financials/seed-accounts - should seed default accounts or 
indicate they exist
(pass) Financials API Tests > Purchases > GET /financials/purchases - should return purchases list
(pass) Financials API Tests > Purchases > POST /financials/purchases - should create purchase with items
(pass) Financials API Tests > Purchases > POST /financials/purchases - should require vendor name
(pass) Financials API Tests > Purchases > GET /financials/purchases/:id - should return purchase with items [16.00ms]
(pass) Financials API Tests > Purchases > PUT /financials/purchases/:id - should update purchase
(pass) Financials API Tests > Transactions > GET /financials/transactions - should return transactions list
(pass) Financials API Tests > Transactions > POST /financials/transactions - should create manual transaction
(pass) Financials API Tests > Financial Reports > GET /financials/statements - should return financial statements
(pass) Financials API Tests > Financial Reports > GET /financials/profit-loss - should return P&L report
(pass) Financials API Tests > FIFO Cost Layers > POST /financials/consume-fifo - should handle FIFO consumption request
(pass) Financials API Tests > Sales with FIFO Integration > GET /sales - should include new cost columns
(pass) Financials API Tests > Sales with FIFO Integration > GET /sales - should support date filtering
(pass) Financials API Tests > Cleanup > DELETE /financials/purchases/:id - should delete purchase
(pass) Financials API Tests > Cleanup > DELETE /financials/accounts/:id - should delete account or reject if has 
transactions

src\tests\gdpr-expanded.test.js:
(pass) GDPR - Auth Guard > POST /gdpr/export without auth returns 401
(pass) GDPR - Data Export > POST /gdpr/export initiates data export
(pass) GDPR - Data Export > GET /gdpr/export/:requestId/download returns 404 for nonexistent
(pass) GDPR - Account Deletion > POST /gdpr/delete-account schedules deletion [438.00ms]
(pass) GDPR - Account Deletion > GET /gdpr/deletion-status returns current status
(pass) GDPR - Account Deletion > POST /gdpr/cancel-deletion cancels pending deletion
(pass) GDPR - Consents > GET /gdpr/consents returns consent preferences
(pass) GDPR - Consents > PUT /gdpr/consents updates consent preferences
(pass) GDPR - Data Rectification > POST /gdpr/rectify submits rectification request

src\tests\gdpr-gaps-expanded.test.js:
(pass) GDPR — Data Export > POST /gdpr/export requests data export
(pass) GDPR — Data Export > GET /gdpr/export/nonexistent/download returns 404
(pass) GDPR — Account Deletion > GET /gdpr/deletion-status returns current status
(pass) GDPR — Account Deletion > POST /gdpr/cancel-deletion when no deletion pending
(pass) GDPR — Account Deletion > POST /gdpr/delete-account requires confirmation [218.00ms]
(pass) GDPR — Consents > GET /gdpr/consents returns user consents
(pass) GDPR — Consents > PUT /gdpr/consents updates consent preferences
(pass) GDPR — Rectification > PUT /gdpr/rectify with valid corrections [16.00ms]
(pass) GDPR — Rectification > PUT /gdpr/rectify with empty corrections
(pass) GDPR — Auth Guard > GET /gdpr/consents requires auth
(pass) GDPR — Auth Guard > POST /gdpr/export requires auth

src\tests\gdpr-gaps.test.js:
(pass) GDPR rectify endpoint (PUT) > PUT /gdpr/rectify with valid corrections [16.00ms]
(pass) GDPR rectify endpoint (PUT) > PUT /gdpr/rectify with empty corrections [500.00ms]
(pass) GDPR rectify endpoint (PUT) > PUT /gdpr/rectify without corrections field

src\tests\gdpr.test.js:
(pass) gdpr routes > should require authentication
(pass) gdpr routes > GET /gdpr/consents responds
(pass) gdpr routes > GET /gdpr/deletion-status responds

src\tests\help.test.js:
Running Help & Support API tests...
(pass) Help - Video Tutorials > GET /help/videos - should list videos
(pass) Help - Video Tutorials > GET /help/videos?category=getting_started - should filter by category
(pass) Help - Video Tutorials > GET /help/videos/:id - should get video details
(pass) Help - Video Tutorials > POST /help/videos/:id/view - should increment view count
(pass) Help - FAQ > GET /help/faq - should list FAQs [15.00ms]
(pass) Help - FAQ > GET /help/faq?category=general - should filter by category
(pass) Help - FAQ > GET /help/faq?search=platform - should search FAQs
(pass) Help - FAQ > POST /help/faq/:id/helpful - should vote helpful
(pass) Help - FAQ > POST /help/faq/:id/helpful - should prevent duplicate votes
(pass) Help - Knowledge Base Articles > GET /help/articles - should list articles
(pass) Help - Knowledge Base Articles > GET /help/articles?category=guides - should filter by category
(pass) Help - Knowledge Base Articles > GET /help/articles/:slug - should get article by slug
(pass) Help - Knowledge Base Articles > POST /help/articles/:id/helpful - should vote on article
(pass) Help - Knowledge Base Articles > GET /help/search - should search knowledge base
(pass) Help - Support Tickets > POST /help/tickets - should create bug report
(pass) Help - Support Tickets > POST /help/tickets - should create feature request
(pass) Help - Support Tickets > POST /help/tickets - should validate required fields
(pass) Help - Support Tickets > GET /help/tickets - should list user tickets
(pass) Help - Support Tickets > GET /help/tickets/:id - should get ticket details
(pass) Help - Support Tickets > POST /help/tickets/:id/replies - should add reply
(pass) Help - Support Tickets > PATCH /help/tickets/:id - should update ticket status
(pass) Help - Authentication > GET /help/videos - should require auth
(pass) Help - Authentication > GET /help/faq - should require auth
(pass) Help - Authentication > POST /help/tickets - should require auth

src\tests\imageBank-expanded.test.js:
(pass) Image Bank Expanded - Scan Usage > POST /image-bank/scan-usage without auth returns 401
(pass) Image Bank Expanded - Scan Usage > POST /image-bank/scan-usage returns scan results
(pass) Image Bank Expanded - Scan Usage > POST /image-bank/scan-usage for fresh user returns zero counts [219.00ms]

src\tests\imageBank.test.js:
(pass) Image Bank - List Images > GET /image-bank - should return image list
(pass) Image Bank - List Images > GET /image-bank?limit=10&offset=0 - should paginate [16.00ms]
(pass) Image Bank - List Images > GET /image-bank?used=true - should filter used images
(pass) Image Bank - List Images > GET /image-bank?used=false - should filter unused images
(pass) Image Bank - List Images > GET /image-bank?dateFrom=2024-01-01 - should filter by date range
(pass) Image Bank - Upload > POST /image-bank/upload - should upload images
(pass) Image Bank - Upload > POST /image-bank/upload - should fail without images
(pass) Image Bank - Upload > POST /image-bank/upload - should fail with empty images array
(pass) Image Bank - Get Single Image > GET /image-bank/:id - should return image details
(pass) Image Bank - Get Single Image > GET /image-bank/:id - should return 404 for non-existent image
(pass) Image Bank - Update Image > PATCH /image-bank/:id - should update image metadata
(pass) Image Bank - Update Image > PATCH /image-bank/:id - should fail without updates
(pass) Image Bank - Update Image > PATCH /image-bank/:id - should return 404 for non-existent image
(pass) Image Bank - Search > GET /image-bank/search?q=test - should search images
(pass) Image Bank - Search > GET /image-bank/search - should fail without query
(pass) Image Bank - Search > GET /image-bank/search?q= - should fail with empty query
(pass) Image Bank - Folders > POST /image-bank/folders - should create folder
(pass) Image Bank - Folders > POST /image-bank/folders - should fail without name
(pass) Image Bank - Folders > GET /image-bank/folders - should list folders
(pass) Image Bank - Folders > PATCH /image-bank/folders/:id - should update folder [15.00ms]
(pass) Image Bank - Folders > PATCH /image-bank/folders/:id - should return 404 for non-existent folder
(pass) Image Bank - Folders > DELETE /image-bank/folders/:id - should delete folder
(pass) Image Bank - Bulk Operations > POST /image-bank/bulk-delete - should delete multiple images
(pass) Image Bank - Bulk Operations > POST /image-bank/bulk-delete - should fail without imageIds
(pass) Image Bank - Bulk Operations > POST /image-bank/bulk-move - should move images to folder
(pass) Image Bank - Bulk Operations > POST /image-bank/bulk-tag - should add tags to images
(pass) Image Bank - Bulk Operations > POST /image-bank/bulk-tag - should fail without tags
(pass) Image Bank - AI Analysis > POST /image-bank/analyze - should analyze image
(pass) Image Bank - AI Analysis > POST /image-bank/analyze - should return 404 for non-existent image
(pass) Image Bank - Cloudinary > GET /image-bank/cloudinary-status - should check Cloudinary config
(pass) Image Bank - Cloudinary > POST /image-bank/cloudinary-edit - should require image ID
(pass) Image Bank - Edit Operations > POST /image-bank/edit - should save edit operation
(pass) Image Bank - Edit Operations > GET /image-bank/edit-history/:id - should return edit history
(pass) Image Bank - Usage Tracking > GET /image-bank/usage/:id - should return image usage
(pass) Image Bank - Usage Tracking > GET /image-bank/usage/:id - should return 404 for non-existent image
(pass) Image Bank - Import > POST /image-bank/import-from-inventory - should require inventory ID
(pass) Image Bank - Delete > DELETE /image-bank/:id - should delete image
(pass) Image Bank - Delete > DELETE /image-bank/:id - should return 404 for non-existent image

src\tests\inventory.test.js:
Running Inventory API tests...
(pass) Inventory - List > GET /inventory - should return inventory list
(pass) Inventory - List > GET /inventory?status=active - should filter by status
(pass) Inventory - List > GET /inventory?category=Tops - should filter by category
(pass) Inventory - List > GET /inventory?search=test - should search items [15.00ms]
(pass) Inventory - List > GET /inventory?sort=price_asc - should sort by price
(pass) Inventory - List > GET /inventory?limit=10&offset=0 - should paginate
(pass) Inventory - Create > POST /inventory - should create inventory item
(pass) Inventory - Create > POST /inventory - should require listPrice
(pass) Inventory - Create > POST /inventory - should auto-generate SKU
(pass) Inventory - Get Single > GET /inventory/:id - should return item details
(pass) Inventory - Get Single > GET /inventory/:id - should return 404 for non-existent item
(pass) Inventory - Update > PUT /inventory/:id - should update item
(pass) Inventory - Update > PUT /inventory/:id - should return 404 for non-existent item
(pass) Inventory - Statistics > GET /inventory/stats - should return statistics
(pass) Inventory - Bulk Operations > POST /inventory/bulk - should perform bulk delete
(pass) Inventory - Bulk Operations > POST /inventory/bulk - should require action and ids
(pass) Inventory - Bulk Operations > POST /inventory/bulk - should update status [16.00ms]
(pass) Inventory - Recently Deleted > GET /inventory/deleted - should return deleted items
(pass) Inventory - Delete > DELETE /inventory/:id - should soft delete item
(pass) Inventory - Delete > DELETE /inventory/:id - should return 404 for non-existent item
(pass) Inventory - Restore > POST /inventory/:id/restore - should restore deleted item
(pass) Inventory - Restore > POST /inventory/:id/restore - should return 404 for non-deleted item
(pass) Inventory - Permanent Delete > DELETE /inventory/:id/permanent - should require deleted status
(pass) Inventory - Cleanup > POST /inventory/cleanup-deleted - should cleanup expired items
(pass) Inventory - Import > POST /inventory/import/csv - should import items from CSV data
(pass) Inventory - Import > POST /inventory/import/csv - should require items array
(pass) Inventory - Import > POST /inventory/import/url - should require URL
(pass) Inventory - Import > POST /inventory/import/url - should accept URL
(pass) Inventory - Authentication > GET /inventory - should require auth
(pass) Inventory - Authentication > POST /inventory - should require auth

src\tests\inventoryImport.test.js:
(pass) Inventory Import - Upload > POST /inventory-import/upload with CSV data returns 201
(pass) Inventory Import - Upload > POST /inventory-import/upload with JSON data returns 201
(pass) Inventory Import - Upload > POST /inventory-import/upload without source_type returns 400
(pass) Inventory Import - Upload > POST /inventory-import/upload without data returns 400
(pass) Inventory Import - Upload > POST /inventory-import/upload with invalid source_type returns 400
(pass) Inventory Import - Jobs List > GET /inventory-import/jobs returns array
(pass) Inventory Import - Jobs List > GET /inventory-import/jobs/:id for nonexistent returns 404 [15.00ms]
(pass) Inventory Import - Jobs List > GET /inventory-import/jobs/:id returns job if created
(pass) Inventory Import - Field Mapping > POST /inventory-import/jobs/:id/mapping with valid mapping
(pass) Inventory Import - Field Mapping > POST /inventory-import/jobs/:id/mapping without field_mapping returns 400
(pass) Inventory Import - Field Mapping > POST /inventory-import/jobs/nonexistent/mapping returns 404
(pass) Inventory Import - Validate & Execute > POST /inventory-import/jobs/:id/validate runs validation
(pass) Inventory Import - Validate & Execute > POST /inventory-import/jobs/:id/execute runs import
(pass) Inventory Import - Cancel & Delete > POST /inventory-import/jobs/nonexistent/cancel returns 404
(pass) Inventory Import - Cancel & Delete > DELETE /inventory-import/jobs/nonexistent returns 404
(pass) Inventory Import - Saved Mappings > GET /inventory-import/mappings returns array
(pass) Inventory Import - Saved Mappings > POST /inventory-import/mappings creates template
(pass) Inventory Import - Saved Mappings > DELETE /inventory-import/mappings/nonexistent returns 404
(pass) Inventory Import - Templates & Helpers > GET /inventory-import/templates/download returns template content
(pass) Inventory Import - Templates & Helpers > GET /inventory-import/field-options returns fields array
(pass) Inventory Import - Auth Guard > unauthenticated upload returns 401
(pass) Inventory Import - Auth Guard > unauthenticated jobs list returns 401

src\tests\inventoryImportEnhanced.test.js:
(pass) Inventory Import - Templates Download > GET /inventory-import/templates/download - should return CSV template
(pass) Inventory Import - Templates Download > GET /inventory-import/templates/download - should return TSV template
(pass) Inventory Import - Templates Download > GET /inventory-import/templates/download - should return JSON template
(pass) Inventory Import - Templates Download > GET /inventory-import/templates/download - should reject invalid format
(pass) Inventory Import - Validate Row > POST /inventory-import/validate-row - should validate valid row
(pass) Inventory Import - Validate Row > POST /inventory-import/validate-row - should catch missing title
(pass) Inventory Import - Validate Row > POST /inventory-import/validate-row - should catch invalid price
(pass) Inventory Import - Validate Row > POST /inventory-import/validate-row - should warn on unknown condition
(pass) Inventory Import - Validate Row > POST /inventory-import/validate-row - should require row data
(pass) Inventory Import - Field Options > GET /inventory-import/field-options - should return field definitions
(pass) Inventory Import - Field Options > GET /inventory-import/field-options - should return suggestions
(pass) Inventory Import - Field Options > GET /inventory-import/field-options - should return date formats
(pass) Inventory Import - Jobs List > GET /inventory-import/jobs - should return jobs list
(pass) Inventory Import - Jobs List > GET /inventory-import/jobs?status=completed - should filter by status
(pass) Inventory Import - Jobs List > GET /inventory-import/jobs?limit=5 - should paginate
(pass) Inventory Import - Upload > POST /inventory-import/upload - should upload CSV data
(pass) Inventory Import - Upload > POST /inventory-import/upload - should upload JSON data
(pass) Inventory Import - Upload > POST /inventory-import/upload - should require source_type and data [15.00ms]
(pass) Inventory Import - Upload > POST /inventory-import/upload - should reject invalid source_type
(pass) Inventory Import - Get Job > GET /inventory-import/jobs/:id - should return job details
(pass) Inventory Import - Get Job > GET /inventory-import/jobs/:id - should return 404 for non-existent job
(pass) Inventory Import - Get Job Rows > GET /inventory-import/jobs/:id/rows - should return import rows
(pass) Inventory Import - Get Job Rows > GET /inventory-import/jobs/:id/rows?limit=2 - should paginate rows
(pass) Inventory Import - Set Mapping > POST /inventory-import/jobs/:id/mapping - should set field mapping
(pass) Inventory Import - Set Mapping > POST /inventory-import/jobs/:id/mapping - should require field_mapping
(pass) Inventory Import - Validate Job > POST /inventory-import/jobs/:id/validate - should validate import data
(pass) Inventory Import - Validate Job > POST /inventory-import/jobs/:id/validate - should return 404 for non-existent 
job
(pass) Inventory Import - Execute Job > POST /inventory-import/jobs/:id/execute - should execute import
(pass) Inventory Import - Execute Job > POST /inventory-import/jobs/:id/execute - should return 404 for non-existent 
job
(pass) Inventory Import - Cancel Job > POST /inventory-import/jobs/:id/cancel - should cancel pending job
(pass) Inventory Import - Delete Job > DELETE /inventory-import/jobs/:id - should delete job
(pass) Inventory Import - Delete Job > DELETE /inventory-import/jobs/:id - should return 404 for non-existent job
(pass) Inventory Import - Mappings List > GET /inventory-import/mappings - should return saved mappings
(pass) Inventory Import - Create Mapping > POST /inventory-import/mappings - should create mapping template
(pass) Inventory Import - Create Mapping > POST /inventory-import/mappings - should require name and field_mapping
(pass) Inventory Import - Update Mapping > PATCH /inventory-import/mappings/:id - should update mapping
(pass) Inventory Import - Update Mapping > PATCH /inventory-import/mappings/:id - should return 404 for non-existent 
mapping
(pass) Inventory Import - Delete Mapping > DELETE /inventory-import/mappings/:id - should delete mapping
(pass) Inventory Import - Delete Mapping > DELETE /inventory-import/mappings/:id - should return 404 for non-existent 
mapping
(pass) Inventory Import - Authentication > GET /inventory-import/jobs - should require auth
(pass) Inventory Import - Authentication > POST /inventory-import/upload - should require auth [16.00ms]

src\tests\legal-expanded.test.js:
(pass) Legal - Auth Guard > GET /legal/privacy/data-export without auth returns 401
(pass) Legal - Auth Guard > POST /legal/tos/accept without auth returns 401
(pass) Legal - Privacy Data Export > GET /legal/privacy/data-export returns user data [16.00ms]
(pass) Legal - Cookie Consent > GET /legal/privacy/cookie-consent returns settings
(pass) Legal - Cookie Consent > PUT /legal/privacy/cookie-consent updates settings
(pass) Legal - Cookie Consent > PUT /legal/privacy/cookie-consent all disabled
(pass) Legal - Data Audit > GET /legal/privacy/data-audit returns record counts
(pass) Legal - ToS Accept > POST /legal/tos/accept without tosVersionId returns 400
(pass) Legal - ToS Accept > POST /legal/tos/accept with valid tosVersionId
(pass) Legal - ToS Acceptance Status > GET /legal/tos/acceptance-status returns status

src\tests\legal-gaps-expanded.test.js:
(pass) Legal — Terms of Service > GET /legal/tos/current returns latest ToS
(pass) Legal — Terms of Service > GET /legal/tos/history returns version array
(pass) Legal — Terms of Service > POST /legal/tos/accept accepts current ToS
(pass) Legal — Terms of Service > GET /legal/tos/acceptance-status returns status
(pass) Legal — Privacy > GET /legal/privacy/data-export returns export data
(pass) Legal — Privacy > GET /legal/privacy/cookie-consent returns consent settings
(pass) Legal — Privacy > PUT /legal/privacy/cookie-consent updates consent
(pass) Legal — Privacy > GET /legal/privacy/data-audit returns audit info
(pass) Legal — Auth Guard > GET /legal/tos/current requires auth
(pass) Legal — Auth Guard > GET /legal/privacy/data-export requires auth

src\tests\legal-gaps.test.js:
(pass) Legal ToS endpoints > GET /legal/tos/current returns latest ToS version [16.00ms]
(pass) Legal ToS endpoints > GET /legal/tos/history returns array of versions

src\tests\legal.test.js:
(pass) GET /api/legal/privacy/data-export > unauthenticated returns 401/403/500
(pass) GET /api/legal/privacy/data-export > authenticated returns GDPR data export [16.00ms]
(pass) GET /api/legal/privacy/cookie-consent > unauthenticated returns 401/403/500
(pass) GET /api/legal/privacy/cookie-consent > authenticated returns cookie consent settings
(pass) PUT /api/legal/privacy/cookie-consent > unauthenticated returns 401/403/500
(pass) PUT /api/legal/privacy/cookie-consent > authenticated updates cookie consent
(pass) GET /api/legal/privacy/data-audit > unauthenticated returns 401/403/500
(pass) GET /api/legal/privacy/data-audit > authenticated returns data audit log
(pass) GET /api/legal/tos/current > unauthenticated returns 401/403/500
(pass) GET /api/legal/tos/current > authenticated returns current ToS or 404 if not set
(pass) GET /api/legal/tos/history > authenticated returns ToS history
(pass) POST /api/legal/tos/accept > unauthenticated returns 401/403/500
(pass) POST /api/legal/tos/accept > nonexistent tosVersionId returns 400 or 404
(pass) GET /api/legal/tos/acceptance-status > unauthenticated returns 401/403/500
(pass) GET /api/legal/tos/acceptance-status > authenticated returns acceptance status

src\tests\listings-archive.test.js:
(pass) Listings - Archive > POST /listings/:id/archive archives a listing
(pass) Listings - Archive > POST /listings/:id/archive on nonexistent returns 404
(pass) Listings - Archive > POST /listings/:id/archive requires auth
(pass) Listings - Unarchive > POST /listings/:id/unarchive restores a listing
(pass) Listings - Unarchive > POST /listings/:id/unarchive on non-archived returns 400
(pass) Listings - Unarchive > POST /listings/:id/unarchive on nonexistent returns 404

src\tests\listings-gaps-expanded.test.js:
(pass) Listings — Folders > GET /listings/folders returns folder list
(pass) Listings — Folders > POST /listings/folders creates folder
(pass) Listings — Folders > DELETE /listings/folders/:id deletes folder
(pass) Listings — Price Features > POST /listings/nonexistent/schedule-price-drop returns 404
(pass) Listings — Price Features > GET /listings/nonexistent/competitor-pricing returns 404
(pass) Listings — Price Features > GET /listings/nonexistent/time-to-sell returns 404
(pass) Listings — List & Search > GET /listings returns list
(pass) Listings — List & Search > GET /listings?status=active filters by status
(pass) Listings — List & Search > GET /listings/stats returns listing stats
(pass) Listings — Auth Guard > GET /listings requires auth

src\tests\listings-gaps.test.js:
(pass) Listings price drop scheduling > POST /listings/:id/schedule-price-drop nonexistent listing
(pass) Listings competitor pricing > GET /listings/:id/competitor-pricing nonexistent listing
(pass) Listings time to sell > GET /listings/:id/time-to-sell nonexistent listing

src\tests\listings.test.js:
Running Listings API tests...
(pass) Listings - Folders > GET /listings/folders - should return folders list
(pass) Listings - Folders > POST /listings/folders - should create folder
(pass) Listings - Folders > POST /listings/folders - should require name
(pass) Listings - Folders > PATCH /listings/folders/:id - should update folder
(pass) Listings - Folders > PATCH /listings/folders/:id - should return 404 for non-existent folder
(pass) Listings - List > GET /listings - should return listings list
(pass) Listings - List > GET /listings?platform=poshmark - should filter by platform
(pass) Listings - List > GET /listings?status=active - should filter by status
(pass) Listings - List > GET /listings?limit=10&offset=0 - should paginate
(pass) Listings - Create > POST /listings - should create listing
(pass) Listings - Create > POST /listings - should require inventoryId, platform, title, and price
(pass) Listings - Create > POST /listings - should return 404 for non-existent inventory item
(pass) Listings - Get Single > GET /listings/:id - should return listing details
(pass) Listings - Get Single > GET /listings/:id - should return 404 for non-existent listing
(pass) Listings - Update > PUT /listings/:id - should update listing
(pass) Listings - Update > PUT /listings/:id - should return 404 for non-existent listing
(pass) Listings - Crosslist > POST /listings/crosslist - should create listings for multiple platforms
(pass) Listings - Crosslist > POST /listings/crosslist - should require inventoryId and platforms
(pass) Listings - Share > POST /listings/:id/share - should queue share task [16.00ms]
(pass) Listings - Share > POST /listings/:id/share - should return 404 for non-existent listing
(pass) Listings - Statistics > GET /listings/stats - should return statistics
(pass) Listings - Batch > POST /listings/batch - should create multiple listings
(pass) Listings - Batch > POST /listings/batch - should require listings array
(pass) Listings - Stale > GET /listings/stale - should return stale listings
(pass) Listings - Stale > GET /listings/stale?daysThreshold=7 - should accept threshold parameter
(pass) Listings - Delist/Relist/Refresh > POST /listings/:id/delist - should delist listing
(pass) Listings - Delist/Relist/Refresh > POST /listings/:id/relist - should relist listing
(pass) Listings - Delist/Relist/Refresh > POST /listings/:id/refresh - should refresh listing
(pass) Listings - Delist/Relist/Refresh > POST /listings/refresh-bulk - should refresh multiple listings
(pass) Listings - Refresh History > GET /listings/:id/refresh-history - should return refresh history
(pass) Listings - Staleness Settings > PUT /listings/:id/staleness-settings - should update staleness settings
(pass) Listings - Archive/Unarchive > POST /listings/:id/archive - should archive listing
(pass) Listings - Archive/Unarchive > POST /listings/:id/unarchive - should unarchive listing
(pass) Listings - Delete > DELETE /listings/:id - should delete listing
(pass) Listings - Delete > DELETE /listings/:id - should return 404 for non-existent listing
(pass) Listings - Delete Folder > DELETE /listings/folders/:id - should delete folder
(pass) Listings - Authentication > GET /listings - should require auth
(pass) Listings - Authentication > POST /listings - should require auth

src\tests\marketIntel.test.js:
(pass) Market Intel - Competitors List > GET /market-intel/competitors - should return competitor list
(pass) Market Intel - Competitors List > GET /market-intel/competitors?platform=poshmark - should filter by platform 
[15.00ms]
(pass) Market Intel - Competitors List > GET /market-intel/competitors - should require authentication
(pass) Market Intel - Add Competitor > POST /market-intel/competitors - should add competitor
(pass) Market Intel - Add Competitor > POST /market-intel/competitors - should fail without platform
(pass) Market Intel - Add Competitor > POST /market-intel/competitors - should fail without username
(pass) Market Intel - Get Competitor Details > GET /market-intel/competitors/:id - should return competitor details
(pass) Market Intel - Get Competitor Details > GET /market-intel/competitors/:id - should return 404 for non-existent 
competitor
(pass) Market Intel - Competitor Listings > GET /market-intel/competitors/:id/listings - should return listings
(pass) Market Intel - Competitor Listings > GET /market-intel/competitors/:id/listings?sold=true - should filter sold 
listings
(pass) Market Intel - Refresh Competitor > POST /market-intel/competitors/:id/refresh - should refresh competitor data
(pass) Market Intel - Insights > GET /market-intel/insights - should return market insights
(pass) Market Intel - Insights > GET /market-intel/insights?category=Clothing - should filter by category
(pass) Market Intel - Insights > GET /market-intel/insights?platform=ebay - should filter by platform
(pass) Market Intel - Insights > POST /market-intel/insights/:category - should generate insight
(pass) Market Intel - Opportunities > GET /market-intel/opportunities - should return sourcing opportunities
(pass) Market Intel - Opportunities > GET /market-intel/opportunities?limit=3 - should limit results
(pass) Market Intel - Compare Price > POST /market-intel/compare-price - should compare prices
(pass) Market Intel - Compare Price > POST /market-intel/compare-price - should require inventory_id
(pass) Market Intel - Compare Price > POST /market-intel/compare-price - should return 404 for non-existent item
(pass) Market Intel - Trending > GET /market-intel/trending - should return trending categories
(pass) Market Intel - Trending > GET /market-intel/trending?platform=poshmark - should filter by platform
(pass) Market Intel - Platforms > GET /market-intel/platforms - should return supported platforms
(pass) Market Intel - Stats > GET /market-intel/stats - should return statistics
(pass) Market Intel - Delete Competitor > DELETE /market-intel/competitors/:id - should delete competitor

src\tests\mfaLoginFlow.test.js:
(pass) MFA Login Flow - Login Triggers MFA > login with MFA-enabled user returns 202 + mfaRequired [234.00ms]
(pass) MFA Login Flow - Login Triggers MFA > MFA login response includes mfaToken [204.00ms]
(pass) MFA Login Flow - Login Triggers MFA > MFA login response does not include access/refresh tokens [218.00ms]
(pass) MFA Login Flow - Verify with TOTP > valid TOTP code completes login with 200 + tokens [219.00ms]
(pass) MFA Login Flow - Verify with TOTP > invalid TOTP code returns 401 [2375.00ms]
(pass) MFA Login Flow - Verify with TOTP > expired/reused mfaToken returns 401 [234.00ms]
(pass) MFA Login Flow - Verify with TOTP > MFA-verified token works for authenticated requests [219.00ms]
(pass) MFA Login Flow - Verify with TOTP > MFA user object does not leak sensitive fields [219.00ms]
(pass) MFA Login Flow - Verify with Backup Code > valid backup code completes login [437.00ms]
(pass) MFA Login Flow - Verify with Backup Code > used backup code cannot be reused [2360.00ms]
(pass) MFA Login Flow - Verify with Backup Code > backup code verification is case-insensitive [437.00ms]
(pass) MFA Login Flow - Validation > missing mfaToken returns 400
(pass) MFA Login Flow - Validation > missing code returns 400
(pass) MFA Login Flow - Validation > empty body returns 400
(pass) MFA Login Flow - Session Properties > MFA login creates a session visible in /auth/sessions [219.00ms]
(pass) MFA Login Flow - Session Properties > concurrent MFA login limit enforced (max 10 sessions)

src\tests\middleware-auth-coverage.test.js:
(pass) authenticateToken — Bearer header > returns success with valid Bearer token
(pass) authenticateToken — Bearer header > returns error when no Authorization header
(pass) authenticateToken — Bearer header > returns error for Authorization header without Bearer prefix
(pass) authenticateToken — Bearer header > returns error for empty Bearer token
(pass) authenticateToken — Cookie-based token > extracts token from vl_access cookie
(pass) authenticateToken — Cookie-based token > extracts token from cookie among multiple cookies
(pass) authenticateToken — Cookie-based token > returns error when cookie header is empty
(pass) authenticateToken — Cookie-based token > returns error when cookie header has no vl_access cookie
(pass) authenticateToken — Cookie-based token > Bearer header takes precedence over cookie
(pass) authenticateToken — Token validation > returns error for expired token
(pass) authenticateToken — Token validation > returns error for token signed with wrong secret
(pass) authenticateToken — Token validation > returns error for tampered token
(pass) authenticateToken — Token validation > rejects refresh token used as access token
(pass) authenticateToken — Token validation > returns error for token with wrong issuer
(pass) authenticateToken — Token validation > returns error for token with wrong audience
(pass) authenticateToken — User lookup > returns error when user not found in database
(pass) authenticateToken — User lookup > queries database with decoded userId
(pass) authenticateToken — Subscription expiry downgrade > downgrades expired pro subscription to free
(pass) authenticateToken — Subscription expiry downgrade > downgrades expired starter subscription to free
(pass) authenticateToken — Subscription expiry downgrade > does NOT downgrade when subscription is still active
(pass) authenticateToken — Subscription expiry downgrade > does NOT downgrade free tier even with expired date
(pass) authenticateToken — Subscription expiry downgrade > does NOT downgrade when subscription_expires_at is null
(pass) generateToken — additional edge cases > includes issuer and audience claims
(pass) generateToken — additional edge cases > includes subscription_tier in token payload [16.00ms]
(pass) generateRefreshToken — additional edge cases > includes jti (unique identifier) claim
(pass) generateRefreshToken — additional edge cases > generates unique jti for each call
(pass) generateRefreshToken — additional edge cases > includes issuer and audience claims
(pass) checkTierPermission — listings feature > pro tier gets unlimited listings (maxListings = -1)
(pass) checkTierPermission — listings feature > free tier checks listing count against limit
(pass) checkTierPermission — listings feature > free tier disallowed when at listing limit
(pass) checkTierPermission — listings feature > starter tier has 150 listing limit
(pass) checkTierPermission — listings feature > handles null count from database
(pass) checkTierPermission — platforms feature > pro tier gets unlimited platforms
(pass) checkTierPermission — platforms feature > free tier checks platform count against limit of 2
(pass) checkTierPermission — platforms feature > free tier disallowed when at platform limit
(pass) checkTierPermission — platforms feature > starter tier has 5 platform limit
(pass) checkTierPermission — platforms feature > handles null count from database for platforms
(pass) checkTierPermission — bulkActions feature > free tier cannot use bulk actions
(pass) checkTierPermission — bulkActions feature > starter tier can use bulk actions
(pass) checkTierPermission — bulkActions feature > pro tier can use bulk actions
(pass) checkTierPermission — analytics feature > free tier gets basic analytics
(pass) checkTierPermission — analytics feature > starter tier gets standard analytics
(pass) checkTierPermission — analytics feature > pro tier gets advanced analytics
(pass) checkTierPermission — unknown tier fallback > unknown tier falls back to free tier limits
(pass) checkTierPermission — unknown tier fallback > undefined tier falls back to free tier limits
(pass) checkTierPermission — unknown tier fallback > null tier falls back to free tier limits
(pass) checkTierPermission — default case > unknown feature returns allowed true
(pass) checkTierPermission — default case > empty string feature returns allowed true
(pass) verifyToken — additional edge cases > returns null for completely invalid string
(pass) verifyToken — additional edge cases > returns null for random garbage
(pass) verifyToken — additional edge cases > rejects token with HS384 algorithm

src\tests\middleware-auth.test.js:
(pass) Token Generation & Verification > generateToken should return a JWT string
(pass) Token Generation & Verification > verifyToken should decode a valid access token
(pass) Token Generation & Verification > generateRefreshToken should return a JWT string
(pass) Token Generation & Verification > verifyToken should decode a valid refresh token
(pass) Token Generation & Verification > verifyToken should reject tampered token
(pass) Token Generation & Verification > verifyToken should reject empty/null token
(pass) Token Generation & Verification > generateToken with custom expiry
(pass) Tier Permission Checks > free tier should have listing limit
(pass) Tier Permission Checks > free tier should not allow AI features
(pass) Tier Permission Checks > pro tier should allow AI features
(pass) Tier Permission Checks > starter tier should allow automations
(pass) Tier Permission Checks > free tier should not allow automations
(pass) Tier Permission Checks > should handle unknown feature gracefully

src\tests\middleware-cdn.test.js:
(pass) CDN - getCacheDuration > .js files return 7 days
(pass) CDN - getCacheDuration > .css files return 7 days
(pass) CDN - getCacheDuration > .png files return 30 days
(pass) CDN - getCacheDuration > .jpg files return 30 days
(pass) CDN - getCacheDuration > .html files return 0 (no cache)
(pass) CDN - getCacheDuration > .woff2 font files return 1 year
(pass) CDN - getCacheDuration > hashed files return 1 year (immutable)
(pass) CDN - getCacheDuration > hashed CSS files return 1 year
(pass) CDN - getCacheDuration > unknown extension returns 1 hour default
(pass) CDN - getCacheDuration > .svg images return 30 days
(pass) CDN - getCacheControl > .html returns no-store directive
(pass) CDN - getCacheControl > .js public includes "public" and max-age
(pass) CDN - getCacheControl > .js private includes "private"
(pass) CDN - getCacheControl > hashed files include "immutable"
(pass) CDN - getCacheControl > long-cached assets include stale-while-revalidate
(pass) CDN - cdnUrl > returns path as-is when CDN_URL is not set
(pass) CDN - cdnUrl > returns path unchanged without CDN_URL
(pass) CDN - staticCacheMiddleware > returns null for API routes
(pass) CDN - staticCacheMiddleware > returns cache headers for static routes
(pass) CDN - staticCacheMiddleware > returns no-store for HTML paths
(pass) CDN - getPreloadHints > returns preload hints string
(pass) CDN - getPreloadHints > includes critical CSS and JS assets

src\tests\middleware-csrf-coverage.test.js:
(pass) CSRFManager — token expiry > expired token is rejected by validateToken
(pass) CSRFManager — token expiry > token right at expiry boundary is rejected
(pass) CSRFManager — session ID validation > valid when no sessionId constraint on token
(pass) CSRFManager — session ID validation > valid when no sessionId provided for validation
(pass) CSRFManager — session ID validation > invalid when sessionId mismatch (both set)
(pass) CSRFManager — session ID validation > valid when sessionId matches exactly
(pass) CSRFManager — max token eviction > evicts oldest tokens when maxTokens is exceeded
(pass) CSRFManager — cleanup > cleanup removes expired tokens
(pass) CSRFManager — cleanup > cleanup is idempotent — calling twice is safe
(pass) CSRFManager — cleanup > cleanup on empty tokens map is safe
(pass) CSRFManager — getOldestToken > returns 0 when no tokens exist
(pass) CSRFManager — getOldestToken > returns age of oldest token
(pass) CSRFManager — getStats edge cases > getStats returns correct totalTokens count
(pass) CSRFManager — getStats edge cases > getStats.oldestToken is a non-negative number
(pass) CSRFManager — consumeToken edge cases > consuming non-existent token does not throw
(pass) CSRFManager — consumeToken edge cases > consuming same token twice does not throw
(pass) addCSRFToken — edge cases > uses ip when user is null
(pass) addCSRFToken — edge cases > uses ip when user.id is undefined
(pass) addCSRFToken — edge cases > uses user.id over ip when available
(pass) validateCSRF — enforced mode (production) > GET request passes without token
(pass) validateCSRF — enforced mode (production) > HEAD request passes without token
(pass) validateCSRF — enforced mode (production) > OPTIONS request passes without token
(pass) validateCSRF — enforced mode (production) > POST without token returns CSRF missing error
(pass) validateCSRF — enforced mode (production) > PUT without token returns CSRF missing error
(pass) validateCSRF — enforced mode (production) > PATCH without token returns CSRF missing error
(pass) validateCSRF — enforced mode (production) > DELETE without token returns CSRF missing error
(pass) validateCSRF — enforced mode (production) > POST with valid x-csrf-token header passes
(pass) validateCSRF — enforced mode (production) > POST with valid csrf-token header passes
(pass) validateCSRF — enforced mode (production) > POST with valid token in body passes
(pass) validateCSRF — enforced mode (production) > token is consumed after successful validation (one-time use)
(pass) validateCSRF — enforced mode (production) > invalid token returns error
(pass) validateCSRF — enforced mode (production) > expired token returns error
(pass) validateCSRF — enforced mode (production) > token with wrong session returns error
(pass) validateCSRF — enforced mode (production) > uses user.id as sessionId when user is present
(pass) validateCSRF — skip paths (production) > POST to /api/auth/login bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/auth/register bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/auth/refresh bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/auth/logout bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/auth/password-reset bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/auth/resend-verification bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/auth/demo-login bypasses CSRF check
(pass) validateCSRF — skip paths (production) > POST to /api/inventory does NOT bypass CSRF
(pass) validateCSRF — skip paths (production) > non-api skip paths also work (stripped /api prefix)
(pass) validateCSRF — test mode bypass > returns valid in NODE_ENV=test even for POST without token
(pass) validateCSRF — test mode bypass > DISABLE_CSRF=true in non-production mode bypasses check
(pass) validateCSRF — test mode bypass > DISABLE_CSRF=true in production does NOT bypass
(pass) applyCSRFProtection — enforced mode > returns null when validation passes (GET)
(pass) applyCSRFProtection — enforced mode > returns error object when token is missing
(pass) applyCSRFProtection — enforced mode > returns error object when token is invalid
(pass) applyCSRFProtection — enforced mode > returns null when valid token is provided
(pass) csrfConfig — additional checks > bypassPaths includes health and status endpoints
(pass) csrfConfig — additional checks > cookie.secure reflects NODE_ENV
(pass) csrfConfig — additional checks > headerNames has exactly 2 entries

src\tests\middleware-csrf-expanded.test.js:
(pass) csrfConfig > has headerNames array with expected values
(pass) csrfConfig > has cookie configuration
(pass) csrfConfig > has skipPaths array
(pass) CSRFManager lifecycle > generateToken returns a hex string
(pass) CSRFManager lifecycle > validateToken returns true for a valid token
(pass) CSRFManager lifecycle > validateToken returns false for unknown token
(pass) CSRFManager lifecycle > validateToken returns false for null token
(pass) CSRFManager lifecycle > validateToken fails with wrong session ID
(pass) CSRFManager lifecycle > consumeToken invalidates the token
(pass) CSRFManager lifecycle > getStats returns object with totalTokens and oldestToken
(pass) CSRFManager lifecycle > getStats.totalTokens increases after generating tokens
(pass) addCSRFToken > returns a token string and sets ctx.csrfToken
(pass) addCSRFToken > uses user.id as session ID when available
(pass) validateCSRF > returns valid:true in test environment
(pass) validateCSRF > returns valid:true for GET requests
(pass) applyCSRFProtection > returns null (no error) in test environment

src\tests\middleware-csrf.test.js:
(pass) CSRF Token Management > GET /csrf-token should return a token
(pass) CSRF Token Management > CSRF should be disabled in test mode (NODE_ENV=test)
(pass) CSRF Token Management > State-changing methods should be subject to CSRF (when enabled)
(pass) CSRF Token Management > GET requests should never require CSRF
(pass) CSRF Skip Paths > POST /auth/login should not require CSRF [219.00ms]
(pass) CSRF Skip Paths > POST /auth/register should not require CSRF [203.00ms]
(pass) CSRF Skip Paths > POST /auth/refresh should not require CSRF
(pass) CSRF Response Headers > Responses should include security-related headers

src\tests\middleware-errorHandler-expanded.test.js:
(pass) ErrorMessages > REQUIRED_FIELD returns formatted message
(pass) ErrorMessages > INVALID_FORMAT returns formatted message
(pass) ErrorMessages > MIN_LENGTH returns formatted message
(pass) ErrorMessages > MAX_LENGTH returns formatted message
(pass) ErrorMessages > OUT_OF_RANGE returns formatted message
(pass) ErrorMessages > INVALID_ENUM returns formatted message with values
(pass) ErrorMessages > INVALID_CREDENTIALS is a string constant
(pass) ErrorMessages > TOKEN_EXPIRED is a string constant
(pass) ErrorMessages > NOT_FOUND returns resource-specific message
(pass) ErrorMessages > ALREADY_EXISTS returns resource-specific message
(pass) ErrorMessages > OPERATION_FAILED returns operation-specific message
(pass) formatErrorResponse edge cases > formats AppError with all fields
(pass) formatErrorResponse edge cases > formats plain Error without code or field
(pass) formatErrorResponse edge cases > includes stack trace when includeStack is true
(pass) formatErrorResponse edge cases > excludes stack trace when includeStack is false
(pass) Error class hierarchy > ValidationError has statusCode 400
(pass) Error class hierarchy > NotFoundError has statusCode 404
(pass) Error class hierarchy > UnauthorizedError has statusCode 401
(pass) Error class hierarchy > ForbiddenError has statusCode 403
(pass) Error class hierarchy > ConflictError has statusCode 409
(pass) Error class hierarchy > RateLimitError has statusCode 429
(pass) Error class hierarchy > all error types are instances of AppError

src\tests\middleware-errorHandler.test.js:
(pass) AppError Classes > AppError should have correct defaults
(pass) AppError Classes > ValidationError should be 400
(pass) AppError Classes > NotFoundError should be 404
(pass) AppError Classes > UnauthorizedError should be 401
(pass) AppError Classes > ForbiddenError should be 403
(pass) AppError Classes > ConflictError should be 409
(pass) AppError Classes > RateLimitError should be 429 with retryAfter
(pass) formatErrorResponse > should format AppError correctly
(pass) formatErrorResponse > should format RateLimitError with retryAfter
(pass) formatErrorResponse > should include stack trace when requested
(pass) formatErrorResponse > should omit stack trace by default
(pass) Assert Helpers > assert should pass on truthy condition
(pass) Assert Helpers > assert should throw ValidationError on falsy
(pass) Assert Helpers > assertFound should return resource if truthy
(pass) Assert Helpers > assertFound should throw NotFoundError if falsy
(pass) Assert Helpers > assertAuthorized should return user if truthy
(pass) Assert Helpers > assertAuthorized should throw UnauthorizedError if falsy
(pass) Assert Helpers > assertPermission should pass on true
(pass) Assert Helpers > assertPermission should throw ForbiddenError on false
(pass) catchAsync > should return result for successful async fn
{"timestamp":"2026-03-05T21:19:42.159Z","level":"ERROR","message":"oops","error":{"message":"oops"}}
(pass) catchAsync > should catch thrown errors and return error response

src\tests\middleware-rateLimiter.test.js:
(pass) RateLimiter > getKey() > should generate IP-based key without userId
(pass) RateLimiter > getKey() > should generate user-based key with userId
(pass) RateLimiter > check() > should allow first request
(pass) RateLimiter > check() > should track remaining requests
(pass) RateLimiter > check() > should reject after exceeding limit
(pass) RateLimiter > check() > should block after repeated violations
(pass) RateLimiter > block() / unblock() > should manually block a key
(pass) RateLimiter > block() / unblock() > should manually unblock a key
(pass) RateLimiter > getStats() > should return stats object
(pass) RateLimiter > cleanup() > should not throw

src\tests\middleware-requestLogger.test.js:
(pass) RequestLogger - AuditActions > LOGIN equals "LOGIN"
(pass) RequestLogger - AuditActions > CREATE equals "CREATE"
(pass) RequestLogger - AuditActions > DELETE equals "DELETE"
(pass) RequestLogger - AuditActions > has all expected authentication keys
(pass) RequestLogger - AuditActions > has all expected CRUD keys
(pass) RequestLogger - AuditActions > has integration keys
(pass) RequestLogger - createRequestContext > returns object with requestId, method, path
(pass) RequestLogger - createRequestContext > generates unique requestIds
(pass) RequestLogger - createRequestContext > extracts query parameters
(pass) RequestLogger - createRequestContext > includes timestamp and startTime
(pass) RequestLogger - createRequestContext > extracts user-agent header
(pass) RequestLogger - createRequestContext > defaults userAgent to "unknown" when missing
(pass) RequestLogger - createRequestContext > extracts referer header
(pass) RequestLogger - createRequestContext > returns "unknown" IP without TRUST_PROXY
(pass) RequestLogger - createRequestLogger > returns object with before and after functions

src\tests\middleware-securityHeaders-expanded.test.js:
(pass) cspConfig > has required CSP directive keys
(pass) cspConfig > all directive values are arrays
(pass) cspConfig > default-src includes self
(pass) cspConfig > script-src includes self and unsafe-inline
(pass) cspConfig > script-src does NOT include unsafe-eval
(pass) securityHeadersConfig > has Content-Security-Policy header
(pass) securityHeadersConfig > has X-Frame-Options set to DENY
(pass) securityHeadersConfig > has X-Content-Type-Options set to nosniff
(pass) securityHeadersConfig > has Referrer-Policy
(pass) securityHeadersConfig > has Permissions-Policy string
(pass) securityHeadersConfig > has Cache-Control for sensitive data
(pass) securityHeadersConfig > has Cross-Origin headers
(pass) securityPresets > has api preset with JSON content type
(pass) securityPresets > has html preset with HTML content type
(pass) securityPresets > has download preset with attachment disposition
(pass) buildCSPWithNonce > returns a string
(pass) buildCSPWithNonce > embeds the nonce in the CSP string
(pass) buildCSPWithNonce > different nonces produce different CSP strings
(pass) buildCSPWithNonce > includes self in script-src
(pass) buildCSPWithNonce > includes unsafe-inline as fallback
(pass) getPresetHeaders > api preset merges security headers with api content type
(pass) getPresetHeaders > html preset merges security headers with html content type
(pass) getPresetHeaders > unknown preset returns base security headers only
(pass) getPresetHeaders > additionalHeaders override preset and base headers
(pass) applySecurityHeaders > returns object with security headers for basic ctx
(pass) applySecurityHeaders > overrides Cache-Control for static .js assets
(pass) applySecurityHeaders > overrides Cache-Control for static .css assets
(pass) applySecurityHeaders > overrides Cache-Control for image assets
(pass) applySecurityHeaders > includes CSRF token from ctx
(pass) applySecurityHeaders > merges rate limit headers from ctx
(pass) applySecurityHeaders > merges additionalHeaders
(pass) applyDevelopmentHeaders > returns object (empty in non-development env)

src\tests\middleware-securityHeaders.test.js:
(pass) Content Security Policy > CSP header should be present
(pass) Content Security Policy > CSP should include default-src directive
(pass) Content Security Policy > CSP should include script-src with self
(pass) Content Security Policy > CSP must include unsafe-inline for SPA compatibility
(pass) Content Security Policy > CSP should NOT include unsafe-eval
(pass) Content Security Policy > CSP should restrict frame-ancestors
(pass) Anti-Clickjacking > X-Frame-Options should be DENY or SAMEORIGIN
(pass) MIME Sniffing Protection > X-Content-Type-Options should be nosniff
(pass) XSS Protection > X-XSS-Protection should be set
(pass) Referrer Policy > Referrer-Policy should be set
(pass) Permissions Policy > Permissions-Policy should restrict dangerous features
(pass) Cross-Origin Policies > Cross-Origin-Opener-Policy should be set
(pass) Cross-Origin Policies > Cross-Origin-Resource-Policy should be set
(pass) Cache Control for API > API responses should have no-store cache control
(pass) Headers on Authenticated Endpoints > Authenticated API responses should have same security headers [219.00ms]

src\tests\mockOAuth.test.js:
(pass) Mock OAuth - Authorize > GET /:platform/authorize - should return HTML login page
(pass) Mock OAuth - Authorize > GET /:platform/authorize - should handle different platforms [15.00ms]
(pass) Mock OAuth - Authorize > GET /:platform/authorize - should fail without required params
(pass) Mock OAuth - Authorize > GET /:platform/authorize - should fail without client_id
(pass) Mock OAuth - Authorize > GET /:platform/authorize - should fail without redirect_uri
(pass) Mock OAuth - Authorize > GET /:platform/authorize - should fail without state
(pass) Mock OAuth - Token Exchange > POST /:platform/token - should return access token
(pass) Mock OAuth - Token Exchange > POST /:platform/token - should work for all platforms
(pass) Mock OAuth - User Info > GET /:platform/user - should return user info
(pass) Mock OAuth - User Info > GET /:platform/user - should return platform-specific user info
(pass) Mock OAuth - Token Revocation > POST /:platform/revoke - should revoke token successfully
(pass) Mock OAuth - Token Revocation > POST /:platform/revoke - should work for all platforms
(pass) Mock OAuth - Error Handling > GET /unknown-route - should return 404
(pass) Mock OAuth - Error Handling > should handle unknown platforms gracefully

src\tests\monitoring-expanded.test.js:
(pass) Public health check > GET /health without auth returns 200
(pass) Public health check > GET /health includes status, timestamp, version
(pass) Public health check > GET /health includes database status
(pass) Public status > GET /status returns 200 with ok
(pass) Monitoring auth guard > GET /monitoring/health/detailed without auth returns 401 or 404
(pass) Monitoring auth guard > GET /monitoring/metrics without auth returns 401 or 404
(pass) Monitoring auth guard > GET /monitoring/alerts without auth returns 401 or 404
(pass) Monitoring authenticated (unmounted router) > GET /monitoring/health with auth returns 200, 401, or 404
(pass) Monitoring authenticated (unmounted router) > GET /monitoring/metrics with auth returns 200, 401, or 404
(pass) Monitoring authenticated (unmounted router) > GET /monitoring/errors with auth returns 200, 401, or 404
(pass) Monitoring authenticated (unmounted router) > GET /monitoring/alerts with auth returns 200, 401, or 404
(pass) Monitoring authenticated (unmounted router) > GET /monitoring/health/detailed with auth returns 200, 401, or 404

src\tests\monitoring.test.js:
(pass) GET /api/monitoring/health (public) > returns 200 without auth
(pass) GET /api/monitoring/health (public) > returns 200 with auth
(pass) GET /api/monitoring/health/detailed > rejects unauthenticated request
(pass) GET /api/monitoring/health/detailed > returns detailed health for authenticated user
(pass) GET /api/monitoring/alerts > rejects unauthenticated request
(pass) GET /api/monitoring/alerts > returns alerts for authenticated user
(pass) GET /api/monitoring/errors > rejects unauthenticated request
(pass) GET /api/monitoring/errors > returns error log for authenticated user
(pass) POST /api/monitoring/rum (public) > accepts RUM metrics without auth
(pass) POST /api/monitoring/rum (public) > accepts RUM metrics with auth
(pass) GET /api/monitoring/metrics (enterprise) > rejects unauthenticated request
(pass) GET /api/monitoring/metrics (enterprise) > returns 403 for non-enterprise demo user
(pass) GET /api/monitoring/metrics/prometheus (enterprise) > rejects unauthenticated request
(pass) GET /api/monitoring/metrics/prometheus (enterprise) > returns 403 for non-enterprise demo user
(pass) GET /api/monitoring/security/events (enterprise) > rejects unauthenticated request
(pass) GET /api/monitoring/security/events (enterprise) > returns 403 for non-enterprise demo user
(pass) GET /api/monitoring/rum/summary (enterprise) > rejects unauthenticated request
(pass) GET /api/monitoring/rum/summary (enterprise) > returns 403 for non-enterprise demo user

src\tests\notifications.test.js:
Running Notifications API tests...
(pass) Notifications - List > GET /notifications - should return notifications list [16.00ms]
(pass) Notifications - List > GET /notifications?page=1&limit=10 - should support pagination
(pass) Notifications - Unread > GET /notifications/unread - should return unread notifications
(pass) Notifications - Unread > GET /notifications/count - should return unread count
(pass) Notifications - Mark as Read > PUT /notifications/:id/read - should mark notification as read
(pass) Notifications - Mark as Read > PUT /notifications/read-all - should mark all as read
(pass) Notifications - Mark as Read > PUT /notifications/:id/read - should return 404 for non-existent
(pass) Notifications - Delete > DELETE /notifications/:id - should delete notification
(pass) Notifications - Delete > DELETE /notifications/:id - should return 404 for non-existent
(pass) Notifications - Authentication > GET /notifications - should require auth
(pass) Notifications - Authentication > GET /notifications/count - should require auth

src\tests\notion-expanded.test.js:
(pass) Notion - Auth Guard > GET /notion/status without auth returns 401
(pass) Notion - Auth Guard > POST /notion/connect without auth returns 401
(pass) Notion - Auth Guard > DELETE /notion/disconnect without auth returns 401
(pass) Notion - Auth Guard > PUT /notion/settings without auth returns 401
(pass) Notion - Auth Guard > POST /notion/sync without auth returns 401
(pass) Notion - Auth Guard > GET /notion/sync/conflicts without auth returns 401
(pass) Notion - Auth Guard > POST /notion/pages without auth returns 401
(pass) Notion - Status (local DB only) > GET /notion/status returns connection status
(pass) Notion - Connect Validation > POST /notion/connect without token returns 400
(pass) Notion - Disconnect (local DB only) > DELETE /notion/disconnect succeeds
(pass) Notion - Settings Validation > PUT /notion/settings with no valid fields returns 400
(pass) Notion - Settings Validation > PUT /notion/settings with invalid conflict_strategy returns 400
(pass) Notion - Settings Validation > PUT /notion/settings with valid conflict_strategy
(pass) Notion - Settings Validation > PUT /notion/settings with valid conflict_strategy: vaultlister_wins
(pass) Notion - Settings Validation > PUT /notion/settings with valid conflict_strategy: notion_wins
(pass) Notion - Settings Validation > PUT /notion/settings with valid conflict_strategy: newest_wins
(pass) Notion - Settings Validation > PUT /notion/settings with too-low sync interval returns 400
(pass) Notion - Settings Validation > PUT /notion/settings with sync_interval_minutes=0 returns 400 [15.00ms]
(pass) Notion - Settings Validation > PUT /notion/settings with valid sync interval (15)
(pass) Notion - Settings Validation > PUT /notion/settings with valid sync interval (60)
(pass) Notion - Settings Validation > PUT /notion/settings with sync_enabled true
(pass) Notion - Settings Validation > PUT /notion/settings with sync_enabled false
(pass) Notion - Settings Validation > PUT /notion/settings with database_id links
(pass) Notion - Sync Status (local DB only) > GET /notion/sync/status returns status
(pass) Notion - Sync Status (local DB only) > GET /notion/sync/history returns history
(pass) Notion - Sync Status (local DB only) > GET /notion/sync/history with limit param
(pass) Notion - Sync Status (local DB only) > GET /notion/sync/pending returns items
(pass) Notion - Sync Status (local DB only) > GET /notion/sync/pending with type=inventory
(pass) Notion - Sync Status (local DB only) > GET /notion/sync/pending with type=sales
(pass) Notion - Conflicts (local DB only) > GET /notion/sync/conflicts returns conflicts list
(pass) Notion - Conflicts (local DB only) > POST /notion/sync/conflicts/fake-id/resolve without resolution returns 400
(pass) Notion - Conflicts (local DB only) > POST /notion/sync/conflicts/fake-id/resolve with invalid resolution 
returns 400
(pass) Notion - Conflicts (local DB only) > POST /notion/sync/conflicts/fake-id/resolve with keep_local returns 404
(pass) Notion - Conflicts (local DB only) > POST /notion/sync/conflicts/fake-id/resolve with keep_notion returns 404
(pass) Notion - Conflicts (local DB only) > POST /notion/sync/conflicts/fake-id/resolve with merge returns 404
(pass) Notion - Conflicts (local DB only) > POST /notion/sync/conflicts/fake-id/resolve with ignore returns 404
(pass) Notion - Pages Validation > POST /notion/pages without database_id returns 400
(pass) Notion - Pages Validation > POST /notion/pages without properties returns 400
(pass) Notion - Pages Validation > PUT /notion/pages/fake-id without properties returns 400
(pass) Notion - Sync Trigger > POST /notion/sync triggers or errors
(pass) Notion - 404 for unknown routes > GET /notion/nonexistent returns 404
(pass) Notion - 404 for unknown routes > POST /notion/nonexistent returns 404 [16.00ms]

src\tests\notion-gaps-expanded.test.js:
(pass) Notion — Connection > GET /notion/status returns connection status
(pass) Notion — Connection > POST /notion/connect without token
(pass) Notion — Connection > DELETE /notion/disconnect when not connected [16.00ms]
(pass) Notion — Setup > POST /notion/setup/inventory with fake database_id
(pass) Notion — Setup > POST /notion/setup/sales with fake database_id
(pass) Notion — Setup > POST /notion/setup/notes with fake database_id
(pass) Notion — Setup > POST /notion/setup/inventory without database_id
(pass) Notion — Settings > PUT /notion/settings updates sync settings
(pass) Notion — Sync > GET /notion/sync/status returns sync status
(pass) Notion — Sync > GET /notion/sync/history returns sync history
(pass) Notion — Sync > GET /notion/sync/pending returns pending items
(pass) Notion — Sync > GET /notion/sync/conflicts returns conflicts
(pass) Notion — Sync > POST /notion/sync triggers sync when not connected
(pass) Notion — Pages > POST /notion/pages without connection returns error
(pass) Notion — Auth Guard > GET /notion/status requires auth

src\tests\notion-gaps.test.js:
(pass) Notion setup endpoints > POST /notion/setup/inventory responds
(pass) Notion setup endpoints > POST /notion/setup/sales responds
(pass) Notion setup endpoints > POST /notion/setup/notes responds
(pass) Notion setup endpoints > POST /notion/setup/inventory without database_id or parent_page_id [15.00ms]

src\tests\notion.test.js:
(pass) notion routes > should require authentication
(pass) notion routes > GET /notion/status responds

src\tests\oauth.test.js:
Running OAuth API tests...
(pass) OAuth - Authorization > GET /oauth/authorize/:platform - should return auth URL for poshmark
(pass) OAuth - Authorization > GET /oauth/authorize/:platform - should return auth URL for ebay
(pass) OAuth - Authorization > GET /oauth/authorize/:platform - should return auth URL for mercari
(pass) OAuth - Authorization > GET /oauth/authorize - should require platform
(pass) OAuth - Callback > GET /oauth/callback/:platform - should reject missing code
(pass) OAuth - Callback > GET /oauth/callback/:platform - should reject invalid state
(pass) OAuth - Callback > GET /oauth/callback/:platform - should handle oauth error
(pass) OAuth - Connection Status > GET /oauth/status/poshmark - should return connection status [15.00ms]
(pass) OAuth - Connection Status > GET /oauth/status/ebay - should return connection status for ebay
(pass) OAuth - Token Refresh > POST /oauth/refresh/:platform - should handle token refresh
(pass) OAuth - Disconnect > DELETE /oauth/revoke/:platform - should revoke connection
(pass) OAuth - Authentication Required > GET /oauth/authorize/:platform - should require auth
(pass) OAuth - Authentication Required > GET /oauth/status/:platform - should require auth

src\tests\offers.test.js:
Running Offers API tests...
(pass) Offers - List > GET /offers - should return offers list
(pass) Offers - List > GET /offers?platform=poshmark - should filter by platform
(pass) Offers - List > GET /offers?status=pending - should filter by status
(pass) Offers - List > GET /offers?limit=10&offset=0 - should paginate
(pass) Offers - Get Single > GET /offers/:id - should return 404 for non-existent offer
(pass) Offers - Accept > POST /offers/:id/accept - should return 404 for non-existent offer
(pass) Offers - Decline > POST /offers/:id/decline - should return 404 for non-existent offer
(pass) Offers - Counter > POST /offers/:id/counter - should require amount
(pass) Offers - Counter > POST /offers/:id/counter - should return 404 for non-existent offer
(pass) Offers - Rules > GET /offers/rules - should return offer rules
(pass) Offers - Rules > POST /offers/rules - should create offer rule
(pass) Offers - Rules > POST /offers/rules - should require name, conditions, and actions
(pass) Offers - Rules > PUT /offers/rules/:id - should update offer rule
(pass) Offers - Rules > PUT /offers/rules/:id - should return 404 for non-existent rule
(pass) Offers - Statistics > GET /offers/stats - should return offer statistics
(pass) Offers - Delete Rule > DELETE /offers/rules/:id - should delete offer rule
(pass) Offers - Delete Rule > DELETE /offers/rules/:id - should return 404 for non-existent rule
(pass) Offers - Authentication > GET /offers - should require auth
(pass) Offers - Authentication > POST /offers/rules - should require auth
(pass) Offers - Authentication > GET /offers/stats - should require auth

src\tests\offlineSync-expanded.test.js:
(pass) Offline Sync - Auth Guard > POST /offline-sync/queue without auth returns 401
(pass) Offline Sync - Queue CRUD > POST /offline-sync/queue adds item [15.00ms]
(pass) Offline Sync - Queue CRUD > POST /offline-sync/queue with update action
(pass) Offline Sync - Queue CRUD > POST /offline-sync/queue with delete action
(pass) Offline Sync - Queue CRUD > POST /offline-sync/queue without action returns 400
(pass) Offline Sync - Queue CRUD > POST /offline-sync/queue without entity_type returns 400
(pass) Offline Sync - Queue CRUD > DELETE /offline-sync/queue/:id removes item
(pass) Offline Sync - Queue CRUD > DELETE /offline-sync/queue/nonexistent returns 404
(pass) Offline Sync - Process Sync > POST /offline-sync/sync processes pending items
(pass) Offline Sync - Manifest > POST /offline-sync/manifest returns PWA manifest data

src\tests\offlineSync-gaps-expanded.test.js:
(pass) Offline Sync — Status > GET /offline-sync/status returns sync status
(pass) Offline Sync — Queue > GET /offline-sync/queue returns pending items
(pass) Offline Sync — Queue > POST /offline-sync/queue adds item to queue
No queue item created
(pass) Offline Sync — Queue > DELETE /offline-sync/queue/:id removes item
(pass) Offline Sync — Queue > DELETE /offline-sync/queue/:id nonexistent returns 404
(pass) Offline Sync — Process & Manifest > POST /offline-sync/sync processes pending items
(pass) Offline Sync — Process & Manifest > POST /offline-sync/manifest returns PWA manifest data [16.00ms]
(pass) Offline Sync — Auth Guard > GET /offline-sync/status requires auth

src\tests\offlineSync-gaps.test.js:
(pass) Offline Sync status endpoint > GET /offline-sync/status returns sync status

src\tests\offlineSync.test.js:
(pass) GET /api/offline-sync/queue > unauthenticated returns 401/403/500
(pass) GET /api/offline-sync/queue > authenticated returns queue
(pass) GET /api/offline-sync/queue > authenticated with status=pending filter
(pass) POST /api/offline-sync/queue > unauthenticated returns 401/403/500
(pass) POST /api/offline-sync/queue > authenticated with valid body enqueues item
(pass) POST /api/offline-sync/sync > unauthenticated returns 401/403/500
(pass) POST /api/offline-sync/sync > authenticated processes pending items
(pass) GET /api/offline-sync/status > unauthenticated returns 401/403/500
(pass) GET /api/offline-sync/status > authenticated returns sync status
(pass) POST /api/offline-sync/manifest > unauthenticated returns 401/403/500
(pass) POST /api/offline-sync/manifest > authenticated returns or generates manifest

src\tests\onboarding-expanded.test.js:
(pass) Onboarding - Auth Guard > GET /onboarding/progress without auth returns 401
(pass) Onboarding - Auth Guard > POST /onboarding/progress without auth returns 401
(pass) Onboarding - Get Progress > GET /onboarding/progress returns progress or default [16.00ms]
(pass) Onboarding - Create/Reset Progress > POST /onboarding/progress with role creates progress
(pass) Onboarding - Create/Reset Progress > POST /onboarding/progress without role returns 400
(pass) Onboarding - Create/Reset Progress > POST /onboarding/progress with invalid role returns 400
(pass) Onboarding - Create/Reset Progress > POST /onboarding/progress with bulk_seller role [218.00ms]
(pass) Onboarding - Complete Step > PUT /onboarding/progress/step completes a step
(pass) Onboarding - Complete Step > PUT /onboarding/progress/step without step_id returns 400
(pass) Onboarding - Tours > GET /onboarding/tours/reseller returns tour steps
(pass) Onboarding - Tours > GET /onboarding/tours/bulk_seller returns different tour
(pass) Onboarding - Tours > GET /onboarding/tours/invalid returns 404
(pass) Onboarding - Badges > GET /onboarding/badges returns badge list
(pass) Onboarding - Badges > POST /onboarding/badges/claim without badge_id returns 400
(pass) Onboarding - Badges > POST /onboarding/badges/claim with valid badge_id

src\tests\onboarding.test.js:
(pass) GET /api/onboarding/progress > unauthenticated returns 401/403/500
(pass) GET /api/onboarding/progress > authenticated returns progress
(pass) POST /api/onboarding/progress > unauthenticated returns 401/403/500
(pass) POST /api/onboarding/progress > authenticated starts or resets onboarding [16.00ms]
(pass) GET /api/onboarding/badges > unauthenticated returns 401/403/500
(pass) GET /api/onboarding/badges > authenticated returns badges
(pass) GET /api/onboarding/tours/:role > valid role reseller returns tour steps
(pass) GET /api/onboarding/tours/:role > invalid role returns 404
(pass) POST /api/onboarding/badges/claim > unauthenticated returns 401/403/500
(pass) POST /api/onboarding/badges/claim > nonexistent badge returns 400 or 404

src\tests\orders-expanded.test.js:
(pass) Orders — Auth Guard > GET /orders without auth returns 401
(pass) Orders — Auth Guard > POST /orders without auth returns 401
(pass) Orders — Shape Validation > GET /orders returns proper shape
(pass) Orders — Shape Validation > GET /orders with date filter
(pass) Orders — Create & Lifecycle > POST /orders creates an order
(pass) Orders — Create & Lifecycle > POST /orders/:id/ship marks as shipped
(pass) Orders — Create & Lifecycle > POST /orders/:id/deliver marks as delivered [15.00ms]
(pass) Orders — Create & Lifecycle > PATCH /orders/:id/priority updates priority
(pass) Orders — Returns > POST /orders/:id/return for nonexistent returns error
(pass) Orders — Returns > PATCH /orders/:id/return for nonexistent returns error
(pass) Orders — Sync & Shipments > POST /orders/sync-all triggers platform sync
(pass) Orders — Sync & Shipments > POST /orders/sync/:platform syncs specific platform
(pass) Orders — Sync & Shipments > GET /orders/:id/shipments for nonexistent returns error
(pass) Orders — Sync & Shipments > POST /orders/:id/split for nonexistent returns error

src\tests\orders-gaps.test.js:
(pass) Orders deliver > POST /orders/:id/deliver nonexistent order
(pass) Orders delete > DELETE /orders/:id nonexistent order
(pass) Orders return > POST /orders/:id/return nonexistent order
(pass) Orders return > PATCH /orders/:id/return nonexistent order
(pass) Orders sync > POST /orders/sync-all triggers sync for all platforms
(pass) Orders sync > POST /orders/sync/:platform triggers platform sync
(pass) Orders priority > PATCH /orders/:id/priority nonexistent order
(pass) Orders split shipment > POST /orders/:id/split nonexistent order
(pass) Orders shipments > GET /orders/:id/shipments nonexistent order

src\tests\orders.test.js:
Running Orders API tests...
(pass) Orders - List > GET /orders - should return orders list
(pass) Orders - List > GET /orders?status=pending - should filter by status
(pass) Orders - List > GET /orders?platform=poshmark - should filter by platform
(pass) Orders - List > GET /orders?include_delivered=true - should include delivered orders [15.00ms]
(pass) Orders - List > GET /orders?search=test - should search orders
(pass) Orders - Create > POST /orders - should create an order or fail gracefully on schema mismatch
(pass) Orders - Get Single > GET /orders/:id - should return order details
(pass) Orders - Get Single > GET /orders/:id - should return 404 for non-existent order
(pass) Orders - Update > PUT /orders/:id - should update order status
(pass) Orders - Update > PATCH /orders/:id - should partially update order
(pass) Orders - Ship > POST /orders/:id/ship - should mark order as shipped
(pass) Orders - Bulk Operations > POST /orders/bulk-update - should update multiple orders
(pass) Orders - Authentication > GET /orders - should require auth

src\tests\outgoingWebhooks-expanded.test.js:
(pass) Outgoing Webhooks Expanded - Test Delivery > POST /outgoing-webhooks/nonexistent/test returns 404
(pass) Outgoing Webhooks Expanded - Test Delivery > POST /outgoing-webhooks/:id/test without auth returns 401
(pass) Outgoing Webhooks Expanded - Test Delivery > POST /outgoing-webhooks/:id/test with created webhook

src\tests\outgoingWebhooks.test.js:
(pass) Outgoing Webhooks - Auth Guard > GET /outgoing-webhooks without token returns 401
(pass) Outgoing Webhooks - Auth Guard > POST /outgoing-webhooks without token returns 401
(pass) Outgoing Webhooks - Empty List > GET /outgoing-webhooks returns empty list with availableEvents
(pass) Outgoing Webhooks - Empty List > availableEvents contains expected event types
(pass) Outgoing Webhooks - Create Validation > POST without name returns 400
(pass) Outgoing Webhooks - Create Validation > POST without url returns 400
(pass) Outgoing Webhooks - Create Validation > POST without events returns 400
(pass) Outgoing Webhooks - Create Validation > POST with invalid URL returns 400
(pass) Outgoing Webhooks - CRUD Cycle > POST with valid data creates webhook and returns secret
(pass) Outgoing Webhooks - CRUD Cycle > GET /outgoing-webhooks lists the webhook (secret NOT exposed)
(pass) Outgoing Webhooks - CRUD Cycle > GET /outgoing-webhooks/:id returns detail with deliveries
(pass) Outgoing Webhooks - CRUD Cycle > PUT /outgoing-webhooks/:id updates webhook name
(pass) Outgoing Webhooks - CRUD Cycle > DELETE /outgoing-webhooks/:id removes webhook
(pass) Outgoing Webhooks - CRUD Cycle > GET /outgoing-webhooks/:id after delete returns 404
(pass) Outgoing Webhooks - IDOR Prevention > userB cannot GET userA webhook
(pass) Outgoing Webhooks - IDOR Prevention > userB cannot PUT userA webhook
(pass) Outgoing Webhooks - IDOR Prevention > userB cannot DELETE userA webhook
(pass) Outgoing Webhooks - Secret Rotation > POST /outgoing-webhooks/:id/rotate-secret returns new secret
(pass) Outgoing Webhooks - Secret Rotation > rotated secret differs from original [15.00ms]

src\tests\performance.test.js:
(pass) Performance - Health Endpoint > GET /health responds in under 200ms
(pass) Performance - CSRF Token > GET /csrf-token responds in under 100ms
(pass) Performance - Authentication > POST /auth/login completes in under 1000ms [219.00ms]
(pass) Performance - Authentication > GET /auth/me completes in under 300ms
(pass) Performance - Inventory > GET /inventory completes in under 500ms
(pass) Performance - Inventory > POST /inventory (create) completes in under 500ms [16.00ms]
(pass) Performance - Inventory > GET /inventory/:id completes in under 300ms
(pass) Performance - Inventory > PUT /inventory/:id (update) completes in under 500ms
(pass) Performance - Listings > GET /listings completes in under 500ms
(pass) Performance - Analytics > GET /analytics/sales completes in under 1000ms
(pass) Performance - Sequential Burst > 5 sequential GET /inventory requests all complete in under 500ms each

src\tests\platformSync-depop.test.js:
(pass) depopSync > syncDepopShop returns expected result shape
(pass) depopSync > creates 3 new listings in mock mode
(pass) depopSync > updates existing listings when found
(pass) depopSync > creates 1 new order in mock mode
(pass) depopSync > skips existing orders
(pass) depopSync > updates shop sync time on success
(pass) depopSync > throws and records error for invalid token
(pass) depopSync > listing external data includes platform depop

src\tests\platformSync-ebay.test.js:
(pass) ebaySync > syncEbayShop returns expected result shape
(pass) ebaySync > creates 2 new listings in mock mode
(pass) ebaySync > updates existing listings when found
(pass) ebaySync > creates 1 new order in mock mode
(pass) ebaySync > skips existing orders
(pass) ebaySync > updates shop sync time on success
(pass) ebaySync > throws for invalid encrypted token
(pass) ebaySync > order external data includes ebay platform and fee estimate

src\tests\platformSync-etsy.test.js:
(pass) etsySync > syncEtsyShop > returns expected result shape
(pass) etsySync > syncEtsyShop > creates 2 new listings in mock mode
(pass) etsySync > syncEtsyShop > updates existing listings when found
(pass) etsySync > syncEtsyShop > creates 1 new order in mock mode
(pass) etsySync > syncEtsyShop > skips existing orders
(pass) etsySync > syncEtsyShop > updates shop sync time on success
(pass) etsySync > syncEtsyShop > throws for invalid encrypted token
(pass) etsySync > createEtsyListing (mock mode) > returns success with listing_id
(pass) etsySync > updateEtsyListing (mock mode) > returns success
(pass) etsySync > deleteEtsyListing (mock mode) > returns success

src\tests\platformSync-grailed.test.js:
(pass) grailedSync > syncGrailedShop returns expected result shape
(pass) grailedSync > creates 3 new listings in mock mode
(pass) grailedSync > updates existing listings when found
(pass) grailedSync > creates 1 new order in mock mode
(pass) grailedSync > skips existing orders
(pass) grailedSync > updates shop sync time
(pass) grailedSync > listing data includes grailed platform and designer info
(pass) grailedSync > order fee calculation uses 9% + $0.30

src\tests\platformSync-mercari.test.js:
(pass) mercariSync > syncMercariShop returns expected result shape
(pass) mercariSync > creates 2 new listings in mock mode
(pass) mercariSync > updates existing listings when found
(pass) mercariSync > creates 1 new order in mock mode
(pass) mercariSync > skips existing orders
(pass) mercariSync > updates shop sync time
(pass) mercariSync > listing data includes mercari platform
(pass) mercariSync > order fee calculation uses 10%

src\tests\platformSync-notionSync.test.js:
(pass) notionSync > performSync > throws when Notion not configured
(pass) notionSync > performSync > throws when sync already in progress (recent)
(pass) notionSync > performSync > allows override if stuck sync is older than 5 minutes
(pass) notionSync > performSync > completes with zero items when no database IDs configured
(pass) notionSync > performSync > returns expected result shape
(pass) notionSync > performSync > marks sync as in_progress then updates status
(pass) notionSync > resolveConflict > throws when conflict not found
(pass) notionSync > syncScheduler lifecycle > stopSyncScheduler is safe when not running
(pass) notionSync > syncScheduler lifecycle > startSyncScheduler + stopSyncScheduler cycle
(pass) notionSync > syncScheduler lifecycle > double stop does not throw

src\tests\platformSync-poshmark.test.js:
(pass) poshmarkSync > syncPoshmarkShop returns expected result shape
(pass) poshmarkSync > creates 3 new listings in mock mode
(pass) poshmarkSync > updates existing listings when found
(pass) poshmarkSync > creates 1 new order in mock mode
(pass) poshmarkSync > skips existing orders
(pass) poshmarkSync > updates shop sync time [16.00ms]
(pass) poshmarkSync > listing data includes poshmark platform
(pass) poshmarkSync > order fee uses 20% for sales > $15

src\tests\platformSync.test.js:
(pass) Platform Sync - List Shops > GET /shops returns array
(pass) Platform Sync - List Shops > shop listing does not leak credentials
(pass) Platform Sync - List Shops > shop objects have expected fields if any exist
(pass) Platform Sync - Connect Shop > POST /shops with missing platform returns 400
(pass) Platform Sync - Connect Shop > POST /shops with valid platform data
(pass) Platform Sync - Sync Status > GET /shops returns sync-related fields
(pass) Platform Sync - Supported Platforms > ebay is a known platform
(pass) Platform Sync - Supported Platforms > poshmark is a known platform
(pass) Platform Sync - Supported Platforms > mercari is a known platform
(pass) Platform Sync - Disconnect > DELETE /shops/:nonexistent returns 404
(pass) Platform Sync - Auth Guard > unauthenticated list returns 401
(pass) Platform Sync - Auth Guard > unauthenticated connect returns 401

src\tests\predictions-expanded.test.js:
(pass) Predictions - Auth Guard > GET /predictions without auth returns 401
(pass) Predictions - Auth Guard > POST /predictions/batch without auth returns 401
(pass) Predictions - List > GET /predictions returns array
(pass) Predictions - List > GET /predictions?recommendation=hold filters by recommendation
(pass) Predictions - List > GET /predictions?include_expired=true includes expired
(pass) Predictions - List > GET /predictions respects limit and offset
(pass) Predictions - Item Prediction > POST /predictions/item/:id generates prediction
(pass) Predictions - Item Prediction > GET /predictions/item/:id returns prediction or 404
(pass) Predictions - Batch > POST /predictions/batch requires inventory_ids array
(pass) Predictions - Batch > POST /predictions/batch rejects more than 50 items
(pass) Predictions - Batch > POST /predictions/batch with valid array
(pass) Predictions - Recommendations > GET /predictions/recommendations returns grouped data
(pass) Predictions - Recommendations > GET /predictions/recommendations?action=price_up filters
(pass) Predictions - Demand Forecasts > GET /predictions/demand returns forecasts
(pass) Predictions - Demand Forecasts > GET /predictions/demand?category=Shoes filters by category [15.00ms]
(pass) Predictions - Demand Forecasts > POST /predictions/demand/:category generates forecast
(pass) Predictions - Seasonal Calendar > GET /predictions/seasonal-calendar returns 12-month calendar
(pass) Predictions - Seasonal Calendar > GET /predictions/seasonal-calendar?category=Shoes filters
(pass) Predictions - Stats > GET /predictions/stats returns prediction accuracy stats
(pass) Predictions - Models CRUD > GET /predictions/models returns array
(pass) Predictions - Models CRUD > POST /predictions/models requires name
(pass) Predictions - Models CRUD > POST /predictions/models requires valid model_type
(pass) Predictions - Models CRUD > POST /predictions/models creates model with valid data
(pass) Predictions - Models CRUD > PUT /predictions/models/:id returns 404 for nonexistent
(pass) Predictions - Models CRUD > DELETE /predictions/models/:id returns 404 for nonexistent
(pass) Predictions - Scenarios CRUD > GET /predictions/scenarios returns array
(pass) Predictions - Scenarios CRUD > POST /predictions/scenarios requires name
(pass) Predictions - Scenarios CRUD > POST /predictions/scenarios requires base_data
(pass) Predictions - Scenarios CRUD > POST /predictions/scenarios requires adjustments
(pass) Predictions - Scenarios CRUD > POST /predictions/scenarios creates scenario with valid data
(pass) Predictions - Scenarios CRUD > GET /predictions/scenarios/:id returns 404 for nonexistent
(pass) Predictions - Scenarios CRUD > DELETE /predictions/scenarios/:id returns 404 for nonexistent

src\tests\predictions-gaps-expanded.test.js:
(pass) Predictions — List & Stats > GET /predictions returns list [16.00ms]
(pass) Predictions — List & Stats > GET /predictions/stats returns statistics
(pass) Predictions — List & Stats > GET /predictions/seasonal-calendar returns calendar
(pass) Predictions — List & Stats > GET /predictions/recommendations returns items needing action
(pass) Predictions — Demand > GET /predictions/demand returns forecasts
(pass) Predictions — Demand > POST /predictions/demand/shoes generates category forecast
(pass) Predictions — Batch > POST /predictions/batch with empty array
(pass) Predictions — Models CRUD > GET /predictions/models returns list
(pass) Predictions — Models CRUD > POST /predictions/models creates model
No model created
(pass) Predictions — Models CRUD > PUT /predictions/models/:id updates model
No model created
(pass) Predictions — Models CRUD > DELETE /predictions/models/:id deletes model
(pass) Predictions — Scenarios CRUD > GET /predictions/scenarios returns list
(pass) Predictions — Scenarios CRUD > POST /predictions/scenarios creates scenario
No scenario created
(pass) Predictions — Scenarios CRUD > GET /predictions/scenarios/:id returns scenario
(pass) Predictions — Scenarios CRUD > GET /predictions/scenarios/nonexistent returns 404
No scenario created
(pass) Predictions — Scenarios CRUD > DELETE /predictions/scenarios/:id deletes scenario
(pass) Predictions — Auth Guard > GET /predictions requires auth

src\tests\predictions-gaps.test.js:
(pass) Predictions scenarios detail > GET /predictions/scenarios/:id for nonexistent scenario
(pass) Predictions scenarios detail > GET /predictions/scenarios/:id after creating a scenario

src\tests\predictions.test.js:
(pass) Predictions - Auth Guard > GET /predictions without auth returns 401
(pass) Predictions - Auth Guard > POST /predictions/item/fake-id without auth returns 401
(pass) Predictions - List > GET /predictions returns 200 or 500
(pass) Predictions - List > GET /predictions with recommendation filter
(pass) Predictions - Item > POST /predictions/item/:id generates prediction
(pass) Predictions - Item > GET /predictions/item/:id returns prediction or 404
(pass) Predictions - Batch > POST /predictions/batch with IDs
(pass) Predictions - Batch > POST /predictions/batch without IDs returns 400
(pass) Predictions - Demand & Seasonal > GET /predictions/demand returns 200
(pass) Predictions - Demand & Seasonal > POST /predictions/demand/:category generates forecast
(pass) Predictions - Demand & Seasonal > GET /predictions/seasonal-calendar returns 200
(pass) Predictions - Recommendations & Stats > GET /predictions/recommendations returns data
(pass) Predictions - Recommendations & Stats > GET /predictions/stats returns stats object [16.00ms]
(pass) Predictions - Models CRUD > POST /predictions/models creates model
(pass) Predictions - Models CRUD > GET /predictions/models lists models
(pass) Predictions - Models CRUD > PUT /predictions/models/nonexistent returns 404 or 500
(pass) Predictions - Models CRUD > DELETE /predictions/models/nonexistent returns 404 or 500
(pass) Predictions - Scenarios CRUD > POST /predictions/scenarios creates scenario
(pass) Predictions - Scenarios CRUD > GET /predictions/scenarios lists scenarios
(pass) Predictions - Scenarios CRUD > DELETE /predictions/scenarios/nonexistent returns 404 or 500

src\tests\pushNotifications-expanded.test.js:
(pass) Push Notifications - Auth Guard > GET /push-notifications/devices without auth returns 401
(pass) Push Notifications - Auth Guard > PUT /push-notifications/preferences without auth returns 401
(pass) Push Notifications - Register Device > POST /push-notifications/register-device with valid data
(pass) Push Notifications - Register Device > POST /push-notifications/register-device with ios platform
(pass) Push Notifications - Register Device > POST /push-notifications/register-device without token returns 400
(pass) Push Notifications - Register Device > POST /push-notifications/register-device without platform returns 400
(pass) Push Notifications - Unregister Device > POST /push-notifications/unregister-device with token
(pass) Push Notifications - Unregister Device > POST /push-notifications/unregister-device without token returns 400
(pass) Push Notifications - Devices > GET /push-notifications/devices returns list
(pass) Push Notifications - Devices > DELETE /push-notifications/devices/nonexistent returns 404
(pass) Push Notifications - Preferences > GET /push-notifications/preferences returns defaults
(pass) Push Notifications - Preferences > PUT /push-notifications/preferences updates settings
(pass) Push Notifications - Preferences > PUT /push-notifications/preferences with quiet hours
(pass) Push Notifications - Send > POST /push-notifications/send with valid data
(pass) Push Notifications - Send > POST /push-notifications/send without title returns 400
(pass) Push Notifications - Send > POST /push-notifications/send-batch with valid data
(pass) Push Notifications - Send > POST /push-notifications/send-batch without userIds returns 400

src\tests\pushNotifications.test.js:
(pass) pushNotifications routes > should require authentication
(pass) pushNotifications routes > GET /push-notifications/devices responds
(pass) pushNotifications routes > GET /push-notifications/preferences responds

src\tests\pushSubscriptions-expanded.test.js:
(pass) Push Subscriptions - VAPID Key > GET /push-subscriptions/vapid-public-key returns key string
(pass) Push Subscriptions - VAPID Key > VAPID key is a non-empty string
(pass) Push Subscriptions - Subscribe > POST /push-subscriptions/subscribe with valid data [15.00ms]
(pass) Push Subscriptions - Subscribe > POST /push-subscriptions/subscribe without endpoint returns 400
(pass) Push Subscriptions - Subscribe > POST /push-subscriptions/subscribe without keys returns 400
(pass) Push Subscriptions - Subscribe > DELETE /push-subscriptions/subscribe removes subscription
(pass) Push Subscriptions - Status > GET /push-subscriptions/status returns subscription info
(pass) Push Subscriptions - Settings > GET /push-subscriptions/settings returns preferences
(pass) Push Subscriptions - Settings > PUT /push-subscriptions/settings updates preferences
(pass) Push Subscriptions - Test & Send > POST /push-subscriptions/test sends test notification
(pass) Push Subscriptions - Test & Send > POST /push-subscriptions/send with message
(pass) Push Subscriptions - Delete Specific > DELETE /push-subscriptions/subscription/:id for nonexistent
(pass) Push Subscriptions - Auth Guards > GET /push-subscriptions/status without auth returns 401
(pass) Push Subscriptions - Auth Guards > POST /push-subscriptions/subscribe without auth returns 401
(pass) Push Subscriptions - Auth Guards > PUT /push-subscriptions/settings without auth returns 401

src\tests\pushSubscriptions.test.js:
Running Push Subscriptions API tests...
(pass) Push Subscriptions - Subscribe > POST /push-subscriptions/subscribe - should create subscription
(pass) Push Subscriptions - Subscribe > POST /push-subscriptions/subscribe - should validate subscription object
(pass) Push Subscriptions - Status > GET /push-subscriptions/status - should return subscription status
(pass) Push Subscriptions - Settings > GET /push-subscriptions/settings - should return notification settings
(pass) Push Subscriptions - Settings > PUT /push-subscriptions/settings - should update settings
(pass) Push Subscriptions - Unsubscribe > DELETE /push-subscriptions/subscribe - should unsubscribe
(pass) Push Subscriptions - VAPID Key > GET /push-subscriptions/vapid-public-key - should return VAPID key
(pass) Push Subscriptions - Authentication > POST /push-subscriptions - should require auth

src\tests\qrAnalytics-expanded.test.js:
(pass) QR Analytics - Dashboard > GET /qr-analytics/dashboard returns analytics overview
(pass) QR Analytics - Track Scans > POST /qr-analytics/track requires qr_type and reference_id
(pass) QR Analytics - Track Scans > POST /qr-analytics/track rejects invalid qr_type
(pass) QR Analytics - Track Scans > POST /qr-analytics/track records listing scan
(pass) QR Analytics - Track Scans > POST /qr-analytics/track records warehouse-bin scan [15.00ms]
(pass) QR Analytics - Track Scans > POST /qr-analytics/track increments count on repeat scan
(pass) QR Analytics - Item Stats > GET /qr-analytics/item/:id returns 404 for nonexistent item
(pass) QR Analytics - Warehouse Bins > GET /qr-analytics/warehouse-bins returns bin list
(pass) QR Analytics - Warehouse Bins > POST /qr-analytics/warehouse-bins requires bin_code
(pass) QR Analytics - Warehouse Bins > POST /qr-analytics/warehouse-bins creates bin
(pass) QR Analytics - Warehouse Bins > POST /qr-analytics/warehouse-bins rejects duplicate bin_code
(pass) QR Analytics - Warehouse Bins > PUT /qr-analytics/warehouse-bins/:id updates bin
(pass) QR Analytics - Warehouse Bins > PUT /qr-analytics/warehouse-bins/:id rejects invalid status
(pass) QR Analytics - Warehouse Bins > PUT /qr-analytics/warehouse-bins/:id requires fields
(pass) QR Analytics - Warehouse Bins > PUT nonexistent bin returns 404
(pass) QR Analytics - Warehouse Bins > GET /qr-analytics/warehouse-bins/:id/items returns items in bin
(pass) QR Analytics - Warehouse Bins > POST /qr-analytics/warehouse-bins/:id/print-label generates label
(pass) QR Analytics - Warehouse Bins > DELETE /qr-analytics/warehouse-bins/:id deletes bin
(pass) QR Analytics - Warehouse Bins > DELETE nonexistent bin returns 404

src\tests\qrAnalytics-gaps-expanded.test.js:
(pass) QR Analytics — Dashboard & Tracking > GET /qr-analytics/dashboard returns engagement data
(pass) QR Analytics — Dashboard & Tracking > POST /qr-analytics/track records a QR scan
(pass) QR Analytics — Dashboard & Tracking > GET /qr-analytics/item/test-item returns scan stats
(pass) QR Analytics — Warehouse Bins > GET /qr-analytics/warehouse-bins returns bin list
(pass) QR Analytics — Warehouse Bins > POST /qr-analytics/warehouse-bins creates bin
No bin created
(pass) QR Analytics — Warehouse Bins > PUT /qr-analytics/warehouse-bins/:id updates bin
No bin created
(pass) QR Analytics — Warehouse Bins > GET /qr-analytics/warehouse-bins/:id/items returns items
No bin created
(pass) QR Analytics — Warehouse Bins > POST /qr-analytics/warehouse-bins/:id/print-label generates label
No bin created
(pass) QR Analytics — Warehouse Bins > DELETE /qr-analytics/warehouse-bins/:id deletes bin
(pass) QR Analytics — Warehouse Bins > DELETE /qr-analytics/warehouse-bins/nonexistent returns 404
(pass) QR Analytics — Warehouse Bins > GET /qr-analytics/warehouse-bins/nonexistent/items returns error
(pass) QR Analytics — Auth Guard > GET /qr-analytics/dashboard requires auth

src\tests\qrAnalytics-gaps.test.js:
(pass) QR Analytics warehouse bin operations > DELETE /qr-analytics/warehouse-bins/:id for nonexistent bin
(pass) QR Analytics warehouse bin operations > DELETE /qr-analytics/warehouse-bins/:id after creating a bin
(pass) QR Analytics warehouse bin operations > GET /qr-analytics/warehouse-bins/:id/items for nonexistent bin
(pass) QR Analytics warehouse bin operations > POST /qr-analytics/warehouse-bins/:id/print-label for nonexistent bin
(pass) QR Analytics warehouse bin operations > POST /qr-analytics/warehouse-bins/:id/print-label after creating a bin

src\tests\qrAnalytics.test.js:
(pass) GET /api/qr-analytics/dashboard > rejects unauthenticated request
(pass) GET /api/qr-analytics/dashboard > returns dashboard data when authenticated
(pass) POST /api/qr-analytics/track > rejects unauthenticated request
(pass) POST /api/qr-analytics/track > records scan event when authenticated with valid body
(pass) GET /api/qr-analytics/warehouse-bins > rejects unauthenticated request
(pass) GET /api/qr-analytics/warehouse-bins > returns warehouse bins list when authenticated
(pass) POST /api/qr-analytics/warehouse-bins > rejects unauthenticated request
(pass) POST /api/qr-analytics/warehouse-bins > creates warehouse bin when authenticated with valid body
(pass) GET /api/qr-analytics/item/:id > rejects unauthenticated request
(pass) GET /api/qr-analytics/item/:id > returns item QR data when authenticated

src\tests\rateLimitDashboard-expanded.test.js:
(pass) Rate Limit Dashboard - Auth Guard > GET /rate-limits/stats without auth returns 401
(pass) Rate Limit Dashboard - Auth Guard > GET /rate-limits/alerts without auth returns 401
(pass) Rate Limit Dashboard - Stats > GET /rate-limits/stats returns stats or 403
(pass) Rate Limit Dashboard - Blocked IPs > GET /rate-limits/blocked-ips returns list or 403
(pass) Rate Limit Dashboard - Blocked Users > GET /rate-limits/blocked-users returns list or 403
(pass) Rate Limit Dashboard - History > GET /rate-limits/history returns history or 403
(pass) Rate Limit Dashboard - History > GET /rate-limits/history?hours=1 with custom hours
(pass) Rate Limit Dashboard - Reset > POST /rate-limits/reset without auth returns 401
(pass) Rate Limit Dashboard - Reset > POST /rate-limits/reset resets counters or 403
(pass) Rate Limit Dashboard - Alerts > GET /rate-limits/alerts returns alerts or 403

src\tests\rateLimitDashboard.test.js:
(pass) GET /api/rate-limits/stats > unauthenticated returns 401 or 403
(pass) GET /api/rate-limits/stats > regular user returns 403 (enterprise only)
(pass) GET /api/rate-limits/blocked-ips > unauthenticated returns 401 or 403
(pass) GET /api/rate-limits/blocked-ips > regular user returns 403 (enterprise only)
(pass) GET /api/rate-limits/blocked-users > unauthenticated returns 401 or 403
(pass) GET /api/rate-limits/blocked-users > regular user returns 403 (enterprise only)
(pass) GET /api/rate-limits/history > unauthenticated returns 401 or 403
(pass) GET /api/rate-limits/history > regular user returns 403 (enterprise only)
(pass) GET /api/rate-limits/alerts > unauthenticated returns 401 or 403
(pass) GET /api/rate-limits/alerts > regular user returns 403 (enterprise only)
(pass) POST /api/rate-limits/reset > unauthenticated returns 401 or 403
(pass) POST /api/rate-limits/reset > regular user returns 403 (enterprise only)

src\tests\receiptParser.test.js:
(pass) Receipt Parser - Upload > POST /receipts/upload - should parse receipt image [1375.00ms]
(pass) Receipt Parser - Upload > POST /receipts/upload - should fail without image data
(pass) Receipt Parser - Upload > POST /receipts/upload - should fail with invalid mime type
(pass) Receipt Parser - Queue > GET /receipts/queue - should return receipt queue
(pass) Receipt Parser - Queue > GET /receipts - should return receipt list
(pass) Receipt Parser - Queue > GET /receipts/queue?status=parsed - should filter by status
(pass) Receipt Parser - Queue > GET /receipts/queue?type=purchase - should filter by type
(pass) Receipt Parser - Get Single > GET /receipts/:id - should return receipt details
(pass) Receipt Parser - Get Single > GET /receipts/:id - should return 404 for non-existent receipt
(pass) Receipt Parser - Update > PUT /receipts/:id - should update parsed data
(pass) Receipt Parser - Update > PUT /receipts/:id - should return 404 for non-existent receipt
(pass) Receipt Parser - Process > POST /receipts/:id/process - should process receipt
(pass) Receipt Parser - Process > POST /receipts/:id/process - should return 404 for non-existent receipt
(pass) Receipt Parser - Ignore > POST /receipts/:id/ignore - should mark receipt as ignored
(pass) Receipt Parser - Ignore > POST /receipts/:id/ignore - should return 404 for non-existent receipt
(pass) Receipt Parser - Reparse > POST /receipts/:id/reparse - should return 404 for non-existent receipt
(pass) Receipt Parser - Vendors > GET /receipts/vendors - should return vendor list
(pass) Receipt Parser - Vendors > POST /receipts/vendors - should create vendor
(pass) Receipt Parser - Vendors > POST /receipts/vendors - should fail without name
(pass) Receipt Parser - Vendors > PUT /receipts/vendors/:id - should update vendor
(pass) Receipt Parser - Vendors > PUT /receipts/vendors/:id - should return 404 for non-existent vendor
(pass) Receipt Parser - Vendors > DELETE /receipts/vendors/:id - should delete vendor
(pass) Receipt Parser - Vendors > DELETE /receipts/vendors/:id - should return 404 for non-existent vendor
(pass) Receipt Parser - Delete > DELETE /receipts/:id - should delete receipt
(pass) Receipt Parser - Delete > DELETE /receipts/:id - should return 404 for non-existent receipt

src\tests\recentlyDeleted-expanded.test.js:
(pass) Recently Deleted - Auth Guard > GET /recently-deleted without auth returns 401
(pass) Recently Deleted - List > GET /recently-deleted returns items with pagination [15.00ms]
(pass) Recently Deleted - List > GET /recently-deleted?type=inventory filters by type
(pass) Recently Deleted - List > GET /recently-deleted?page=1&limit=5 paginates
(pass) Recently Deleted - Stats > GET /recently-deleted/stats returns deletion stats
(pass) Recently Deleted - Restore > POST /recently-deleted/:id/restore returns 404 for nonexistent
(pass) Recently Deleted - Restore > POST /recently-deleted/bulk-restore requires item_ids
(pass) Recently Deleted - Permanent Delete > DELETE /recently-deleted/:id returns 404 for nonexistent
(pass) Recently Deleted - Permanent Delete > POST /recently-deleted/bulk-delete requires item_ids
(pass) Recently Deleted - Cleanup > POST /recently-deleted/cleanup triggers old item cleanup

src\tests\recentlyDeleted-gaps.test.js:
(pass) Recently Deleted — Filter Combinations > GET /recently-deleted with reason filter
(pass) Recently Deleted — Filter Combinations > GET /recently-deleted with search filter
(pass) Recently Deleted — Filter Combinations > GET /recently-deleted with date range
(pass) Recently Deleted — Filter Combinations > GET /recently-deleted with combined filters
(pass) Recently Deleted — Filter Combinations > GET /recently-deleted with large limit is capped
(pass) Recently Deleted — Stats Shape > GET /recently-deleted/stats returns detailed shape
(pass) Recently Deleted — Bulk Operations > POST /recently-deleted/bulk-restore with empty ids
(pass) Recently Deleted — Bulk Operations > DELETE /recently-deleted/bulk-delete with empty ids returns error
(pass) Recently Deleted — Bulk Operations > POST /recently-deleted/cleanup runs cleanup [16.00ms]

src\tests\recentlyDeleted.test.js:
(pass) recentlyDeleted routes > should require authentication
(pass) recentlyDeleted routes > GET /recently-deleted/ responds
(pass) recentlyDeleted routes > GET /recently-deleted/stats responds

src\tests\relisting-expanded.test.js:
(pass) Relisting - Rules CRUD Shape Validation > GET /relisting/rules returns array
(pass) Relisting - Rules CRUD Shape Validation > POST /relisting/rules creates rule with required fields
(pass) Relisting - Rules CRUD Shape Validation > POST /relisting/rules without name returns error
(pass) Relisting - Rules CRUD Shape Validation > POST /relisting/rules with negative stale_days
(pass) Relisting - Rules CRUD Shape Validation > GET /relisting/rules/:id for nonexistent returns 404
(pass) Relisting - Rules CRUD Shape Validation > DELETE /relisting/rules/:id for nonexistent returns 404
(pass) Relisting - Stale Listings > GET /relisting/stale returns stale listing data [16.00ms]
(pass) Relisting - Stale Listings > GET /relisting/stale with days filter
(pass) Relisting - Queue Operations > GET /relisting/queue returns queue items
(pass) Relisting - Queue Operations > POST /relisting/queue adds items to queue
(pass) Relisting - Queue Operations > POST /relisting/process processes queue
(pass) Relisting - Queue Operations > DELETE /relisting/queue/:id removes item
(pass) Relisting - Performance & Scheduling > GET /relisting/performance returns stats
(pass) Relisting - Performance & Scheduling > POST /relisting/preview-price returns price preview
(pass) Relisting - Performance & Scheduling > POST /relisting/auto-schedule sets up schedule
(pass) Relisting - Performance & Scheduling > GET /relisting/schedule-preview returns preview
(pass) Relisting - Auth Guards > GET /relisting/rules without auth returns 401
(pass) Relisting - Auth Guards > POST /relisting/rules without auth returns 401

src\tests\relisting.test.js:
Running Relisting API tests...
(pass) Relisting - Rules List > GET /relisting/rules - should return relisting rules
(pass) Relisting - Create Rule > POST /relisting/rules - should create relisting rule
(pass) Relisting - Create Rule > POST /relisting/rules - should require name
(pass) Relisting - Get Single Rule > GET /relisting/rules/:id - should return rule details
(pass) Relisting - Update Rule > PUT /relisting/rules/:id - should update rule
(pass) Relisting - Stale Listings > GET /relisting/stale - should return stale listings [16.00ms]
(pass) Relisting - Stale Listings > GET /relisting/stale?days=30 - should filter by days
(pass) Relisting - Execute > POST /relisting/execute - should execute relisting
(pass) Relisting - Preview > POST /relisting/preview - should preview relisting changes
(pass) Relisting - Delete Rule > DELETE /relisting/rules/:id - should delete rule
(pass) Relisting - Authentication > GET /relisting/rules - should require auth

src\tests\reports-gaps.test.js:
(pass) Reports run > POST /reports/:id/run nonexistent report
(pass) Reports P&L > GET /reports/pnl returns profit and loss data
(pass) Reports query > POST /reports/query runs ad-hoc query
(pass) Reports schedule > GET /reports/:id/schedule nonexistent report
(pass) Reports schedule > POST /reports/:id/schedule nonexistent report
(pass) Reports schedule > DELETE /reports/:id/schedule nonexistent report
(pass) Reports templates > GET /reports/templates returns available templates

src\tests\reports.test.js:
(pass) Reports - List Reports > GET /reports - should return report list
(pass) Reports - List Reports > GET /reports - should require authentication
(pass) Reports - Widget Types > GET /reports/widgets - should return widget types
(pass) Reports - Widget Types > GET /reports/widgets - should have expected widget types [16.00ms]
(pass) Reports - Create Report > POST /reports - should create report
(pass) Reports - Create Report > POST /reports - should fail without name
(pass) Reports - Create Report > POST /reports - should create report with empty widgets
(pass) Reports - Get Report > GET /reports/:id - should return report with widget data
(pass) Reports - Get Report > GET /reports/:id?startDate=2024-01-01&endDate=2024-12-31 - should apply date range
(pass) Reports - Get Report > GET /reports/:id - should return 404 for non-existent report
(pass) Reports - Update Report > PUT /reports/:id - should update report
(pass) Reports - Update Report > PUT /reports/:id - should update widgets
(pass) Reports - Update Report > PUT /reports/:id - should return 404 for non-existent report
(pass) Reports - Generate On-Demand > POST /reports/generate - should generate widget data
(pass) Reports - Generate On-Demand > POST /reports/generate - should work with empty widgets
(pass) Reports - Generate On-Demand > POST /reports/generate - should use default date range
(pass) Reports - Widget Data Types > POST /reports/generate - revenue_chart should return line data
(pass) Reports - Widget Data Types > POST /reports/generate - sales_by_platform should return pie data
(pass) Reports - Widget Data Types > POST /reports/generate - inventory_value should return stat data
(pass) Reports - Widget Data Types > POST /reports/generate - top_sellers should return table data
(pass) Reports - Delete Report > DELETE /reports/:id - should delete report

src\tests\roadmap-expanded.test.js:
(pass) Roadmap - Auth Guard > GET /roadmap without auth returns 401
(pass) Roadmap - List Features > GET /roadmap returns features list
(pass) Roadmap - List Features > GET /roadmap?status=planned filters by status
(pass) Roadmap - List Features > GET /roadmap?category=integration filters by category
(pass) Roadmap - Get Single Feature > GET /roadmap/nonexistent returns 404
(pass) Roadmap - Vote > POST /roadmap/vote/nonexistent returns 404
(pass) Roadmap - Vote > POST /roadmap/vote without auth returns 401
(pass) Roadmap - Admin Create > POST /roadmap without admin role returns 403
(pass) Roadmap - Admin Create > POST /roadmap without title returns 400 or 403
(pass) Roadmap - Changelog RSS > GET /roadmap/changelog/rss returns XML

src\tests\roadmap.test.js:
(pass) Roadmap - Auth Guard > GET /roadmap is public (no auth needed)
(pass) Roadmap - List Features > GET /roadmap returns features array
(pass) Roadmap - List Features > GET /roadmap?status=planned filters by status
(pass) Roadmap - List Features > GET /roadmap?category=features filters by category
(pass) Roadmap - Get Single > GET /roadmap/:id returns feature if exists
(pass) Roadmap - Get Single > GET /roadmap/nonexistent returns 404
(pass) Roadmap - Vote > POST /roadmap/vote/:id votes for feature
(pass) Roadmap - Vote > POST /roadmap/vote/:id toggles vote off
(pass) Roadmap - Vote > POST /roadmap/vote/nonexistent returns 404
(pass) Roadmap - Admin Create > POST /roadmap without admin returns 403
(pass) Roadmap - Changelog RSS > GET /roadmap/changelog/rss returns 200
(pass) Roadmap - Changelog RSS > GET /roadmap/changelog/rss returns XML-like content

src\tests\routes-stub-coverage.test.js:
(pass) Routes Stub Coverage — AI > ai: GET /ai/sourcing-suggestions without auth returns 401
(pass) Routes Stub Coverage — AI > ai: GET /ai/sourcing-suggestions with auth returns 200 or 403 (tier-gated)
(pass) Routes Stub Coverage — AI > ai: POST /ai/analyze-listing-image without body returns 400 or 403
(pass) Routes Stub Coverage — AI > ai: POST /ai/generate-title without body returns 400 or 403
(pass) Routes Stub Coverage — AI > ai: POST /ai/predict-price without body returns 400 or 403
(pass) Routes Stub Coverage — AI > ai: unknown endpoint returns 404
(pass) Routes Stub Coverage — Batch Photo > batch-photo: GET /batch-photo/jobs without auth returns 401
(pass) Routes Stub Coverage — Batch Photo > batch-photo: GET /batch-photo/jobs with auth returns 200
(pass) Routes Stub Coverage — Batch Photo > batch-photo: GET /batch-photo/presets with auth returns 200
(pass) Routes Stub Coverage — Batch Photo > batch-photo: POST /batch-photo/jobs without required fields returns 400
(pass) Routes Stub Coverage — Feedback > feedback: GET /feedback/analytics without auth returns 401
(pass) Routes Stub Coverage — Feedback > feedback: GET /feedback/trending with auth returns 200
(pass) Routes Stub Coverage — Feedback > feedback: GET /feedback/analytics with auth returns 200
(pass) Routes Stub Coverage — Feedback > feedback: POST /feedback with missing fields returns 400 [16.00ms]
(pass) Routes Stub Coverage — Feedback > feedback: POST /feedback with valid data returns 200 or 201
(pass) Routes Stub Coverage — Financials > financials: GET /financials/purchases without auth returns 401
(pass) Routes Stub Coverage — Financials > financials: GET /financials/purchases with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/accounts with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/transactions with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/statements with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/profit-loss with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/categorization-rules with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/recurring-templates with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/platform-fees with auth returns 200
(pass) Routes Stub Coverage — Financials > financials: GET /financials/platform-fees/summary with auth returns 200
(pass) Routes Stub Coverage — Image Bank > image-bank: GET /image-bank without auth returns 401
(pass) Routes Stub Coverage — Image Bank > image-bank: GET /image-bank with auth returns 200
(pass) Routes Stub Coverage — Image Bank > image-bank: GET /image-bank/folders with auth returns 200
(pass) Routes Stub Coverage — Image Bank > image-bank: GET /image-bank/cloudinary-status with auth returns 200
(pass) Routes Stub Coverage — Image Bank > image-bank: GET /image-bank/storage-stats with auth returns 200
(pass) Routes Stub Coverage — Image Bank > image-bank: GET /image-bank/search without query returns 200 or 400
(pass) Routes Stub Coverage — Image Bank > image-bank: POST /image-bank/upload without images returns 400
(pass) Routes Stub Coverage — Inventory > inventory: GET /inventory without auth returns 401
(pass) Routes Stub Coverage — Inventory > inventory: GET /inventory with auth returns 200
(pass) Routes Stub Coverage — Inventory > inventory: GET /inventory with pagination returns 200
(pass) Routes Stub Coverage — Inventory > inventory: GET /inventory with status filter returns 200
(pass) Routes Stub Coverage — Inventory > inventory: GET /inventory with search returns 200
(pass) Routes Stub Coverage — Offline Sync > offline-sync: GET /offline-sync/queue without auth returns 401
(pass) Routes Stub Coverage — Offline Sync > offline-sync: GET /offline-sync/queue with auth returns 200
(pass) Routes Stub Coverage — Offline Sync > offline-sync: GET /offline-sync/status with auth returns 200
(pass) Routes Stub Coverage — Offline Sync > offline-sync: POST /offline-sync/queue without action returns 400
(pass) Routes Stub Coverage — Offline Sync > offline-sync: POST /offline-sync/queue with valid payload returns 200 or 
201
(pass) Routes Stub Coverage — Recently Deleted > recently-deleted: GET /recently-deleted/ without auth returns 401
(pass) Routes Stub Coverage — Recently Deleted > recently-deleted: GET /recently-deleted/ with auth returns 200
(pass) Routes Stub Coverage — Recently Deleted > recently-deleted: GET /recently-deleted/stats with auth returns 200
(pass) Routes Stub Coverage — Recently Deleted > recently-deleted: GET /recently-deleted/ with type filter returns 200
(pass) Routes Stub Coverage — Recently Deleted > recently-deleted: GET /recently-deleted/ with pagination returns 200 
[15.00ms]
(pass) Routes Stub Coverage — Relisting > relisting: GET /relisting/rules without auth returns 401
(pass) Routes Stub Coverage — Relisting > relisting: GET /relisting/rules with auth returns 200
(pass) Routes Stub Coverage — Relisting > relisting: POST /relisting/rules with valid data returns 200 or 201
(pass) Routes Stub Coverage — Relisting > relisting: POST /relisting/rules without name returns 400
(pass) Routes Stub Coverage — Reports > reports: GET /reports without auth returns 401
(pass) Routes Stub Coverage — Reports > reports: GET /reports with auth returns 200
(pass) Routes Stub Coverage — Reports > reports: GET /reports/widgets with auth returns 200
(pass) Routes Stub Coverage — Reports > reports: POST /reports with valid data returns 200 or 201
(pass) Routes Stub Coverage — Shipping Labels > shipping-labels-mgmt: GET /shipping-labels-mgmt/ without auth returns 
401
(pass) Routes Stub Coverage — Shipping Labels > shipping-labels-mgmt: GET /shipping-labels-mgmt/ with auth returns 200
(pass) Routes Stub Coverage — Shipping Labels > shipping-labels-mgmt: GET /shipping-labels-mgmt/addresses with auth 
returns 200
(pass) Routes Stub Coverage — Shipping Labels > shipping-labels-mgmt: GET /shipping-labels-mgmt/batches with auth 
returns 200
(pass) Routes Stub Coverage — Shipping Labels > shipping-labels-mgmt: GET /shipping-labels-mgmt/stats with auth 
returns 200
(pass) Routes Stub Coverage — Size Charts > size-charts: GET /size-charts/ without auth returns 401
(pass) Routes Stub Coverage — Size Charts > size-charts: GET /size-charts/ with auth returns 200 or 500
(pass) Routes Stub Coverage — Size Charts > size-charts: GET /size-charts/brands with auth returns 200 or 500
(pass) Routes Stub Coverage — Size Charts > size-charts: GET /size-charts/availability with auth returns 200 or 500
(pass) Routes Stub Coverage — Size Charts > size-charts: GET /size-charts/convert with params returns 200 or 400 or 500
(pass) Routes Stub Coverage — Size Charts > size-charts: POST /size-charts with valid data returns 200, 201, or 500 
[16.00ms]
(pass) Routes Stub Coverage — Route Registration Verification > ai route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > batch-photo route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > feedback route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > financials route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > image-bank route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > inventory route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > offline-sync route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > recently-deleted route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > relisting route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > reports route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > shipping-labels-mgmt route is registered and reachable
(pass) Routes Stub Coverage — Route Registration Verification > size-charts route is registered and reachable

src\tests\rum.test.js:
(pass) RUM - POST /api/monitoring/rum > accepts valid metric batch
(pass) RUM - POST /api/monitoring/rum > rejects missing sessionId
(pass) RUM - POST /api/monitoring/rum > rejects empty metrics array
(pass) RUM - POST /api/monitoring/rum > rejects missing metrics field
(pass) RUM - POST /api/monitoring/rum > caps batch at 50 metrics
(pass) RUM - POST /api/monitoring/rum > filters out invalid metric names
(pass) RUM - GET /api/monitoring/rum/summary > requires authentication
(pass) RUM - GET /api/monitoring/rum/summary > requires enterprise tier [16.00ms]
(pass) Monitoring Router - mounted endpoints > GET /api/monitoring/health returns 200
(pass) Monitoring Router - mounted endpoints > GET /api/monitoring/metrics requires auth
(pass) Monitoring Router - mounted endpoints > GET /api/monitoring/alerts requires auth
(pass) Monitoring Router - mounted endpoints > GET /api/monitoring/errors requires auth

src\tests\sales.test.js:
Running Sales API tests...
(pass) Sales - List > GET /sales - should return sales list
(pass) Sales - List > GET /sales?platform=poshmark - should filter by platform
(pass) Sales - List > GET /sales?status=shipped - should filter by status
(pass) Sales - List > GET /sales - should support date range filtering
(pass) Sales - List > GET /sales - should support pagination
(pass) Sales - Create > POST /sales - should create a sale [16.00ms]
(pass) Sales - Create > POST /sales - should require platform
(pass) Sales - Create > POST /sales - should require sale price
(pass) Sales - Get Single > GET /sales/:id - should return sale details
(pass) Sales - Get Single > GET /sales/:id - should return 404 for non-existent sale
(pass) Sales - Update > PUT /sales/:id - should update sale
(pass) Sales - Statistics > GET /sales/stats - should return sales statistics
(pass) Sales - Authentication > GET /sales - should require auth
(pass) Sales - Authentication > POST /sales - should require auth

src\tests\salesEnhancements-expanded.test.js:
(pass) Sales Enhancements - Auth Guard > GET /sales-tools/tax-nexus without auth returns 401
(pass) Sales Enhancements - Auth Guard > GET /sales-tools/buyers without auth returns 401
(pass) Sales Enhancements - Tax Nexus > GET /sales-tools/tax-nexus returns nexus data
(pass) Sales Enhancements - Tax Nexus > POST /sales-tools/tax-nexus/calculate recalculates nexus
(pass) Sales Enhancements - Tax Nexus > GET /sales-tools/tax-nexus/alerts returns threshold alerts
(pass) Sales Enhancements - Tax Nexus > PUT /sales-tools/tax-nexus/CA/registered marks state registered
(pass) Sales Enhancements - Buyer Profiles > GET /sales-tools/buyers returns buyer list
(pass) Sales Enhancements - Buyer Profiles > GET /sales-tools/buyers?platform=ebay filters by platform
(pass) Sales Enhancements - Buyer Profiles > GET /sales-tools/buyers?blocked=true filters blocked
(pass) Sales Enhancements - Buyer Profiles > POST /sales-tools/buyers requires buyer_username and platform
(pass) Sales Enhancements - Buyer Profiles > POST /sales-tools/buyers creates buyer profile
(pass) Sales Enhancements - Buyer Profiles > GET /sales-tools/buyers/:id returns buyer with history [16.00ms]
(pass) Sales Enhancements - Buyer Profiles > GET /sales-tools/buyers/:id returns 404 for nonexistent
(pass) Sales Enhancements - Buyer Profiles > PUT /sales-tools/buyers/:id requires at least one field
(pass) Sales Enhancements - Buyer Profiles > PUT /sales-tools/buyers/:id updates profile
(pass) Sales Enhancements - Buyer Profiles > POST /sales-tools/buyers/:id/block toggles block
(pass) Sales Enhancements - Buyer Profiles > POST /sales-tools/buyers/nonexistent/block returns 404
(pass) Sales Enhancements - Flagged Buyers > GET /sales-tools/buyers/flagged returns flagged list
(pass) Sales Enhancements - Buyer Sync > POST /sales-tools/buyers/sync syncs buyer profiles from orders

src\tests\salesEnhancements.test.js:
(pass) GET /api/sales-tools/tax-nexus > rejects unauthenticated request
(pass) GET /api/sales-tools/tax-nexus > returns tax nexus data when authenticated
(pass) POST /api/sales-tools/tax-nexus/calculate > rejects unauthenticated request
(pass) POST /api/sales-tools/tax-nexus/calculate > calculates tax nexus when authenticated
(pass) GET /api/sales-tools/tax-nexus/alerts > rejects unauthenticated request
(pass) GET /api/sales-tools/tax-nexus/alerts > returns alerts when authenticated
(pass) GET /api/sales-tools/buyers > rejects unauthenticated request
(pass) GET /api/sales-tools/buyers > returns buyers list when authenticated
(pass) GET /api/sales-tools/buyers > accepts platform filter param
(pass) POST /api/sales-tools/buyers > rejects unauthenticated request
(pass) POST /api/sales-tools/buyers > creates buyer record when authenticated with valid body
(pass) GET /api/sales-tools/buyers/flagged > rejects unauthenticated request
(pass) GET /api/sales-tools/buyers/flagged > returns flagged buyers when authenticated
(pass) POST /api/sales-tools/buyers/sync > rejects unauthenticated request
(pass) POST /api/sales-tools/buyers/sync > triggers sync when authenticated

src\tests\searchAnalytics-expanded.test.js:
(pass) Search Analytics - Auth Guard > POST /search-analytics/track without auth returns 401
(pass) Search Analytics - Auth Guard > GET /search-analytics/dashboard without auth returns 401
(pass) Search Analytics - Track Search > POST /search-analytics/track records search term
(pass) Search Analytics - Track Search > POST /search-analytics/track without term returns 400
(pass) Search Analytics - Track Search > POST /search-analytics/track with empty term returns 400
(pass) Search Analytics - Track Search > POST /search-analytics/track with term over 500 chars returns 400
(pass) Search Analytics - Track Search > POST /search-analytics/track increments existing term count
(pass) Search Analytics - Popular > GET /search-analytics/popular returns popular searches
(pass) Search Analytics - Popular > GET /search-analytics/popular?limit=3 respects limit
(pass) Search Analytics - No Results > GET /search-analytics/no-results returns zero-result searches
(pass) Search Analytics - Dashboard > GET /search-analytics/dashboard returns aggregated stats

src\tests\searchAnalytics.test.js:
(pass) POST /api/search-analytics/track > rejects unauthenticated request
(pass) POST /api/search-analytics/track > tracks search term with valid body
(pass) POST /api/search-analytics/track > rejects empty body
(pass) GET /api/search-analytics/popular > rejects unauthenticated request
(pass) GET /api/search-analytics/popular > returns popular search terms
(pass) GET /api/search-analytics/popular > accepts limit query parameter
(pass) GET /api/search-analytics/no-results > rejects unauthenticated request
(pass) GET /api/search-analytics/no-results > returns searches with no results
(pass) GET /api/search-analytics/dashboard > rejects unauthenticated request
(pass) GET /api/search-analytics/dashboard > returns dashboard analytics data

src\tests\security-expanded.test.js:
(pass) Security Expanded - Auth Guards > POST /security/send-verification without auth returns 401
(pass) Security Expanded - Auth Guards > GET /security/mfa/status without auth returns 401
(pass) Security Expanded - Auth Guards > GET /security/events without auth returns 401
(pass) Security Expanded - Auth Guards > POST /security/mfa/disable without auth returns 401
(pass) Security Expanded - Auth Guards > POST /security/mfa/regenerate-codes without auth returns 401
(pass) Security Expanded - Send Verification > POST /security/send-verification returns success or already-verified
(pass) Security Expanded - Verify Email > POST /security/verify-email without token returns 400
(pass) Security Expanded - Verify Email > POST /security/verify-email with invalid token returns 400 [16.00ms]
(pass) Security Expanded - Forgot Password > POST /security/forgot-password without email returns 400
(pass) Security Expanded - Forgot Password > POST /security/forgot-password with nonexistent email returns 200 
(anti-enumeration)
(pass) Security Expanded - Reset Password > POST /security/reset-password without token or password returns 400
(pass) Security Expanded - Reset Password > POST /security/reset-password with weak password returns 400
(pass) Security Expanded - Reset Password > POST /security/reset-password with invalid token returns 400
(pass) Security Expanded - MFA Disable > POST /security/mfa/disable without password returns 400
(pass) Security Expanded - MFA Disable > POST /security/mfa/disable when MFA not enabled returns 400
(pass) Security Expanded - MFA Regenerate Codes > POST /security/mfa/regenerate-codes without password returns 400
(pass) Security Expanded - MFA Regenerate Codes > POST /security/mfa/regenerate-codes when MFA not enabled returns 400
(pass) Security Expanded - MFA Status > GET /security/mfa/status returns shape for fresh user
(pass) Security Expanded - Events > GET /security/events returns shape with arrays

src\tests\security-regression.test.js:
(pass) Webhook Secret Enforcement > should reject webhook without signature
(pass) Webhook Secret Enforcement > should reject webhook with invalid signature
(pass) Webhook Secret Enforcement > should reject unregistered webhook source
(pass) Automation Cron Validation > should reject invalid cron schedule
(pass) Automation Cron Validation > should reject cron with too few fields
(pass) Automation Cron Validation > should accept valid cron schedule
(pass) Custom Query Parameterization > should block non-SELECT statements
(pass) Custom Query Parameterization > should block SQL comments
(pass) Custom Query Parameterization > should block UNION injection
(pass) Custom Query Parameterization > should block disallowed tables
(pass) Inventory Import IDOR Protection > should return 404 for non-existent job rows [15.00ms]
(pass) Limit/Offset Bounds Checking > should handle negative offset gracefully
(pass) Limit/Offset Bounds Checking > should cap excessive limit

src\tests\security.test.js:
Running VaultLister Security tests...
Make sure the server is running: bun run dev
(pass) SQL Injection Prevention > Login should safely handle SQL injection in email field
(pass) SQL Injection Prevention > Login should safely handle SQL injection in password field
(pass) SQL Injection Prevention > Inventory search should sanitize SQL injection attempts [31.00ms]
(pass) SQL Injection Prevention > Inventory creation should handle SQL injection in title
(pass) XSS Prevention > Inventory title should store XSS payloads safely [32.00ms]
(pass) XSS Prevention > User registration should handle XSS in username
(pass) JWT Security > Should reject requests without token
(pass) JWT Security > Should reject malformed tokens
(pass) JWT Security > Should reject token without Bearer prefix
(pass) JWT Security > Should reject empty Authorization header
(pass) JWT Security > Should reject token with wrong prefix
(pass) Password Security > Should reject passwords shorter than 6 characters
(pass) Password Security > Should hash passwords (login works after registration) [453.00ms]
(pass) Password Security > Should reject incorrect password for valid user [234.00ms]
(pass) Authorization > Should require authentication for inventory endpoints
(pass) Authorization > Should require authentication for analytics endpoints
(pass) Authorization > Should require authentication for automations endpoints
(pass) Authorization > Authenticated user can access their own data
(pass) Input Validation > Should reject inventory with missing required fields
(pass) Input Validation > Should reject inventory with invalid price
(pass) Input Validation > Should handle extremely long input
(pass) Input Validation > Should handle unicode and special characters
(pass) Input Validation > Should handle null bytes
(pass) Rate Limiting Preparation > Server should handle rapid sequential requests [47.00ms]
(pass) Error Handling > Should return JSON error for invalid JSON body
(pass) Error Handling > Should return 404 for non-existent inventory item
(pass) Error Handling > Should handle missing Content-Type header
(pass) CSRF Protection > Should provide CSRF token via /api/csrf-token
(pass) CSRF Protection > POST without CSRF token should be rejected
(pass) CSRF Protection > POST with valid CSRF token should succeed
(pass) CSRF Protection > POST with reused CSRF token should be rejected
(pass) CSRF Protection > POST with invalid CSRF token should be rejected

src\tests\service-analytics-unit.test.js:
(pass) analyticsService > anonymizeIp > anonymizes IPv4 by zeroing last octet
(pass) analyticsService > anonymizeIp > anonymizes another IPv4
(pass) analyticsService > anonymizeIp > anonymizes IPv6 by zeroing last 80 bits
(pass) analyticsService > anonymizeIp > returns null for null input
(pass) analyticsService > anonymizeIp > returns null for empty string
(pass) analyticsService > anonymizeIp > returns null for invalid input
(pass) analyticsService > track > queues an event
(pass) analyticsService > track > respects DNT header when provided
(pass) analyticsService > trackPageView > tracks a page view
(pass) analyticsService > trackPageView > tracks page view with user
(pass) analyticsService > trackAction > tracks a user action
(pass) analyticsService > trackError > tracks an error event
(pass) analyticsService > trackConversion > tracks a conversion
(pass) analyticsService > getEventCounts > returns event counts for date range
(pass) analyticsService > getPageViews > returns page views grouped by day
(pass) analyticsService > getPageViews > accepts groupBy parameter
(pass) analyticsService > getUserSessions > returns user sessions
(pass) analyticsService > getUserSessions > accepts limit parameter
(pass) analyticsService > analyzeFunnel > returns funnel analysis
(pass) analyticsService > getConversionMetrics > returns conversion metrics
(pass) analyticsService > getRetentionCohorts > returns retention cohort data
(pass) analyticsService > cleanupOldData > does not throw
(pass) analyticsService > flush > flushes queued events
(pass) analyticsService > shutdown > shuts down gracefully
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles loopback IPv4 (127.0.0.1)
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles all-zeros IPv4 (0.0.0.0)
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles broadcast IPv4 
(255.255.255.255)
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles private range 172.16.x.x
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles private range 10.x.x.x
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles IPv4-mapped IPv6 
(::ffff:192.168.1.1) via IPv4 path
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles short IPv6 loopback (::1)
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles link-local IPv6 (fe80::)
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > returns null for undefined
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > returns null for string without dots 
or colons
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles three-octet dotted string
(pass) analyticsService — extended coverage > anonymizeIp — extended edge cases > handles two-group colon string
(pass) analyticsService — extended coverage > track — event construction > respects DNT header with object-style 
headers
(pass) analyticsService — extended coverage > track — event construction > does NOT block when DNT header is "0"
(pass) analyticsService — extended coverage > track — event construction > does NOT block when DNT header is absent
(pass) analyticsService — extended coverage > track — event construction > handles null properties gracefully (uses 
default {})
(pass) analyticsService — extended coverage > track — event construction > passes sessionId from properties
(pass) analyticsService — extended coverage > track — event construction > handles request with no ip
(pass) analyticsService — extended coverage > track — event construction > captures user-agent from request headers 
[16.00ms]
(pass) analyticsService — extended coverage > track — event construction > handles missing user-agent header
(pass) analyticsService — extended coverage > track — event construction > extracts userId from user object
(pass) analyticsService — extended coverage > track — event construction > sets userId to null when user has no id
(pass) analyticsService — extended coverage > track — event construction > sets userId to null when user is null
(pass) analyticsService — extended coverage > trackPageView — argument forwarding > tracks page view with all 
parameters
(pass) analyticsService — extended coverage > trackPageView — argument forwarding > tracks page view with only page 
parameter
(pass) analyticsService — extended coverage > trackPageView — argument forwarding > tracks page view with empty page 
string
(pass) analyticsService — extended coverage > trackAction — argument forwarding > tracks action with user and request
(pass) analyticsService — extended coverage > trackAction — argument forwarding > tracks action with minimal arguments
(pass) analyticsService — extended coverage > trackError — error handling > truncates stack to 500 characters
(pass) analyticsService — extended coverage > trackError — error handling > handles error with undefined stack
(pass) analyticsService — extended coverage > trackError — error handling > handles error with undefined message
(pass) analyticsService — extended coverage > trackError — error handling > merges context properties into event
(pass) analyticsService — extended coverage > trackError — error handling > tracks error with user parameter
(pass) analyticsService — extended coverage > trackConversion — type and value handling > tracks conversion with zero 
value
(pass) analyticsService — extended coverage > trackConversion — type and value handling > tracks conversion with 
negative value
(pass) analyticsService — extended coverage > trackConversion — type and value handling > tracks conversion with all 
parameters
(pass) analyticsService — extended coverage > trackConversion — type and value handling > tracks conversion with empty 
properties
(pass) analyticsService — extended coverage > getEventCounts — query behavior > calls query.all with date range
(pass) analyticsService — extended coverage > getEventCounts — query behavior > returns empty array when no events
(pass) analyticsService — extended coverage > getEventCounts — query behavior > uses endDate default (new Date()) when 
not provided
(pass) analyticsService — extended coverage > getPageViews — groupBy logic > returns page views grouped by day 
(default)
(pass) analyticsService — extended coverage > getPageViews — groupBy logic > passes hour format when groupBy is hour
(pass) analyticsService — extended coverage > getPageViews — groupBy logic > passes day format when groupBy is day
(pass) analyticsService — extended coverage > getPageViews — groupBy logic > defaults to day format when groupBy is 
unrecognized
(pass) analyticsService — extended coverage > getUserSessions — parameters > returns sessions for a specific user
(pass) analyticsService — extended coverage > getUserSessions — parameters > defaults to limit of 10
(pass) analyticsService — extended coverage > getUserSessions — parameters > passes custom limit
(pass) analyticsService — extended coverage > getUserSessions — parameters > returns empty array for user with no 
sessions
(pass) analyticsService — extended coverage > analyzeFunnel — step parsing and dropoff calculation > parses step with 
event:target format
(pass) analyticsService — extended coverage > analyzeFunnel — step parsing and dropoff calculation > parses step 
without target
(pass) analyticsService — extended coverage > analyzeFunnel — step parsing and dropoff calculation > calculates 
multi-step funnel
(pass) analyticsService — extended coverage > analyzeFunnel — step parsing and dropoff calculation > returns empty 
results array for empty steps
(pass) analyticsService — extended coverage > analyzeFunnel — step parsing and dropoff calculation > handles funnel 
step with zero users at a point
(pass) analyticsService — extended coverage > getConversionMetrics — result shape > returns conversion metrics for a 
specific type
(pass) analyticsService — extended coverage > getConversionMetrics — result shape > returns null values when no 
conversions exist
(pass) analyticsService — extended coverage > getConversionMetrics — result shape > passes correct parameters to query
(pass) analyticsService — extended coverage > getRetentionCohorts — result handling > returns cohort data array
(pass) analyticsService — extended coverage > getRetentionCohorts — result handling > passes start and end dates twice 
(for cohorts and weekly_activity CTEs)
(pass) analyticsService — extended coverage > getRetentionCohorts — result handling > returns empty array when no data
(pass) analyticsService — extended coverage > cleanupOldData — retention logic > returns the number of deleted records
(pass) analyticsService — extended coverage > cleanupOldData — retention logic > returns 0 when no records to clean
(pass) analyticsService — extended coverage > cleanupOldData — retention logic > calls query.run with a cutoff date 
parameter
(pass) analyticsService — extended coverage > flush — queue processing and error recovery > flush calls query.prepare 
with INSERT statement
(pass) analyticsService — extended coverage > flush — queue processing and error recovery > flush is a no-op when 
queue is empty
(pass) analyticsService — extended coverage > flush — queue processing and error recovery > flush re-queues events on 
error if queue is small
(pass) analyticsService — extended coverage > init — timer setup > init does not throw
(pass) analyticsService — extended coverage > init — timer setup > init can be called multiple times without error
(pass) analyticsService — extended coverage > shutdown — cleanup > shutdown does not throw after init
(pass) analyticsService — extended coverage > shutdown — cleanup > shutdown does not throw without prior init
(pass) analyticsService — extended coverage > module exports > analyticsService is the default export
(pass) analyticsService — extended coverage > module exports > migration is a named export with valid SQL
(pass) analyticsService — extended coverage > module exports > analyticsService has exactly 16 public methods
(pass) analyticsService — extended coverage > module exports > all expected methods exist on analyticsService
(pass) analyticsService — extended coverage > migration SQL — structural validation > defines analytics_events table 
with all 7 columns
(pass) analyticsService — extended coverage > migration SQL — structural validation > id is INTEGER PRIMARY KEY 
AUTOINCREMENT
(pass) analyticsService — extended coverage > migration SQL — structural validation > name is TEXT NOT NULL
(pass) analyticsService — extended coverage > migration SQL — structural validation > timestamp is TEXT NOT NULL
(pass) analyticsService — extended coverage > migration SQL — structural validation > has 4 CREATE INDEX statements
(pass) analyticsService — extended coverage > migration SQL — structural validation > all indexes are on 
analytics_events table
(pass) analyticsService — extended coverage > ANALYTICS_CONFIG — behavioral validation > sessionTimeout-related 
behavior: track adds timestamp to events
(pass) analyticsService — extended coverage > ANALYTICS_CONFIG — behavioral validation > dataRetentionDays drives 
cleanupOldData cutoff (~90 days)
(pass) analyticsService — extended coverage > ANALYTICS_CONFIG — behavioral validation > respectDNT is true by default 
(DNT=1 blocks tracking)
(pass) analyticsService — extended coverage > ANALYTICS_CONFIG — behavioral validation > anonymizeIp is true by 
default (IPs are anonymized in events)

src\tests\service-auditLog-coverage.test.js:
(pass) redactSensitive edge cases > non-object values pass through unchanged
(pass) redactSensitive edge cases > string details are passed as-is after JSON.stringify
(pass) redactSensitive edge cases > number details are passed as-is after JSON.stringify
(pass) redactSensitive edge cases > nested sensitive fields are redacted
(pass) redactSensitive edge cases > array details are handled
(pass) redactSensitive edge cases > credit_card field is redacted
(pass) redactSensitive edge cases > ssn field is redacted
(pass) redactSensitive edge cases > bank_account field is redacted
(pass) redactSensitive edge cases > secret field is redacted
(pass) auditLog.log — critical alert > calls alertCritical for CRITICAL severity events
(pass) auditLog.log — critical alert > does not call alertCritical for INFO severity
(pass) auditLog.log — critical alert > does not call alertCritical for WARNING severity
(pass) auditLog.log — critical alert > does not call alertCritical for ERROR severity
(pass) auditLog.logDataAccess > logs data access with DATA category
(pass) auditLog.logDataAccess > passes context to underlying log
(pass) auditLog.logDataAccess > returns a valid ID
(pass) auditLog.logFinancial > logs financial event with FINANCIAL category
(pass) auditLog.logFinancial > passes context through
(pass) auditLog.logFinancial > redacts sensitive financial details
(pass) auditLog.alertCritical > logs critical event details
(pass) auditLog.query — filters > no filters returns all with default limit/offset
(pass) auditLog.query — filters > userId filter adds WHERE clause
(pass) auditLog.query — filters > category filter adds WHERE clause
(pass) auditLog.query — filters > severity filter adds WHERE clause
(pass) auditLog.query — filters > action filter uses LIKE with escaping
(pass) auditLog.query — filters > action filter escapes special SQL chars
(pass) auditLog.query — filters > resourceType filter adds WHERE clause
(pass) auditLog.query — filters > resourceId filter adds WHERE clause
(pass) auditLog.query — filters > startDate filter adds WHERE clause
(pass) auditLog.query — filters > endDate filter adds WHERE clause
(pass) auditLog.query — filters > custom limit and offset
(pass) auditLog.query — filters > all filters combined
(pass) auditLog.query — filters > returns empty array when query.all returns null
(pass) auditLog.query — filters > returns data from query.all
(pass) auditLog.getUserActivity > queries user activity with userId and date range
(pass) auditLog.getUserActivity > defaults to 30 days
(pass) auditLog.getUserActivity > custom days parameter
(pass) auditLog.getUserActivity > returns empty array when null from DB
(pass) auditLog.getUserActivity > returns activity data
(pass) auditLog.getAdminActivity > queries admin activity with default 7 days
(pass) auditLog.getAdminActivity > custom days parameter
(pass) auditLog.getAdminActivity > returns empty array when DB returns null
(pass) auditLog.getAdminActivity > returns admin activity data
(pass) auditLog.generateComplianceReport > returns report with correct structure
(pass) auditLog.generateComplianceReport > summary.byCategory queries grouped by category
(pass) auditLog.generateComplianceReport > summary.bySeverity queries grouped by severity
(pass) auditLog.generateComplianceReport > details.authentication contains totalLogins, failedLogins, passwordResets
(pass) auditLog.generateComplianceReport > details.security contains mfaEnrollments and suspiciousActivity
(pass) auditLog.generateComplianceReport > handles null from query.get gracefully (defaults to 0)
(pass) auditLog.generateComplianceReport > handles null from query.all for dataAccess and adminActions
(pass) auditLog.getSecurityAlerts > queries with default 24 hours
(pass) auditLog.getSecurityAlerts > custom hours parameter
(pass) auditLog.getSecurityAlerts > returns empty array when DB returns null
(pass) auditLog.getSecurityAlerts > returns alerts data
(pass) auditLog.cleanup — extended > uses default retention of 90 and 730 days
(pass) auditLog.cleanup — extended > logs cleanup results
(pass) auditLog.cleanup — extended > custom retention days
(pass) auditLog.init > logs initialization message
(pass) auditLogRouter > returns 401 when no user
(pass) auditLogRouter > GET /my-activity — returns user activity
(pass) auditLogRouter > GET /my-activity — parses days parameter
(pass) auditLogRouter > GET /my-activity — defaults to 30 days for invalid input
(pass) auditLogRouter > GET /logs — returns 403 for non-admin
(pass) auditLogRouter > GET /logs — admin can query logs
(pass) auditLogRouter > GET /logs — passes all filter params
(pass) auditLogRouter > GET /admin-activity — returns 403 for non-admin
(pass) auditLogRouter > GET /admin-activity — admin gets activity
(pass) auditLogRouter > GET /admin-activity — custom days param
(pass) auditLogRouter > GET /security-alerts — returns 403 for non-admin
(pass) auditLogRouter > GET /security-alerts — admin gets alerts [16.00ms]
(pass) auditLogRouter > GET /security-alerts — custom hours param
(pass) auditLogRouter > GET /compliance-report — returns 403 for non-admin
(pass) auditLogRouter > GET /compliance-report — admin gets report
(pass) auditLogRouter > GET /compliance-report — custom date params
(pass) auditLogRouter > GET /user/:userId — returns 403 for non-admin
(pass) auditLogRouter > GET /user/:userId — admin gets user activity and logs access
(pass) auditLogRouter > GET /user/:userId — custom days param
(pass) auditLogRouter > GET /stats — returns 403 for non-admin
(pass) auditLogRouter > GET /stats — admin gets stats
(pass) auditLogRouter > GET /stats — custom days param
(pass) auditLogRouter > GET /stats — handles null from DB
(pass) auditLogRouter > unknown route returns 404
(pass) auditLogRouter > POST method on known path returns 404
(pass) auditLogRouter > enterprise tier user is treated as admin
(pass) auditLogRouter > is_admin true but non-enterprise tier is treated as admin
(pass) auditLog.log — default parameters > defaults category to system
(pass) auditLog.log — default parameters > defaults severity to info
(pass) auditLog.log — default parameters > defaults metadata to empty object
(pass) auditLog.log — default parameters > stores timestamp in ISO format
(pass) auditLog.log — default parameters > generates unique IDs for each log entry
(pass) migration export > migration string is defined
(pass) migration export > migration creates audit_logs table
(pass) migration export > migration includes all required columns
(pass) migration export > migration creates indexes
(pass) migration export > migration includes foreign key constraint
(pass) CATEGORIES and SEVERITY re-exports > CATEGORIES has expected values
(pass) CATEGORIES and SEVERITY re-exports > SEVERITY has expected values

src\tests\service-auditLog-unit.test.js:
(pass) auditLog.log > inserts audit record via query.run
(pass) auditLog.log > returns an ID string
(pass) auditLog.log > redacts sensitive fields in details
(pass) auditLog.log > redacts token fields in details
(pass) auditLog.log > redacts api_key in metadata
(pass) auditLog.log > stores all expected fields
(pass) auditLog.logAuth > logs auth event with AUTH category
(pass) auditLog.logAuth > sets WARNING severity for failed actions
(pass) auditLog.logAuth > sets INFO severity for successful actions
(pass) auditLog.logAdmin > logs admin event with ADMIN category and WARNING severity
(pass) auditLog.logSecurity > logs security event with SECURITY category
(pass) auditLog.query > queries audit logs from DB
(pass) auditLog.cleanup > deletes old logs via query.run
(pass) auditLog.cleanup > propagates DB error from cleanup

src\tests\service-auditLogConstants.test.js:
(pass) CATEGORIES > has all 10 expected keys
(pass) CATEGORIES > all values are lowercase strings
(pass) CATEGORIES > AUTH maps to authentication
(pass) CATEGORIES > SECURITY maps to security
(pass) SEVERITY > has 4 severity levels
(pass) SEVERITY > has INFO, WARNING, ERROR, CRITICAL
(pass) SEVERITY > all values are lowercase strings

src\tests\service-cloudinary-transformations.test.js:
(pass) cloudinaryService transformations > when NOT configured > removeBackground returns error
(pass) cloudinaryService transformations > when NOT configured > autoEnhance returns error
(pass) cloudinaryService transformations > when NOT configured > generateResponsiveUrls returns error
(pass) cloudinaryService transformations > when configured > removeBackground returns URL with e_background_removal
(pass) cloudinaryService transformations > when configured > autoEnhance returns URL with improvement transforms
(pass) cloudinaryService transformations > when configured > smartCrop returns URL with dimensions
(pass) cloudinaryService transformations > when configured > aiUpscale returns URL with e_upscale
(pass) cloudinaryService transformations > when configured > applyTransformations builds URL from string
(pass) cloudinaryService transformations > when configured > applyTransformations builds URL from array
(pass) cloudinaryService transformations > when configured > generateResponsiveUrls returns multiple sizes

src\tests\service-cloudinary-upload-expanded.test.js:
(pass) isCloudinaryConfigured > returns boolean
(pass) isCloudinaryConfigured > returns false without env vars
(pass) uploadToCloudinary > returns error when not configured
(pass) uploadToCloudinary > returns object with success property
(pass) removeBackground — unconfigured returns empty object > returns object
(pass) removeBackground — unconfigured returns empty object > does not throw for any public ID
(pass) autoEnhance — unconfigured returns empty object > returns object
(pass) smartCrop — unconfigured returns empty object > returns object
(pass) smartCrop — unconfigured returns empty object > does not throw for various dimensions
(pass) aiUpscale — unconfigured returns empty object > returns object
(pass) applyTransformations — unconfigured returns empty object > returns object
(pass) generateResponsiveUrls — unconfigured returns error > returns object with success=false
(pass) generateResponsiveUrls — unconfigured returns error > handles custom sizes param
(pass) Cloudinary exports are all functions > all expected functions are exported

src\tests\service-cloudinary-upload.test.js:
(pass) isCloudinaryConfigured > returns boolean
(pass) uploadToCloudinary > returns error when cloudinary is not configured
(pass) uploadToCloudinary > returns object with success property

src\tests\service-cloudinary.test.js:
(pass) isCloudinaryConfigured > returns false when env vars not set
(pass) isCloudinaryConfigured > returns false when only some vars set
(pass) isCloudinaryConfigured > returns true when all vars set
(pass) generateResponsiveUrls > returns error when not configured
(pass) generateResponsiveUrls > generates URLs for default sizes when configured
(pass) generateResponsiveUrls > generates URLs with correct cloud name
(pass) generateResponsiveUrls > supports custom sizes
(pass) generateResponsiveUrls > URLs use c_scale transformation
(pass) removeBackground (not configured) > returns error when not configured
(pass) removeBackground (not configured) > returns URL when configured
(pass) autoEnhance > returns error when not configured
(pass) autoEnhance > returns URL with enhance transformations
(pass) smartCrop > returns error when not configured
(pass) smartCrop > returns URL with crop params
(pass) applyTransformations > returns error when not configured
(pass) applyTransformations > applies string transformation
(pass) applyTransformations > applies array of transformations
(pass) aiUpscale > returns error when not configured
(pass) aiUpscale > returns URL with upscale transformation
(pass) uploadToCloudinary (not configured) > returns error when not configured

src\tests\service-email-unit.test.js:
(pass) initEmailService > returns false when SMTP credentials not set
(pass) sendVerificationEmail > returns success result
(pass) sendVerificationEmail > uses the user email as recipient
(pass) sendVerificationEmail > handles missing username gracefully
(pass) sendPasswordResetEmail > returns success result
(pass) sendPasswordResetEmail > handles XSS in username
(pass) sendMFAEnabledEmail > returns success result [16.00ms]
(pass) sendMFADisabledEmail > returns success result
(pass) sendSecurityAlertEmail > returns success for new_login alert
(pass) sendSecurityAlertEmail > returns success for password_changed alert
(pass) sendSecurityAlertEmail > handles unknown alert type
(pass) sendSecurityAlertEmail > escapes HTML in alert details

src\tests\service-emailMarketing-unit.test.js:
(pass) EMAIL_TEMPLATES config > sendEmail recognises the welcome template
(pass) EMAIL_TEMPLATES config > sendEmail recognises welcomeDay2 template
(pass) EMAIL_TEMPLATES config > sendEmail recognises welcomeDay7 template
(pass) EMAIL_TEMPLATES config > sendEmail recognises saleNotification template
(pass) EMAIL_TEMPLATES config > sendEmail recognises weeklyDigest template
(pass) EMAIL_TEMPLATES config > sendEmail recognises priceDropAlert template
(pass) EMAIL_TEMPLATES config > sendEmail recognises inactivityReminder template
(pass) EMAIL_TEMPLATES config > sendEmail recognises offerReceived template
(pass) EMAIL_TEMPLATES config > sendEmail skips unknown template without throwing
(pass) emailMarketing.sendEmail > passes email address to the email service
(pass) emailMarketing.sendEmail > replaces placeholders in subject
(pass) emailMarketing.sendEmail > replaces multiple placeholders in priceDropAlert subject
(pass) emailMarketing.sendEmail > strips newlines from placeholder values (header injection prevention)
(pass) emailMarketing.sendEmail > logs email to email_log table
(pass) emailMarketing.sendEmail > passes template name to email service
(pass) emailMarketing.sendEmail > passes data object to email service
(pass) emailMarketing.generateUnsubscribeLink > returns a string URL path
(pass) emailMarketing.generateUnsubscribeLink > includes userId parameter
(pass) emailMarketing.generateUnsubscribeLink > includes encoded email parameter
(pass) emailMarketing.generateUnsubscribeLink > includes token parameter
(pass) emailMarketing.generateUnsubscribeLink > token is 32 hex characters
(pass) emailMarketing.generateUnsubscribeLink > different emails produce different tokens
(pass) emailMarketing.generateUnsubscribeLink > different users produce different tokens
(pass) emailMarketing.generateUnsubscribeLink > same inputs produce deterministic output
(pass) emailMarketing.hasConsent > returns false when no consent record exists
(pass) emailMarketing.hasConsent > returns true when consent granted = 1
(pass) emailMarketing.hasConsent > returns false when consent granted = 0
(pass) emailMarketing.hasConsent > returns false when granted field is undefined
(pass) emailMarketing.hasConsent > returns false when granted is a truthy non-1 value
(pass) emailMarketing.queueEmail > queues email without error using default date
(pass) emailMarketing.queueEmail > queues email with future scheduled date
(pass) emailMarketing.queueEmail > inserts into email_queue table
(pass) emailMarketing.queueEmail > serializes data as JSON string
(pass) emailMarketing.queueEmail > generates a UUID for each queued email
(pass) emailMarketing.sendWelcomeEmail > queues three emails (welcome, day2, day7) [15.00ms]
(pass) emailMarketing.sendWelcomeEmail > uses username if full_name is missing
(pass) emailMarketing.sendWelcomeEmail > schedules day2 email ~2 days in future
(pass) emailMarketing.sendWelcomeEmail > schedules day7 email ~7 days in future
(pass) emailMarketing.sendSaleNotification > skips if user has no consent
(pass) emailMarketing.sendSaleNotification > sends email if user has consent
(pass) emailMarketing.sendSaleNotification > handles listing without inventory_id
(pass) emailMarketing.sendSaleNotification > falls back to "Your item" when listing is null
(pass) emailMarketing.sendWeeklyDigest > returns early if user not found
(pass) emailMarketing.sendWeeklyDigest > returns early if user has no consent
(pass) emailMarketing.sendWeeklyDigest > sends digest when user exists and has consent
(pass) emailMarketing.sendWeeklyDigest > handles null stats gracefully (defaults to 0)
(pass) emailMarketing.processWelcomeSequence > processes pending emails from queue
(pass) emailMarketing.processWelcomeSequence > handles empty queue
(pass) emailMarketing.processWelcomeSequence > handles null queue result
(pass) emailMarketing.processWelcomeSequence > marks email as failed on send error
(pass) emailMarketing.processWelcomeSequence > processes multiple emails
(pass) emailMarketing.processWeeklyDigests > skips if not Sunday at 9 AM
(pass) emailMarketing.processInactivityReminders > sends reminders to inactive users with consent
(pass) emailMarketing.processInactivityReminders > skips users without consent
(pass) emailMarketing.processInactivityReminders > handles empty inactive users list
(pass) emailMarketing.processInactivityReminders > handles null result from query
(pass) emailMarketing.unsubscribe > succeeds with valid HMAC token
(pass) emailMarketing.unsubscribe > updates user_consents to granted=0
(pass) emailMarketing.unsubscribe > throws on invalid token
(pass) emailMarketing.unsubscribe > throws on empty token
(pass) emailMarketing.init > init does not throw
(pass) emailMarketing.init > startScheduledJobs sets interval handles
(pass) emailMarketing.cleanup > clears all interval handles
(pass) emailMarketing.cleanup > calling cleanup twice does not throw
(pass) emailMarketingRouter > GET /unsubscribe > returns 200 HTML on successful unsubscribe
(pass) emailMarketingRouter > GET /unsubscribe > returns 400 on invalid unsubscribe token
(pass) emailMarketingRouter > authentication gate > returns 401 when user is null for non-unsubscribe routes
(pass) emailMarketingRouter > GET /stats > returns 403 for non-enterprise users
(pass) emailMarketingRouter > GET /stats > returns 403 for pro tier users
(pass) emailMarketingRouter > GET /stats > returns 200 with stats for enterprise users
(pass) emailMarketingRouter > unknown routes > returns 404 for unknown path
(pass) emailMarketingRouter > unknown routes > returns 404 for POST to /stats
(pass) migration export > migration is a non-empty string
(pass) migration export > migration creates email_queue table
(pass) migration export > migration creates email_log table
(pass) migration export > email_queue has required columns
(pass) migration export > migration creates indexes
(pass) migration export > email_queue has foreign key to users

src\tests\service-encryption.test.js:
(pass) Token Encryption > encryptToken should return iv:encrypted format
(pass) Token Encryption > decryptToken should recover original token
(pass) Token Encryption > round-trip with various token types
(pass) Token Encryption > encryptToken with null should return null
(pass) Token Encryption > decryptToken with null should return null
(pass) Token Encryption > each encryption should produce different ciphertext (random IV)
(pass) State Token > generateStateToken should return 64-char hex string
(pass) State Token > each state token should be unique
(pass) Hash Token > hashToken should return consistent hash
(pass) Hash Token > different tokens should produce different hashes
(pass) Hash Token > hash should be hex string

src\tests\service-enhancedMFA-unit.test.js:
(pass) hashBackupCode (indirect) > backup code verification hashes the code with SHA-256
(pass) hashBackupCode (indirect) > code hash is deterministic
(pass) hashBackupCode (indirect) > different codes produce different hashes
(pass) generateChallenge (indirect via startRegistration) > startRegistration returns a base64url challenge string
(pass) generateChallenge (indirect via startRegistration) > each call generates a different challenge
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > generates 10 backup codes by default
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > backup codes are formatted as XXXX-XXXX
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > backup codes are unique within a batch
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > result includes warning messages
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > deletes existing unused codes before 
generating new ones
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > inserts each code into the database
(pass) generateBackupCodes (indirect via enhancedMFA.generateBackupCodes) > enables MFA for the user if not already 
enabled
(pass) enhancedMFA.startRegistration > throws if user is not found
(pass) enhancedMFA.startRegistration > returns WebAuthn registration options with correct structure
(pass) enhancedMFA.startRegistration > uses email prefix as displayName when username is missing
(pass) enhancedMFA.startRegistration > encodes user.id as base64url
(pass) enhancedMFA.startRegistration > excludes existing credentials
(pass) enhancedMFA.completeRegistration > throws if no registration challenge exists
(pass) enhancedMFA.completeRegistration > throws if challenge has expired
(pass) enhancedMFA.completeRegistration > completes registration successfully and stores credential
(pass) enhancedMFA.completeRegistration > uses attestationObject when publicKey is missing
(pass) enhancedMFA.completeRegistration > defaults device name to "Security Key"
(pass) enhancedMFA.completeRegistration > enables MFA for user if not already enabled
(pass) enhancedMFA.startAuthentication > throws if no security keys registered
(pass) enhancedMFA.startAuthentication > throws if credentials query returns null
(pass) enhancedMFA.startAuthentication > returns authentication options with allowCredentials
(pass) enhancedMFA.completeAuthentication > throws if no authentication challenge exists
(pass) enhancedMFA.completeAuthentication > throws if credential is unknown
(pass) enhancedMFA.completeAuthentication > returns success and updates sign count on valid authentication
(pass) enhancedMFA.listSecurityKeys > returns empty array when no keys exist
(pass) enhancedMFA.listSecurityKeys > returns null-safe (defaults to empty array)
(pass) enhancedMFA.listSecurityKeys > returns all keys for a user
(pass) enhancedMFA.listSecurityKeys > queries webauthn_credentials table [16.00ms]
(pass) enhancedMFA.removeSecurityKey > throws when removing last key without other MFA methods
(pass) enhancedMFA.removeSecurityKey > allows removal when other keys remain
(pass) enhancedMFA.removeSecurityKey > allows removal when user has backup codes
(pass) enhancedMFA.removeSecurityKey > allows removal when MFA method is not webauthn
(pass) enhancedMFA.verifyBackupCode > returns failure for invalid/used code
(pass) enhancedMFA.verifyBackupCode > returns success and marks code as used
(pass) enhancedMFA.verifyBackupCode > warns when remaining codes are low (< 3)
(pass) enhancedMFA.verifyBackupCode > strips dashes and spaces from code before hashing
(pass) enhancedMFA.getBackupCodeStatus > returns zeroes when no codes exist
(pass) enhancedMFA.getBackupCodeStatus > returns correct counts
(pass) enhancedMFA.getBackupCodeStatus > queries backup_codes table with aggregation
(pass) enhancedMFA.registerPhone > throws for phone number shorter than 10 digits
(pass) enhancedMFA.registerPhone > throws for phone with only non-digit characters
(pass) enhancedMFA.registerPhone > cleans phone number (removes non-digits)
(pass) enhancedMFA.registerPhone > returns last four digits of phone number
(pass) enhancedMFA.registerPhone > stores pending phone and verification code in DB
(pass) enhancedMFA.verifyPhone > throws if no phone verification is pending
(pass) enhancedMFA.verifyPhone > throws if verification code has expired
(pass) enhancedMFA.verifyPhone > throws if code does not match
(pass) enhancedMFA.verifyPhone > succeeds with correct code and clears pending state
(pass) enhancedMFA.sendSMSCode > throws if no verified phone number
(pass) enhancedMFA.sendSMSCode > throws if phone exists but is not verified
(pass) enhancedMFA.sendSMSCode > inserts SMS code and returns last four digits
(pass) enhancedMFA.verifySMSCode > returns failure when code not found
(pass) enhancedMFA.verifySMSCode > returns failure when code has expired
(pass) enhancedMFA.verifySMSCode > returns success and marks code as used for valid code
(pass) enhancedMFA.getMFAStatus > returns full MFA status for a user
(pass) enhancedMFA.getMFAStatus > returns disabled status when MFA is off
(pass) enhancedMFA.disableMFA > throws if password is invalid [94.00ms]
(pass) enhancedMFA.disableMFA > deletes all MFA data when no password_hash set
(pass) enhancedMFA.cleanupChallenges > does not throw when called directly
(pass) enhancedMFA.cleanupChallenges > is called during startRegistration
(pass) enhancedMFARouter > returns 401 if user is not authenticated
(pass) enhancedMFARouter > GET /status returns MFA status
(pass) enhancedMFARouter > POST /disable with no password_hash succeeds
(pass) enhancedMFARouter > POST /disable with wrong password returns 400 [453.00ms]
(pass) enhancedMFARouter > POST /webauthn/register/start returns registration options
(pass) enhancedMFARouter > POST /webauthn/register/complete without prior start returns 400
(pass) enhancedMFARouter > POST /webauthn/authenticate/start without keys returns 400
(pass) enhancedMFARouter > POST /webauthn/authenticate/complete without prior start returns 400
(pass) enhancedMFARouter > GET /webauthn/keys returns security keys
(pass) enhancedMFARouter > DELETE /webauthn/keys/:id removes a key
(pass) enhancedMFARouter > DELETE /webauthn/keys/:id returns 400 when removal not allowed
(pass) enhancedMFARouter > POST /backup-codes/generate returns codes
(pass) enhancedMFARouter > POST /backup-codes/verify with invalid code returns 400
(pass) enhancedMFARouter > GET /backup-codes/status returns status
(pass) enhancedMFARouter > POST /sms/register with valid phone succeeds
(pass) enhancedMFARouter > POST /sms/register with invalid phone returns 400
(pass) enhancedMFARouter > POST /sms/verify-phone without pending verification returns 400
(pass) enhancedMFARouter > POST /sms/send without verified phone returns 400
(pass) enhancedMFARouter > POST /sms/verify with invalid code returns 400
(pass) enhancedMFARouter > returns 404 for unknown path
(pass) enhancedMFARouter > returns 404 for unknown method on valid path

src\tests\service-errorHandler-unit.test.js:
{"timestamp":"2026-03-05T21:20:00.343Z","level":"ERROR","message":"boom","method":"GET","path":"/test","error":{"messag
e":"boom"}}
(pass) handleError > returns 500 for generic Error
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"Item not found","error":{"message":"Item not 
found"}}
(pass) handleError > returns the statusCode from AppError
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"Authentication 
required","error":{"message":"Authentication required"}}
(pass) handleError > returns 401 for UnauthorizedError
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"Access denied","error":{"message":"Access denied"}}
(pass) handleError > returns 403 for ForbiddenError
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"bad input","error":{"message":"bad input"}}
(pass) handleError > returns 400 for ValidationError
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"server 
crash","method":"POST","path":"/api/test","userId":"u1","error":{"message":"server crash"}}
(pass) handleError > logs 500 errors to database via query.run
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"unexpected","method":"GET","path":"/api/items","erro
r":{"message":"unexpected"}}
(pass) handleError > logs non-operational errors to database
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"Item not 
found","method":"GET","path":"/api/items/1","error":{"message":"Item not found"}}
(pass) handleError > does NOT log operational 4xx errors to database
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"bad","error":{"message":"bad"}}
(pass) handleError > does NOT log ValidationError to database
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"Authentication 
required","error":{"message":"Authentication required"}}
(pass) handleError > does NOT log UnauthorizedError to database
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"crash","error":{"message":"crash"}}
(pass) handleError > survives if DB write fails (silent failure)
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"fail","method":"DELETE","path":"/api/items/123","use
rId":"user-42","ip":"10.0.0.1","requestId":"req-abc","error":{"message":"fail"}}
(pass) handleError > includes error context in DB insert
{"timestamp":"2026-03-05T21:20:00.344Z","level":"ERROR","message":"secret internal details","error":{"message":"secret 
internal details"}}
(pass) handleError > hides details in production for 500 errors
(pass) catchAsync > returns result from successful handler
{"timestamp":"2026-03-05T21:20:00.345Z","level":"ERROR","message":"Widget not 
found","method":"GET","path":"/test","error":{"message":"Widget not found"}}
(pass) catchAsync > catches thrown error and returns handleError result
{"timestamp":"2026-03-05T21:20:00.345Z","level":"ERROR","message":"boom","error":{"message":"boom"}}
(pass) catchAsync > catches generic error and returns 500
(pass) wrapRouterWithErrorHandling > passes through successful router result
{"timestamp":"2026-03-05T21:20:00.345Z","level":"ERROR","message":"invalid","error":{"message":"invalid"}}
(pass) wrapRouterWithErrorHandling > catches router errors and returns handleError result
{"timestamp":"2026-03-05T21:20:00.345Z","level":"ERROR","message":"crash","error":{"message":"crash"}}
(pass) wrapRouterWithErrorHandling > handles unexpected errors from router

src\tests\service-featureFlags-expanded.test.js:
(pass) Feature Flags — hashUserId determinism > hashUserId returns same value for same input
(pass) Feature Flags — hashUserId determinism > hashUserId returns different values for different inputs
(pass) Feature Flags — hashUserId determinism > hashUserId returns a non-negative integer
(pass) Feature Flags — hashUserId determinism > hashUserId handles empty string
(pass) Feature Flags — hashUserId determinism > getAllFlags returns object with default flags
(pass) Feature Flags — hashUserId determinism > isEnabled returns false for unknown flag [16.00ms]
(pass) Feature Flags — hashUserId determinism > isEnabled returns true for fully enabled flag (100% rollout)
(pass) Feature Flags — hashUserId determinism > isEnabled returns false for disabled flag
(pass) Feature Flags — hashUserId determinism > setFlag updates cache
(pass) Feature Flags — hashUserId determinism > isEnabled respects user targeting
(pass) Feature Flags — hashUserId determinism > isEnabled respects tier targeting
(pass) Feature Flags — hashUserId determinism > getFlagsForUser returns all flags as booleans
(pass) Feature Flags — API endpoints > GET /feature-flags returns flags via API
(pass) Feature Flags — API endpoints > GET /feature-flags requires auth

src\tests\service-featureFlags-unit.test.js:
(pass) featureFlags.loadFlags > loads flags from DB into cache
(pass) featureFlags.loadFlags > handles DB error gracefully (uses defaults)
(pass) featureFlags.loadFlags > parses target_users and target_tiers JSON
(pass) featureFlags.isEnabled > returns false for unknown flag
(pass) featureFlags.isEnabled > returns true for enabled default flag
(pass) featureFlags.isEnabled > returns false for disabled default flag
(pass) featureFlags.isEnabled > respects user targeting (targeted user gets true)
(pass) featureFlags.isEnabled > respects tier targeting (matched tier gets true)
(pass) featureFlags.isEnabled > disabled flag returns false regardless of targeting
(pass) featureFlags.hashUserId > returns a number
(pass) featureFlags.hashUserId > returns same hash for same input (deterministic)
(pass) featureFlags.hashUserId > returns different hashes for different inputs
(pass) featureFlags.hashUserId > returns non-negative value
(pass) featureFlags.setFlag > persists flag to database via query.run
(pass) featureFlags.setFlag > handles DB error gracefully
(pass) featureFlags.trackUsage > inserts usage record via query.run
(pass) featureFlags.trackUsage > handles DB error silently
(pass) featureFlags.getUsageStats > queries usage stats from DB
(pass) featureFlags.getUsageStats > returns empty array on DB error
(pass) featureFlags.getAllFlags > returns a copy of the flags cache
(pass) abTesting.getVariant > returns a variant from the list
(pass) abTesting.getVariant > returns consistent variant for same user
(pass) abTesting.getVariant > supports more than 2 variants
(pass) abTesting.trackConversion > inserts conversion record via query.run
(pass) abTesting.trackConversion > handles DB error silently
(pass) abTesting.getResults > queries experiment results from DB
(pass) abTesting.getResults > returns empty array on DB error

src\tests\service-featureFlags.test.js:
(pass) Feature Flags API > GET /feature-flags should return flags object
(pass) Feature Flags API > Feature flags should be boolean values [16.00ms]

src\tests\service-gmailService.test.js:
(pass) base64UrlToBase64 > replaces - with + and _ with /
(pass) base64UrlToBase64 > handles standard base64 (no replacements needed)
(pass) base64UrlToBase64 > handles empty string
(pass) base64UrlToBase64 > handles multiple replacements
(pass) parseGmailMessage > parses message with headers
(pass) parseGmailMessage > extracts fromEmail and fromName
(pass) parseGmailMessage > handles from without angle brackets
(pass) parseGmailMessage > handles multipart message
(pass) parseGmailMessage > handles missing headers gracefully
(pass) parseGmailMessage > extracts attachments from multipart

src\tests\service-grokService.test.js:
(pass) isGrokConfigured > returns false when no API key
(pass) isGrokConfigured > returns false when mode is not api
(pass) isGrokConfigured > returns true when key and mode=api
(pass) getChatbotMode > defaults to mock when no env var
(pass) getChatbotMode > returns grok when XAI_API_KEY and CHATBOT_MODE=api
(pass) getGrokResponse (mock mode) > returns greeting for hello
(pass) getGrokResponse (mock mode) > returns cross-listing help
(pass) getGrokResponse (mock mode) > returns image bank help
(pass) getGrokResponse (mock mode) > returns template help
(pass) getGrokResponse (mock mode) > returns AI generation help
(pass) getGrokResponse (mock mode) > returns automation help
(pass) getGrokResponse (mock mode) > returns analytics help
(pass) getGrokResponse (mock mode) > returns inventory help
(pass) getGrokResponse (mock mode) > returns platform help
(pass) getGrokResponse (mock mode) > returns pricing help
(pass) getGrokResponse (mock mode) > returns help for support queries
(pass) getGrokResponse (mock mode) > returns default for unrecognized queries
(pass) getGrokResponse (mock mode) > quickActions is always an array
(pass) getGrokResponse (mock mode) > quickActions have label and route/action
(pass) getGrokResponse (mock mode) > uses last message in array

src\tests\service-imageStorage-unit.test.js:
(pass) imageStorage > validateImage > accepts JPEG
(pass) imageStorage > validateImage > accepts PNG
(pass) imageStorage > validateImage > accepts WebP
(pass) imageStorage > validateImage > rejects GIF
(pass) imageStorage > validateImage > rejects file exceeding 10MB
(pass) imageStorage > validateImage > rejects null file
(pass) imageStorage > validateImage > rejects undefined file
(pass) imageStorage > getImageUrl > returns file_path when image exists
(pass) imageStorage > getImageUrl > returns null when image not found
(pass) imageStorage > deleteImage > returns error when image not found

src\tests\service-imageValidation.test.js:
(pass) validateImage > returns invalid for null file
(pass) validateImage > returns invalid for undefined file
(pass) validateImage > accepts image/jpeg
(pass) validateImage > accepts image/jpg
(pass) validateImage > accepts image/png
(pass) validateImage > accepts image/webp
(pass) validateImage > rejects image/gif
(pass) validateImage > rejects application/pdf
(pass) validateImage > rejects file over 10MB
(pass) validateImage > accepts file exactly at 10MB limit
(pass) validateImage > accepts very small file

src\tests\service-marketData-unit.test.js:
(pass) marketDataService > getCompetitorsForPlatform > returns competitors for poshmark
(pass) marketDataService > getCompetitorsForPlatform > returns competitors for ebay
(pass) marketDataService > getCompetitorsForPlatform > returns empty array for unknown platform
(pass) marketDataService > getCompetitorsForPlatform > each competitor has required fields
(pass) marketDataService > generateCompetitorListings > returns requested number of listings
(pass) marketDataService > generateCompetitorListings > defaults to 10 listings
(pass) marketDataService > generateCompetitorListings > each listing has required fields
(pass) marketDataService > getMarketInsight > returns insight with correct structure
(pass) marketDataService > getMarketInsight > applies grailed platform multiplier (higher prices)
(pass) marketDataService > getMarketInsight > applies premium brand multiplier
(pass) marketDataService > findOpportunities > returns sorted by opportunity score descending
(pass) marketDataService > findOpportunities > only includes categories with opportunity >= 60
(pass) marketDataService > findOpportunities > respects limit option
(pass) marketDataService > comparePricesWithCompetitors > returns comparison with required fields
(pass) marketDataService > getTrendingCategories > returns max 5 categories sorted by trend_score
(pass) marketDataService > getTrendingCategories > each category has required fields

src\tests\service-marketData.test.js:
(pass) getCompetitorsForPlatform > returns competitors for poshmark
(pass) getCompetitorsForPlatform > returns competitors for ebay
(pass) getCompetitorsForPlatform > returns competitors for mercari
(pass) getCompetitorsForPlatform > returns competitors for depop
(pass) getCompetitorsForPlatform > returns competitors for grailed
(pass) getCompetitorsForPlatform > returns empty array for unknown platform
(pass) getCompetitorsForPlatform > handles case-insensitive platform names
(pass) getCompetitorsForPlatform > each competitor has unique id
(pass) getCompetitorsForPlatform > infers category focus from username
(pass) generateCompetitorListings > generates specified number of listings
(pass) generateCompetitorListings > defaults to 10 listings
(pass) generateCompetitorListings > listings have required fields
(pass) generateCompetitorListings > prices are positive numbers
(pass) generateCompetitorListings > some listings are sold
(pass) getMarketInsight > returns insight for known category
(pass) getMarketInsight > falls back to Clothing for unknown category
(pass) getMarketInsight > applies platform multiplier for grailed
(pass) getMarketInsight > applies brand multiplier for premium brands
(pass) getMarketInsight > includes insights_json
(pass) findOpportunities > returns opportunity array
(pass) findOpportunities > only includes high-opportunity categories
(pass) findOpportunities > sorted by opportunity score descending
(pass) findOpportunities > respects limit option
(pass) findOpportunities > includes recommendation text
(pass) comparePricesWithCompetitors > returns comparison data
(pass) comparePricesWithCompetitors > price_position is one of expected values
(pass) comparePricesWithCompetitors > very high price is above_market
(pass) comparePricesWithCompetitors > very low price is below_market
(pass) comparePricesWithCompetitors > falls back to Clothing for unknown category
(pass) getTrendingCategories > returns top 5 trending categories
(pass) getTrendingCategories > sorted by trend_score descending
(pass) getTrendingCategories > each entry has required fields

src\tests\service-mfa-qrcode-expanded.test.js:
(pass) generateSecret > returns object with secret and otpauth
(pass) generateSecret > otpauth contains issuer and label
(pass) generateSecret > different emails produce different secrets
(pass) generateSecret > otpauth is a valid URI
(pass) generateQRCode > returns data URL for valid input [31.00ms]
(pass) generateQRCode > base64 data is substantial (not trivially small)
(pass) verifyToken > rejects empty token
(pass) verifyToken > rejects non-numeric token
(pass) verifyToken > rejects wrong-length token
(pass) verifyToken > rejects invalid token format
(pass) generateBackupCodes > returns codes and hashedCodes arrays
(pass) generateBackupCodes > generates exactly 10 codes
(pass) generateBackupCodes > codes are in XXXX-XXXX format
(pass) generateBackupCodes > all codes are unique
(pass) generateBackupCodes > hashed codes are bcrypt hashes
(pass) generateBackupCodes > all 10 codes are distinct within a single generation
(pass) verifyBackupCode > verifies a valid backup code and invalidates it [2265.00ms]
(pass) verifyBackupCode > accepts lowercase input [1000.00ms]
(pass) verifyBackupCode > rejects invalid code [1750.00ms]

src\tests\service-mfa-qrcode.test.js:
(pass) generateQRCode > returns a data URL string
(pass) generateQRCode > returns non-empty base64 data [16.00ms]
(pass) generateQRCode > different inputs produce different QR codes [16.00ms]

src\tests\service-mfa.test.js:
(pass) generateSecret > returns secret and otpauth URI
(pass) generateSecret > otpauth contains issuer
(pass) generateSecret > otpauth contains email label (URL-encoded)
(pass) generateSecret > generates unique secrets
(pass) generateSecret > secret is base32 format
(pass) verifyToken > returns boolean
(pass) verifyToken > rejects empty token
(pass) verifyToken > rejects wrong-length token
(pass) verifyToken > rejects non-numeric token
(pass) generateBackupCodes > generates 10 codes [2125.00ms]
(pass) generateBackupCodes > codes are in XXXX-XXXX format [2140.00ms]
(pass) generateBackupCodes > hashed codes are bcrypt hashes [2172.00ms]
(pass) generateBackupCodes > all codes are unique [2125.00ms]
(pass) generateBackupCodes > codes and hashes correspond (different batches are different) [4281.00ms]
(pass) verifyBackupCode > verifies valid backup code [2438.00ms]
(pass) verifyBackupCode > rejects invalid backup code [4531.00ms]
(pass) verifyBackupCode > nullifies used code in array [2516.00ms]
(pass) verifyBackupCode > verifies different codes from same batch [4906.00ms]
(pass) verifyBackupCode > rejects already-used code [4500.00ms]

src\tests\service-monitoring-unit.test.js:
(pass) monitoring.formatUptime > formats zero milliseconds
(pass) monitoring.formatUptime > formats milliseconds to hours and minutes
(pass) monitoring.formatUptime > formats days correctly
(pass) monitoring.formatUptime > formats partial hours
(pass) monitoring.formatUptime > formats seconds only (< 60s)
(pass) monitoring.formatUptime > formats minutes and seconds (no hours)
(pass) monitoring.formatUptime > formats exactly 1 day
(pass) monitoring.formatUptime > formats large durations (multiple days)
(pass) monitoring.formatUptime > returns days+hours format (not minutes) when days > 0
(pass) monitoring.formatUptime > formats sub-second values as 0s
(pass) monitoring.getMetrics > returns metrics object
(pass) monitoring.getMetrics > metrics includes request counters
(pass) monitoring.getMetrics > metrics includes memory info
(pass) monitoring.getMetrics > metrics has all top-level keys
(pass) monitoring.getMetrics > requests object has total, errors, errorRate
(pass) monitoring.getMetrics > latency object has avg, p50, p95, p99
(pass) monitoring.getMetrics > uptime object has seconds and formatted
(pass) monitoring.getMetrics > memory contains heapUsed and rss
(pass) monitoring.getMetrics > recentErrors is an array
(pass) monitoring.getMetrics > errorRate shows percentage string
(pass) monitoring.getMetrics > errorRate is "0%" when no requests tracked
(pass) monitoring.trackRequest > increments request count
(pass) monitoring.trackRequest > tracks error requests
(pass) monitoring.trackRequest > records duration in latency stats
(pass) monitoring.trackRequest > calls alert for slow responses (> 2000ms threshold)
(pass) monitoring.trackRequest > does not alert for fast responses (< 2000ms)
(pass) monitoring.trackRequest > tracks multiple requests and accumulates total
(pass) monitoring.getMetrics latency > getMetrics returns latency stats
(pass) monitoring.getMetrics latency > latency percentiles are ordered p50 <= p95 <= p99
(pass) monitoring.getMetrics latency > avg latency is computed correctly for known values
(pass) monitoring.trackError > increments error count
(pass) monitoring.trackError > error appears in recentErrors
(pass) monitoring.trackError > error record has expected fields
(pass) monitoring.trackError > error context is preserved
(pass) monitoring.trackError > error timestamp is a valid ISO string
(pass) monitoring.trackError > calls query.run to insert error log into database
(pass) monitoring.trackError > does not throw when database insert fails
(pass) monitoring.trackError > default context is empty object when not provided
(pass) monitoring.healthCheck > returns an object
(pass) monitoring.healthCheck > has database, redis, memory, uptime fields
(pass) monitoring.healthCheck > database check uses query.get
(pass) monitoring.healthCheck > database is true when query succeeds
(pass) monitoring.healthCheck > database is false when query throws
(pass) monitoring.healthCheck > memory check returns a boolean
(pass) monitoring.healthCheck > memory returns a boolean reflecting heap usage vs 95% threshold
(pass) monitoring.healthCheck > uptime is a positive number
(pass) monitoring.healthCheck > redis is always false (not implemented)
(pass) monitoring.healthCheck > multiple healthCheck calls accumulate uptime checks
(pass) monitoring.alert > does not throw
(pass) monitoring.alert > calls query.run to store alert in database
(pass) monitoring.alert > does not throw when db insert fails
(pass) monitoring.alert > handles various alert types
(pass) monitoring.init > exists and is a function
(pass) monitoring.init > does not throw when called
(pass) monitoring.startMetricsCollection / stopMetricsCollection > stopMetricsCollection clears interval
(pass) monitoring.startMetricsCollection / stopMetricsCollection > startMetricsCollection sets interval
(pass) monitoring.startMetricsCollection / stopMetricsCollection > stopMetricsCollection is idempotent (safe to call 
twice)
(pass) monitoring.startMetricsCollection / stopMetricsCollection > stopMetricsCollection is no-op when no interval 
exists
(pass) monitoring.initSentry > exists and is an async function
(pass) monitoring.initSentry > does not throw when @sentry/node is not installed
(pass) monitoring.getAlerts > returns an array
(pass) monitoring.getAlerts > returns empty array when query fails
(pass) monitoring.getAlerts > accepts hours parameter
(pass) monitoring.getAlerts > defaults to 24 hours
(pass) monitoring.getAlerts > returns query results when database has data
(pass) migration export > migration is a non-empty string
(pass) migration export > migration creates error_logs table
(pass) migration export > migration creates alerts table
(pass) migration export > migration includes indexes for error_logs
(pass) migration export > migration includes indexes for alerts
(pass) migration export > error_logs table has expected columns
(pass) migration export > alerts table has expected columns
(pass) module exports > monitoring is exported as named export
(pass) module exports > monitoring is exported as default export
(pass) module exports > migration is exported as named export
(pass) module exports > default export and named export are the same object
(pass) THRESHOLDS config (indirect) > slow response threshold is around 2000ms — 1999ms does not alert
(pass) THRESHOLDS config (indirect) > slow response threshold is around 2000ms — 2001ms triggers alert
(pass) THRESHOLDS config (indirect) > error rate alert requires > 5% rate AND > 100 total requests
(pass) monitoring method inventory > has init method
(pass) monitoring method inventory > has initSentry method
(pass) monitoring method inventory > has trackRequest method
(pass) monitoring method inventory > has trackError method
(pass) monitoring method inventory > has startMetricsCollection method
(pass) monitoring method inventory > has stopMetricsCollection method
(pass) monitoring method inventory > has alert method
(pass) monitoring method inventory > has healthCheck method
(pass) monitoring method inventory > has getMetrics method
(pass) monitoring method inventory > has formatUptime method
(pass) monitoring method inventory > has getAlerts method

src\tests\service-notificationService-unit.test.js:
(pass) notificationService > NotificationTypes > has all 6 expected type constants
(pass) notificationService > createNotification > returns correct shape with all fields
(pass) notificationService > createNotification > stringifies data when provided
(pass) notificationService > createNotification > passes null for data when not provided
(pass) notificationService > createNotification > propagates DB errors
(pass) notificationService > getUnreadNotifications > returns parsed notifications with JSON data
(pass) notificationService > getUnreadNotifications > returns empty array on DB error
(pass) notificationService > getNotifications > returns paginated result
(pass) notificationService > getNotifications > returns fallback on error
(pass) notificationService > markAsRead > returns true when notification updated
(pass) notificationService > markAsRead > returns false when not found
(pass) notificationService > markAllAsRead > returns count of marked notifications
(pass) notificationService > markAllAsRead > returns 0 on error
(pass) notificationService > deleteNotification > returns true on success
(pass) notificationService > deleteNotification > returns false when not found
(pass) notificationService > cleanupOldNotifications > returns deleted count
(pass) notificationService > cleanupOldNotifications > defaults to 30 days
(pass) notificationService > getUnreadCount > returns count from DB
(pass) notificationService > getUnreadCount > returns 0 on error
(pass) notificationService > createOAuthNotification > generates success message for TOKEN_REFRESH_SUCCESS
(pass) notificationService > createOAuthNotification > generates error message for TOKEN_REFRESH_FAILED
(pass) notificationService > createOAuthNotification > sanitizes platform name against XSS
(pass) notificationService > createOAuthNotification > falls back to generic for unknown type

src\tests\service-notificationTypes-expanded.test.js:
(pass) Notifications API — CRUD > GET /notifications returns paginated list
(pass) Notifications API — CRUD > GET /notifications/unread returns unread notifications
(pass) Notifications API — CRUD > GET /notifications/count returns unread count
(pass) Notifications API — CRUD > POST /notifications/mark-all-read marks all as read
(pass) Notifications API — CRUD > Notifications require auth
(pass) NotificationTypes — unit import > NotificationTypes has required keys (and may include additional keys)
(pass) NotificationTypes — unit import > createNotification is a function
(pass) NotificationTypes — unit import > createOAuthNotification is a function
(pass) NotificationTypes — unit import > createOAuthNotification rejects invalid user gracefully
(pass) Notifications — mark single as read > PUT /notifications/:id/read with nonexistent ID
(pass) Notifications — mark single as read > DELETE /notifications/:id with nonexistent ID

src\tests\service-notificationTypes.test.js:
(pass) NotificationTypes > has required keys (and may include additional keys)
(pass) NotificationTypes > all values are non-empty strings
(pass) NotificationTypes > values match expected snake_case format

src\tests\service-notionMapping.test.js:
(pass) INVENTORY_SCHEMA > has title set to VaultLister Inventory
(pass) INVENTORY_SCHEMA > has all expected property keys
(pass) INVENTORY_SCHEMA > Condition has 5 select options
(pass) INVENTORY_SCHEMA > Status has 4 select options
(pass) SALES_SCHEMA > has title set to VaultLister Sales
(pass) SALES_SCHEMA > has all expected property keys
(pass) SALES_SCHEMA > Status has 5 options including completed and refunded
(pass) NOTES_SCHEMA > has title set to VaultLister Notes
(pass) NOTES_SCHEMA > has all expected property keys
(pass) mapInventoryToNotion > maps minimal item with title and id
(pass) mapInventoryToNotion > defaults title to Untitled when missing
(pass) mapInventoryToNotion > maps all optional fields when present
(pass) mapInventoryToNotion > truncates description to 2000 chars
(pass) mapInventoryToNotion > parses string prices to numbers
(pass) mapInventoryToNotion > handles zero price correctly
(pass) mapInventoryToNotion > does not include optional fields when absent
(pass) mapInventoryToNotion > does not include empty tags array
(pass) mapInventoryToNotion > handles non-array tags gracefully
(pass) mapNotionToInventory > maps full Notion page to inventory object
(pass) mapNotionToInventory > defaults missing properties
(pass) mapNotionToInventory > handles page with no properties key
(pass) mapSaleToNotion > maps minimal sale with item_title and id
(pass) mapSaleToNotion > defaults item title to Sale when missing
(pass) mapSaleToNotion > maps full sale with all fields
(pass) mapSaleToNotion > splits date on T to get date-only string
(pass) mapSaleToNotion > parses string prices to numbers
(pass) mapNotionToSale > maps full Notion page to sale object
(pass) mapNotionToSale > defaults missing properties
(pass) mapNotionToSale > handles page with no properties

src\tests\service-notionService-unit.test.js:
(pass) notionService > Schema constants > INVENTORY_SCHEMA has correct title and properties
(pass) notionService > Schema constants > SALES_SCHEMA has sale-related properties
(pass) notionService > Schema constants > NOTES_SCHEMA has note properties
(pass) notionService > mapInventoryToNotion > maps basic required fields
(pass) notionService > mapInventoryToNotion > maps all optional fields when present
(pass) notionService > mapInventoryToNotion > truncates description to 2000 characters
(pass) notionService > mapInventoryToNotion > defaults title to Untitled when missing
(pass) notionService > mapNotionToInventory > maps properties correctly
(pass) notionService > mapNotionToInventory > uses defaults for missing properties
(pass) notionService > mapSaleToNotion > maps sale fields correctly
(pass) notionService > mapSaleToNotion > defaults item_title to Sale
(pass) notionService > mapNotionToSale > maps properties and uses defaults
(pass) notionService > isConfigured > returns true when env token exists (no userId)
(pass) notionService > isConfigured > returns true when user has encrypted token in DB
(pass) notionService > isConfigured > returns false when no token anywhere
(pass) notionService > getClient > returns Client with user token from DB
(pass) notionService > getClient > throws when no token available
(pass) notionService > getSettings / deleteSettings > getSettings returns DB row
(pass) notionService > getSettings / deleteSettings > deleteSettings runs 4 cleanup queries
(pass) notionService > Sync operations > getSyncMap queries by user, entity type, and local ID
(pass) notionService > Sync operations > getSyncMapByNotionId queries by notion page ID
(pass) notionService > Sync operations > updateSyncStatus updates entry
(pass) notionService > Sync operations > getPendingSyncItems returns items
(pass) notionService > Sync operations > getPendingSyncItems filters by entity type
(pass) notionService > Sync history > logSyncHistory inserts and returns UUID
(pass) notionService > Sync history > getSyncHistory returns ordered results

src\tests\service-notionSync-unit.test.js:
(pass) service-notionSync-unit > performSync result shape > returns object with expected fields
(pass) service-notionSync-unit > performSync result shape > sync_id is a valid UUID format
(pass) service-notionSync-unit > performSync result shape > duration_ms is a non-negative number
(pass) service-notionSync-unit > performSync without settings > throws "not configured" when getSettings returns null
(pass) service-notionSync-unit > performSync without settings > throws for empty user ID when settings null
(pass) service-notionSync-unit > performSync with valid settings > completes with success status when no entities
(pass) service-notionSync-unit > performSync with valid settings > marks sync as in_progress via query.run
(pass) service-notionSync-unit > performSync with valid settings > calls logSyncHistory via query.run on completion
(pass) service-notionSync-unit > performSync with valid settings > manual flag is carried through to result
(pass) service-notionSync-unit > performSync concurrent prevention > throws when sync in_progress and within 5 minutes
(pass) service-notionSync-unit > performSync concurrent prevention > allows override when stuck sync older than 5 
minutes
(pass) service-notionSync-unit > performSync concurrent prevention > allows sync when last_sync_at is null (never 
synced)
(pass) service-notionSync-unit > resolveConflict > resolves keep_local conflict — throws without Notion token
(pass) service-notionSync-unit > resolveConflict > resolves ignore conflict without modifying data
(pass) service-notionSync-unit > resolveConflict > resolves keep_notion conflict by pulling from Notion
(pass) service-notionSync-unit > resolveConflict > merge without mergedData throws error
(pass) service-notionSync-unit > resolveConflict -- not found > throws when conflict does not exist
(pass) service-notionSync-unit > syncScheduler lifecycle > stopSyncScheduler is safe when not running
(pass) service-notionSync-unit > syncScheduler lifecycle > startSyncScheduler + stopSyncScheduler cycle
(pass) service-notionSync-unit > syncScheduler lifecycle > double start does not create duplicate intervals
(pass) service-notionSync-unit > syncScheduler lifecycle > double stop does not throw
(pass) service-notionSync-unit > sync directions > push direction with inventory DB pushes items
(pass) service-notionSync-unit > sync directions > bidirectional is the default direction
(pass) service-notionSync-unit > entity types filtering > defaults to all three entity types
(pass) service-notionSync-unit > entity types filtering > respects custom entity_types filter
(pass) service-notionSync-unit > entity types filtering > only syncs sales when sales entity type specified
(pass) service-notionSync-unit > entity types filtering > notes entity returns empty results (placeholder)
(pass) service-notionSync-unit > error handling > updates notion_settings with error message on failures
(pass) service-notionSync-unit > resolveConflict DB updates > marks conflict resolved=1 in database
(pass) service-notionSync-unit > resolveConflict DB updates > calls updateSyncStatus after resolution

src\tests\service-outgoingWebhooks-unit.test.js:
(pass) outgoingWebhooks.getEventTypes > returns a non-empty object
(pass) outgoingWebhooks.getEventTypes > includes inventory events
(pass) outgoingWebhooks.getEventTypes > includes listing events
(pass) outgoingWebhooks.getEventTypes > includes sale events
(pass) outgoingWebhooks.getEventTypes > includes offer events
(pass) outgoingWebhooks.getEventTypes > includes automation events
(pass) outgoingWebhooks.getEventTypes > includes account events
(pass) outgoingWebhooks.getEventTypes > each event type has a description string
(pass) outgoingWebhooks.getEventTypes > returns exactly the expected number of event types
(pass) outgoingWebhooks.getEventTypes > returns the same reference on successive calls
(pass) outgoingWebhooks.init > does not throw
(pass) outgoingWebhooks.init > can be called multiple times without error
(pass) outgoingWebhooks.trigger > returns undefined for unknown event type
(pass) outgoingWebhooks.trigger > returns undefined when no active webhooks found
(pass) outgoingWebhooks.trigger > returns undefined when query.all returns null
(pass) outgoingWebhooks.trigger > queries user webhooks with correct event type pattern
(pass) outgoingWebhooks.trigger > sanitizes sensitive fields from payload data
(pass) outgoingWebhooks.trigger > handles empty data gracefully
(pass) outgoingWebhooks.trigger > handles null data gracefully
(pass) outgoingWebhooks.trigger > handles undefined data gracefully
(pass) outgoingWebhooks.trigger > handles multiple webhooks for the same event
(pass) sanitizeWebhookData behavior > trigger passes with data containing only safe fields
(pass) sanitizeWebhookData behavior > trigger passes with data containing sensitive fields
(pass) sanitizeWebhookData behavior > trigger passes with nested non-object data values
(pass) outgoingWebhooksRouter — auth > returns 401 when user is not authenticated
(pass) outgoingWebhooksRouter — auth > returns 401 when user is undefined
(pass) outgoingWebhooksRouter — GET / > returns 200 with webhooks list
(pass) outgoingWebhooksRouter — GET / > includes availableEvents in response
(pass) outgoingWebhooksRouter — GET / > handles empty path as list route
(pass) outgoingWebhooksRouter — GET / > queries with correct user id
(pass) outgoingWebhooksRouter — POST / > returns 201 with created webhook
(pass) outgoingWebhooksRouter — POST / > returns 400 when name is missing
(pass) outgoingWebhooksRouter — POST / > returns 400 when url is missing
(pass) outgoingWebhooksRouter — POST / > returns 400 when events is missing
(pass) outgoingWebhooksRouter — POST / > returns 400 for invalid URL
(pass) outgoingWebhooksRouter — POST / > inserts webhook into database
(pass) outgoingWebhooksRouter — POST / > joins array events with comma
(pass) outgoingWebhooksRouter — POST / > accepts string events (not just array)
(pass) outgoingWebhooksRouter — POST / > handles custom headers parameter
(pass) outgoingWebhooksRouter — POST / > webhook secret message warns to save
(pass) outgoingWebhooksRouter — POST / > handles empty path as create route
(pass) outgoingWebhooksRouter — GET /:id > returns 200 with webhook and deliveries
(pass) outgoingWebhooksRouter — GET /:id > returns 404 when webhook not found
(pass) outgoingWebhooksRouter — GET /:id > queries with webhook id and user id
(pass) outgoingWebhooksRouter — PUT /:id > returns 404 when webhook does not exist
(pass) outgoingWebhooksRouter — PUT /:id > returns 200 when webhook is updated
(pass) outgoingWebhooksRouter — PUT /:id > updates name field
(pass) outgoingWebhooksRouter — PUT /:id > updates url field [15.00ms]
(pass) outgoingWebhooksRouter — PUT /:id > updates events field (array)
(pass) outgoingWebhooksRouter — PUT /:id > updates is_active field
(pass) outgoingWebhooksRouter — PUT /:id > updates headers field
(pass) outgoingWebhooksRouter — PUT /:id > sets updated_at timestamp
(pass) outgoingWebhooksRouter — PUT /:id > handles update with no fields (no-op)
(pass) outgoingWebhooksRouter — DELETE /:id > returns 200 on successful deletion
(pass) outgoingWebhooksRouter — DELETE /:id > executes DELETE SQL with correct params
(pass) outgoingWebhooksRouter — POST /:id/test > returns 404 when webhook not found
(pass) outgoingWebhooksRouter — POST /:id/test > returns 200 with test result when webhook exists
(pass) outgoingWebhooksRouter — POST /:id/test > handles webhook with custom headers
(pass) outgoingWebhooksRouter — POST /:id/rotate-secret > returns 404 when webhook not found
(pass) outgoingWebhooksRouter — POST /:id/rotate-secret > returns 200 with new secret
(pass) outgoingWebhooksRouter — POST /:id/rotate-secret > updates secret in database
(pass) outgoingWebhooksRouter — POST /:id/rotate-secret > message instructs user to update integration
(pass) outgoingWebhooksRouter — unknown routes > returns 404 for unsupported method
(pass) outgoingWebhooksRouter — unknown routes > returns 404 for unknown path
(pass) migration SQL > is exported as a string
(pass) migration SQL > creates user_webhooks table
(pass) migration SQL > creates webhook_deliveries table
(pass) migration SQL > includes foreign key on user_webhooks
(pass) migration SQL > includes foreign key on webhook_deliveries
(pass) migration SQL > creates index on user_webhooks
(pass) migration SQL > creates index on webhook_deliveries
(pass) migration SQL > user_webhooks has all required columns
(pass) migration SQL > webhook_deliveries has all required columns
(pass) retry and queue behavior > trigger queues deliveries for matching webhooks
(pass) retry and queue behavior > multiple triggers in succession do not throw
(pass) generateSignature behavior (via test endpoint) > test endpoint sends request with signature headers
(pass) HMAC-SHA256 signature algorithm > crypto.createHmac produces consistent output
(pass) HMAC-SHA256 signature algorithm > different secrets produce different signatures
(pass) HMAC-SHA256 signature algorithm > different payloads produce different signatures
(pass) HMAC-SHA256 signature algorithm > signature is a 64-char hex string
(pass) edge cases > trigger with very long event type string for unknown event [16.00ms]
(pass) edge cases > router handles path with multiple segments
(pass) edge cases > create webhook with null headers
(pass) edge cases > create webhook with empty events array
(pass) edge cases > update with is_active=true converts to 1
(pass) edge cases > update with is_active=false converts to 0
(pass) edge cases > delete on nonexistent webhook still returns 200

src\tests\service-outlookService.test.js:
(pass) parseOutlookMessage > parses basic message
(pass) parseOutlookMessage > parses HTML body into text
(pass) parseOutlookMessage > handles attachments
(pass) parseOutlookMessage > parses date into dateObj and dateISO
(pass) getMockOutlookEmails > returns array of mock emails
(pass) getMockOutlookEmails > each mock has required structure
(pass) getMockOutlookEmails > mocks have unique IDs

src\tests\service-platformSync-coverage.test.js:
(pass) isSyncSupported — coverage > returns true for all 6 supported platforms
(pass) isSyncSupported — coverage > is case-insensitive (toLowerCase)
(pass) isSyncSupported — coverage > returns false for unsupported platforms
(pass) getSupportedPlatforms — coverage > returns array of 7 platforms
(pass) getSupportedPlatforms — coverage > all entries have required shape
(pass) getSupportedPlatforms — coverage > 6 platforms have syncSupported=true, 1 (facebook) has false
(pass) getSupportedPlatforms — coverage > facebook entry has note field
(pass) getSupportedPlatforms — coverage > all sync-supported platforms have listings+orders capabilities
(pass) getSupportedPlatforms — coverage > all sync-supported platforms have oauthSupported=true
(pass) getSupportedPlatforms — coverage > platform names match expected list
(pass) syncShop — coverage > throws when shop not found
(pass) syncShop — coverage > throws when shop is not connected via OAuth
(pass) syncShop — coverage > throws when shop has no oauth_token
(pass) syncShop — coverage > throws for unsupported platform (e.g. facebook)
(pass) syncShop — coverage > routes to eBay sync handler and returns results
(pass) syncShop — coverage > routes to Poshmark sync handler
(pass) syncShop — coverage > routes to Mercari sync handler
(pass) syncShop — coverage > routes to Depop sync handler
(pass) syncShop — coverage > routes to Grailed sync handler
(pass) syncShop — coverage > routes to Etsy sync handler
(pass) syncShop — coverage > platform matching is case-insensitive via getSyncHandler
(pass) syncShop — coverage > sync results include listing create counts
(pass) syncShop — coverage > sync results include order create counts
(pass) syncShop — coverage > throws for totally unknown platform
(pass) getSyncStatus — coverage > throws when shop not found
(pass) getSyncStatus — coverage > returns status for connected shop with no pending tasks
(pass) getSyncStatus — coverage > returns status with pending sync task
(pass) getSyncStatus — coverage > returns status with processing sync task
(pass) getSyncStatus — coverage > reports isSyncSupported=false for facebook
(pass) getSyncStatus — coverage > reports sync error when present
(pass) getSyncStatus — coverage > isConnected is false for disconnected shop
(pass) getSyncStatus — coverage > passes correct shopId to task_queue query
(pass) getSyncStatus — coverage > returns all supported platform types correctly
(pass) default export — coverage > default export has all 4 functions

src\tests\service-platformSync-expanded.test.js:
(pass) ebaySync — expanded > listing external_data includes sku, listingId, condition, and syncedAt
(pass) ebaySync — expanded > order external_data includes orderId, lineItems, and fulfillmentStatus
(pass) ebaySync — expanded > listing prices are parsed as numbers from string values
(pass) ebaySync — expanded > listing quantity defaults to 1 for mock data
(pass) ebaySync — expanded > sale buyer_username is extracted from nested buyer object
(pass) ebaySync — expanded > sale net_profit = total - fees - shipping
(pass) ebaySync — expanded > handles mixed create and update in same sync
(pass) ebaySync — expanded > individual listing error does not abort entire sync
(pass) ebaySync — expanded > timestamps are valid ISO 8601 strings
(pass) poshmarkSync — expanded > sold listing maps to quantity 0, available to quantity 1
(pass) poshmarkSync — expanded > preserves brand and category in external data
(pass) poshmarkSync — expanded > preserves shares and likes counts in external data
(pass) poshmarkSync — expanded > flat $2.95 fee applies for sales $15 or under
(pass) poshmarkSync — expanded > default shipping cost is $7.97 when not specified
(pass) poshmarkSync — expanded > order external data includes listingId reference
(pass) poshmarkSync — expanded > update path modifies title, price, quantity, status, and external_data
(pass) mercariSync — expanded > condition and category are preserved in external data
(pass) mercariSync — expanded > views and likes are preserved in external data
(pass) mercariSync — expanded > listing prices match mock data exactly
(pass) mercariSync — expanded > order net profit = price - 10% fee - shipping
(pass) mercariSync — expanded > handles error on first listing without crashing second
(pass) mercariSync — expanded > on_sale maps to active status for all listings
(pass) mercariSync — expanded > handles missing column gracefully on shop update
(pass) depopSync — expanded > uses description field as listing title (not title field)
(pass) depopSync — expanded > external data includes size, brand, and likes
(pass) depopSync — expanded > order buyer_username is extracted correctly
(pass) depopSync — expanded > 10% fee on $22 order = $2.20
(pass) depopSync — expanded > shipping cost of $4.50 from mock data
(pass) depopSync — expanded > external_listing_id matches depop listing id
(pass) depopSync — expanded > order external_order_id matches depop order id
(pass) depopSync — expanded > error in order processing does not prevent results from returning
(pass) grailedSync — expanded > designer and condition are included in external data
(pass) grailedSync — expanded > followers count preserved in external data
(pass) grailedSync — expanded > listing prices match high-end mock data
(pass) grailedSync — expanded > 9% + $0.30 fee on $350 order = $31.80
(pass) grailedSync — expanded > $15 shipping cost from mock order data
(pass) grailedSync — expanded > for_sale status maps to active
(pass) grailedSync — expanded > order buyer_username from mock data
(pass) grailedSync — expanded > delivered order maps to completed status
(pass) grailedSync — expanded > sold listing quantity is 0, for_sale quantity is 1
(pass) etsySync — expanded > Etsy amount/divisor price conversion is accurate
(pass) etsySync — expanded > external data includes URL for each listing
(pass) etsySync — expanded > order grandtotal conversion from amount/divisor
(pass) etsySync — expanded > 9.5% + $0.25 fee calculation on $25 order
(pass) etsySync — expanded > sale date is converted from unix timestamp to ISO string
(pass) etsySync — expanded > order buyer_email used as buyer_username
(pass) etsySync — expanded > paid status maps to completed
(pass) etsySync — expanded > active state maps to active status for listings
(pass) etsySync — expanded > listing external_listing_id is stringified
(pass) etsySync — expanded > createEtsyListing — expanded > listing_id starts with etsy-new-
(pass) etsySync — expanded > createEtsyListing — expanded > returns title that matches input
(pass) etsySync — expanded > createEtsyListing — expanded > URL points to etsy.com
(pass) etsySync — expanded > updateEtsyListing — expanded > returns the same listing_id passed in
(pass) etsySync — expanded > updateEtsyListing — expanded > always returns success in mock mode
(pass) etsySync — expanded > deleteEtsyListing — expanded > returns success true in mock mode
(pass) etsySync — expanded > deleteEtsyListing — expanded > result does not contain listing_id
(pass) notionSync — expanded > performSync — edge cases > defaults to bidirectional direction
(pass) notionSync — expanded > performSync — edge cases > defaults to all entity types (inventory, sales, notes)
(pass) notionSync — expanded > performSync — edge cases > manual flag defaults to false
(pass) notionSync — expanded > performSync — edge cases > result includes sync_id as UUID
(pass) notionSync — expanded > performSync — edge cases > duration_ms is a non-negative number
(pass) notionSync — expanded > performSync — edge cases > completed_at is after started_at
(pass) notionSync — expanded > performSync — edge cases > supports push-only direction
(pass) notionSync — expanded > performSync — edge cases > supports pull-only direction
(pass) notionSync — expanded > performSync — edge cases > supports single entity type
(pass) notionSync — expanded > performSync — edge cases > notes sync returns empty results (placeholder)
(pass) notionSync — expanded > performSync — edge cases > inventory result has correct initial structure
(pass) notionSync — expanded > performSync — edge cases > sales result has correct initial structure
(pass) notionSync — expanded > resolveConflict — edge cases > throws when conflict not found
(pass) notionSync — expanded > resolveConflict — edge cases > marks conflict as resolved with resolution string
(pass) notionSync — expanded > resolveConflict — edge cases > merge without data throws
(pass) notionSync — expanded > scheduler lifecycle — expanded > start does not throw
(pass) notionSync — expanded > scheduler lifecycle — expanded > stop is safe before start [15.00ms]
(pass) notionSync — expanded > scheduler lifecycle — expanded > double start then stop
(pass) notionSync — expanded > scheduler lifecycle — expanded > stop after start then stop again
(pass) cross-platform consistency > ebay > syncs 2 listings and 1 orders
(pass) cross-platform consistency > ebay > startedAt precedes completedAt
(pass) cross-platform consistency > ebay > no errors on clean run
(pass) cross-platform consistency > ebay > all listings stored with correct user_id
(pass) cross-platform consistency > ebay > all listings stored with correct shop_id
(pass) cross-platform consistency > ebay > all listings have null inventory_id (not linked yet)
(pass) cross-platform consistency > ebay > all sales stored with correct user_id and shop_id
(pass) cross-platform consistency > ebay > external data JSON is parseable for all listings
(pass) cross-platform consistency > ebay > updates shop sync time on success
(pass) cross-platform consistency > ebay > all inserts have UUID-format IDs
(pass) cross-platform consistency > ebay > all insert timestamps are valid ISO 8601
(pass) cross-platform consistency > poshmark > syncs 3 listings and 1 orders
(pass) cross-platform consistency > poshmark > startedAt precedes completedAt
(pass) cross-platform consistency > poshmark > no errors on clean run
(pass) cross-platform consistency > poshmark > all listings stored with correct user_id
(pass) cross-platform consistency > poshmark > all listings stored with correct shop_id
(pass) cross-platform consistency > poshmark > all listings have null inventory_id (not linked yet)
(pass) cross-platform consistency > poshmark > all sales stored with correct user_id and shop_id
(pass) cross-platform consistency > poshmark > external data JSON is parseable for all listings
(pass) cross-platform consistency > poshmark > updates shop sync time on success
(pass) cross-platform consistency > poshmark > all inserts have UUID-format IDs
(pass) cross-platform consistency > poshmark > all insert timestamps are valid ISO 8601
(pass) cross-platform consistency > mercari > syncs 2 listings and 1 orders
(pass) cross-platform consistency > mercari > startedAt precedes completedAt
(pass) cross-platform consistency > mercari > no errors on clean run
(pass) cross-platform consistency > mercari > all listings stored with correct user_id
(pass) cross-platform consistency > mercari > all listings stored with correct shop_id
(pass) cross-platform consistency > mercari > all listings have null inventory_id (not linked yet)
(pass) cross-platform consistency > mercari > all sales stored with correct user_id and shop_id
(pass) cross-platform consistency > mercari > external data JSON is parseable for all listings
(pass) cross-platform consistency > mercari > updates shop sync time on success
(pass) cross-platform consistency > mercari > all inserts have UUID-format IDs
(pass) cross-platform consistency > mercari > all insert timestamps are valid ISO 8601
(pass) cross-platform consistency > depop > syncs 3 listings and 1 orders
(pass) cross-platform consistency > depop > startedAt precedes completedAt
(pass) cross-platform consistency > depop > no errors on clean run
(pass) cross-platform consistency > depop > all listings stored with correct user_id
(pass) cross-platform consistency > depop > all listings stored with correct shop_id
(pass) cross-platform consistency > depop > all listings have null inventory_id (not linked yet)
(pass) cross-platform consistency > depop > all sales stored with correct user_id and shop_id
(pass) cross-platform consistency > depop > external data JSON is parseable for all listings
(pass) cross-platform consistency > depop > updates shop sync time on success
(pass) cross-platform consistency > depop > all inserts have UUID-format IDs
(pass) cross-platform consistency > depop > all insert timestamps are valid ISO 8601
(pass) cross-platform consistency > grailed > syncs 3 listings and 1 orders
(pass) cross-platform consistency > grailed > startedAt precedes completedAt
(pass) cross-platform consistency > grailed > no errors on clean run
(pass) cross-platform consistency > grailed > all listings stored with correct user_id
(pass) cross-platform consistency > grailed > all listings stored with correct shop_id
(pass) cross-platform consistency > grailed > all listings have null inventory_id (not linked yet)
(pass) cross-platform consistency > grailed > all sales stored with correct user_id and shop_id
(pass) cross-platform consistency > grailed > external data JSON is parseable for all listings
(pass) cross-platform consistency > grailed > updates shop sync time on success
(pass) cross-platform consistency > grailed > all inserts have UUID-format IDs
(pass) cross-platform consistency > grailed > all insert timestamps are valid ISO 8601
(pass) cross-platform consistency > etsy > syncs 2 listings and 1 orders
(pass) cross-platform consistency > etsy > startedAt precedes completedAt
(pass) cross-platform consistency > etsy > no errors on clean run
(pass) cross-platform consistency > etsy > all listings stored with correct user_id
(pass) cross-platform consistency > etsy > all listings stored with correct shop_id
(pass) cross-platform consistency > etsy > all listings have null inventory_id (not linked yet)
(pass) cross-platform consistency > etsy > all sales stored with correct user_id and shop_id
(pass) cross-platform consistency > etsy > external data JSON is parseable for all listings
(pass) cross-platform consistency > etsy > updates shop sync time on success
(pass) cross-platform consistency > etsy > all inserts have UUID-format IDs
(pass) cross-platform consistency > etsy > all insert timestamps are valid ISO 8601

src\tests\service-platformSync.test.js:
(pass) isSyncSupported > returns true for ebay
(pass) isSyncSupported > returns true for poshmark
(pass) isSyncSupported > returns true for mercari
(pass) isSyncSupported > returns true for depop
(pass) isSyncSupported > returns true for grailed
(pass) isSyncSupported > returns true for etsy
(pass) isSyncSupported > returns false for unknown platform
(pass) isSyncSupported > is case-insensitive
(pass) isSyncSupported > returns false for facebook (not yet supported)
(pass) getSupportedPlatforms > returns an array
(pass) getSupportedPlatforms > returns 7 platforms
(pass) getSupportedPlatforms > each platform has required shape
(pass) getSupportedPlatforms > 6 platforms have syncSupported=true
(pass) getSupportedPlatforms > facebook has syncSupported=false with note
(pass) getSupportedPlatforms > supported platforms have listings and orders capabilities

src\tests\service-pricingEngine-coverage.test.js:
(pass) generatePricePrediction > throws when item not found
(pass) generatePricePrediction > returns prediction with all required fields
(pass) generatePricePrediction > stores prediction in database
(pass) generatePricePrediction > handles DB insert failure gracefully
(pass) generatePricePrediction > predicted_price is a positive number
(pass) generatePricePrediction > confidence is between 0.2 and 0.95
(pass) generatePricePrediction > price_range_low is at least cost_price
(pass) generatePricePrediction > price_range_high is >= predicted_price
(pass) generatePricePrediction > comparable_count is between 5 and 14 (generated)
(pass) generatePricePrediction > passes platform option through to prediction
(pass) generatePricePrediction > platform defaults to null when not specified
(pass) generatePricePrediction > expires_at is 7 days in the future
(pass) generatePricePrediction > handles item with no list_price (uses default 50)
(pass) generatePricePrediction > handles item with no condition (uses default multiplier)
(pass) generatePricePrediction > handles item with no cost_price
(pass) generatePricePrediction > handles item with unknown condition
(pass) generatePricePrediction > recommendation is one of expected actions
(pass) generatePricePrediction > seasonality_factor is a valid number
(pass) generateBatchPredictions > returns predictions for all items
(pass) generateBatchPredictions > returns error objects for items that fail
(pass) generateBatchPredictions > handles empty array input
(pass) generateBatchPredictions > handles all items failing
(pass) generateBatchPredictions > passes options to each prediction
(pass) calculateDemandScore — extended > handles missing daysToSell in comparables (defaults to 14)
(pass) calculateDemandScore — extended > handles no list_price in item (defaults to 50)
(pass) calculateDemandScore — extended > very slow selling items reduce score
(pass) calculateDemandScore — extended > high-price items get penalty
(pass) calculateDemandScore — extended > score cannot go below 0
(pass) calculateDemandScore — extended > score cannot exceed 100
(pass) calculateDemandScore — extended > medium-speed selling (7-14 days) gives moderate boost
(pass) calculateDemandScore — extended > fewer than 3 comparables penalize score [15.00ms]
(pass) calculateDemandScore — extended > empty comparables still produces valid score
(pass) getRecommendation — extended > handles zero list_price
(pass) getRecommendation — extended > handles no list_price
(pass) getRecommendation — extended > handles no created_at (daysSinceListed = 0)
(pass) getRecommendation — extended > stale listing with high demand still holds
(pass) getRecommendation — extended > moderate price diff with high demand falls to default hold
(pass) getRecommendation — extended > large positive priceDiff with low demand falls to default
(pass) getRecommendation — extended > large negative priceDiff with high demand falls to default
(pass) getDemandForecast — extended > shoes category recognized
(pass) getDemandForecast — extended > electronics category recognized
(pass) getDemandForecast — extended > tech category recognized as electronics
(pass) getDemandForecast — extended > phone category recognized as electronics
(pass) getDemandForecast — extended > home category recognized
(pass) getDemandForecast — extended > furniture category recognized as home
(pass) getDemandForecast — extended > accessories category recognized
(pass) getDemandForecast — extended > bag category recognized as accessories
(pass) getDemandForecast — extended > jewelry category recognized as accessories
(pass) getDemandForecast — extended > boot category recognized as shoes
(pass) getDemandForecast — extended > shirt category recognized as clothing
(pass) getDemandForecast — extended > dress category recognized as clothing
(pass) getDemandForecast — extended > pants category recognized as clothing
(pass) getDemandForecast — extended > unknown category uses default seasonality
(pass) getDemandForecast — extended > null category uses default seasonality
(pass) getDemandForecast — extended > demand_level is high when seasonality >= 1.05
(pass) getDemandForecast — extended > price_trend is rising when seasonality >= 1.15
(pass) getDemandForecast — extended > demand_level is low when seasonality <= 0.85
(pass) getDemandForecast — extended > notes contain category name
(pass) getDemandForecast — extended > notes contain month name
(pass) getDemandForecast — extended > forecast_date matches today
(pass) Condition multiplier coverage > new condition gets 1.0 multiplier
(pass) Condition multiplier coverage > new_with_tags condition gets 1.0 multiplier
(pass) Condition multiplier coverage > excellent condition gets 0.85 multiplier
(pass) Condition multiplier coverage > good condition gets 0.75 multiplier
(pass) Condition multiplier coverage > fair condition gets 0.60 multiplier
(pass) Condition multiplier coverage > poor condition gets 0.40 multiplier
(pass) Condition multiplier coverage > like_new gets 0.92 multiplier
(pass) Condition multiplier coverage > poor condition produces lower price than new
(pass) Seasonality factor — category routing > clothing category uses clothing seasonality
(pass) Seasonality factor — category routing > shoe category uses shoes seasonality
(pass) Seasonality factor — category routing > electronics category uses electronics seasonality
(pass) Seasonality factor — category routing > home category uses home seasonality
(pass) Seasonality factor — category routing > accessories category uses accessories seasonality
(pass) Seasonality factor — category routing > unknown category uses default seasonality
(pass) Seasonality factor — category routing > null category uses default seasonality
(pass) default export > default export has all expected functions
(pass) avg_days_to_sell via generatePricePrediction > avg_days_to_sell is a positive integer
(pass) price range and variance > price_range_high > price_range_low

src\tests\service-pricingEngine.test.js:
(pass) PricingEngine - calculateDemandScore > returns base score of 50 with no comparables
(pass) PricingEngine - calculateDemandScore > boosts score for fast-selling comparables
(pass) PricingEngine - calculateDemandScore > boosts score for many comparables
(pass) PricingEngine - calculateDemandScore > clamps score between 0 and 100
(pass) PricingEngine - calculateDemandScore > sweet spot pricing boosts score
(pass) PricingEngine - getRecommendation > recommends price_up for high demand and low current price
(pass) PricingEngine - getRecommendation > recommends price_down for low demand and high current price
(pass) PricingEngine - getRecommendation > recommends hold when price is near optimal
(pass) PricingEngine - getRecommendation > recommends relist for stale listings with moderate demand
(pass) PricingEngine - getRecommendation > always returns action and reason
(pass) PricingEngine - getDemandForecast > returns forecast with required fields
(pass) PricingEngine - getDemandForecast > includes platform when specified
(pass) PricingEngine - getDemandForecast > platform defaults to null
(pass) PricingEngine - getDemandForecast > demand_level is one of expected values
(pass) PricingEngine - getDemandForecast > price_trend is one of expected values
(pass) PricingEngine - getDemandForecast > seasonality_index is a valid number
(pass) PricingEngine - getDemandForecast > different categories produce different seasonality
(pass) PricingEngine - getDemandForecast > forecast_date is ISO date format
(pass) PricingEngine - getDemandForecast > notes is a non-empty string

src\tests\service-receiptDetector.test.js:
(pass) ReceiptDetector - DEFAULT_RECEIPT_SENDERS > contains major selling platforms
(pass) ReceiptDetector - DEFAULT_RECEIPT_SENDERS > contains shipping carriers
(pass) ReceiptDetector - DEFAULT_RECEIPT_SENDERS > contains retail/thrift stores
(pass) ReceiptDetector - DEFAULT_RECEIPT_SENDERS > has reasonable number of senders
(pass) ReceiptDetector - RECEIPT_SUBJECT_PATTERNS > matches receipt keywords
(pass) ReceiptDetector - RECEIPT_SUBJECT_PATTERNS > does not match random subjects
(pass) ReceiptDetector - detectReceipt > detects eBay sale receipt
(pass) ReceiptDetector - detectReceipt > detects PayPal payment
(pass) ReceiptDetector - detectReceipt > detects shipping label from USPS
(pass) ReceiptDetector - detectReceipt > detects receipt from subject only (unknown sender)
(pass) ReceiptDetector - detectReceipt > rejects non-receipt email
(pass) ReceiptDetector - detectReceipt > boosts confidence for PDF attachments
(pass) ReceiptDetector - detectReceipt > caps confidence at 100
(pass) ReceiptDetector - detectReceipt > respects user custom filters
(pass) ReceiptDetector - detectReceipt > returns full result structure
(pass) ReceiptDetector - inferReceiptType > detects sale from body text
(pass) ReceiptDetector - inferReceiptType > detects shipping from subject
(pass) ReceiptDetector - inferReceiptType > detects expense from body
(pass) ReceiptDetector - inferReceiptType > defaults to purchase
(pass) ReceiptDetector - inferReceiptType > handles missing body gracefully
(pass) ReceiptDetector - extractVendorName > extracts from sender name
(pass) ReceiptDetector - extractVendorName > cleans up noreply suffix
(pass) ReceiptDetector - extractVendorName > falls back to domain name
(pass) ReceiptDetector - extractVendorName > capitalizes domain name
(pass) ReceiptDetector - buildSenderQuery > builds Gmail query from default senders
(pass) ReceiptDetector - buildSenderQuery > uses custom filters when provided
(pass) ReceiptDetector - buildSenderQuery > default query has all senders

src\tests\service-redis.test.js:
(pass) Redis - Connection State > isRedisConnected returns boolean
(pass) Redis - Connection State > getClient returns client or null
(pass) Redis - Set and Get (in-memory fallback) > set returns true
(pass) Redis - Set and Get (in-memory fallback) > get returns stored value
(pass) Redis - Set and Get (in-memory fallback) > get returns null for nonexistent key
(pass) Redis - Set and Get (in-memory fallback) > set with custom TTL
(pass) Redis - Delete > del removes key
(pass) Redis - Delete > del on nonexistent key returns true
(pass) Redis - Increment > incr increments counter
(pass) Redis - Increment > incr on nonexistent key starts at 1
(pass) Redis - Increment > incr increments multiple times
(pass) Redis - Exists > exists returns 1 for existing key
(pass) Redis - Exists > exists returns 0 for nonexistent key
(pass) Redis - TTL and Expire > expire sets TTL on key
(pass) Redis - TTL and Expire > ttl returns remaining seconds
(pass) Redis - TTL and Expire > ttl returns -1 or -2 for nonexistent key

src\tests\service-sentry-unit.test.js:
(pass) service-sentry-unit > sentryService.init() > logs message when no DSN configured
(pass) service-sentry-unit > sentryService.init() > does not set initialized=true when DSN is missing
(pass) service-sentry-unit > sentryService.init() > init is callable multiple times without error
(pass) service-sentry-unit > captureException disabled mode > returns null when IS_ENABLED is false
(pass) service-sentry-unit > captureException disabled mode > logs the error via logger.error when disabled
(pass) service-sentry-unit > captureException with Error > captureException accepts Error with context
(pass) service-sentry-unit > captureException with Error > captureException accepts Error with empty context
(pass) service-sentry-unit > captureException with Error > captureException logs error message in disabled mode
(pass) service-sentry-unit > captureMessage > returns null when disabled
(pass) service-sentry-unit > captureMessage > accepts info level (default)
(pass) service-sentry-unit > captureMessage > accepts warning level
(pass) service-sentry-unit > captureMessage > accepts error level
(pass) service-sentry-unit > captureMessage > logs message via logger.info when disabled
(pass) service-sentry-unit > setUser and clearUser > setUser does not throw with valid user
(pass) service-sentry-unit > setUser and clearUser > setUser with null user does not throw
(pass) service-sentry-unit > setUser and clearUser > clearUser sets _currentUser to null
(pass) service-sentry-unit > setUser and clearUser > clearUser when already null does not throw
(pass) service-sentry-unit > addBreadcrumb > does not add breadcrumbs when disabled
(pass) service-sentry-unit > addBreadcrumb > addBreadcrumb does not throw with any input
(pass) service-sentry-unit > addBreadcrumb > breadcrumbs array caps at 100 when manually forced
(pass) service-sentry-unit > startTransaction > returns object with finish function when disabled
(pass) service-sentry-unit > startTransaction > finish does not throw when disabled
(pass) service-sentry-unit > startTransaction > returns minimal object in disabled mode
(pass) service-sentry-unit > transaction structure > disabled transaction finish is a no-op
(pass) service-sentry-unit > sentryMiddleware > returns null when disabled
(pass) service-sentry-unit > sentryMiddleware > is a function
(pass) service-sentry-unit > sentryMiddleware > handles ctx with user property without error
(pass) service-sentry-unit > sentryMiddleware > handles ctx without user property
(pass) service-sentry-unit > sentryErrorHandler scrubs headers > removes authorization header
(pass) service-sentry-unit > sentryErrorHandler scrubs headers > removes cookie header
(pass) service-sentry-unit > sentryErrorHandler scrubs headers > removes x-csrf-token header
(pass) service-sentry-unit > sentryErrorHandler scrubs query params > removes token from query
(pass) service-sentry-unit > sentryErrorHandler scrubs query params > removes api_key from query
(pass) service-sentry-unit > sentryErrorHandler scrubs query params > removes key from query
(pass) service-sentry-unit > _parseStackTrace > returns empty array for null
(pass) service-sentry-unit > _parseStackTrace > returns empty array for empty string
(pass) service-sentry-unit > _parseStackTrace > parses structured stack with function name and location
(pass) service-sentry-unit > _parseStackTrace > handles stack lines without function names
(pass) service-sentry-unit > _parseStackTrace > parses real Error stack
(pass) service-sentry-unit > _parseStackTrace > skips first line (Error: message)
(pass) service-sentry-unit > _generateEventId > returns 32-character hex string
(pass) service-sentry-unit > _generateEventId > generates unique IDs
(pass) service-sentry-unit > _generateEventId > contains no dashes
(pass) service-sentry-unit > disabled mode — all methods > captureException returns null
(pass) service-sentry-unit > disabled mode — all methods > captureMessage returns null
(pass) service-sentry-unit > disabled mode — all methods > sentryMiddleware returns null
(pass) service-sentry-unit > disabled mode — all methods > startTransaction returns object with no-op finish
(pass) service-sentry-unit > disabled mode — all methods > setUser returns undefined (no-op) when disabled
(pass) service-sentry-unit > disabled mode — all methods > addBreadcrumb returns undefined when disabled
(pass) service-sentry-unit > slow transaction logging > disabled transaction finish does not call logger.warn
(pass) service-sentry-unit > exports > sentryService is the default export
(pass) service-sentry-unit > exports > sentryMiddleware is a named export
(pass) service-sentry-unit > exports > sentryErrorHandler is a named export
(pass) service-sentry-unit > sentryService properties > has dsn property
(pass) service-sentry-unit > sentryService properties > has initialized property
(pass) service-sentry-unit > sentryService properties > dsn matches SENTRY_DSN env var
(pass) service-sentry-unit > sentryErrorHandler with user context > includes user id when user is present
(pass) service-sentry-unit > sentryErrorHandler with user context > handles missing user gracefully
(pass) service-sentry-unit > _sendToSentry > returns without calling fetch when dsn is falsy
(pass) service-sentry-unit > _sendToSentry > handles network errors gracefully when dsn is set
(pass) service-sentry-unit > _sendToSentry > logs error when response is not ok
(pass) service-sentry-unit > _sendToSentry > sends correct request to Sentry store endpoint

src\tests\service-sentry.test.js:
(pass) sentryService object > has init method
(pass) sentryService object > has captureException method
(pass) sentryService object > has captureMessage method
(pass) sentryService object > has setUser method
(pass) sentryService object > has clearUser method
(pass) sentryService object > has addBreadcrumb method
(pass) sentryService object > has startTransaction method
(pass) sentryService._generateEventId > returns 32-character hex string
(pass) sentryService._generateEventId > generates unique IDs across calls
(pass) sentryService._parseStackTrace > parses real Error stack trace
(pass) sentryService._parseStackTrace > returns empty array for null stack
(pass) sentryService._parseStackTrace > returns empty array for empty string
(pass) sentryService._parseStackTrace > parses structured stack frame
(pass) sentryService in non-production mode > startTransaction returns object with finish function
(pass) sentryService in non-production mode > setUser does not throw
(pass) sentryService in non-production mode > clearUser does not throw
(pass) sentryService in non-production mode > addBreadcrumb does not throw
(pass) sentryMiddleware > is a function
(pass) sentryMiddleware > returns null in non-production mode
(pass) sentryErrorHandler > is a function

src\tests\service-tokenRefresh.test.js:
(pass) getOAuthConfig > returns config for ebay
(pass) getOAuthConfig > returns config for poshmark
(pass) getOAuthConfig > returns config for mercari
(pass) getOAuthConfig > returns config for depop
(pass) getOAuthConfig > returns config for grailed
(pass) getOAuthConfig > returns config for facebook
(pass) getOAuthConfig > mock mode configs have token URL
(pass) getOAuthConfig > returns config object for any platform (generic fallback)
(pass) getRefreshSchedulerStatus > returns status object
(pass) getRefreshSchedulerStatus > includes interval and buffer config
(pass) getRefreshSchedulerStatus > includes maxFailures
(pass) startTokenRefreshScheduler / stopTokenRefreshScheduler > starting scheduler sets isRunning to true [16.00ms]
(pass) startTokenRefreshScheduler / stopTokenRefreshScheduler > stopping scheduler sets isRunning to false
(pass) startTokenRefreshScheduler / stopTokenRefreshScheduler > double stop does not throw
(pass) startTokenRefreshScheduler / stopTokenRefreshScheduler > start after stop restarts

src\tests\service-tokenRefreshScheduler-coverage.test.js:
(pass) getOAuthConfig — coverage > mock mode returns all expected fields for every platform
(pass) getOAuthConfig — coverage > mock mode uses BASE_URL env if set
(pass) getOAuthConfig — coverage > mock mode uses OAUTH_REDIRECT_URI env if set
(pass) getOAuthConfig — coverage > real mode eBay uses sandbox by default
(pass) getOAuthConfig — coverage > real mode eBay uses production URLs when EBAY_ENVIRONMENT=production
(pass) getOAuthConfig — coverage > real mode poshmark has correct URLs
(pass) getOAuthConfig — coverage > real mode mercari returns config object
(pass) getOAuthConfig — coverage > real mode depop returns config object
(pass) getOAuthConfig — coverage > real mode grailed returns config object
(pass) getOAuthConfig — coverage > real mode facebook uses v18 graph URLs
(pass) getOAuthConfig — coverage > unknown platform falls back to eBay config in real mode
(pass) getOAuthConfig — coverage > eBay real mode includes scopes for sell.inventory, sell.account, sell.fulfillment
(pass) scheduler lifecycle — coverage > startTokenRefreshScheduler sets isRunning=true
(pass) scheduler lifecycle — coverage > double start does not create second interval
(pass) scheduler lifecycle — coverage > stop after start sets isRunning=false
(pass) scheduler lifecycle — coverage > stop without start is safe
(pass) scheduler lifecycle — coverage > start-stop-start-stop cycle works correctly
(pass) refreshExpiringTokens — coverage > returns immediately when no tokens are expiring
(pass) refreshExpiringTokens — coverage > processes a single expiring shop in mock mode [516.00ms]
(pass) refreshExpiringTokens — coverage > processes multiple shops sequentially [1015.00ms]
(pass) refreshExpiringTokens — coverage > continues to next shop when one fails [1032.00ms]
(pass) refreshExpiringTokens — coverage > handles query.all throwing "no such column" with fallback query
(pass) refreshExpiringTokens — coverage > handles query.all throwing non-column error by re-throwing
(pass) refreshExpiringTokens — coverage > skips when previous cycle is still running [500.00ms]
(pass) refreshShopToken — coverage > mock mode returns success with new access_token
(pass) refreshShopToken — coverage > mock mode updates shops table with encrypted tokens
(pass) refreshShopToken — coverage > uses new refresh_token if returned by provider
(pass) refreshShopToken — coverage > falls back to simpler UPDATE when "no such column" error on update
(pass) refreshShopToken — coverage > re-throws non-column errors from UPDATE
(pass) refreshShopToken — coverage > throws when platform has no token URL (unknown platform, not mock mode)
(pass) refreshShopToken — coverage > records failure and creates notification on error
(pass) refreshShopToken — coverage > auto-disconnects after MAX_CONSECUTIVE_FAILURES
(pass) refreshShopToken — coverage > records failure even when error columns are missing
(pass) refreshShopToken — coverage > handles notification creation failure gracefully
(pass) refreshShopToken — coverage > handles disconnect notification failure gracefully
(pass) refreshShopToken — coverage > does not auto-disconnect when failures are below threshold
(pass) refreshShopToken — coverage > does not create notification when shop has no user_id
(pass) refreshShopToken — coverage > real mode performs HTTP token refresh
(pass) refreshShopToken — coverage > real mode eBay includes Basic auth header
(pass) refreshShopToken — coverage > real mode throws on non-OK response
(pass) refreshShopToken — coverage > real mode without new refresh_token keeps original
(pass) refreshShopToken — coverage > real mode defaults expires_in to 3600 when not provided
(pass) refreshShopToken — coverage > non-ebay platform does not include Basic auth header in real mode
(pass) manualRefreshToken — coverage > throws when shop not found [15.00ms]
(pass) manualRefreshToken — coverage > throws when shop has no refresh token
(pass) manualRefreshToken — coverage > succeeds in mock mode for valid shop
(pass) manualRefreshToken — coverage > passes correct shopId and userId to query
(pass) getRefreshSchedulerStatus — coverage > returns correct shape with stats from DB
(pass) getRefreshSchedulerStatus — coverage > uses fallback query on "no such column" error
(pass) getRefreshSchedulerStatus — coverage > returns zeroed stats on non-column error
(pass) getRefreshSchedulerStatus — coverage > isRunning is true when scheduler is active

src\tests\service-tokenRefreshScheduler-unit.test.js:
(pass) tokenRefreshScheduler > getOAuthConfig > mock mode returns local URLs for ebay
(pass) tokenRefreshScheduler > getOAuthConfig > mock mode returns local URLs for poshmark
(pass) tokenRefreshScheduler > getOAuthConfig > mock mode includes clientId and scopes
(pass) tokenRefreshScheduler > getOAuthConfig > mock mode includes redirectUri
(pass) tokenRefreshScheduler > getOAuthConfig > real mode returns eBay sandbox URLs by default
(pass) tokenRefreshScheduler > getOAuthConfig > real mode returns platform-specific config for poshmark
(pass) tokenRefreshScheduler > getOAuthConfig > falls back to ebay for unknown platform
(pass) tokenRefreshScheduler > getOAuthConfig > returns Facebook config with graph API URLs
(pass) tokenRefreshScheduler > scheduler lifecycle > stopTokenRefreshScheduler is safe when not running
(pass) tokenRefreshScheduler > scheduler lifecycle > refreshExpiringTokens handles no expiring tokens
(pass) tokenRefreshScheduler > getRefreshSchedulerStatus > returns status with expected shape
(pass) tokenRefreshScheduler > getRefreshSchedulerStatus > handles missing DB columns with fallback

src\tests\service-webhookProcessor-unit.test.js:
(pass) processWebhookEvent > listing.created sends notification and returns success
(pass) processWebhookEvent > listing.updated syncs local listing data
(pass) processWebhookEvent > listing.sold sends important notification and dispatches to user endpoints
(pass) processWebhookEvent > listing.ended sends notification
(pass) processWebhookEvent > listing.views tracks engagement
(pass) processWebhookEvent > order.created sends important notification
(pass) processWebhookEvent > order.shipped sends notification
(pass) processWebhookEvent > order.delivered sends notification
(pass) processWebhookEvent > order.cancelled sends important notification
(pass) processWebhookEvent > offer.received sends important notification and dispatches
(pass) processWebhookEvent > offer.accepted returns logged action
(pass) processWebhookEvent > offer.declined returns logged action
(pass) processWebhookEvent > offer.expired sends notification
(pass) processWebhookEvent > account.synced sends sync complete notification
(pass) processWebhookEvent > account.error sends important error notification
(pass) processWebhookEvent > inventory.low_stock sends low stock notification
(pass) processWebhookEvent > inventory.out_of_stock sends important out of stock notification
(pass) processWebhookEvent > returns error for unknown event type
(pass) processWebhookEvent > parses string payload as JSON
(pass) processWebhookEvent > accepts object payload directly
(pass) processWebhookEvent > returns error when handler throws
(pass) processWebhookEvent > updates event status to processed on success
(pass) processWebhookEvent > updates event status to failed on error
(pass) processWebhookEvent > event without user_id skips notification for listing.created
(pass) processWebhookEvent > account.synced with missing itemsSynced defaults to 0 in message
(pass) processWebhookEvent > processWebhookEvent with invalid JSON string payload returns error
(pass) verifySignature > returns true for valid signature
(pass) verifySignature > returns true for valid string payload signature
(pass) verifySignature > returns false for invalid signature
(pass) verifySignature > returns false for tampered payload
(pass) verifySignature > returns false for missing signature (null)
(pass) verifySignature > returns false for missing signature (undefined)
(pass) verifySignature > returns false for empty string signature
(pass) verifySignature > returns false for missing secret
(pass) verifySignature > returns false for mismatched length signatures
(pass) dispatchToUserEndpoints > does nothing when no endpoints are registered
(pass) dispatchToUserEndpoints > dispatches to enabled endpoints with correct headers
(pass) dispatchToUserEndpoints > dispatches to multiple endpoints
(pass) dispatchToUserEndpoints > updates endpoint success state on successful dispatch
(pass) dispatchToUserEndpoints > increments failure count when dispatch fails with non-ok response
(pass) dispatchToUserEndpoints > increments failure count when fetch throws network error
(pass) dispatchToUserEndpoints > disables endpoint and sends notification after 10+ failures
(pass) dispatchToUserEndpoints > does not disable endpoint when failure count is below threshold
(pass) dispatchToUserEndpoints > sends correct body payload with event type and timestamp
(pass) dispatchToUserEndpoints > generates correct HMAC signature for dispatch
(pass) edge cases > listing.views with missing platform defaults gracefully
(pass) edge cases > listing.views without listingId still succeeds
(pass) edge cases > listing.updated without listingId still succeeds

src\tests\service-webhookProcessor.test.js:
(pass) Webhook Signature Verification > should accept valid signature
(pass) Webhook Signature Verification > should reject invalid signature
(pass) Webhook Signature Verification > should reject wrong secret
(pass) Webhook Signature Verification > should reject tampered payload
(pass) Webhook Signature Verification > should reject empty signature
(pass) Webhook Signature Verification > should reject null/undefined inputs
(pass) Webhook Signature Verification > should handle empty payload

src\tests\service-websocket-unit.test.js:
(pass) MESSAGE_TYPES constants > has connection types (PING, PONG, AUTH, AUTH_SUCCESS, AUTH_FAILED)
(pass) MESSAGE_TYPES constants > has subscription types
(pass) MESSAGE_TYPES constants > has inventory event types
(pass) MESSAGE_TYPES constants > has listing event types
(pass) MESSAGE_TYPES constants > has sale, offer, notification, chat, presence, error types
(pass) MESSAGE_TYPES constants > all values are unique strings
(pass) handleConnection > assigns connectionId and sets up data
(pass) handleConnection > sends connection acknowledgment with connectionId
(pass) handleConnection > registers message, close, error, pong handlers
(pass) handleAuth > authenticates with valid JWT and sends AUTH_SUCCESS
(pass) handleAuth > authenticates using decoded.id fallback
(pass) handleAuth > rejects invalid JWT and sends AUTH_FAILED
(pass) handleAuth > rejects auth when JWT_SECRET is not configured
(pass) handleAuth > auto-subscribes to user-specific topics on auth
(pass) handleSubscribe > subscribes to valid topics for authenticated user
(pass) handleSubscribe > rejects subscription to another users topics
(pass) handleSubscribe > rejects subscription when not authenticated
(pass) handleSubscribe > rejects presence subscription without authentication
(pass) handleSubscribe > exceeds max 50 subscriptions
(pass) handleSubscribe > rejects invalid topic format (special characters)
(pass) handleSubscribe > rejects topic over 100 characters
(pass) handleSubscribe > allows chat topics for authenticated users
(pass) handleSubscribe > allows presence for authenticated user
(pass) handleUnsubscribe > removes topics from subscriptions
(pass) handleUnsubscribe > handles single topic (non-array)
(pass) handleDisconnect > cleans up user connections and subscriptions
(pass) handleDisconnect > keeps user in connections if other connections exist
(pass) send() > calls ws.send with JSON-stringified data when readyState is OPEN
(pass) send() > does not send when readyState is not OPEN
(pass) sendToUser() > sends to all connections for a user
(pass) sendToUser() > does nothing for unknown user
(pass) broadcast() > sends to all connections subscribed to a topic
(pass) broadcastAll() > sends to every connected client
(pass) handleMessage > responds to PING with PONG
(pass) handleMessage > handles invalid JSON gracefully and sends error
(pass) handleMessage > routes AUTH messages to handleAuth
(pass) handleMessage > routes SUBSCRIBE messages
(pass) handleMessage > routes UNSUBSCRIBE messages
(pass) handleMessage > ignores CHAT_MESSAGE from unauthenticated user
(pass) handleMessage > logs unknown message types
(pass) rate limiting > allows up to 60 messages in a window
(pass) rate limiting > closes connection after exceeding 60 messages
(pass) max connections per user > rejects 11th connection for same user
(pass) chat message handling > broadcasts sanitized chat message to room [16.00ms]
(pass) chat message handling > truncates chat content to 2000 characters
(pass) getStats() > returns connectedUsers, totalConnections, rooms
(pass) getStats() > increments after auth and decrements after disconnect
(pass) business event notifications > notifyInventoryCreated sends correct message type
(pass) business event notifications > notifyInventoryUpdated sends correct message type
(pass) business event notifications > notifyInventoryDeleted sends correct message type
(pass) business event notifications > notifyInventorySync sends items array
(pass) business event notifications > notifyListingCreated sends listing data
(pass) business event notifications > notifyListingUpdated sends listing data
(pass) business event notifications > notifyListingSold sends listing and sale data
(pass) business event notifications > notifyListingView sends view data
(pass) business event notifications > notifySaleCreated sends sale data
(pass) business event notifications > notifySaleShipped sends sale data
(pass) business event notifications > notifySaleDelivered sends sale data
(pass) business event notifications > notifyOfferReceived sends offer data
(pass) business event notifications > notifyOfferAccepted sends offer data
(pass) business event notifications > notifyOfferDeclined sends offer data
(pass) business event notifications > notify sends generic notification
(pass) cleanup() > clears heartbeat interval
(pass) cleanup() > calling cleanup twice does not throw
(pass) init() > stores server reference and returns this
(pass) disconnectAllForUser() > closes all connections for a user
(pass) disconnectAllForUser() > does nothing for nonexistent user
(pass) heartbeat() > pings alive connections and marks isAlive false
(pass) heartbeat() > closes dead connections (isAlive = false)
(pass) WebSocketClient export > WebSocketClient is exported as a string template

src\tests\service-websocket.test.js:
(pass) MESSAGE_TYPES constants > has PING and PONG
(pass) MESSAGE_TYPES constants > has AUTH types
(pass) MESSAGE_TYPES constants > has SUBSCRIBE types
(pass) MESSAGE_TYPES constants > has INVENTORY event types
(pass) MESSAGE_TYPES constants > has LISTING event types
(pass) MESSAGE_TYPES constants > has SALE event types
(pass) MESSAGE_TYPES constants > has OFFER event types
(pass) MESSAGE_TYPES constants > has NOTIFICATION type
(pass) MESSAGE_TYPES constants > has CHAT_MESSAGE type
(pass) MESSAGE_TYPES constants > has ERROR type
(pass) MESSAGE_TYPES constants > all values are unique strings
(pass) websocketService object > has init method
(pass) websocketService object > has handleConnection method
(pass) websocketService object > has handleMessage method
(pass) websocketService object > has handleDisconnect method
(pass) websocketService object > has send method
(pass) websocketService object > has sendToUser method
(pass) websocketService object > has broadcast method
(pass) websocketService object > has broadcastAll method
(pass) websocketService object > has getStats method
(pass) websocketService object > getStats returns connection info
(pass) websocketService object > has cleanup method
(pass) websocketService object > has disconnectAllForUser method
(pass) websocketService object > has notification methods

src\tests\sessionManagement.test.js:
(pass) Session Management - List Sessions > new user has at least 1 session after registration
(pass) Session Management - List Sessions > session object has required shape
(pass) Session Management - List Sessions > session does not expose refresh_token
(pass) Session Management - List Sessions > session has current flag (0 or 1)
(pass) Session Management - List Sessions > sessions are ordered by created_at DESC [219.00ms]
(pass) Session Management - Multiple Logins > 3 logins create 3 additional sessions [859.00ms]
(pass) Session Management - Multiple Logins > each login session has unique ID [656.00ms]
(pass) Session Management - Revoke Specific > revoking a session removes it from the list [438.00ms]
(pass) Session Management - Revoke Specific > revoking own current session still returns 200 [437.00ms]
(pass) Session Management - Revoke Specific > revoking nonexistent session returns 404
(pass) Session Management - Revoke Specific > cross-user revocation returns 404
(pass) Session Management - Revoke All > revoke-all returns count of revoked sessions [641.00ms]
(pass) Session Management - Revoke All > after revoke-all, session list is minimal [859.00ms]
(pass) Session Management - Revoke All > revoke-all does not affect other users
(pass) Session Management - Max Limit > 11th login prunes oldest session (max 10) [2375.00ms]
(pass) Session Management - Max Limit > newest sessions survive pruning [2579.00ms]
(pass) Session Management - Cross-User Isolation > user A cannot see user B sessions
(pass) Session Management - Cross-User Isolation > user A cannot revoke user B session
(pass) Session Management - Cross-User Isolation > revoke-all only affects own sessions

src\tests\shared-constants.test.js:
(pass) PAGINATION > has DEFAULT_LIMIT of 50
(pass) PAGINATION > has MAX_LIMIT of 200
(pass) PAGINATION > MAX_LIMIT >= DEFAULT_LIMIT
(pass) CONTENT_LIMITS > has TITLE_MAX_LENGTH of 200
(pass) CONTENT_LIMITS > has DESCRIPTION_MAX_LENGTH of 5000
(pass) CONTENT_LIMITS > has TAG limits
(pass) CONTENT_LIMITS > has URL_MAX_LENGTH of 2048
(pass) CONTENT_LIMITS > has SQL_MAX_LENGTH of 10000
(pass) CONTENT_LIMITS > has JSON_FIELD_MAX of 50000
(pass) CONTENT_LIMITS > all values are positive numbers
(pass) CACHE > has DEFAULT_TTL_MS of 5 minutes
(pass) CACHE > has MAX_ENTRIES of 1000
(pass) TIMEOUTS > has API_REQUEST_MS of 30 seconds
(pass) TIMEOUTS > has WORKER_POLL_MS of 60 seconds

src\tests\shared-helpers.test.js:
(pass) parseBoolean > returns true for truthy strings
(pass) parseBoolean > returns false for falsy strings
(pass) parseBoolean > returns defaultValue for null/undefined
(pass) parseBoolean > returns defaultValue for unrecognized strings
(pass) parseIntBounded > parses valid integer within bounds
(pass) parseIntBounded > clamps to min
(pass) parseIntBounded > clamps to max
(pass) parseIntBounded > returns default for NaN
(pass) parsePagination > returns defaults for empty query
(pass) parsePagination > respects custom limit
(pass) parsePagination > clamps limit to maxLimit
(pass) parsePagination > computes offset from page
(pass) parsePagination > uses offset when no page given
(pass) buildPaginationMeta > builds correct metadata
(pass) buildPaginationMeta > last page has no next
(pass) buildPaginationMeta > single page
(pass) safeJsonParse > parses valid JSON
(pass) safeJsonParse > returns fallback for invalid JSON
(pass) safeJsonParse > returns fallback for falsy input
(pass) safeJsonParse > returns object as-is if already object
(pass) validateRequired > returns valid when all fields present
(pass) validateRequired > returns invalid with missing fields
(pass) validateRequired > treats empty string as missing
(pass) validateRequired > treats null as missing
(pass) validateLength > valid when within bounds
(pass) validateLength > invalid when too short
(pass) validateLength > invalid when too long
(pass) validateLength > valid for empty when min is 0
(pass) validateLength > invalid for empty when min > 0
(pass) validateRange > valid within range
(pass) validateRange > invalid below min
(pass) validateRange > invalid above max
(pass) validateRange > invalid for non-number
(pass) validateEnum > valid for allowed value
(pass) validateEnum > invalid for disallowed value
(pass) validateEmail > valid email
(pass) validateEmail > invalid email
(pass) validateEmail > null/empty returns invalid
(pass) validateUrl > valid URL
(pass) validateUrl > invalid URL
(pass) validateUrl > null/empty is valid (optional)
(pass) validateHexColor > valid hex color
(pass) validateHexColor > invalid hex color
(pass) validateHexColor > null/empty is valid (optional)
(pass) validatePrice > valid price
(pass) validatePrice > negative price invalid
(pass) validatePrice > exceeds max invalid
(pass) validatePrice > too many decimals invalid
(pass) validatePrice > non-number invalid
(pass) validatePrice > null/undefined is valid (optional)
(pass) sanitizeString > trims whitespace
(pass) sanitizeString > truncates to maxLength
(pass) sanitizeString > returns falsy values as-is
(pass) successResponse > builds success response with default status
(pass) successResponse > accepts custom status
(pass) errorResponse > builds error response
(pass) errorResponse > includes error code when provided
(pass) errorResponse > default status is 400
(pass) paginatedResponse > builds paginated response
(pass) Constants > VALID_PLATFORMS contains expected platforms
(pass) Constants > VALID_CONDITIONS contains expected values
(pass) Constants > VALID_INVENTORY_STATUSES contains expected values
(pass) Constants > VALID_ORDER_STATUSES contains expected values
(pass) validatePlatform > valid platform
(pass) validatePlatform > invalid platform
(pass) validatePlatform > optional when not required
(pass) validatePlatform > required when flagged
(pass) validateCondition > valid condition
(pass) validateCondition > invalid condition
(pass) validateCondition > optional when not required
(pass) validateCondition > required when flagged
(pass) validateInventoryStatus > valid status
(pass) validateInventoryStatus > invalid status
(pass) validateInventoryStatus > optional when not required
(pass) validateInventoryStatus > required when flagged
(pass) validateOrderStatus > valid status
(pass) validateOrderStatus > invalid status
(pass) validateOrderStatus > optional when not required
(pass) validateOrderStatus > required when flagged

src\tests\shared-utils-logging.test.js:
{"timestamp":"2026-03-05T21:20:56.388Z","level":"INFO","message":"test info message"}
(pass) logInfo > does not throw with message
{"timestamp":"2026-03-05T21:20:56.388Z","level":"INFO","message":"test info","userId":"123","action":"login"}
(pass) logInfo > accepts context object
{"timestamp":"2026-03-05T21:20:56.388Z","level":"INFO","message":"test info"}
(pass) logInfo > works with empty context
{"timestamp":"2026-03-05T21:20:56.388Z","level":"WARN","message":"test warning"}
(pass) logWarn > does not throw with message
{"timestamp":"2026-03-05T21:20:56.388Z","level":"WARN","message":"test 
warning","detail":"something","severity":"medium"}
(pass) logWarn > accepts context object
{"timestamp":"2026-03-05T21:20:56.388Z","level":"WARN","message":"test warning"}
(pass) logWarn > works with empty context
{"timestamp":"2026-03-05T21:20:56.388Z","level":"ERROR","message":"test error"}
(pass) logError > does not throw with message only
{"timestamp":"2026-03-05T21:20:56.388Z","level":"ERROR","message":"test error","error":{"message":"sample error"}}
(pass) logError > accepts Error object
{"timestamp":"2026-03-05T21:20:56.388Z","level":"ERROR","message":"test error","code":"ERR_123"}
(pass) logError > accepts null error with context
{"timestamp":"2026-03-05T21:20:56.388Z","level":"ERROR","message":"test","route":"/api/test","error":{"message":"e"}}
(pass) logError > accepts Error and context

src\tests\shared-utils.test.js:
(pass) generateId > returns a UUID v4 string
(pass) generateId > generates unique IDs
(pass) generateShortId > returns 8-character string
(pass) generatePrefixedId > returns prefix-SHORTID format
(pass) generatePrefixedId > works with different prefixes
(pass) now > returns ISO timestamp
(pass) today > returns YYYY-MM-DD format
(pass) daysAgo > returns date in the past
(pass) daysAgo > 0 days ago is today
(pass) daysFromNow > returns date in the future
(pass) formatDate > formats date string [15.00ms]
(pass) formatDate > returns empty for falsy input
(pass) formatDateTime > formats date and time
(pass) formatDateTime > returns empty for falsy input
(pass) formatPrice > formats number as USD currency
(pass) formatPrice > formats zero
(pass) formatPrice > handles null/undefined
(pass) parsePrice > parses dollar string
(pass) parsePrice > returns number as-is
(pass) parsePrice > parses string with commas
(pass) parsePrice > returns 0 for falsy input
(pass) roundCurrency > rounds to 2 decimal places
(pass) roundCurrency > handles zero/null
(pass) calculatePercentage > calculates percentage
(pass) calculatePercentage > returns 0 for zero total
(pass) truncate > truncates long strings
(pass) truncate > does not truncate short strings
(pass) truncate > handles falsy input
(pass) capitalize > capitalizes first letter
(pass) capitalize > handles single character
(pass) capitalize > handles falsy input
(pass) toTitleCase > converts to title case
(pass) toTitleCase > lowercases subsequent characters
(pass) toTitleCase > handles falsy input
(pass) toSlug > converts string to slug
(pass) toSlug > handles multiple spaces/dashes
(pass) toSlug > removes special characters
(pass) toSlug > handles falsy input
(pass) generateSKU > generates SKU from string
(pass) generateSKU > includes prefix when provided
(pass) generateSKU > generates random SKU for empty string
(pass) safeJsonParse > parses valid JSON
(pass) safeJsonParse > returns fallback for invalid
(pass) safeJsonParse > returns object as-is
(pass) safeJsonParse > returns fallback for falsy
(pass) safeJsonStringify > stringifies object
(pass) safeJsonStringify > returns fallback for falsy input
(pass) unique > removes duplicates
(pass) unique > handles strings
(pass) unique > handles empty array
(pass) groupBy > groups by string key
(pass) groupBy > groups by function key
(pass) sortBy > sorts ascending by key
(pass) sortBy > sorts descending
(pass) sortBy > does not mutate original
(pass) sortBy > sorts by function key
(pass) pick > picks specified keys
(pass) pick > ignores missing keys
(pass) omit > omits specified keys
(pass) omit > returns copy without mutation
(pass) deepMerge > merges nested objects
(pass) deepMerge > overwrites non-object values
(pass) deepMerge > merges multiple sources
(pass) deepMerge > skips __proto__ for safety
(pass) parsePagination (utils) > returns defaults for empty query
(pass) parsePagination (utils) > computes offset from page
(pass) parsePagination (utils) > clamps limit to max
(pass) parsePagination (utils) > limit 0 falls back to default
(pass) buildPaginationMeta (utils) > calculates correct meta
(pass) successResponse (utils) > builds with default status 200
(pass) successResponse (utils) > includes meta
(pass) errorResponse (utils) > builds error with code and field
(pass) paginatedResponse (utils) > builds paginated data
(pass) ErrorCodes > contains validation errors
(pass) ErrorCodes > contains auth errors
(pass) ErrorCodes > contains server errors
(pass) ErrorCodes > contains all expected categories
(pass) createLogEntry > creates structured log entry
(pass) createLogEntry > works without context

src\tests\shippingLabels.test.js:
Running Shipping Labels API tests...
(pass) Shipping Labels - List > GET /shipping-labels - should return labels list
(pass) Shipping Labels - List > GET /shipping-labels?status=draft - should filter by status
(pass) Shipping Labels - List > GET /shipping-labels?carrier=usps - should filter by carrier [16.00ms]
(pass) Shipping Labels - List > GET /shipping-labels?limit=10&offset=0 - should paginate
(pass) Shipping Labels - Create > POST /shipping-labels - should create label
(pass) Shipping Labels - Create > POST /shipping-labels - should require carrier and addresses
(pass) Shipping Labels - Get Single > GET /shipping-labels/:id - should return label details
(pass) Shipping Labels - Get Single > GET /shipping-labels/:id - should return 404 for non-existent label
(pass) Shipping Labels - Update > PATCH /shipping-labels/:id - should update label
(pass) Shipping Labels - Update > PATCH /shipping-labels/:id - should return 404 for non-existent label
(pass) Shipping Labels - Update > PATCH /shipping-labels/:id - should require updates
(pass) Shipping Labels - Return Addresses > GET /shipping-labels/addresses - should return addresses list
(pass) Shipping Labels - Return Addresses > POST /shipping-labels/addresses - should create return address
(pass) Shipping Labels - Return Addresses > POST /shipping-labels/addresses - should require address fields
(pass) Shipping Labels - Return Addresses > PATCH /shipping-labels/addresses/:id - should update address
(pass) Shipping Labels - Return Addresses > PATCH /shipping-labels/addresses/:id - should return 404 for non-existent 
address
(pass) Shipping Labels - Batches > GET /shipping-labels/batches - should return batches list
(pass) Shipping Labels - Batches > POST /shipping-labels/batches - should create batch
(pass) Shipping Labels - Batches > POST /shipping-labels/batches - should require label_ids
(pass) Shipping Labels - Batches > POST /shipping-labels/batches/:id/process - should process batch
(pass) Shipping Labels - Batches > POST /shipping-labels/batches/:id/process - should return 404 for non-existent batch
(pass) Shipping Labels - Rates > POST /shipping-labels/rates - should get shipping rates
(pass) Shipping Labels - Rates > POST /shipping-labels/rates - should require weight and zips
(pass) Shipping Labels - Print Batch > POST /shipping-labels/print-batch - should mark labels as printed
(pass) Shipping Labels - Print Batch > POST /shipping-labels/print-batch - should require label_ids
(pass) Shipping Labels - Download Batch > GET /shipping-labels/download-batch - should get batch download info
(pass) Shipping Labels - Download Batch > GET /shipping-labels/download-batch - should require label_ids
(pass) Shipping Labels - Generate PDF > POST /shipping-labels/generate-pdf - should generate PDF data
(pass) Shipping Labels - Generate PDF > POST /shipping-labels/generate-pdf - should require label_ids
(pass) Shipping Labels - Statistics > GET /shipping-labels/stats - should return statistics
(pass) Shipping Labels - Statistics > GET /shipping-labels/stats?startDate=2024-01-01&endDate=2024-12-31 - should 
accept date range [15.00ms]
(pass) Shipping Labels - Delete > DELETE /shipping-labels/:id - should delete draft label
(pass) Shipping Labels - Delete > DELETE /shipping-labels/:id - should return 404 for non-existent label
(pass) Shipping Labels - Delete Address > DELETE /shipping-labels/addresses/:id - should delete address
(pass) Shipping Labels - Delete Address > DELETE /shipping-labels/addresses/:id - should return 404 for non-existent 
address
(pass) Shipping Labels - Authentication > GET /shipping-labels - should require auth
(pass) Shipping Labels - Authentication > POST /shipping-labels - should require auth
(pass) Shipping Labels - Authentication > GET /shipping-labels/stats - should require auth

src\tests\shippingLabelsEnhanced.test.js:
(pass) Shipping Labels - Print Enhancement > POST /shipping-labels-mgmt/print-batch - should require label_ids
(pass) Shipping Labels - Print Enhancement > POST /shipping-labels-mgmt/print-batch - should accept format
(pass) Shipping Labels - Download Batch > GET /shipping-labels-mgmt/download-batch - should require label_ids
(pass) Shipping Labels - Download Batch > GET /shipping-labels-mgmt/download-batch - should accept label_ids param
(pass) Shipping Labels - Stats > GET /shipping-labels-mgmt/stats - should return stats
(pass) Shipping Labels - Stats > GET /shipping-labels-mgmt/stats - should accept date range

src\tests\shippingProfiles-expanded.test.js:
(pass) Shipping Profiles - List > GET /shipping-profiles returns array
(pass) Shipping Profiles - Create > POST /shipping-profiles with valid data
(pass) Shipping Profiles - Create > POST /shipping-profiles without name returns error
(pass) Shipping Profiles - Get Single > GET /shipping-profiles/:id returns profile
(pass) Shipping Profiles - Get Single > GET /shipping-profiles/:id for nonexistent returns 404
(pass) Shipping Profiles - Update > PUT /shipping-profiles/:id updates profile
(pass) Shipping Profiles - Update > PUT /shipping-profiles/:id for nonexistent returns error
(pass) Shipping Profiles - Set Default > PUT /shipping-profiles/:id/set-default for nonexistent
(pass) Shipping Profiles - Delete > DELETE /shipping-profiles/:id for nonexistent returns 404
(pass) Shipping Profiles - Delete > DELETE /shipping-profiles/:id removes profile
(pass) Shipping Profiles - Auth Guards > GET /shipping-profiles without auth returns 401
(pass) Shipping Profiles - Auth Guards > POST /shipping-profiles without auth returns 401

src\tests\shippingProfiles.test.js:
Running Shipping Profiles API tests...
(pass) Shipping Profiles - List > GET /shipping-profiles - should return profiles list
(pass) Shipping Profiles - Create > POST /shipping-profiles - should create profile
(pass) Shipping Profiles - Create > POST /shipping-profiles - should require name
(pass) Shipping Profiles - Get Single > GET /shipping-profiles/:id - should return profile details
(pass) Shipping Profiles - Update > PUT /shipping-profiles/:id - should update profile
(pass) Shipping Profiles - Update > PUT /shipping-profiles/:id/default - should set as default
(pass) Shipping Profiles - Rate Calculation > POST /shipping-profiles/calculate-rate - should calculate shipping rate
(pass) Shipping Profiles - Delete > DELETE /shipping-profiles/:id - should delete profile
(pass) Shipping Profiles - Authentication > GET /shipping-profiles - should require auth

src\tests\shops.test.js:
Running Shops API tests...
(pass) Shops - List > GET /shops - should return connected shops
(pass) Shops - List > GET /shops - should not expose credentials
(pass) Shops - Connect > POST /shops - should connect new platform
(pass) Shops - Connect > POST /shops - should require platform [16.00ms]
(pass) Shops - Connect > POST /shops - should prevent duplicate connections
(pass) Shops - Get Single > GET /shops/:platform - should return shop details
(pass) Shops - Get Single > GET /shops/:platform - should return 404 for non-existent platform
(pass) Shops - Update > PUT /shops/:platform - should update shop settings
(pass) Shops - Update > PUT /shops/:platform - should update connection status
(pass) Shops - Update > PUT /shops/:platform - should return 404 for non-existent platform
(pass) Shops - Sync > POST /shops/:platform/sync - should start sync
(pass) Shops - Sync > POST /shops/:platform/sync - should return 404 for disconnected shop
(pass) Shops - Statistics > GET /shops/:platform/stats - should return shop statistics
(pass) Shops - Statistics > GET /shops/:platform/stats - should return 404 for non-existent shop
(pass) Shops - Disconnect > DELETE /shops/:platform - should disconnect shop
(pass) Shops - Disconnect > DELETE /shops/:platform - should return 404 for non-existent shop
(pass) Shops - Authentication > GET /shops - should require auth
(pass) Shops - Authentication > POST /shops - should require auth

src\tests\sizeCharts-expanded.test.js:
(pass) Size Charts - Auth Guard > GET /size-charts without auth returns 401
(pass) Size Charts - List > GET /size-charts returns charts array
(pass) Size Charts - List > GET /size-charts?category=Shoes filters by category
(pass) Size Charts - List > GET /size-charts?gender=mens filters by gender
(pass) Size Charts - Create > POST /size-charts requires name and category
(pass) Size Charts - Create > POST /size-charts rejects invalid gender
(pass) Size Charts - Create > POST /size-charts creates chart with valid data
(pass) Size Charts - Get Single > GET /size-charts/:id returns chart [15.00ms]
(pass) Size Charts - Get Single > GET /size-charts/:id returns 404 for nonexistent
(pass) Size Charts - Update > PUT /size-charts/:id updates chart
(pass) Size Charts - Update > PUT /size-charts/:id returns 404 for nonexistent
(pass) Size Charts - Delete > DELETE /size-charts/:id returns 404 for nonexistent
(pass) Size Charts - International Conversions > GET /size-charts/convert requires from, to, size
(pass) Size Charts - International Conversions > GET /size-charts/convert rejects invalid size system
(pass) Size Charts - International Conversions > GET /size-charts/convert with valid params
(pass) Size Charts - International Conversions > GET /size-charts/convert with brand filter
(pass) Size Charts - Brands > GET /size-charts/brands returns brand list
(pass) Size Charts - Brands > GET /size-charts/brands/:brand returns brand guide
(pass) Size Charts - Brands > GET /size-charts/brands/Unknown returns 404
(pass) Size Charts - Brands > GET /size-charts/brands/:brand/:garment returns specific guide
(pass) Size Charts - Recommendations > POST /size-charts/recommend requires measurements
(pass) Size Charts - Recommendations > POST /size-charts/recommend with measurements
(pass) Size Charts - Availability Heatmap > GET /size-charts/availability returns availability data
(pass) Size Charts - Availability Heatmap > GET /size-charts/availability?category=Shoes filters
(pass) Size Charts - Link Listings > POST /size-charts/:id/link-listings requires listing_ids
(pass) Size Charts - Link Listings > POST /size-charts/:id/link-listings links listings
(pass) Size Charts - Link Listings > GET /size-charts/:id/linked-listings returns linked listings
(pass) Size Charts - Link Listings > POST nonexistent chart /link-listings returns 404
(pass) Size Charts - Cleanup > DELETE created chart

src\tests\sizeCharts.test.js:
(pass) GET /api/size-charts > unauthenticated returns 401 or 403
(pass) GET /api/size-charts > authenticated returns size charts
(pass) POST /api/size-charts > unauthenticated returns 401 or 403
(pass) POST /api/size-charts > authenticated creates size chart [15.00ms]
(pass) GET /api/size-charts/brands > unauthenticated returns 401 or 403
(pass) GET /api/size-charts/brands > authenticated returns brands list
(pass) GET /api/size-charts/convert > authenticated converts size
(pass) POST /api/size-charts/recommend > authenticated returns recommendations
(pass) GET /api/size-charts/availability > authenticated returns availability

src\tests\skuRules-expanded.test.js:
(pass) SKU Rules — Get by ID & Default > GET /sku-rules/:id for nonexistent returns 404
(pass) SKU Rules — Get by ID & Default > GET /sku-rules/default returns default rule
(pass) SKU Rules — Set Default > POST /sku-rules/:id/set-default sets rule as default
(pass) SKU Rules — Set Default > POST /sku-rules/:id/set-default for nonexistent returns 404
(pass) SKU Rules — Preview & Batch > POST /sku-rules/preview generates SKU preview
(pass) SKU Rules — Preview & Batch > POST /sku-rules/preview without pattern returns error
(pass) SKU Rules — Preview & Batch > POST /sku-rules/batch-update updates multiple rules

src\tests\skuRules.test.js:
Running SKU Rules API tests...
(pass) SKU Rules - List > GET /sku-rules - should return SKU rules
(pass) SKU Rules - Create > POST /sku-rules - should create SKU rule
(pass) SKU Rules - Create > POST /sku-rules - should require name
(pass) SKU Rules - Generate > POST /sku-rules/generate - should generate SKU
(pass) SKU Rules - Generate > POST /sku-rules/generate - should use specific rule
(pass) SKU Rules - Update > PUT /sku-rules/:id - should update rule
(pass) SKU Rules - Delete > DELETE /sku-rules/:id - should delete rule
(pass) SKU Rules - Authentication > GET /sku-rules - should require auth

src\tests\skuSync-expanded.test.js:
(pass) SKU Sync - Auth Guard > POST /sku-sync/link without auth returns 401
(pass) SKU Sync - Link > POST /sku-sync/link creates platform link
(pass) SKU Sync - Link > POST /sku-sync/link without master_sku returns 400 [16.00ms]
(pass) SKU Sync - Link > POST /sku-sync/link without platform returns 400
(pass) SKU Sync - Sync > POST /sku-sync/sync processes pending links
(pass) SKU Sync - Barcode Lookup > GET /sku-sync/barcode/TEST-SKU-001 searches for item
(pass) SKU Sync - Barcode Lookup > GET /sku-sync/barcode/nonexistent returns 404 or empty
(pass) SKU Sync - Delete > DELETE /sku-sync/nonexistent-id returns 404

src\tests\skuSync-gaps-expanded.test.js:
(pass) SKU Sync — List & Filter > GET /sku-sync returns list of platform links
(pass) SKU Sync — List & Filter > GET /sku-sync?platform=ebay filters by platform
(pass) SKU Sync — List & Filter > GET /sku-sync/conflicts returns conflict list
(pass) SKU Sync — Link & Sync > POST /sku-sync/link creates platform link
(pass) SKU Sync — Link & Sync > POST /sku-sync/link rejects missing fields
(pass) SKU Sync — Link & Sync > POST /sku-sync/sync syncs pending links
No link created
(pass) SKU Sync — Link & Sync > DELETE /sku-sync/:id removes link
(pass) SKU Sync — Link & Sync > DELETE /sku-sync/nonexistent returns 404
(pass) SKU Sync — Barcode Lookup > GET /sku-sync/barcode/TEST123 looks up by barcode
(pass) SKU Sync — Barcode Lookup > GET /sku-sync/barcode with empty barcode
(pass) SKU Sync — Auth Guard > GET /sku-sync requires auth

src\tests\skuSync-gaps.test.js:
(pass) SKU Sync list and conflicts > GET /sku-sync/ returns list of platform links
(pass) SKU Sync list and conflicts > GET /sku-sync/?platform=ebay filters by platform [16.00ms]
(pass) SKU Sync list and conflicts > GET /sku-sync/conflicts returns conflict list

src\tests\skuSync.test.js:
(pass) GET /api/sku-sync > rejects unauthenticated request
(pass) GET /api/sku-sync > returns SKU sync records for authenticated user
(pass) GET /api/sku-sync > accepts platform query filter
(pass) POST /api/sku-sync/link > rejects unauthenticated request
(pass) POST /api/sku-sync/link > links SKU with valid body
(pass) POST /api/sku-sync/link > rejects missing required fields
(pass) GET /api/sku-sync/conflicts > rejects unauthenticated request
(pass) GET /api/sku-sync/conflicts > returns SKU conflicts for authenticated user
(pass) POST /api/sku-sync/sync > rejects unauthenticated request
(pass) POST /api/sku-sync/sync > triggers sync for authenticated user
(pass) GET /api/sku-sync/barcode/:barcode > rejects unauthenticated request
(pass) GET /api/sku-sync/barcode/:barcode > looks up SKU by barcode

src\tests\socialAuth-expanded.test.js:
(pass) Social Auth - Providers List > GET /social-auth/providers returns provider list
(pass) Social Auth - Providers List > GET /social-auth/ also returns provider list
(pass) Social Auth - Auth Guard (OAuth Flows) > GET /social-auth/google without auth returns 401
(pass) Social Auth - Auth Guard (OAuth Flows) > GET /social-auth/google/callback without auth returns 401
(pass) Social Auth - Auth Guard (OAuth Flows) > GET /social-auth/apple without auth returns 401
(pass) Social Auth - Auth Guard (OAuth Flows) > POST /social-auth/apple/callback without auth returns 401 [16.00ms]
(pass) Social Auth - Google OAuth Flow (Authenticated) > GET /social-auth/google returns redirect or auth URL
(pass) Social Auth - Google OAuth Flow (Authenticated) > GET /social-auth/google/callback without code returns error 
or redirect
(pass) Social Auth - Apple OAuth Flow (Authenticated) > POST /social-auth/apple/callback without code returns error or 
redirect
(pass) Social Auth - Apple OAuth Flow (Authenticated) > POST /social-auth/apple/callback with error param
(pass) Social Auth - Unlink Provider > DELETE /social-auth/google without auth returns 401
(pass) Social Auth - Unlink Provider > DELETE /social-auth/google unlinks provider
(pass) Social Auth - Unlink Provider > DELETE /social-auth/apple unlinks provider

src\tests\socialAuth.test.js:
(pass) socialAuth routes > should require authentication
(pass) socialAuth routes > GET /social-auth/providers responds

src\tests\suppliers.test.js:
(pass) Suppliers - List > GET /suppliers - should return supplier list
(pass) Suppliers - List > GET /suppliers?type=wholesale - should filter by type
(pass) Suppliers - List > GET /suppliers?active=false - should include inactive suppliers
(pass) Suppliers - List > GET /suppliers - should require authentication
(pass) Suppliers - Create > POST /suppliers - should create supplier
(pass) Suppliers - Create > POST /suppliers - should fail without name
(pass) Suppliers - Create > POST /suppliers - should fail without type
(pass) Suppliers - Create > POST /suppliers - should fail with invalid type
(pass) Suppliers - Get Single > GET /suppliers/:id - should return supplier details
(pass) Suppliers - Get Single > GET /suppliers/:id - should return 404 for non-existent supplier
(pass) Suppliers - Update > PUT /suppliers/:id - should update supplier
(pass) Suppliers - Update > PUT /suppliers/:id - should return 404 for non-existent supplier
(pass) Suppliers - Items > GET /suppliers/:id/items - should return supplier items
(pass) Suppliers - Items > POST /suppliers/:id/items - should add item to supplier
(pass) Suppliers - Items > POST /suppliers/:id/items - should fail without name
(pass) Suppliers - Item Details > GET /suppliers/items/:itemId - should return item with price history
(pass) Suppliers - Item Details > GET /suppliers/items/:itemId - should return 404 for non-existent item
(pass) Suppliers - Item Details > PUT /suppliers/items/:itemId - should update item
(pass) Suppliers - Item Details > PUT /suppliers/items/:itemId - should return 404 for non-existent item
(pass) Suppliers - Alerts > GET /suppliers/alerts - should return price drop alerts [16.00ms]
(pass) Suppliers - Stats > GET /suppliers/stats - should return statistics
(pass) Suppliers - Types > GET /suppliers/types - should return supplier types
(pass) Suppliers - Delete Item > DELETE /suppliers/items/:itemId - should delete item
(pass) Suppliers - Delete Supplier > DELETE /suppliers/:id - should delete supplier

src\tests\tasks.test.js:
Running Tasks API tests...
(pass) Tasks - List > GET /tasks - should return tasks list
(pass) Tasks - List > GET /tasks?status=pending - should filter by status
(pass) Tasks - List > GET /tasks?type=share_listing - should filter by type
(pass) Tasks - List > GET /tasks?limit=10&offset=0 - should paginate
(pass) Tasks - Create > POST /tasks - should create task
(pass) Tasks - Create > POST /tasks - should require type and payload
(pass) Tasks - Create > POST /tasks - should reject invalid type
(pass) Tasks - Create > POST /tasks - should accept scheduled time [16.00ms]
(pass) Tasks - Get Single > GET /tasks/:id - should return task details
(pass) Tasks - Get Single > GET /tasks/:id - should return 404 for non-existent task
(pass) Tasks - Cancel > POST /tasks/:id/cancel - should cancel pending task
(pass) Tasks - Cancel > POST /tasks/:id/cancel - should return 404 for non-existent task
(pass) Tasks - Retry > POST /tasks/:id/retry - should require failed status
(pass) Tasks - Retry > POST /tasks/:id/retry - should return 404 for non-existent task
(pass) Tasks - Bulk Create > POST /tasks/bulk - should create multiple tasks
(pass) Tasks - Bulk Create > POST /tasks/bulk - should require tasks array
(pass) Tasks - Clear > POST /tasks/clear - should clear completed tasks
(pass) Tasks - Clear > POST /tasks/clear - should accept olderThan parameter
(pass) Tasks - Queue Status > GET /tasks/queue - should return queue statistics
(pass) Tasks - Delete > DELETE /tasks/:id - should delete task
(pass) Tasks - Delete > DELETE /tasks/:id - should return 404 for non-existent task
(pass) Tasks - Authentication > GET /tasks - should require auth
(pass) Tasks - Authentication > POST /tasks - should require auth

src\tests\teams-expanded.test.js:
(pass) Teams — Auth Guards > GET /teams without auth returns 401
(pass) Teams — Auth Guards > POST /teams without auth returns 401
(pass) Teams — List & Permissions > GET /teams returns list [16.00ms]
(pass) Teams — List & Permissions > GET /teams/permissions returns role matrix
(pass) Teams — CRUD > POST /teams creates a team
(pass) Teams — CRUD > POST /teams without name returns error
(pass) Teams — CRUD > GET /teams/:id returns team details or error
(pass) Teams — CRUD > PATCH /teams/:id updates team or errors
(pass) Teams — CRUD > DELETE /teams/:id removes team or errors
(pass) Teams — Members & Invitations > POST /teams/:id/invite sends invitation
(pass) Teams — Members & Invitations > POST /teams/join with invalid token returns error
(pass) Teams — Members & Invitations > PATCH /teams/:id/members/:memberId updates role
(pass) Teams — Members & Invitations > DELETE /teams/:id/members/:memberId removes member
(pass) Teams — Members & Invitations > POST /teams/:id/leave leaves team
(pass) Teams — Members & Invitations > GET /teams/:id/activity returns activity log

src\tests\teams.test.js:
Running Teams API tests...
(pass) Teams - Get Current Team > GET /teams/current - should return current team
(pass) Teams - Create > POST /teams - should create team
(pass) Teams - Members > GET /teams/members - should list team members
(pass) Teams - Members > PUT /teams/members/:id/role - should update member role
(pass) Teams - Members > DELETE /teams/members/:id - should remove team member
(pass) Teams - Invitations > POST /teams/invites - should create invitation
(pass) Teams - Invitations > GET /teams/invites - should list pending invitations
Skipping: No test invite ID
(pass) Teams - Invitations > DELETE /teams/invites/:id - should cancel invitation
(pass) Teams - Settings > GET /teams/settings - should return team settings
(pass) Teams - Settings > PUT /teams/settings - should update team settings
(pass) Teams - Activity > GET /teams/activity - should return team activity log
(pass) Teams - Authentication > GET /teams/current - should require auth

src\tests\templates-expanded.test.js:
(pass) Templates - List > GET /templates returns array
(pass) Templates - Create > POST /templates with valid data
(pass) Templates - Create > POST /templates without name returns 400
(pass) Templates - Get Single > GET /templates/:id returns template
(pass) Templates - Get Single > GET /templates/:id for nonexistent returns 404
(pass) Templates - Update > PUT /templates/:id updates template
(pass) Templates - Update > PUT /templates/:id for nonexistent returns 404
(pass) Templates - Favorite > PATCH /templates/:id/favorite for nonexistent
(pass) Templates - Apply > POST /templates/:id/apply for nonexistent template
(pass) Templates - Delete > DELETE /templates/:id for nonexistent returns 404 [15.00ms]
(pass) Templates - Delete > DELETE /templates/:id removes template
(pass) Templates - Auth Guards > GET /templates without auth returns 401
(pass) Templates - Auth Guards > POST /templates without auth returns 401

src\tests\templates.test.js:
Running Templates API tests...
(pass) Templates - List > GET /templates - should return templates list
(pass) Templates - Create > POST /templates - should create a template
(pass) Templates - Create > POST /templates - should require name
(pass) Templates - Get Single > GET /templates/:id - should return template details
(pass) Templates - Get Single > GET /templates/:id - should return 404 for non-existent template
(pass) Templates - Update > PUT /templates/:id - should update template
(pass) Templates - Update > PATCH /templates/:id/favorite - should toggle favorite
(pass) Templates - Apply > POST /templates/:id/apply - should apply template to listing [16.00ms]
(pass) Templates - Delete > DELETE /templates/:id - should delete template
(pass) Templates - Authentication > GET /templates - should require auth
(pass) Templates - Authentication > POST /templates - should require auth

src\tests\tokenLifecycle.test.js:
(pass) Token Lifecycle - Access Token > fresh access token can access /auth/me
(pass) Token Lifecycle - Access Token > fresh access token works for inventory requests
(pass) Token Lifecycle - Access Token > garbage token is rejected with 401
(pass) Token Lifecycle - Access Token > missing Authorization header is rejected with 401
(pass) Token Lifecycle - Access Token > malformed JWT (valid base64 but bad signature) is rejected
(pass) Token Lifecycle - Refresh Token > POST /auth/refresh with valid token returns new access token [421.00ms]
(pass) Token Lifecycle - Refresh Token > refresh rotation issues a new refresh token [438.00ms]
(pass) Token Lifecycle - Refresh Token > POST /auth/refresh with invalid token returns 401
(pass) Token Lifecycle - Refresh Token > new access token from refresh works for authenticated requests [437.00ms]

src\tests\userAnalytics.test.js:
(pass) User Analytics - Auth Guard > POST /user-analytics/page-view without auth returns 401
(pass) User Analytics - Auth Guard > GET /user-analytics/sessions without auth returns 401
(pass) User Analytics - Page View > POST /user-analytics/page-view tracks page view
(pass) User Analytics - Page View > POST /user-analytics/page-view without page returns 400
(pass) User Analytics - Action > POST /user-analytics/action tracks action [16.00ms]
(pass) User Analytics - Action > POST /user-analytics/action without action field
(pass) User Analytics - Sessions > GET /user-analytics/sessions returns session data
(pass) Server.js Inline - Status > GET /status returns ok

src\tests\validation-schemas.test.js:
(pass) CommonSchemas.inventoryItem > validates a valid inventory item
(pass) CommonSchemas.inventoryItem > rejects missing title
(pass) CommonSchemas.inventoryItem > rejects invalid condition value
(pass) CommonSchemas.inventoryItem > accepts minimal item with just title
(pass) CommonSchemas.userRegistration > validates valid registration
(pass) CommonSchemas.userRegistration > rejects missing email
(pass) CommonSchemas.userRegistration > rejects invalid email format
(pass) CommonSchemas.userRegistration > rejects password shorter than 8 characters
(pass) CommonSchemas.contactForm > validates valid contact form
(pass) CommonSchemas.contactForm > rejects missing message
(pass) CommonSchemas.pagination > validates valid pagination params
(pass) CommonSchemas.pagination > validates with empty object (all optional)
(pass) validateRequest > returns a function (middleware)
(pass) validateRequest > middleware returns null for valid body
(pass) validateRequest > middleware returns error response for invalid body
(pass) validateRequest > middleware uses custom bodyKey when provided
(pass) createSchema + Rules > custom schema validates correctly
(pass) createSchema + Rules > custom schema returns errors for invalid data
(pass) createSchema + Rules > Rules.oneOf rejects invalid values
(pass) createSchema + Rules > Rules.range validates boundaries

src\tests\validation.test.js:
(pass) Basic Type Validators > isPresent
(pass) Basic Type Validators > isNonEmptyString
(pass) Basic Type Validators > isValidNumber
(pass) Basic Type Validators > isPositiveNumber
(pass) Basic Type Validators > isNonNegativeNumber
(pass) Basic Type Validators > isValidInteger
(pass) Basic Type Validators > isInRange
(pass) String Validators > minLength / maxLength / lengthInRange
(pass) String Validators > isValidEmail
(pass) String Validators > isValidUrl
(pass) String Validators > isValidPhone
(pass) String Validators > isValidDateFormat
(pass) String Validators > isValidUUID
(pass) String Validators > isValidSlug
(pass) Business Validators > isValidPrice
(pass) Business Validators > isValidQuantity
(pass) Business Validators > isValidSKU
(pass) Business Validators > isValidBarcode
(pass) Array & Object Validators > isArray / isNonEmptyArray
(pass) Array & Object Validators > arrayMinLength / arrayMaxLength
(pass) Array & Object Validators > isObject
(pass) Array & Object Validators > hasRequiredKeys
(pass) Array & Object Validators > isOneOf / areAllOneOf
(pass) Schema Validation > createSchema validates correctly
(pass) Schema Validation > Rules.required rejects empty values
(pass) Schema Validation > Rules.price validates correctly
(pass) Schema Validation > Rules.oneOf validates set membership

src\tests\watermark-expanded.test.js:
(pass) Watermark - Auth Guard > GET /watermark/presets without auth returns 401
(pass) Watermark - Auth Guard > POST /watermark/presets without auth returns 401
(pass) Watermark - List Presets > GET /watermark/presets returns array
(pass) Watermark - Create Preset > POST /watermark/presets with text type [16.00ms]
(pass) Watermark - Create Preset > POST /watermark/presets without name returns 400
(pass) Watermark - Create Preset > POST /watermark/presets without type returns 400
(pass) Watermark - Create Preset > POST /watermark/presets without content returns 400
(pass) Watermark - Create Preset > POST /watermark/presets with invalid type returns 400
(pass) Watermark - Create Preset > POST /watermark/presets with invalid position returns 400
(pass) Watermark - Create Preset > POST /watermark/presets with opacity out of range returns 400
(pass) Watermark - Create Preset > POST /watermark/presets with size out of range returns 400
(pass) Watermark - Create Preset > POST /watermark/presets with rotation out of range returns 400
(pass) Watermark - Update Preset > PUT /watermark/presets/nonexistent returns 404
(pass) Watermark - Delete Preset > DELETE /watermark/presets/nonexistent returns 404
(pass) Watermark - Set Default > POST /watermark/presets/nonexistent/set-default returns 404
(pass) Watermark - Apply Batch > POST /watermark/apply-batch without preset_id returns 400
(pass) Watermark - Apply Batch > POST /watermark/apply-batch without image_ids returns 400
(pass) Watermark - Apply Batch > POST /watermark/apply-batch with empty image_ids returns 400

src\tests\watermark-extended.test.js:
(pass) Watermark Presets > POST /watermark/presets should validate type
(pass) Watermark Presets > POST /watermark/presets should validate URL for image type
(pass) Watermark Presets > POST /watermark/presets should accept valid text preset
(pass) Watermark Presets > POST /watermark/presets should require name
(pass) Watermark Presets > GET /watermark/presets should list presets
(pass) Watermark Presets > POST /watermark/presets should reject ftp:// URL for image type

src\tests\watermark.test.js:
(pass) GET /api/watermark/presets > rejects unauthenticated request
(pass) GET /api/watermark/presets > returns presets list when authenticated [16.00ms]
(pass) POST /api/watermark/presets > rejects unauthenticated request
(pass) POST /api/watermark/presets > creates preset when authenticated with valid body
(pass) POST /api/watermark/presets > rejects missing required fields
(pass) POST /api/watermark/apply-batch > rejects unauthenticated request
(pass) POST /api/watermark/apply-batch > processes batch apply when authenticated

src\tests\webhookIncoming.test.js:
(pass) Webhook Incoming - Unknown Source > POST /webhooks/incoming/unknown returns 404
(pass) Webhook Incoming - Unknown Source > POST /webhooks/incoming without source returns 404
(pass) Webhook Incoming - Signature Validation > POST without signature header is rejected
(pass) Webhook Incoming - Signature Validation > POST with invalid signature is rejected
(pass) Webhook Incoming - Endpoint CRUD > GET /webhooks/endpoints returns array
(pass) Webhook Incoming - Endpoint CRUD > POST /webhooks/endpoints creates endpoint
(pass) Webhook Incoming - Endpoint CRUD > POST /webhooks/endpoints with localhost URL is blocked (SSRF) [16.00ms]
(pass) Webhook Incoming - Endpoint CRUD > POST /webhooks/endpoints with private IP is blocked (SSRF)
(pass) Webhook Incoming - Endpoint CRUD > DELETE /webhooks/endpoints/:nonexistent returns 404
(pass) Webhook Incoming - Event Types > GET /webhooks/event-types returns list
(pass) Webhook Incoming - Event Types > event types include listing events
(pass) Webhook Incoming - Event Types > event types include order events
(pass) Webhook Incoming - Auth Guard > unauthenticated endpoints request returns 401
(pass) Webhook Incoming - Auth Guard > unauthenticated create returns 401

src\tests\webhooks.test.js:
Running Webhooks API tests...
(pass) Webhooks - Incoming (Public) > POST /webhooks/incoming/:source - should accept signed webhook payload
(pass) Webhooks - Incoming (Public) > POST /webhooks/incoming/:source - should handle ebay webhooks
(pass) Webhooks - Incoming (Public) > POST /webhooks/incoming/:source - should handle mercari webhooks
(pass) Webhooks - Incoming (Public) > POST /webhooks/incoming/:source - should reject unregistered sources
(pass) Webhooks - Endpoints (Protected) > GET /webhooks/endpoints - should list webhook endpoints
(pass) Webhooks - Endpoints (Protected) > POST /webhooks/endpoints - should create webhook endpoint
(pass) Webhooks - Endpoints (Protected) > POST /webhooks/endpoints - should require name
(pass) Webhooks - Endpoints (Protected) > POST /webhooks/endpoints - should require valid URL
(pass) Webhooks - Endpoint Management > GET /webhooks/endpoints/:id - should get endpoint details
(pass) Webhooks - Endpoint Management > PUT /webhooks/endpoints/:id - should update endpoint
(pass) Webhooks - Endpoint Management > POST /webhooks/endpoints/:id/test - should send test webhook [15.00ms]
(pass) Webhooks - Endpoint Management > DELETE /webhooks/endpoints/:id - should delete endpoint
(pass) Webhooks - Events History > GET /webhooks/events - should list webhook events
(pass) Webhooks - Events History > GET /webhooks/events?source=poshmark - should filter by source
(pass) Webhooks - Authentication > GET /webhooks/endpoints - should require auth
(pass) Webhooks - Authentication > POST /webhooks/incoming/:source - should NOT require auth (public endpoint)

src\tests\whatnot.test.js:
(pass) Whatnot - List Events > GET /whatnot - should return event list
(pass) Whatnot - List Events > GET /whatnot?status=scheduled - should filter by status
(pass) Whatnot - List Events > GET /whatnot?upcoming=true - should filter upcoming events
(pass) Whatnot - List Events > GET /whatnot - should require authentication
(pass) Whatnot - Create Event > POST /whatnot - should create live event
(pass) Whatnot - Create Event > POST /whatnot - should fail without title
(pass) Whatnot - Create Event > POST /whatnot - should fail without start_time
(pass) Whatnot - Get Single Event > GET /whatnot/:id - should return event with items
(pass) Whatnot - Get Single Event > GET /whatnot/:id - should return 404 for non-existent event
(pass) Whatnot - Update Event > PUT /whatnot/:id - should update event
(pass) Whatnot - Update Event > PUT /whatnot/:id - should update status
(pass) Whatnot - Update Event > PUT /whatnot/:id - should return 404 for non-existent event
(pass) Whatnot - Event Items > POST /whatnot/:id/items - should add item to event [16.00ms]
(pass) Whatnot - Event Items > POST /whatnot/:id/items - should fail without inventory_id
(pass) Whatnot - Event Items > DELETE /whatnot/:eventId/items/:itemId - should remove item from event
(pass) Whatnot - Statistics > GET /whatnot/stats - should return event statistics
(pass) Whatnot - Delete Event > DELETE /whatnot/:id - should delete event

src\tests\whatnotEnhanced-expanded.test.js:
(pass) Whatnot Enhanced - Auth Guard > POST /whatnot-enhanced/cohosts without auth returns 401
(pass) Whatnot Enhanced - Cohosts CRUD > POST /whatnot-enhanced/cohosts creates cohost [16.00ms]
(pass) Whatnot Enhanced - Cohosts CRUD > POST /whatnot-enhanced/cohosts without event_id returns 400
(pass) Whatnot Enhanced - Cohosts CRUD > POST /whatnot-enhanced/cohosts without cohost_name returns 400
(pass) Whatnot Enhanced - Cohosts CRUD > POST /whatnot-enhanced/cohosts with invalid revenue_split
(pass) Whatnot Enhanced - Cohosts CRUD > PUT /whatnot-enhanced/cohosts/:id updates cohost
(pass) Whatnot Enhanced - Cohosts CRUD > PUT /whatnot-enhanced/cohosts/nonexistent returns 404
(pass) Whatnot Enhanced - Cohosts CRUD > DELETE /whatnot-enhanced/cohosts/:id removes cohost
(pass) Whatnot Enhanced - Cohosts CRUD > DELETE /whatnot-enhanced/cohosts/nonexistent returns 404
(pass) Whatnot Enhanced - Staging CRUD > POST /whatnot-enhanced/staging stages item
(pass) Whatnot Enhanced - Staging CRUD > POST /whatnot-enhanced/staging without event_id returns 400
(pass) Whatnot Enhanced - Staging CRUD > POST /whatnot-enhanced/staging without inventory_id returns 400
(pass) Whatnot Enhanced - Staging CRUD > PUT /whatnot-enhanced/staging/:id updates staged item
(pass) Whatnot Enhanced - Staging CRUD > PUT /whatnot-enhanced/staging/nonexistent returns 404
(pass) Whatnot Enhanced - Staging CRUD > DELETE /whatnot-enhanced/staging/:id removes staged item
(pass) Whatnot Enhanced - Staging CRUD > DELETE /whatnot-enhanced/staging/nonexistent returns 404
(pass) Whatnot Enhanced - Auto-Suggest > POST /whatnot-enhanced/staging/auto-suggest with event_id
(pass) Whatnot Enhanced - Auto-Suggest > POST /whatnot-enhanced/staging/auto-suggest without event_id returns 400
(pass) Whatnot Enhanced - Bundles > GET /whatnot-enhanced/staging/bundles returns bundle groups
(pass) Whatnot Enhanced - Bundles > GET /whatnot-enhanced/staging/bundles with event_id filter

src\tests\whatnotEnhanced.test.js:
(pass) GET /api/whatnot-enhanced/cohosts > unauthenticated returns 401/403/500
(pass) GET /api/whatnot-enhanced/cohosts > authenticated returns cohosts
(pass) GET /api/whatnot-enhanced/cohosts > authenticated with event_id filter
(pass) POST /api/whatnot-enhanced/cohosts > unauthenticated returns 401/403/500
(pass) POST /api/whatnot-enhanced/cohosts > authenticated with nonexistent event returns 201 or 404
(pass) GET /api/whatnot-enhanced/staging > unauthenticated returns 401/403/500
(pass) GET /api/whatnot-enhanced/staging > authenticated returns staging items
(pass) POST /api/whatnot-enhanced/staging > authenticated with nonexistent ids returns 201 or 404
(pass) POST /api/whatnot-enhanced/staging/auto-suggest > unauthenticated returns 401/403/500
(pass) POST /api/whatnot-enhanced/staging/auto-suggest > authenticated with nonexistent event returns 200 or 404
(pass) GET /api/whatnot-enhanced/staging/bundles > unauthenticated returns 401/403/500
(pass) GET /api/whatnot-enhanced/staging/bundles > authenticated returns bundles

src\tests\worker-emailPolling-expanded.test.js:
(pass) Email Polling Worker — export shapes > startEmailPollingWorker is a function
(pass) Email Polling Worker — export shapes > stopEmailPollingWorker is a function
(pass) Email Polling Worker — export shapes > getEmailPollingStatus is a function
(pass) Email Polling Worker — export shapes > syncEmailAccount is exported
(pass) Email Polling Worker — getEmailPollingStatus > returns status object
(pass) Email Polling Worker — getEmailPollingStatus > status has expected fields
(pass) Email Polling Worker — stop lifecycle > stop does not throw when not started
(pass) Email Polling Worker — stop lifecycle > double stop does not throw
(pass) Email Polling Worker — stop lifecycle > triple stop is safe
(pass) Email Polling Worker — syncEmailAccount edge cases > rejects null account
(pass) Email Polling Worker — syncEmailAccount edge cases > rejects account with missing fields
(pass) Email Polling Worker — syncEmailAccount edge cases > rejects account with invalid provider
(pass) Email Polling Worker — start/stop cycle > start followed by immediate stop does not throw

src\tests\worker-emailPolling-unit.test.js:
(pass) emailPollingWorker (unit) > getEmailPollingStatus > returns expected shape
(pass) emailPollingWorker (unit) > getEmailPollingStatus > isRunning false when stopped
(pass) emailPollingWorker (unit) > getEmailPollingStatus > intervalMs defaults to 5 minutes
(pass) emailPollingWorker (unit) > syncEmailAccount > syncs account with no new emails
(pass) emailPollingWorker (unit) > syncEmailAccount > marks account as syncing then idle
(pass) emailPollingWorker (unit) > syncEmailAccount > records failure on decrypt error

src\tests\worker-emailPolling.test.js:
(pass) emailPollingWorker exports > startEmailPollingWorker is a function
(pass) emailPollingWorker exports > stopEmailPollingWorker is a function
(pass) emailPollingWorker exports > getEmailPollingStatus is a function
(pass) stopEmailPollingWorker > does not throw when worker is not started
(pass) stopEmailPollingWorker > double stop does not throw

src\tests\worker-gdpr-expanded.test.js:
(pass) GDPR Worker — exports > startGDPRWorker is a function
(pass) GDPR Worker — exports > stopGDPRWorker is a function
(pass) GDPR Worker — exports > stopGDPRWorker does not throw when not started
(pass) GDPR API — data audit > GET /gdpr/audit returns data audit
(pass) GDPR API — data audit > GET /gdpr/audit requires auth [16.00ms]
(pass) GDPR API — data export > GET /gdpr/export returns user data
(pass) GDPR API — data export > GET /gdpr/export requires auth
(pass) GDPR API — consent > GET /gdpr/consent returns consent status
(pass) GDPR API — consent > POST /gdpr/consent updates consent
(pass) GDPR API — consent > GET /gdpr/consent requires auth
(pass) GDPR API — rectification > PUT /gdpr/rectify accepts correction request
(pass) GDPR API — rectification > PUT /gdpr/rectify requires auth
(pass) GDPR API — deletion request > POST /gdpr/delete-request initiates deletion
(pass) GDPR API — deletion request > GET /gdpr/delete-request/status checks deletion status

src\tests\worker-gdpr.test.js:
(pass) GDPR Endpoints > GET /gdpr/audit should return data audit
(pass) GDPR Endpoints > GET /gdpr/export should return user data export
(pass) GDPR Endpoints > GET /gdpr/consent should return consent status
(pass) GDPR Endpoints > PUT /gdpr/rectify should accept correction request

src\tests\worker-gdprWorker-coverage.test.js:
(pass) stopGDPRWorker > is safe when not running
(pass) stopGDPRWorker > can be called multiple times without error
(pass) stopGDPRWorker > clears interval after start
(pass) startGDPRWorker > logs start messages
(pass) startGDPRWorker > calls processAccountDeletions on start [62.00ms]
(pass) startGDPRWorker > calls cleanupExportRequests on start [63.00ms]
(pass) startGDPRWorker > calls sendDeletionReminders on start [62.00ms]
(pass) processAccountDeletions — empty > returns early when no pending deletions [63.00ms]
(pass) processAccountDeletions — empty > returns early when pending deletions is null [62.00ms]
(pass) processAccountDeletions — with records > processes single deletion record [157.00ms]
(pass) processAccountDeletions — with records > processes multiple deletion records [218.00ms]
(pass) processAccountDeletions — with records > deletes from all user data tables [157.00ms]
(pass) processAccountDeletions — with records > handles table deletion error gracefully (table not exist) [203.00ms]
(pass) processAccountDeletions — with records > marks deletion as failed when executeAccountDeletion throws [156.00ms]
(pass) processAccountDeletions — with records > inserts audit log after deletion [156.00ms]
(pass) processAccountDeletions — with records > audit log failure does not break deletion [156.00ms]
(pass) processAccountDeletions — with records > email send failure does not break deletion [204.00ms]
(pass) processAccountDeletions — with records > uses full_name in email data when available [156.00ms]
(pass) processAccountDeletions — with records > falls back to username when full_name is null [156.00ms]
(pass) processAccountDeletions — with records > falls back to "User" when both full_name and username are null 
[156.00ms]
(pass) sendDeletionReminders > queries for upcoming deletions within 3 days [63.00ms]
(pass) sendDeletionReminders > handles null result from query.all gracefully [62.00ms]
(pass) sendDeletionReminders > marks reminder_sent when email succeeds [203.00ms]
(pass) sendDeletionReminders > logs error when email send fails for reminder [204.00ms]
(pass) sendDeletionReminders > processes multiple reminders [203.00ms]
(pass) sendDeletionReminders > uses username fallback in reminder email data [156.00ms]
(pass) cleanupExportRequests > runs UPDATE on data_export_requests for expired exports [62.00ms]
(pass) cleanupExportRequests > passes a date parameter for 7-day cutoff [63.00ms]
(pass) top-level error handling > processAccountDeletions failure is caught by .catch wrapper [109.00ms]
(pass) top-level error handling > all three async tasks can fail without crashing the worker [110.00ms]
(pass) default export > default export has startGDPRWorker and stopGDPRWorker
(pass) interval lifecycle > start then stop clears the interval
(pass) interval lifecycle > starting twice does not throw

src\tests\worker-gdprWorker-unit.test.js:
(pass) gdprWorker (unit) > stopGDPRWorker > is safe when not running
(pass) gdprWorker (unit) > stopGDPRWorker > can be called multiple times
(pass) gdprWorker (unit) > startGDPRWorker + stopGDPRWorker lifecycle > starts without error when no pending deletions
(pass) gdprWorker (unit) > startGDPRWorker + stopGDPRWorker lifecycle > queries pending deletions on start [62.00ms]
(pass) gdprWorker (unit) > startGDPRWorker + stopGDPRWorker lifecycle > processes deletion when pending record exists 
[110.00ms]
(pass) gdprWorker (unit) > startGDPRWorker + stopGDPRWorker lifecycle > runs cleanupExportRequests on start [62.00ms]

src\tests\worker-priceCheck-unit.test.js:
(pass) priceCheckWorker (unit) > triggerPriceCheck > returns error for non-existent items
(pass) priceCheckWorker (unit) > triggerPriceCheck > handles multiple not-found items
(pass) priceCheckWorker (unit) > triggerPriceCheck > checks found item and updates price [140.00ms]
(pass) priceCheckWorker (unit) > triggerPriceCheck > returns correct shape
(pass) priceCheckWorker (unit) > triggerPriceCheck > updates supplier_items price on check [250.00ms]

src\tests\worker-priceCheck.test.js:
(pass) getPriceCheckWorkerStatus > returns status object with expected shape
(pass) getPriceCheckWorkerStatus > running is boolean
(pass) getPriceCheckWorkerStatus > interval is 30 minutes
(pass) getPriceCheckWorkerStatus > max items per cycle is 50
(pass) startPriceCheckWorker / stopPriceCheckWorker > not running before start
(pass) startPriceCheckWorker / stopPriceCheckWorker > starting sets running to true
(pass) startPriceCheckWorker / stopPriceCheckWorker > stopping sets running to false
(pass) startPriceCheckWorker / stopPriceCheckWorker > double stop does not throw
(pass) startPriceCheckWorker / stopPriceCheckWorker > start after stop restarts
(pass) startPriceCheckWorker / stopPriceCheckWorker > double start is idempotent

src\tests\worker-taskWorker-coverage.test.js:
(pass) taskWorker coverage > processQueue — empty queue > processQueue runs on startTaskWorker and handles empty queue 
[94.00ms]
(pass) taskWorker coverage > processQueue — empty queue > processQueue skips when isProcessing is true (re-entrant 
guard) [63.00ms]
(pass) taskWorker coverage > processQueue — with tasks > processes a sync_shop task that throws missing shopId error 
[218.00ms]
(pass) taskWorker coverage > processQueue — with tasks > processes a sync_shop task that fails and retries (attempts < 
maxAttempts) [203.00ms]
(pass) taskWorker coverage > processQueue — with tasks > processes a sync_shop task that fails permanently (attempts 
>= maxAttempts) [204.00ms]
(pass) taskWorker coverage > processQueue — with tasks > notifyTaskFailure handles sync_shop failure notification 
[218.00ms]
(pass) taskWorker coverage > processQueue — with tasks > notifyTaskFailure handles error in notification creation 
gracefully [203.00ms]
(pass) taskWorker coverage > processQueue — with tasks > processes unknown task type which throws error [219.00ms]
(pass) taskWorker coverage > processTask — success path logging > logs automation_run on successful 
cleanup_notifications task [313.00ms]
(pass) taskWorker coverage > processTask — success path logging > handles automation_runs logging error gracefully 
[312.00ms]
(pass) taskWorker coverage > processTask — success path logging > processTask success path — task without userId skips 
automation_runs [313.00ms]
(pass) taskWorker coverage > processTask — failure logging > logs automation failure to automation_runs on permanent 
failure with userId [312.00ms]
(pass) taskWorker coverage > processTask — failure logging > handles automation_runs failure logging error gracefully 
[313.00ms]
(pass) taskWorker coverage > processTask — failure logging > permanent failure without userId skips automation_runs 
logging [312.00ms]
(pass) taskWorker coverage > executeTask dispatch — refresh_token > refresh_token task calls manualRefreshToken via 
dynamic import [313.00ms]
(pass) taskWorker coverage > executeTask dispatch — sync_email_account > sync_email_account throws when accountId is 
missing [328.00ms]
(pass) taskWorker coverage > executeTask dispatch — sync_email_account > sync_email_account throws when userId is 
missing [312.00ms]
(pass) taskWorker coverage > executeTask dispatch — sync_email_account > sync_email_account throws when account not 
found [313.00ms]
(pass) taskWorker coverage > executeTask dispatch — process_webhook > process_webhook throws when eventId is missing 
[312.00ms]
(pass) taskWorker coverage > executeTask dispatch — process_webhook > process_webhook throws when event not found 
[313.00ms]
(pass) taskWorker coverage > executeSyncShopTask — success with shop found > successful sync creates notification when 
shop is found [406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with missing ruleId throws [313.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with rule not found returns skip message 
[312.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with price_drop type executes price drop 
handler [406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > price_drop skips when newPrice >= oldPrice (at minimum) 
[407.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > price_drop with inventory_id updates inventory and 
price_history [406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > price_drop with platform filter includes platform in WHERE 
[406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with relist type [406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with share type [407.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with offer type — auto accept [421.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with offer type — auto decline [422.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with offer type — offer outside criteria 
(skipped) [407.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with offer type — no pending offers [421.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with follow type returns noop message [407.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with custom type executes custom handler 
[406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with unknown type falls through to custom 
handler [406.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation with invalid JSON conditions/actions uses empty 
objects [422.00ms]
(pass) taskWorker coverage > executeRunAutomationTask > run_automation updates automation_rules run_count and 
last_run_at [406.00ms]
(pass) taskWorker coverage > checkAutomationSchedules > skips already-queued automation tasks (guard test) [219.00ms]
(pass) taskWorker coverage > checkAutomationSchedules > processQueue with empty automation_rules is safe [203.00ms]
(pass) taskWorker coverage > checkAutomationSchedules > run_automation exercises cron-related code paths (via 
scheduledRun flag) [406.00ms]
(pass) taskWorker coverage > checkAutomationSchedules > run_automation with null conditions and null actions handled 
safely [407.00ms]
(pass) taskWorker coverage > checkAutomationSchedules > run_automation with empty string conditions/actions handled 
safely [422.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with ranges e.g. 1-5 in dow field [312.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with step values e.g. */15 [313.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with comma-separated values [312.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with step on range e.g. 1-30/5 [313.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with invalid step (NaN) is skipped [312.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with step of 0 is skipped [313.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with fewer than 5 fields returns null 
[312.00ms]
(pass) taskWorker coverage > parseCronField via schedule checking > cron with out-of-range values are clamped 
[313.00ms]
(pass) taskWorker coverage > logAutomationAction error handling > logAutomationAction catches DB errors without 
crashing [406.00ms]
(pass) taskWorker coverage > processQueue error handling > processQueue catches error from query.all and logs it 
[203.00ms]
(pass) taskWorker coverage > concurrent task processing > processes multiple tasks concurrently up to 
MAX_CONCURRENT_TASKS [406.00ms]
(pass) taskWorker coverage > retry with exponential backoff > retry delay increases exponentially [313.00ms]
(pass) taskWorker coverage > retry with exponential backoff > error.code is passed as error_code in automation_runs 
failure [328.00ms]
(pass) taskWorker coverage > relist error handling > relist catches per-listing errors [422.00ms]
(pass) taskWorker coverage > share edge cases > share with platform filter and no party share [406.00ms]
(pass) taskWorker coverage > share edge cases > share catches per-listing errors [406.00ms]
(pass) taskWorker coverage > offer error handling > offer catches per-offer errors [422.00ms]
(pass) taskWorker coverage > offer error handling > offer with platform filter [406.00ms]
(pass) taskWorker coverage > price_drop per-listing error > catches per-listing errors in price drop [407.00ms]
(pass) taskWorker coverage > relist with platform filter > relist with platform filter and null optional fields 
[468.00ms]
(pass) taskWorker coverage > processTask max_attempts fallback > uses DEFAULT_MAX_ATTEMPTS when task.max_attempts is 
null/undefined [313.00ms]
(pass) taskWorker coverage > share — partyOnly condition path > share with conditions.partyOnly flag [406.00ms]
(pass) taskWorker coverage > price_drop — price_history error handling > price_history insert failure is silently 
caught [422.00ms]
(pass) taskWorker coverage > notifyTaskFailure — non-sync_shop > notifyTaskFailure does nothing for non-sync_shop task 
types [312.00ms]
(pass) taskWorker coverage > notifyTaskFailure — sync_shop no shop > notifyTaskFailure skips notification when shop 
not found [313.00ms]
(pass) taskWorker coverage > notifyTaskFailure — sync_shop no userId > notifyTaskFailure skips when payload has no 
userId [312.00ms]
(pass) taskWorker coverage > mixed success and failure > processes mix of succeeding and failing tasks [407.00ms]

src\tests\worker-taskWorker-expanded.test.js:
(pass) Task Worker — exports > queueTask is a function
(pass) Task Worker — exports > getTaskStatus is a function
(pass) Task Worker — exports > getWorkerStatus is a function
(pass) Task Worker — exports > startTaskWorker is a function
(pass) Task Worker — exports > stopTaskWorker is a function
(pass) Task Worker — exports > cleanupOldTasks is a function
(pass) Task Worker — getWorkerStatus > returns status object
(pass) Task Worker — queueTask > queues a cleanup_notifications task
(pass) Task Worker — queueTask > queues a sync_shop task
(pass) Task Worker — queueTask > handles invalid task type gracefully
(pass) Task Worker — API endpoints > GET /tasks/status returns worker status
(pass) Task Worker — API endpoints > GET /tasks lists tasks
(pass) Task Worker — API endpoints > POST /tasks creates a task with valid type
(pass) Task Worker — API endpoints > POST /tasks rejects missing type
(pass) Task Worker — API endpoints > Tasks require auth
(pass) Task Worker — stopTaskWorker safety > stopTaskWorker does not throw when not started

src\tests\worker-taskWorker-unit.test.js:
(pass) taskWorker (unit) > queueTask > returns a task object with correct fields
(pass) taskWorker (unit) > queueTask > calls query.run with INSERT statement and correct values
(pass) taskWorker (unit) > queueTask > uses default priority of 0
(pass) taskWorker (unit) > queueTask > uses default maxAttempts of 3
(pass) taskWorker (unit) > queueTask > accepts custom priority option
(pass) taskWorker (unit) > queueTask > accepts custom maxAttempts option
(pass) taskWorker (unit) > queueTask > accepts custom scheduledAt option
(pass) taskWorker (unit) > queueTask > generates a non-empty string ID (real UUID)
(pass) taskWorker (unit) > queueTask > serializes payload to JSON in the INSERT
(pass) taskWorker (unit) > queueTask > returns the payload object (not serialized)
(pass) taskWorker (unit) > queueTask > works with different task types
(pass) taskWorker (unit) > queueTask > scheduledAt defaults to a PostgreSQL datetime format (no T or Z)
(pass) taskWorker (unit) > queueTask > multiple queueTask calls generate unique IDs
(pass) taskWorker (unit) > getTaskStatus > returns the task record from the database
(pass) taskWorker (unit) > getTaskStatus > calls query.get with the correct SQL and task ID
(pass) taskWorker (unit) > getTaskStatus > returns null when task is not found
(pass) taskWorker (unit) > getTaskStatus > returns undefined when query.get returns undefined
(pass) taskWorker (unit) > getTaskStatus > returns a pending task
(pass) taskWorker (unit) > getTaskStatus > returns a failed task with error info
(pass) taskWorker (unit) > getTaskStatus > selects specific columns
(pass) taskWorker (unit) > getWorkerStatus > returns expected shape with all properties
(pass) taskWorker (unit) > getWorkerStatus > maxConcurrent is 3
(pass) taskWorker (unit) > getWorkerStatus > pollIntervalMs is 10000 (10 seconds)
(pass) taskWorker (unit) > getWorkerStatus > isRunning is false when worker is stopped
(pass) taskWorker (unit) > getWorkerStatus > last24Hours contains the stats from the database
(pass) taskWorker (unit) > getWorkerStatus > activeTasks is a number
(pass) taskWorker (unit) > getWorkerStatus > query uses 24 hour window
(pass) taskWorker (unit) > getWorkerStatus > query counts tasks by status
(pass) taskWorker (unit) > cleanupOldTasks > returns the number of deleted tasks
(pass) taskWorker (unit) > cleanupOldTasks > defaults to 7 days when no argument is provided
(pass) taskWorker (unit) > cleanupOldTasks > passes custom daysOld to the query
(pass) taskWorker (unit) > cleanupOldTasks > deletes only completed and failed tasks
(pass) taskWorker (unit) > cleanupOldTasks > uses DELETE FROM task_queue
(pass) taskWorker (unit) > cleanupOldTasks > returns 0 when no tasks are old enough
(pass) taskWorker (unit) > cleanupOldTasks > uses completed_at for age comparison
(pass) taskWorker (unit) > cleanupOldTasks > with daysOld of 1 works correctly
(pass) taskWorker (unit) > startTaskWorker / stopTaskWorker > stopTaskWorker does not throw when worker is not running
(pass) taskWorker (unit) > startTaskWorker / stopTaskWorker > startTaskWorker starts the worker (isRunning becomes 
true)
(pass) taskWorker (unit) > startTaskWorker / stopTaskWorker > stopTaskWorker stops the worker (isRunning becomes false)
(pass) taskWorker (unit) > startTaskWorker / stopTaskWorker > calling startTaskWorker twice does not create duplicate 
intervals
(pass) taskWorker (unit) > startTaskWorker / stopTaskWorker > start then stop then start cycle works correctly
(pass) taskWorker (unit) > edge cases > queueTask with empty payload object
(pass) taskWorker (unit) > edge cases > queueTask with nested payload data
(pass) taskWorker (unit) > edge cases > queueTask with priority 0 is stored correctly
(pass) taskWorker (unit) > edge cases > queueTask with negative priority is stored
(pass) taskWorker (unit) > edge cases > queueTask with maxAttempts of 1 means single try only
(pass) taskWorker (unit) > edge cases > queueTask ID is a valid UUID v4 format
(pass) taskWorker (unit) > edge cases > queueTask INSERT params order matches VALUES placeholders
(pass) taskWorker (unit) > edge cases > getWorkerStatus activeTasks starts at 0
(pass) taskWorker (unit) > edge cases > cleanupOldTasks with large daysOld still works

src\tests\worker-taskWorker.test.js:
(pass) Task Worker API > GET /tasks/status should return worker status
(pass) Task Worker API > GET /tasks should list tasks
(pass) Task Worker API > POST /tasks should create a task

src\tests\z-middleware-requestLogger-unit.test.js:
(pass) requestLogger middleware > createRequestContext > extracts method from request
(pass) requestLogger middleware > createRequestContext > extracts path from URL
(pass) requestLogger middleware > createRequestContext > extracts query parameters from URL
(pass) requestLogger middleware > createRequestContext > extracts empty query when no params present
(pass) requestLogger middleware > createRequestContext > extracts IP as unknown when TRUST_PROXY is not set
(pass) requestLogger middleware > createRequestContext > extracts IP from x-forwarded-for when TRUST_PROXY is set
(pass) requestLogger middleware > createRequestContext > extracts IP from x-real-ip when x-forwarded-for is absent
(pass) requestLogger middleware > createRequestContext > extracts user-agent header
(pass) requestLogger middleware > createRequestContext > defaults user-agent to unknown when missing
(pass) requestLogger middleware > createRequestContext > extracts referer header
(pass) requestLogger middleware > createRequestContext > sets referer to null when missing
(pass) requestLogger middleware > createRequestContext > includes requestId from generateId
(pass) requestLogger middleware > createRequestContext > includes timestamp from now()
(pass) requestLogger middleware > createRequestContext > includes startTime as a number
(pass) requestLogger middleware > logRequestStart > calls logInfo with request metadata for normal paths
(pass) requestLogger middleware > logRequestStart > skips logging for /api/health path
(pass) requestLogger middleware > logRequestStart > skips logging for /api/status path
(pass) requestLogger middleware > logRequestStart > skips logging for favicon.ico
(pass) requestLogger middleware > logRequestStart > skips logging for static asset paths (.css)
(pass) requestLogger middleware > logRequestStart > skips logging for static asset paths (.js)
(pass) requestLogger middleware > logRequestStart > skips logging for static asset paths (.png)
(pass) requestLogger middleware > logRequestComplete > logs completed request with duration
(pass) requestLogger middleware > logRequestComplete > stores request log to database via query.run
(pass) requestLogger middleware > logRequestComplete > logs error path when error is provided
(pass) requestLogger middleware > logRequestComplete > uses status 500 when error is provided and no response
(pass) requestLogger middleware > logRequestComplete > logs 4xx response as completed with error (not logError)
(pass) requestLogger middleware > logRequestComplete > skips logging for health endpoint
(pass) requestLogger middleware > logRequestComplete > skips logging for static assets (.woff2)
(pass) requestLogger middleware > logRequestComplete > defaults to status 200 when no response and no error
(pass) requestLogger middleware > logAuditEvent > inserts audit record via query.run
(pass) requestLogger middleware > logAuditEvent > handles context without user gracefully
(pass) requestLogger middleware > logAuditEvent > also calls logInfo after inserting audit record
(pass) requestLogger middleware > logAuditEvent > does not throw when DB insert fails
(pass) requestLogger middleware > logAuditEvent > stores anonymized IP in audit record
(pass) requestLogger middleware > logAuditEvent > truncates long user agents
(pass) requestLogger middleware > AuditActions > contains all authentication actions
(pass) requestLogger middleware > AuditActions > contains all CRUD actions
(pass) requestLogger middleware > AuditActions > contains bulk operation actions
(pass) requestLogger middleware > AuditActions > contains import/export actions
(pass) requestLogger middleware > AuditActions > contains settings and integration actions
(pass) requestLogger middleware > AuditActions > contains admin actions
(pass) requestLogger middleware > createRequestLogger > returns object with before and after functions
(pass) requestLogger middleware > createRequestLogger > before() creates request context and assigns to ctx
(pass) requestLogger middleware > createRequestLogger > after() calls logRequestComplete
(pass) requestLogger middleware > createRequestLogger > after() passes error to logRequestComplete
(pass) requestLogger middleware > IP anonymization via logAuditEvent > IPv4 last octet is zeroed
(pass) requestLogger middleware > IP anonymization via logAuditEvent > IPv6 is anonymized (last groups zeroed)
(pass) requestLogger middleware > IP anonymization via logAuditEvent > unknown IP is passed through unchanged

src\tests\z-monitoring-router-unit.test.js:
(pass) Monitoring Router - GET /health > returns 200 with healthy status
(pass) Monitoring Router - GET /health > returns 503 when DB check fails
(pass) Monitoring Router - GET /health/detailed > returns 401 without auth
(pass) Monitoring Router - GET /health/detailed > returns health check results with auth
(pass) Monitoring Router - GET /metrics > returns 401 without auth
(pass) Monitoring Router - GET /metrics > returns 403 for non-enterprise user
(pass) Monitoring Router - GET /metrics > returns metrics for enterprise user
(pass) Monitoring Router - GET /metrics/prometheus > returns 401 without auth
(pass) Monitoring Router - GET /metrics/prometheus > returns 403 for non-enterprise user
(pass) Monitoring Router - GET /metrics/prometheus > returns prometheus text format for enterprise user
(pass) Monitoring Router - GET /security/events > returns 401 without auth
(pass) Monitoring Router - GET /security/events > returns 403 for non-enterprise user
(pass) Monitoring Router - GET /security/events > returns security events for enterprise user
(pass) Monitoring Router - GET /alerts > returns 401 without auth
(pass) Monitoring Router - GET /alerts > returns alerts array for authenticated user
(pass) Monitoring Router - GET /alerts > returns empty array when alerts table missing
(pass) Monitoring Router - POST /alerts/:id/acknowledge > returns 401 without auth
(pass) Monitoring Router - POST /alerts/:id/acknowledge > acknowledges alert for authenticated user
(pass) Monitoring Router - GET /errors > returns 401 without auth
(pass) Monitoring Router - GET /errors > returns errors array for authenticated user
(pass) Monitoring Router - GET /errors > returns empty array when error_logs table missing
(pass) Monitoring Router - Unknown Routes > unknown GET path returns 404
(pass) Monitoring Router - Unknown Routes > unknown POST path returns 404

src\tests\z-notion-final.test.js:
(pass) Notion Router - Auth Guard > returns 401 without user for GET /databases
(pass) Notion Router - Auth Guard > returns 401 without user for GET /databases/:id
(pass) Notion Router - Auth Guard > returns 401 without user for POST /databases/:id/query
(pass) Notion Router - Auth Guard > returns 401 without user for GET /pages/:id
(pass) Notion Router - Auth Guard > returns 401 without user for DELETE /pages/:id
(pass) Notion Router - GET /databases > returns 400 when not configured
(pass) Notion Router - GET /databases > returns databases array when configured
(pass) Notion Router - GET /databases > returns 500 when service throws
(pass) Notion Router - GET /databases/:id > returns 400 when not configured
(pass) Notion Router - GET /databases/:id > returns database object when configured
(pass) Notion Router - GET /databases/:id > returns 500 when service throws
(pass) Notion Router - POST /databases/:id/query > returns 400 when not configured
(pass) Notion Router - POST /databases/:id/query > returns query results when configured
(pass) Notion Router - POST /databases/:id/query > passes filter and sort parameters
(pass) Notion Router - POST /databases/:id/query > returns 500 when service throws
(pass) Notion Router - GET /pages/:id > returns 400 when not configured
(pass) Notion Router - GET /pages/:id > returns page object when configured
(pass) Notion Router - GET /pages/:id > returns 500 when service throws
(pass) Notion Router - DELETE /pages/:id > returns 400 when not configured
(pass) Notion Router - DELETE /pages/:id > archives page when configured
(pass) Notion Router - DELETE /pages/:id > returns 500 when service throws
(pass) Notion Router - Setup Create-New Branches > POST /setup/inventory with parent_page_id creates new database
(pass) Notion Router - Setup Create-New Branches > POST /setup/sales with parent_page_id creates new database
(pass) Notion Router - Setup Create-New Branches > POST /setup/notes with parent_page_id creates new database
(pass) Notion Router - Setup Create-New Branches > POST /setup/inventory without any params returns 400

src\tests\z-routes-monitoring-coverage.test.js:
(pass) POST /rum — validation > returns 400 when sessionId is missing
(pass) POST /rum — validation > returns 400 when sessionId is not a string
(pass) POST /rum — validation > returns 400 when metrics is missing
(pass) POST /rum — validation > returns 400 when metrics is empty array
(pass) POST /rum — validation > returns 400 when metrics is not an array
(pass) POST /rum — validation > returns 400 when body is null/undefined
(pass) POST /rum — successful ingestion > accepts valid LCP metric
(pass) POST /rum — successful ingestion > accepts multiple valid metrics
(pass) POST /rum — successful ingestion > ignores metrics with invalid name
(pass) POST /rum — successful ingestion > ignores metrics without name
(pass) POST /rum — successful ingestion > ignores metrics without numeric value
(pass) POST /rum — successful ingestion > accepts all valid metric names
(pass) POST /rum — successful ingestion > limits batch to 50 metrics
(pass) POST /rum — successful ingestion > includes user.id when authenticated
(pass) POST /rum — successful ingestion > passes metric url, userAgent, connectionType, metadata
(pass) POST /rum — database error handling > returns note when rum_metrics table does not exist
(pass) POST /rum — database error handling > skips individual metric insert failures (non-table error)
(pass) POST /rum — database error handling > returns 500 on outer catch for unexpected error
(pass) GET /rum/summary — auth and permissions > returns 401 without auth
(pass) GET /rum/summary — auth and permissions > returns 403 for non-enterprise user
(pass) GET /rum/summary — auth and permissions > returns 403 for pro user
(pass) GET /rum/summary — successful responses > returns summary with default 24h period
(pass) GET /rum/summary — successful responses > respects period=1h query parameter
(pass) GET /rum/summary — successful responses > respects period=7d query parameter
(pass) GET /rum/summary — successful responses > respects period=30d query parameter
(pass) GET /rum/summary — successful responses > defaults to 24h for unknown period value
(pass) GET /rum/summary — successful responses > returns metric percentiles when data exists
(pass) GET /rum/summary — successful responses > handles null uniqueSessions count
(pass) GET /rum/summary — error handling > returns empty data when rum_metrics table does not exist
(pass) GET /rum/summary — error handling > returns 500 on generic database error
(pass) GET /alerts — data parsing > parses alert data JSON
(pass) GET /alerts — data parsing > handles null alert data gracefully
(pass) GET /alerts — data parsing > returns empty array on no-such-table error
(pass) GET /alerts — data parsing > returns 500 on generic database error
(pass) GET /alerts — data parsing > returns multiple alerts parsed correctly
(pass) POST /alerts/:id/acknowledge — error handling > returns 500 when update query throws
(pass) POST /alerts/:id/acknowledge — error handling > extracts alertId from path correctly
(pass) POST /alerts/:id/acknowledge — error handling > passes user.id as acknowledged_by
(pass) GET /errors — data parsing > parses error context JSON
(pass) GET /errors — data parsing > handles null context gracefully
(pass) GET /errors — data parsing > returns empty array on no-such-table error
(pass) GET /errors — data parsing > returns 500 on generic database error
(pass) GET /errors — data parsing > returns multiple errors parsed correctly
(pass) GET /health/detailed — status codes > returns 503 when health status is unhealthy
(pass) GET /metrics/prometheus — format details > includes per-endpoint metrics
(pass) GET /metrics/prometheus — format details > includes http_errors_total
(pass) GET /metrics/prometheus — format details > includes http_response_time_avg
(pass) GET /metrics/prometheus — format details > returns text/plain content type
(pass) GET /metrics/prometheus — format details > sanitizes endpoint names in labels
(pass) GET /security/events — response data > returns counters and recentEvents
(pass) GET /security/events — response data > returns 403 for starter tier user
(pass) Unknown routes — comprehensive > PUT to any path returns 404
(pass) Unknown routes — comprehensive > DELETE to any path returns 404
(pass) Unknown routes — comprehensive > POST to /health returns 404
(pass) Unknown routes — comprehensive > GET /rum (without /summary) returns 404

 5280 pass
 0 fail
 9674 expect() calls
Ran 5280 tests across 264 files. [160.76s]

--- Teardown Command ---
stop direct test server + bun run dev:stop
Stopped server PID 17960
cmd.exe : $ bun scripts/server-manager.js stop
At C:\Users\Matt1\OneDrive\Desktop\Claude Code Project Brainstormer\vaultlister-3\runbook\steps\TEST_UNIT.ps1:103 
char:28
+ ...    $postStopOutput = (& cmd.exe /d /c "bun run dev:stop" 2>&1 | Out-S ...
+                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ bun scripts/server-manager.js stop:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Stopping server (PID 170752)...
Server stopped.
```
