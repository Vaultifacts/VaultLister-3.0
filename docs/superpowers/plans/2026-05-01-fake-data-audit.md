# Fake Data Audit — 109 Findings (2026-05-01)

All fake, hardcoded, state-only, and stub implementations discovered in the exhaustive UI audit.
Source of truth: `memory/STATUS.md` "Fix Checklist — All 109 Findings" section.

---

## CRITICAL — Security

- [x] F77: Implement real 2FA — TOTP secret generated server-side, real QR code returned, SMS API integrated, `verify2FACode()` validates against backend (`handlers-settings-account.js:747,810,864-877`)
- [x] F108: Make OAUTH_MODE fail-closed — error on startup if not explicitly set to `'real'`; remove `|| 'mock'` default (`oauth.js:99,180,319,413`)
- [x] F61: Wire `regenerateAPIKey()` to a real backend endpoint — store and return the new key from DB; current key is unusable client-side random (`handlers-settings-account.js:4644`)

---

## HIGH — State-Only Mutations (data lost on refresh)

- [x] F103: `saveShopBranding(platform)` — create backend branding endpoint; persist logo/color/tagline/bio (`handlers-settings-account.js:111-124`)
- [x] F104: `saveSyncSettings()` — create backend sync-config endpoint; persist mode/frequency/platform prefs (`handlers-settings-account.js:195-218`)
- [x] F109: `showShopSettings()` Save button — wire modal form to a real API call instead of inline `toast.success` onclick (`handlers-settings-account.js:56`)
- [~] F58: `financialGoals` — deferred post-launch; card hidden on production via `display:none` hostname check (`pages-sales-orders.js:2041`)
- [x] F74: `saveGoals()` (revenue/sales/margin) — create backend goals endpoint or persist via existing settings route (`handlers-deferred.js:4689-4700`)
- [x] F86: `saveWhatnotLiveEvent()` calendar path — call existing `POST /api/whatnot/events`; already wired in main Whatnot page (`handlers-tools-tasks.js:452-489`)
- [x] F87: Quick Notes — create backend `/notes` endpoint or persist to localStorage; currently lost on every refresh (`handlers-tools-tasks.js:1304`)
- [x] F96: `addCompetitor()` — call existing `POST /api/market-intel/competitors` instead of state-only (`handlers-deferred.js:5633-5634`)
- [x] F97: `removeCompetitor()` — call existing `DELETE /api/market-intel/competitors/:id` instead of state-only (`handlers-deferred.js:5728-5729`)
- [x] F65: `saveNewSupplier()` in Intelligence page — call existing `POST /api/inventory/suppliers` like `addSupplier()` in Settings does (`handlers-intelligence.js:216-235`)
- [x] F80: `savePriceWatch()` — create backend price-watch endpoint; remove Math.random() seed history (`handlers-intelligence.js:1278-1295`)
- [x] F99: `saveBudgetSettings()` — create backend budget endpoint; persist monthlyBudget (`handlers-sales-orders.js:1428-1433`)
- [x] F100: `saveCompetitorAlerts()` — create backend competitor-alerts endpoint (`handlers-deferred.js:5775-5784`)
- [x] F57: Budget data (Financials page) — create backend `/budget` endpoint or load from sales data; currently always zero (`pages-deferred.js:3516-3521`)
- [x] F66: AI model weights — include `modelWeights` in `/predictions` API calls; currently slider values have no effect (`handlers-intelligence.js:144-151`)

---

## HIGH — Fake Operations (toast only, no real API call)

