# Vault Buddy — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-vb-1 | Vault Buddy | Please make the default Chatbot size larger and allow the user to resize it if they would like to. Additionally Please add another tab to the chat popup that says "Home". The Home tab in the chat popup should show all of the following dropdown menu buttons and options (image-96, image-97) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| L-9 | Vault Buddy | Chat bubble occludes content — covers "Net" label in financials, "Goal" in analytics | Session 1 | VERIFIED ✅ — main.css — Vault Buddy FAB positioned bottom-right, no nav overlap, confirmed live |
| M-34 | Vault Buddy | Chat bubble click does nothing — no chat window opens | Session 3 | VERIFIED ✅ — 00e1551 — handlers-core.js: core stub for toggleVaultBuddy lazy-loads community chunk on click |
| #159 | Vault Buddy | Vault Buddy auto-opens on every page render — `renderApp()` triggers panel open automatically on every page load; fires "Failed to load conversations" error toast each time | Session 8 | VERIFIED ✅ — e097efa |
| #185 | Vault Buddy | `toggleVaultBuddy` crashes: `TypeError: pages[store.state.currentPage] is not a function` — calls `pages[currentPage]()` instead of `window.pages[currentPage]()` for deferred chunk pages | Session 14 | VERIFIED ✅ — 07338ae |
| #186 | Vault Buddy | Vault Buddy chat completely non-functional — all operations crash with `undefined.get` error (same root cause as #150). No conversations can be loaded, no new chats can be started | Session 14 | VERIFIED ✅ — aca307f + 5f331cc — toggleVaultBuddy opens panel; sendVaultBuddyMessage runs without crash |
| 186-new | Vault Buddy / API Routes | Vault Buddy chat GET 404 after POST 201 — route regex `[a-f0-9-]+` didn't match `conv_TIMESTAMP_HEXSUFFIX` ID format. Both GET and DELETE routes were broken. | Post-session | VERIFIED ✅ — 5a7c6c0 |
