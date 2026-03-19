# Frontend Layer Audit — VaultLister 3.0

**Date:** 2026-03-19
**Auditor:** Claude Code (QA Specialist)
**Scope:** `src/frontend/` — all JS, HTML, page, handler, core, UI, and init files
**Method:** Static analysis — source reading, grep pattern matching, structural tracing

---

## Executive Summary

The frontend has solid foundations in XSS escaping (`escapeHtml` on all modal and toast outputs), auth token storage (sessionStorage-only, never localStorage), CSRF enforcement on every mutating `api.request()` call, and modal focus-trap / Escape handling. The most urgent problems are structural and systemic:

- `app.js` (~3.7 MB) and every extracted module file (`core/*.js`, `ui/*.js`, `handlers/*.js`, `init.js`) are verbatim duplicates of sections of `app.js`. Every defect exists in 2–3 locations. Any fix must be applied to all copies.
- Direct `store.state.*` mutations bypass `setState()` in at least 6 places across handler and page files.
- `app.toast(...)` is called in a live handler — `app` is undefined and the call crashes silently.
- Two different localStorage keys (`vaultlister_dark_mode` vs `vaultlister_darkmode`) are used for dark mode across different code paths, causing silent preference loss.
- `addPhotosToBank`, `removeQuickPhoto`, and `enhanceQuickPhoto` handlers are non-functional stubs in the chunk-loaded files — Quick Photo Capture silently does nothing in those code paths.

---

## Findings Table