- [x] F101: `connectIntegration(platform)` — already real OAuth redirect to `/api/oauth/authorize/:platform` (`handlers-settings-account.js:953`)
- [x] F102: `manageIntegration(platform)` — already reads real store state (last_sync_at, item_count); Sync Now→syncAllShops, Disconnect→disconnectShop both real (`handlers-settings-account.js:916-951`)
- [x] F62: `syncAllShops()` — already calls `POST /api/shops/sync-all` in both handler files (`handlers-deferred.js:3190`, `handlers-settings-account.js:6`)
- [x] F50: `refreshCompetitorActivity()` — already calls `GET /api/market-intel/competitors` (`handlers-deferred.js:5626`)
- [ ] F51: `runSavedSearch(id)` — query backend with saved search parameters instead of setting results to null (`handlers-intelligence.js:1517`)
- [x] F52: `refreshAnalytics()` — fetch new data from `/api/analytics` instead of re-rendering stale state (`handlers-deferred.js:4652`)
- [x] F53: `refreshShopHealth(platform)` — call real shop health endpoint (`handlers-deferred.js:3406`)
- [x] F54: `exportFinancials(format)` — implement server-side CSV/PDF generation and trigger download (`handlers-deferred.js:4590`)
- [x] F63: `saveRoadmapSubscription()` — POST email to backend or third-party email list endpoint (`handlers-community-help.js:182`)
- [x] F67: `runPredictionModel()` — call real prediction endpoint instead of adding Math.random() noise (`handlers-intelligence.js:14-27`)
- [ ] F69: `generateLabelsForOrders()` — call EasyPost label generation endpoint (`handlers-sales-orders.js:4200-4205`)
- [x] F72: `downloadLegalPDF(docType)` — serve pre-generated PDFs from `/public/legal/` or generate server-side (`handlers-deferred.js:26718-26722`)
- [x] F73: `downloadReport(reportId)` — generate and serve report file from backend (`handlers-deferred.js:26886-26891`)
- [x] F76: `runCleanup()` — implement real data deletion endpoint instead of setTimeout toast (`handlers-settings-account.js:630-635`)
- [x] F71: `refreshPredictions()` — fetch new data from predictions endpoint instead of re-rendering (`handlers-deferred.js:4727-4732`)
- [x] F78: `refreshAllSuppliers()` — call `/api/inventory/suppliers` instead of timeout toast (`handlers-intelligence.js:156-162`)
- [x] F79: `refreshSupplier(id)` — call `/api/inventory/suppliers/:id` instead of timeout toast (`handlers-intelligence.js:303-308`)

---

## MEDIUM — Hardcoded Fallback Data shown as real

- [ ] F105: `trendingKeywords.render()` — remove 5 hardcoded fake terms; show empty/loading state when no data (`widgets.js:7226-7263`)
- [ ] F106: `opportunityCards.render()` — remove 3 hardcoded fake opportunity cards; show empty state (`widgets.js:7157-7222`)
- [ ] F107: `pricePositionChart.render()` — remove Comp A/B/C hardcoded dots and `{price:45,quality:75}` default; show no-data state (`widgets.js:7266-7286`)
- [x] F49: Automation History fake fallback — replace mock fallback with empty state (`pages-deferred.js:1691-1707`)
- [x] F88: `showAutomationHistoryMock()` error fallback — replace fake history in catch block with real error state or retry prompt (`handlers-inventory-catalog.js:1153-1154`)
- [ ] F95: `showAutomationHistoryMock()` called from normal navigation — remove calls from close/back/retry buttons; fetch real data instead (`handlers-deferred.js:1996,2078,2174`)
- [ ] F89: `_simulateDryRun()` — implement real dry-run API endpoint or remove feature; remove hardcoded affected counts and action strings (`handlers-inventory-catalog.js:859-1007`)
- [ ] F64: `showPredictionDetails()` — remove "Sample Item" hardcoded fallback; show not-found state (`handlers-intelligence.js:82-89`)
- [ ] F91: Prediction accuracy — remove hardcoded `{total:156,correct:118,...}` fallback; show empty state (`pages-intelligence.js:691-698`)
- [ ] F93: Model Comparison table — remove 3 fake AI models and made-up accuracy figures; show empty or real data (`pages-intelligence.js:755-774`)
- [ ] F55: Financial Ratios — remove fake `totalRevenue * 0.3` multiplier formulas; show N/A when real balance sheet data unavailable (`pages-deferred.js:3502-3509`)
- [ ] F70: `runAITagging()` tools chunk — replace Math.random() tag picker with real Claude `/image-bank/analyze` call; this version wins for image-bank route (`handlers-tools-tasks.js:337-365`)

