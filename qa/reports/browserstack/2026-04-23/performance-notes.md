# BrowserStack Performance Scan — Notes (2026-04-23)

## BS-7 Investigation & Fix Summary

---

## Part 1 — Zero-Score SPA Routes: Confirmed Scanner Artifact

**Affected routes:** `/#calendar`, `/#listings`, `/#shops`, `/#orders-sales`, `/#sales`, `/`

**Finding:** All six routes show TTFB > 0 but LCP/FCP/TBT/CLS = exactly 0.0. This is physically impossible for a rendered page — it indicates the scanner measured the TCP/HTTP connection but never observed a paint event.

**Root cause — auth guard fires before any paint:**

File: `src/frontend/core/router.js`, lines 394–422

```js
// Auth guard: redirect unauthenticated users to login for protected routes.
const publicRoutes = ['login', 'register', 'forgot-password', 'reset-password', ...];
if (!publicRoutes.includes(path)) {
    const token = store.state.token;
    if (!auth.isAuthenticated() || this._isTokenExpired(token)) {
        // ...
        } else if (!auth.isAuthenticated()) {
            store.setState({ currentPage: 'login', _intendedRoute: path });
            window.location.hash = '#login';   // ← redirect fires here, before any content paint
            const handler = this.routes['login'];
            if (handler) handler();
            return;
        }
    }
}
```

The BrowserStack scanner hits these SPA hash routes without a valid session. The router immediately redirects to `#login` and returns — no protected page content is ever rendered. The scanner's Lighthouse run captures TTFB (the initial HTTP connection) but sees no LCP or FCP because the page redirects before painting any content.

**Verdict:** NOT real performance failures. No code change required. These routes are functioning correctly — unauthenticated traffic is blocked by design.

---

## Part 2 — status.html CLS Fix (CLS 0.112 → target < 0.1)

**Confirmed CLS sources found and fixed:**

### Fix 1: Nav logo missing `width` attribute (line 520)
- `horizontal-2048.svg` intrinsic size: 2048×512 (aspect ratio 4:1)
- At `height="75"`, correct width = 75 × (2048/512) = **300**
- Added `width="300"` — browser can now reserve correct space before image loads

### Fix 2: Footer logo missing `width` attribute (line 719)
- `horizontal-512.svg` intrinsic size: 512×128 (aspect ratio 4:1)
- At `height="36"`, correct width = 36 × (512/128) = **144**
- Added `width="144"` — browser can now reserve correct space before image loads

### Fix 3: JS-injected platform logo images — no reserved space (CSS)
- `renderPlatformCards()` creates 7 platform cards synchronously, each containing 2 `<img>` elements for marketplace logos with no `width`/`height` attributes
- `.platform-hero img` and `.status-row-title img` created via `el('img', { attrs: { src, alt } })` with no dimensions
- 7 cards × 2 logo images = 14 potential layout-shift events as logos load
- **Fix:** Added `min-height: 54px` to `.platform-hero` to reserve space for the tallest logo (max `logoHeight` is 38px + card padding), and added `display: block` + `aspect-ratio: auto` to `.platform-hero img` and `.status-row-title img` to signal intrinsic sizing

**Lint verification after fixes:** `bun run lint:html` → `HTML OK` (0 errors, 14 pre-existing warnings)

**TODO (future regression risk):** `renderPastIncidents()` replaces the static "No resolved incidents in the last 90 days." text with a dynamically-built `<ul>` of different height when incidents exist. Currently no incidents → no shift. When the first real incident is posted, this will cause CLS. Fix: give `#past-incidents-list` a `min-height` matching the empty state, or pre-render as a `<ul>` with an empty-state `<li>`.

---

## Part 3 — TBT Findings (SPA Routes with Real Performance Issues)

**Affected routes and scores:**
| Route | Score | Main issue |
|---|---:|---|
| `/#forgot-password` | 90 | TBT |
| `/#register` | 94 | TBT |
| `/#reports` | 95 | TBT |
| `/#planner` | 96 | TBT |
| `/#analytics` | 96 | TBT |
| `/#automations` | 96 | TBT |

**Bundle size:**
```
src/frontend/core-bundle.js: 1,497,978 bytes (~1.43 MB uncompressed)
```

**Likely cause:** The SPA loads `core-bundle.js` (1.43 MB) as a single synchronous script. Bun compiles 12 source modules into one chunk. On lower-end mobile CPUs (which BrowserStack tests emulate), parsing and executing 1.43 MB of JS creates a long task on the main thread, which directly causes TBT. The TBT issue is worst on `/#forgot-password` (score 90) and `/#register` (score 94) — the two lightest auth pages — which indicates the bundle parse cost dominates, not the page logic.

**Why these routes and not others?** These routes are accessible without auth (they are in `publicRoutes`), so the scanner actually renders them. Routes like `/#dashboard`, `/#inventory`, etc. redirect to login before rendering — they show 0 TBT because no JS runs past the redirect.

**Recommendations (not implemented in this PR — deferred):**
1. **Route-based code splitting:** Extract heavy page modules (reports, analytics, planner, automations) from the core bundle into lazy-loaded chunks. These are already in separate source files (`pages-sales-orders.js`, `pages-intelligence.js`, etc.) — the Bun build config needs to be updated to emit separate chunks and load them on-demand.
2. **Defer non-critical modules:** Move chart libraries, AI features, and bot-management code out of the eager bundle.
3. **Minification + compression:** Ensure Railway serves `core-bundle.js` with gzip/brotli. 1.43 MB uncompressed is likely ~400–500 KB compressed, which significantly reduces parse time.
4. **Preload hint for auth pages:** Auth pages (`/login`, `/register`, `/forgot-password`) don't need the full bundle. A separate minimal auth bundle could load in < 100 KB.

These are architectural changes that require ADR review before implementation.

---

## Files Changed in This PR

- `public/status.html` — fixed nav logo `width`, footer logo `width`, `.platform-hero` space reservation
- `qa/reports/browserstack/2026-04-23/performance-notes.md` — this file
