# /mobile-audit — VaultLister Mobile Audit (390px iPhone)

Run a strict visual + functional mobile audit of the live VaultLister app at 390px iPhone viewport. Produces a classified findings report.

## CRITICAL RULES — NON-NEGOTIABLE
1. **SCREENSHOT EVERY PAGE before any DOM check.** Look at it. If it looks broken, record it as VERIFIED.
2. **ONLY use `mcp__claude-in-chrome__*` tools.** NEVER use `mcp__plugin_chrome-devtools-mcp` — that opens a separate Chrome window you can't log into.
3. **NEVER mark VERIFIED without screenshot evidence.**
4. **NEVER use `window.location.hash` or `window.router.navigate()`** — both disconnect the extension bridge. Use `renderApp(window.pages.xxx())`.
5. **Restore window width to 1280px when done** — user's session is in this window.

## Phase 1: Setup

1. Get tab context: `mcp__claude-in-chrome__tabs_context_mcp`
2. Navigate to live site: `https://vaultlister-app-production.up.railway.app`
3. Resize to 390px: `mcp__claude-in-chrome__resize_window` — width: 390, height: 844
4. Wait 1 second for reflow.
5. Take baseline screenshot — confirm the page renders at mobile width.
6. Inject fake session:
   ```js
   window.store.setState({user:{id:'demo',username:'demo',email:'demo@vaultlister.com',role:'admin'},token:'fake',refreshToken:'fake',isAuthenticated:true});
   window.fetch = async (url, opts) => {
     if (url.includes('/api/')) return new Response(JSON.stringify({success:true,data:[],total:0,items:[]}),{status:200,headers:{'Content-Type':'application/json'}});
     return fetch(url, opts);
   };
   renderApp(window.pages.dashboard());
   ```

## Phase 2: Pages to Test

Test each page in this order. For each: take screenshot → look → record issues.

| Page | Render call |
|------|------------|
| Dashboard | `renderApp(window.pages.dashboard())` |
| Inventory | `renderApp(window.pages.inventory())` |
| Cross-Lister | `renderApp(window.pages.crossLister())` |
| Automations | `renderApp(window.pages.automations())` |
| Analytics | `renderApp(window.pages.analytics())` |
| Sales | `renderApp(window.pages.sales())` |
| Offers | `renderApp(window.pages.offers())` |
| Image Bank | `renderApp(window.pages.imageBank())` |
| Settings | `renderApp(window.pages.settings())` |

Re-inject fake session before each `renderApp()` call — API calls will trigger logout.

## Phase 3: What to Check on Each Page

### Layout
- No horizontal scroll bar (check via `document.documentElement.scrollWidth > 390`)
- No text/elements clipped at right edge
- No overlapping UI elements
- Sidebar collapsed (should NOT show at 390px)
- Only mobile header visible (`.mobile-header` shows, `.header` hidden)

### Touch Targets (WCAG 2.5.5 — 44×44px minimum)
Run in console after each render:
```js
const small = Array.from(document.querySelectorAll('button, a, [role="button"]'))
  .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); })
  .map(el => ({ text: el.textContent.trim().slice(0,40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
console.log(JSON.stringify(small));
```
Any result with elements = VERIFIED touch target issue.

### iOS Auto-Zoom Prevention
```js
const zoomRisk = Array.from(document.querySelectorAll('input, select, textarea'))
  .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16)
  .map(el => ({ tag: el.tagName, class: el.className.slice(0,40), fs: getComputedStyle(el).fontSize }));
console.log(JSON.stringify(zoomRisk));
```
Any result with elements = VERIFIED iOS zoom issue.

### Widget Grid (Dashboard only)
```js
const container = document.querySelector('.dashboard-widgets-container');
if (container) console.log(getComputedStyle(container).gridTemplateColumns);
```
Expected at 390px: two columns (`XXXpx XXXpx`). Six equal tiny columns = VERIFIED grid issue.

### Forms / Inputs
- Inputs full-width (not overflowing viewport)
- Labels visible above inputs
- Dropdowns usable at 390px

### Navigation
- Mobile hamburger menu visible and ≥44×44px
- Menu opens on tap
- Menu items readable at 390px

## Phase 4: Issue Classification

Classify each finding:

| Class | Criteria |
|-------|----------|
| **VERIFIED** | Screenshot shows the issue. Console output confirms. |
| **HIGH-PROBABILITY** | Strong code evidence (CSS missing breakpoint, hardcoded px value) but no screenshot confirmation. |
| **HYPOTHESIS** | Inference only — no direct evidence yet. |

Only VERIFIED issues should be fixed without further investigation.

## Phase 5: Cleanup and Report

1. Restore window: `mcp__claude-in-chrome__resize_window` — width: 1280, height: 900
2. Determine next report filename: check `docs/audits/mobile/` for existing files, increment date/version.
3. Write report to `docs/audits/mobile/mobile-audit-YYYY-MM-DD.md` using the template:

```markdown
# Mobile Audit — YYYY-MM-DD
Viewport: 390×844 (iPhone 14 Pro)
Tested: [pages list]
Tool: mcp__claude-in-chrome__resize_window

## Summary
- VERIFIED: N
- HIGH-PROBABILITY: N
- HYPOTHESIS: N

## Findings

### [Page Name]
#### [Issue title] — VERIFIED / HIGH-PROBABILITY / HYPOTHESIS
**Evidence:** [screenshot filename or console output]
**Impact:** [what breaks for the user]
**Location:** [CSS class / file / line if known]

## Previously Fixed (this session baseline)
[list any fixes applied before this audit]
```

4. Tell the user: "Audit complete. N VERIFIED issues written to docs/audits/mobile/mobile-audit-YYYY-MM-DD.md. Run /mobile-fix to patch VERIFIED issues."