| # | File | Line(s) | Severity | Category | Description |
|---|------|---------|----------|----------|-------------|
| F-01 | `init.js` / `core-bundle.js` / `app.js` | init.js:1623 | Critical | Broken Reference | `handlers.downloadLegalPDF` calls `app.toast(...)` but `app` is never defined globally. Crashes silently on every legal document download — no download occurs, no error shown. Correct call is `toast.success(...)`. |
| F-02 | `core/api.js` | 119–123 | High | State Management | `store.state.rateLimitInfo` mutated directly without `setState()`. Bypasses subscriber notification and `persist()`. Duplicate at `core-bundle.js:8290`. |
| F-03 | `core/auth.js` | 58 | High | State Management | `store.state.useSessionStorage = true` is a direct mutation without `setState()`, skipping all subscriber notifications. Same at `core-bundle.js:20858` and `app.js:37569`. |
| F-04 | `handlers/handlers-settings-account.js` | 1710, 2557–2612 | High | State Management | Six direct `store.state.*` mutations without `setState()`: `darkModePreview`, `globalSearchItems`, `globalSearchIndex` (×2), `globalSearchFiltered`. Identical mutations in `handlers-deferred.js` and `app.js`. |
| F-05 | `pages/pages-tools-tasks.js` | 455, 457 | High | State Management | `store.state.checklistTab` assigned directly in inline `onclick` template expressions, bypassing `setState()` entirely. |
| F-06 | `init.js` / `core-bundle.js` / `app.js` | Entire files | Critical | Duplicate Code | All extracted module files are verbatim copies of sections of `app.js`. Every defect exists in 2–3 locations. Any fix applied to one copy must be re-applied to all others or live behavior is undefined depending on which script loads. This is the root-cause multiplier for all other findings. |
| F-07 | `handlers/handlers-tools-tasks.js` | 5212–5224 | High | Broken Feature | `addPhotosToBank()`, `removeQuickPhoto()`, and `enhanceQuickPhoto()` are stubs emitting only a toast. Real upload implementation is in `init.js:1525`. If the chunk-loaded version runs, Quick Photo Capture silently does nothing. |
| F-08 | `handlers/handlers-deferred.js` | 26856–26866 | High | Broken Feature | Same stub pattern: `addPhotosToBank`, `removeQuickPhoto`, `enhanceQuickPhoto` emit a toast and do nothing, shadowing the real implementations. |
| F-09 | `init.js` | 1525–1560 | High | Auth Gap | `addPhotosToBank` uses raw `fetch('/api/image-bank/upload')` bypassing `api.request()`. Missing: 401/token-refresh retry, AbortController 30s timeout, retry-on-500, structured error. Token expiry mid-upload produces opaque failure. |
| F-10 | Multiple | `handlers-settings-account.js:1692`, `handlers-core.js:410,414`, `init.js:39` | High | State Inconsistency | Three different localStorage keys for dark mode: `vaultlister_dark_mode` (settings handler, `init.js` reader) vs `vaultlister_darkmode` (header toggle, `themeManager`). Dark mode preference can be silently lost depending on which path last ran. |
| F-11 | `core/utils.js` | 4595 | High | XSS | `richTooltip.show(target, content)` sets `tooltip.innerHTML = content` where `content` is the raw caller-supplied string with no escaping guarantee. Any caller passing unsanitized server data is an XSS sink. Same at `core-bundle.js:4596`. |
| F-12 | `core/utils.js` | 665–676 | Medium | DOM Memory Leak | `scrollToTop.init()` adds a `window` scroll listener with no removal mechanism. Each initialization adds another listener. Same at `core-bundle.js:666` and `widgets.js:996`. |
| F-13 | Multiple files | Various | Medium | DOM Memory Leak | 33 separate `document.addEventListener('keydown', ...)` calls across 6 files at module-load scope, most without corresponding `removeEventListener`. Listener count grows with any component re-initialization. |
| F-14 | `ui/widgets.js` / `core/utils.js` | widgets.js:3499, utils.js:1487 | Medium | DOM Memory Leak | `countdownTimer` `setInterval` not cleared by the router on page navigation. Continues running after page transitions, referencing stale DOM. |
| F-15 | `init.js` | 1627–1634 | Medium | DOM Memory Leak | `document.addEventListener('scroll', ...)` added at module load to update `.legal-progress` elements. Runs on every scroll in the entire app at all times, never removed. |
| F-16 | `core/router.js` | 404–441 | Medium | Stale State | `loadPageData()` covers fewer pages than the `handleRoute()` data-loading block. Missing: `financials`, `transactions`, `community`, `support-articles`, `report-bug`, `orders-sales`. These pages show empty/stale content on the initial-load background re-render path. |
| F-17 | `init.js` | 126–200 (16 route registrations) | Medium | Double Render | Inventory, listings, orders, planner, and 13 other routes call `renderApp()` then `await handlers.load*()` then `renderApp()` again. Every navigation to a data-loading page renders twice — visible flash, doubled render side-effects. |
| F-18 | `core/toast.js` | 35 | Medium | XSS Risk | Undo button `onclick="toast.handleUndo('${toastId}', ${undoAction})"` — `undoAction` is serialized directly into an inline `onclick` attribute. If `undoAction` is a function its `.toString()` output is injected verbatim. Same at `core-bundle.js:8666`. |
| F-19 | `ui/modals.js` | 96, 108–119 | Medium | Accessibility | `confirm()` X-close button sets `modal-container.innerHTML = ''` directly without calling `modals.close()`. Leaves `_escapeHandler` and `_focusTrapHandler` permanently attached to `document`. Focus not restored to `_previouslyFocused`. Keyboard users lose their page position. |
| F-20 | `core/router.js` | 242 | Low | State Inconsistency | `delete store.state.darkModePreview` mutates state directly without `setState()`, bypassing all subscribers. |
| F-21 | `init.js` | 358–366 | Low | Dead Code | `window.addEventListener('message', ...)` has two empty `if`-branches for `email-oauth-success` and `email-oauth-error` with no actual handling code. |
| F-22 | `core/auth.js` | 85 | Medium | DOM Memory Leak | `window._loginBanCountdown` `setInterval` started on auth rate-limit response. Router clears `_lockoutCountdown` (router.js:206) but not `_loginBanCountdown`. Interval outlives its countdown DOM element. |
| F-23 | `init.js` | 56–70 | Low | Race Condition | WebSocket subscriptions registered inside `setTimeout(..., 2000)`. Offer and notification events in the first 2 seconds after login are silently dropped. |
| F-24 | `core/store.js` | 8–363 | Medium | Performance | `store.state` initial value contains ~10KB of hardcoded demo data: 10 inventory items, 12 listings, 10 sales, 4 offers, 8 orders, 26 analytics data points, etc. All allocated on every page load before server data arrives. |
| F-25 | `handlers/handlers-settings-account.js` | 2527 | Low | Performance | Global search `oninput` handler has no debounce. Every keystroke triggers full search execution and re-render. |
| F-26 | `core/utils.js` | 198–207 | Low | Accessibility | `tableSorter.initSortableHeaders` adds `click` handlers on `<th>` without `tabindex="0"`, `role="button"`, or `keydown` handlers. Tables cannot be sorted by keyboard-only users. |
| F-27 | `init.js` | 410–444 | Low | Accessibility | `showAddWebhookModal()` creates a modal manually, bypassing `modals.show()`. No `aria-labelledby` wired to the `<h3>` heading. Screen readers cannot announce the modal title. |
| F-28 | `core/router.js` | 106 | Low | Hardcoded Value | `const v = '19'` is a magic chunk version string not derived from build metadata. Requires manual update on every build or cache-busting breaks. |
| F-29 | `core/api.js` | 213–221 | Low | Correctness | `ensureCSRFToken()` fetches `/inventory?limit=1` as a side effect to obtain a CSRF token, then awaits an arbitrary 50ms delay. No guarantee the token has arrived. Creates unwanted audit/analytics events. |
| F-30 | `pages/pages-community-help.js` | 1857 | Low | XSS Risk | `<img src="${store.state.feedbackScreenshot}">` — value is a `FileReader` `data:` URL stored in state but not validated to be exclusively `data:image/*` before use. |

