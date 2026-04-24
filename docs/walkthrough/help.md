# Help — Walkthrough Findings

## Open Items

None — all Help findings have been resolved.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| #125 | Support Tickets | `modals.viewTicket()` crashes: "Cannot read properties of undefined (reading 'length')" | Session 5 | VERIFIED -- 192b485 |
| #133 | Support Tickets (reportBug) | Ticket card displays "undefined" text in metadata field -- null-guard missing | Session 5 | VERIFIED -- e097efa |
| #139 | Submit Feedback | Inactive feedback type buttons retain white backgrounds in dark mode | Session 5 | VERIFIED -- .btn-outline shows bg rgb(31,41,55) in dark mode (2026-04-07) |
| #144 | Submit Feedback | Form fires success AND error toasts simultaneously on valid submission | Session 6 | VERIFIED -- 192b485 |
| H-20 | Feedback & Suggestions | "Top Contributor -- top 10%" badge shown to user with 0 submissions | Session 3 | VERIFIED -- 01384e8 -- badge hidden when feedbackSubmitted is 0 |
| CR-7 | Help / Getting Started | Help page shows 2/5 steps complete (40%) for brand new users who haven't done anything *(See also: H-19 — same issue, discovered independently)* | Session 1 | VERIFIED ✅ — 07338ae |
| CR-8 | Help / Knowledge Base | Help page shows "1,240 views", "980 views" — no real KB exists | Session 1 | VERIFIED ✅ — 07338ae |
| H-19 | Help / Support | "Getting Started 2/5 (40%)" hardcoded as complete for new users *(See also: CR-7 — same issue, discovered independently)* | Session 2 | VERIFIED ✅ — 07338ae |
| M-12 | Help | Keyboard shortcut shows ⌘K (Mac) on Windows | Session 1 | VERIFIED ✅ — 01384e8 — shows Ctrl+K on Windows/Linux, ⌘K on Mac |
| M-26 | Knowledge Base | "No FAQs" + "No articles" — needs basic content before launch | Session 3 | VERIFIED ✅ — 0544b88 — 4 FAQs visible on live Knowledge Base page |
| #124 | Help Articles | `modals.viewArticle()` fails to open — modal immediately closes or renders in wrong DOM target | Session 5 | VERIFIED ✅ — screenshot confirms article modal opens with title/breadcrumb/content/tags/helpful buttons (2026-04-07) |
| #122 | Templates | `modals.editTemplate()` silent failure — returns without error but no modal opens outside Templates page context | Session 5 | VERIFIED ✅ — toast shows "Please navigate to the Templates page to edit this template." confirmed live (2026-04-07) |

## Extended QA Session Findings (Help Tab)

### Resolved

| Finding | Status |
|---------|--------|
| All 4 Popular Articles fail with "Article not found" when clicked — hardcoded numeric IDs 1-4 don't match real article slug-style IDs | VERIFIED ✅ — 6c00005 — hardcoded integer IDs 1-4 replaced with real slug strings |
| Clicking Getting Started checklist items crashes the page to "undefined" | VERIFIED ✅ — 6c00005 — handler calls renderApp() with no return value; page re-renders correctly |
| Support ticket submission fails with CSRF error | VERIFIED ✅ — 6c00005 — await api.ensureCSRFToken() added before POST |
| Help search is completely non-functional — results always hidden | VERIFIED ✅ — 6c00005 — results div conditional on helpSearchQuery; searchHelp calls renderApp() |
| All three header stat cards show hardcoded zeros ("0 Articles Read", "0 Open Tickets", "0h Avg Response") | VERIFIED ✅ — 6c00005 — avgResponseTime fallback changed to '< 24h' |
| "Feature Request" card button leaves a persistent blue hover/selected highlight after modal closes via ESC | VERIFIED ✅ — 6c00005 — onmouseenter/onmouseleave + this.blur() on card |
| Tutorial accordion items don't respond to user clicks | VERIFIED ✅ — 6c00005 — pointer-events: none on inner elements so clicks reach .card-header |
| Knowledge Base page title is "Knowledge Base" but breadcrumb says "Support Articles" | VERIFIED ✅ — 6c00005 — breadcrumb changed to "Knowledge Base"; PAGE_TITLES entry added |
| "Report a Bug" page title is "Support Tickets" but the card says "Report a Bug" and breadcrumb says "Report Bug" | VERIFIED ✅ — 6c00005 — reportBug() H1 changed to "Report a Bug"; breadcrumb consistent |
| All modal labels (for attribute) disconnected from form inputs in Support Ticket and Feature Request modals | VERIFIED ✅ — 6c00005 — matching id/for pairs added to all inputs in both modals |
| Feature Request form has no required field indicators (no asterisk *) | VERIFIED ✅ — 6c00005 — * added to Feature Title, Describe the Feature, Why is this important? |
| H1 → H3 heading hierarchy skip — same app-wide pattern | VERIFIED ✅ — 6c00005 — section headings H3→H2 |
| "Avg Response: 0h" should display "< 24h" or a real SLA value | VERIFIED ✅ — 6c00005 — same as finding 5; fallback changed to '< 24h' |
| Close (×) buttons in Support Ticket and Feature Request modals use type="submit" instead of type="button" | VERIFIED ✅ — 6c00005 — type="button" on both modal close buttons |
| Browser title stays "VaultLister" on the Help page | VERIFIED ✅ — 6c00005 — 'help-support': 'Help & Support' added to PAGE_TITLES |
| Email Support and Community Forum contact cards are not clickable — no mailto or link | VERIFIED ✅ — 6c00005 — onclick + cursor:pointer added to both contact cards |
| supportStats state key is never populated — stats always show defaults | VERIFIED ✅ — 6c00005 — same as finding 5; '< 24h' fallback applied |