---

## MEDIUM — Calculation Bugs / Always-Wrong Values

- [x] F81: API usage hardcoded 35% — implement real API call counter or remove stat (`handlers-settings-account.js:2872-2873`)
- [x] F82: Active sessions hardcoded 2 — query real session count from backend (`handlers-settings-account.js:2881-2882`)
- [ ] F75: Data Retention preview uses Math.random() — replace with real `COUNT(*)` queries from backend (`handlers-settings-account.js:542-548`)
- [ ] F90: productivityScore "mock calculation" — use real task completion data or remove badge (`handlers-deferred.js:2281-2282`)
- [x] F98: "Time saved today" arbitrary minutes — use real automation timing from backend or remove stat (`pages-deferred.js:1802-1813`)
- [x] F94: Cash-flow ticker shuffles on every render — remove `Math.random()` sort; use stable sort by date (`pages-core.js:1016`)
- [ ] F92: Monthly accuracy chart labels always Mar–Oct — generate labels from real date range (`pages-intelligence.js:732`)
- [ ] F56: Financials cashFlowChange always 0 — derive from real cash flow periods (`pages-deferred.js:3485`)
- [ ] F59: Unmatched transactions panel always empty — add API call to populate `store.state.unmatchedTransactions` (`pages-deferred.js:4038`)

---

## MEDIUM — Settings / UI State Bugs

- [ ] F32: Data Retention defaults shown as user preferences — load from user settings, not hardcoded (`pages-settings-account.js:1850-1856`)
- [ ] F33: Security score always 75% "Good" — compute from real user security posture (`pages-settings-account.js:1093-1095`)
- [ ] F34: Security checklist always green — derive from real account state (password age, email verified, etc.) (`pages-settings-account.js:1103-1119`)
- [ ] F35: Appearance tab light-mode hardcoded — bind radio to `store.state.darkMode` (`pages-settings-account.js:1133`)
- [ ] F36: "@unknown" username — show email prefix or "Not set" when username is absent (`pages-settings-account.js:2181,2202`)
- [ ] F37: My Shops Avg Health always null% — fix `avgHealthScore` calculation (`pages-settings-account.js:82,213`)
- [ ] F38: My Shops Performance always `'—'` — load real conversion rate / days-to-sell / return rate (`pages-settings-account.js:606-609`)
- [ ] F39: Platform status dots all grey — compute from real OAuth connection state (`pages-settings-account.js:234-238`)
- [ ] F40: Connected shops always 0 — derive from real `connectedShops` state (`pages-settings-account.js:79`)
- [ ] F41: Sync status all "Never" — show real last-sync timestamps (`pages-settings-account.js:623-626`)
- [ ] F43: Notification save shows success even on error — add error handler for notification save API call (`handlers-settings-account.js`)
- [ ] F45: Roadmap in-progress always 50% — use real `progress` field when available (`pages-deferred.js:10527`)
- [ ] F46: Roadmap 3 features hardcoded — remove hardcoded eBay Bot/EasyPost/Stripe Billing entries (`pages-deferred.js:10374-10378`)
- [ ] F47: Onboarding "0/4" timing bug — wait for API load before checking `store.state.shops` (`core-bundle.js:10208-10211`)

---

## LOW — Minor / Stub Cleanup

- [ ] F68: Live Support Chat fake bot — implement real support backend or websocket connection; remove hardcoded "support agent" reply (`handlers-community-help.js:1129-1137`)
- [ ] F83: `runRetentionCleanup()` stub — implement or remove "coming soon" toast (`handlers-deferred.js:6482-6484`)
- [ ] F84: `enhanceQuickPhoto()` fake — implement canvas API processing or call Cloudinary enhance endpoint (`init.js:1589-1595`)
- [ ] F85: Offline queue `executeAction()` empty — implement action replay on reconnect (`widgets.js:1094-1098`)