---

## Critical Path Impact

| Finding | User Journey Broken |
|---------|---------------------|
| F-01 | Legal PDF download silently crashes — no download, no error shown |
| F-06 | Every fix requires triple-edit — high regression velocity for the whole codebase |
| F-07 / F-08 | Quick Photo Capture "Add to Bank" does nothing in chunk-loaded context |
| F-10 | Dark mode preference silently lost on certain navigation paths |
| F-11 | XSS possible via `richTooltip` content if any caller passes server data |
| F-16 | Pages (financials, community, etc.) render with empty data on first load |
| F-17 | All data-loading pages flash and render twice on every navigation |
| F-19 | Keyboard users lose focus position after closing confirm dialogs via X button |

---

## Verified vs Assumed Coverage

| Area | Verdict | Evidence |
|------|---------|----------|
| `escapeHtml()` on all toast messages | VERIFIED | `toast.js:32` |
| `escapeHtml()` on `confirm()` and `prompt()` content | VERIFIED | `modals.js:95,99,131–136` |
| Auth token never written to localStorage | VERIFIED | `store.js:396–401` |
| CSRF token on all `api.request()` mutating calls | VERIFIED | `api.js:73–76` |
| Token refresh deduplication (`isRefreshing` guard) | VERIFIED | `api.js:18–19` |
| Modal Tab key focus trap implemented | VERIFIED | `modals.js:33–55` |
| Modal Escape handler cleaned up on `modals.close()` | VERIFIED | `modals.js:61–67` |
| `IntersectionObserver` feature-detected before use | VERIFIED | `utils/performance.js:43` |
| `getUserMedia` feature-detected before use | VERIFIED | `handlers-tools-tasks.js:4257` |
| Dark mode preference consistent across all paths | NOT VERIFIED | F-10: two different localStorage keys confirmed |
| `richTooltip` content sanitized before `innerHTML` | NOT VERIFIED | F-11: confirmed unsanitized |
| All `setInterval` calls cleaned up on navigation | NOT VERIFIED | F-14, F-22: confirmed leaks |
| `addPhotosToBank` executes real upload in all code paths | NOT VERIFIED | F-07/F-08: stubs confirmed |
| `confirm()` X-button restores focus to trigger element | NOT VERIFIED | F-19: confirmed focus not restored |

---

## Recommended Missing Automated Tests

1. **F-01:** Call `handlers.downloadLegalPDF('terms')` and assert no `TypeError` is thrown and a download blob is created.
2. **F-10:** Toggle dark mode via the header path; read the preference via the settings init path; assert both use the same `localStorage` key and the same value after `location.reload()`.
3. **F-11:** Pass `'<img src=x onerror="window.__xss=1">'` to `richTooltip.show()` and assert `window.__xss` remains `undefined` after render.
4. **F-17:** Spy on `renderApp` before navigating to `#inventory`; assert it is called exactly once, not twice.
5. **F-19:** Open a `modals.confirm()` dialog, click the X-close button, assert `document.activeElement === triggerElement`.
6. **F-22:** Trigger a login ban countdown, call `router.navigate('dashboard')`, assert `window._loginBanCountdown` is `null` or cleared within one tick.
7. **F-07/F-08:** After the `tools` chunk loads, call `handlers.addPhotosToBank()` and assert a `POST` request is issued to `/api/image-bank/upload`, not just a toast.
