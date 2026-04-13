---
name: mobile-audit
description: Strict visual and functional mobile audit of VaultLister at 390px iPhone viewport. Screenshot-first. Evidence required for VERIFIED classification. Run when asked to audit mobile, check mobile layout, or test on iPhone.
trigger: /mobile-audit
---

# /mobile-audit — VaultLister Mobile Audit Skill

You are running a strict mobile audit of the VaultLister live app at 390px iPhone viewport. Every claim about a bug must be backed by a screenshot or console output. No guessing.

## Recommended Approach: BrowserStack (all 9 pages, stable viewport)

```bash
# First-time setup
npm install  # installs browserstack-node-sdk
# Add to .env: BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY

bun run test:mobile-audit
# Results: playwright-report/browserstack/
```

BrowserStack runs `e2e/tests/mobile-audit.bs.spec.js` on a real iPhone 14 Pro at 390×844.
All 9 pages are testable — Playwright viewport is stable (no DPR/click-reset issues).
After the run, check `playwright-report/browserstack/` for screenshots and failures, then
update `docs/audits/mobile/mobile-audit-YYYY-MM-DD.md` with findings.

## Fallback Approach: Claude in Chrome (Dashboard + Analytics only)

Use this only when BrowserStack credentials are unavailable. Limited to 2/9 pages due to
Windows DPR tooling limitation — `resize_window` sets OS window to 390px but CSS viewport
reports ~726px (DPR=0.75). Click interactions reset viewport to 1845px, blocking lazy-loaded
page navigation.

### Rules (Non-Negotiable)

1. Screenshot BEFORE any DOM check. Take it, look at it, then decide.
2. Use ONLY `mcp__claude-in-chrome__*` tools. NEVER use `mcp__plugin_chrome-devtools-mcp` — it opens an unauthenticated separate window.
3. NEVER use `window.location.hash` or `window.router.navigate()` — both disconnect the extension bridge. Use `renderApp(window.pages.xxx())`.
4. Re-inject fake session before EVERY `renderApp()` call. API errors trigger logout and clear the session.
5. Restore the Chrome window to 1280px when done. The user's session is in this window.

## Setup Sequence

```javascript
// 1. Resize to iPhone 14 Pro dimensions
mcp__claude-in-chrome__resize_window({ width: 390, height: 844 })

// 2. Inject fake session (in javascript_tool with correct tabId)
window.store.setState({
  user: { id: 'demo', username: 'demo', email: 'demo@vaultlister.com', role: 'admin' },
  token: 'fake', refreshToken: 'fake', isAuthenticated: true
});
window.fetch = async (url, opts) => {
  if (url.includes('/api/')) {
    return new Response(JSON.stringify({ success: true, data: [], total: 0, items: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  return fetch(url, opts);
};

// 3. Render first page
renderApp(window.pages.dashboard());
```

## Pages to Test (in order)

Dashboard → Inventory → Cross-Lister → Automations → Analytics → Sales → Offers → Image Bank → Settings

Re-inject session before each `renderApp()` call.

## Checks on Every Page

### Visual Layout
- [ ] No horizontal scrollbar — `document.documentElement.scrollWidth <= 390`
- [ ] No elements clipped at right edge
- [ ] No overlapping elements
- [ ] Only `.mobile-header` visible (`.header` must be hidden)
- [ ] Sidebar absent at 390px
- [ ] Text readable — not truncated, not overflowing

### Touch Targets (WCAG 2.5.5)
Run after render:
```javascript
const small = Array.from(document.querySelectorAll('button, a, [role="button"]'))
  .filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.width < 44 || r.height < 44);
  })
  .map(el => ({ text: el.textContent.trim().slice(0, 40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
JSON.stringify(small);
```
Non-empty result = VERIFIED touch target failure.

### iOS Auto-Zoom (Safari zooms when focused input font-size < 16px)
```javascript
const risk = Array.from(document.querySelectorAll('input, select, textarea'))
  .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16)
  .map(el => ({ tag: el.tagName, fs: getComputedStyle(el).fontSize }));
JSON.stringify(risk);
```
Non-empty result = VERIFIED iOS zoom risk.

### Dashboard Widget Grid
```javascript
const c = document.querySelector('.dashboard-widgets-container');
c ? getComputedStyle(c).gridTemplateColumns : 'container not found';
```
At 390px: should be 2 columns. Six tiny equal columns = VERIFIED grid issue.

### Button Row Stacking
On pages with `.page-header` action buttons, check they wrap horizontally — not stack into a single column.

### Form Fields
- Full-width inputs (not overflowing)
- Labels readable above inputs
- Dropdowns/selects tappable

## Issue Classification

| Class | When to use |
|-------|-------------|
| **VERIFIED** | Screenshot shows issue AND/OR console output confirms it. You saw it. |
| **HIGH-PROBABILITY** | CSS grep shows a missing rule or hardcoded non-responsive value. Not screenshot-confirmed. |
| **HYPOTHESIS** | Pattern inference only — no direct evidence. |

Only VERIFIED issues get fixed by `/mobile-fix` without additional investigation.

## Report Output

Write to `docs/audits/mobile/mobile-audit-YYYY-MM-DD.md`.

Structure:
```markdown
# Mobile Audit — YYYY-MM-DD
Viewport: 390×844 (iPhone 14 Pro)
Live site: https://vaultlister-app-production.up.railway.app
Tested pages: [list]

## Summary
- VERIFIED: N issues
- HIGH-PROBABILITY: N issues  
- HYPOTHESIS: N issues

## Findings

### [Page Name]
#### [Issue title] — [CLASS]
**Evidence:** [description of screenshot or console output]
**Impact:** [user-facing consequence]
**Fix hint:** [CSS class / file / property if known]
```

After writing the report:
1. Restore Chrome: `mcp__claude-in-chrome__resize_window` width: 1280, height: 900
2. Tell user: "Audit complete. N VERIFIED issues found. Report at docs/audits/mobile/mobile-audit-YYYY-MM-DD.md. Run /mobile-fix to patch."

## Known VaultLister Mobile Patterns

These were verified fixed in April 2026 (commits 659ac3a, ef5daa9, 4deaa78, f80adad):
- `.header` hidden on mobile via `@media (max-width: 1024px) { .header { display: none; } }`
- `.page-header .flex { flex-wrap: wrap }` at ≤768px (not `flex-direction: column`)
- Form inputs at `font-size: 1rem` at ≤768px
- Dashboard grid: `repeat(2, 1fr)` at ≤768px
- Touch targets: `.mobile-menu-btn`, `.widget-collapse-btn`, `.onboarding-minimize/dismiss`, `.announcement-banner-close`, `.user-avatar` all ≥44×44px

If any of these re-appear, it means a CSS regression — check if `core-bundle.js` was regenerated after the source module edit.
