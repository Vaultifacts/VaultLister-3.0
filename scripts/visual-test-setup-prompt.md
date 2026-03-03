# Universal Visual & Interactive Testing Script Setup Prompt

> **How to use:** Copy everything below the line into Claude Code on any web application project. Claude Code will scan your project, adapt the script to your routes/auth/selectors, and create a fully working `scripts/visual-test.js`.

---

## PROMPT START — COPY EVERYTHING BELOW THIS LINE

Create a comprehensive visual and interactive testing script at `scripts/visual-test.js` using **Node.js** and **Playwright**. This script must be a single self-contained file (~5,500-6,500 lines) with zero external test framework dependencies — it is its own runner, assertion library, and reporter.

**IMPORTANT**: Use Node.js (not Bun/Deno) because Playwright's `chromium.launch()` can hang under alternative runtimes on Windows. The shebang should be `#!/usr/bin/env node`.

### Phase 1: Project Discovery

Before writing any code, scan this project to determine:

1. **Base URL** — What port does the dev server run on? Check `package.json` scripts, server config, `.env`, etc. Default to `http://localhost:3000` if unclear.
2. **Route/page system** — Is it hash-based (`#dashboard`), path-based (`/dashboard`), or a framework router (Next.js, React Router, Vue Router, etc.)? List all major routes/pages.
3. **Authentication flow** — How does login work? Find the login form selectors, credential fields, submit button, and what URL/element confirms successful login. Find or create test credentials.
4. **App globals** — Does the app expose global state objects (like `store`, `router`, `auth`, `toast`, `modals`)? These will be used for `page.evaluate()` interactions.
5. **CSS class patterns** — What naming conventions are used? (BEM, Tailwind, CSS modules, etc.) This affects selector strategies for assertions.
6. **Key UI components** — Sidebar, modals, toasts, dropdowns, tabs, etc. What selectors identify them?
7. **Loading indicators** — How does the app signal it's ready? (loading screen, skeleton loaders, spinner elements)

### Phase 2: Script Architecture

Structure the script in this exact order:

```
1. Imports & Constants           (lines ~1-75)
2. CLI Parsing                   (lines ~76-90)
3. PageContext Class             (lines ~91-280)
4. Utility Functions             (lines ~281-540)
5. State Assertion Helpers       (lines ~541-590)
6. Screenshot Functions          (lines ~591-780)
7. HTML Report Generator         (lines ~781-880)
8. Command Functions             (lines ~881-5600)
9. Step Execution Engine         (inside command functions, ~3200 lines)
10. Built-in Test Flows          (lines ~5600-5750)
11. Reporters (JUnit, JSON, HTML)(lines ~5750-5850)
12. Post-Run Handler             (lines ~5851-5920)
13. Trends & History             (lines ~5921-5990)
14. Main Dispatcher + Help Text  (lines ~5991-end)
```

### Phase 3: Constants & Configuration

```javascript
import { chromium, firefox, webkit, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, appendFileSync, copyFileSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = '<DISCOVERED_BASE_URL>';
const SCREENSHOTS_DIR = resolve(__dirname, '..', 'screenshots');
const CURRENT_DIR = join(SCREENSHOTS_DIR, 'current');
const BASELINES_DIR = join(SCREENSHOTS_DIR, 'baselines');
const DIFFS_DIR = join(SCREENSHOTS_DIR, 'diffs');
const AUDITS_DIR = join(SCREENSHOTS_DIR, 'audits');
const REPORTS_DIR = join(SCREENSHOTS_DIR, 'reports');
const TRACES_DIR = join(SCREENSHOTS_DIR, 'traces');
const VIDEOS_DIR = join(SCREENSHOTS_DIR, 'videos');
const HISTORY_FILE = join(REPORTS_DIR, 'history.jsonl');
const DEMO_EMAIL = '<DISCOVERED_TEST_EMAIL>';
const DEMO_PASSWORD = '<DISCOVERED_TEST_PASSWORD>';

const VIEWPORTS = {
    desktop: { width: 1280, height: 720 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
};
```

Define three route arrays adapted to this project:
- **`MAJOR_ROUTES`** — All primary app pages (aim for 20-60 routes)
- **`NO_LOGIN_ROUTES`** — Pages accessible without authentication (login, register, about, 404, terms, privacy, etc.)
- **`MINOR_ROUTES`** — Secondary/less-important pages
- **`SETTINGS_TABS`** — If the app has tabbed settings, list the tab identifiers

### Phase 4: CLI System

Hand-rolled argument parsing (no library dependencies):

```javascript
const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    return args[idx + 1];
}

function hasFlag(name) {
    return args.includes(`--${name}`);
}
```

### Phase 5: PageContext Diagnostic Collector

Create a `PageContext` class that attaches to a Playwright page and collects:

```javascript
class PageContext {
    constructor(page) {
        this.page = page;
        this.consoleMessages = [];    // Capture console warnings and errors
        this.networkFailures = [];    // Capture HTTP 400+ responses
        this.allRequests = [];        // Track ALL requests for assert-request
        this.performanceMetrics = null;
        this.a11yIssues = [];

        // Attach console listener
        page.on('console', msg => {
            if (['warning', 'error'].includes(msg.type())) {
                this.consoleMessages.push({ type: msg.type(), text: msg.text() });
            }
        });

        // Attach network listener — IMPORTANT: cap at 10,000 entries to prevent memory leaks
        page.on('response', response => {
            if (this.allRequests.length >= 10000) this.allRequests.shift();
            this.allRequests.push({
                url: response.url(),
                status: response.status(),
                method: response.request().method()
            });
            if (response.status() >= 400) {
                this.networkFailures.push({
                    url: response.url(),
                    status: response.status(),
                    method: response.request().method()
                });
            }
        });
    }

    async collectPerformanceMetrics() { /* Use Navigation Timing API + Paint Timing API via page.evaluate() */ }
    async collectA11yIssues() { /* Check missing alt, empty buttons/links, unlabeled inputs, broken images */ }
    getReport() { /* Return { console, network, performance, accessibility, summary } */ }
}
```

### Phase 6: Utility Functions

Implement these helpers:

1. **`sanitizeRoute(route)`** — Strip `#`, replace `/` with `-`, replace non-alphanumeric with `_`

2. **`escapeHtml(s)`** — Escape `&`, `<`, `>`, `"` for safe HTML report output:
   ```javascript
   function escapeHtml(s) {
       return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
   }
   ```

3. **`ensureScreenshotsDirs()`** — Create all screenshot subdirectories

4. **`checkServer()`** — Fetch `<BASE_URL>/api/health` (or `/` or any known endpoint) with 3s abort timeout; exit if unreachable

5. **`launchBrowser(viewportName)`** — Launch Playwright browser supporting:
   - `--headed` flag for visible browser
   - `--slow-mo <ms>` for delays
   - `--browser chromium|firefox|webkit` selection
   - `--device "<name>"` for device emulation via `playwright.devices`
   - `--video` for recording
   - `--trace` for Playwright trace
   - Clipboard permissions: `['clipboard-read', 'clipboard-write']`
   - **IMPORTANT**: Warn if both `--device` and a non-default `--viewport` are specified (device overrides viewport):
     ```javascript
     if (hasFlag('device') && getFlag('viewport') && getFlag('viewport') !== 'desktop') {
         console.warn('Warning: --device overrides --viewport. Device viewport will be used.');
     }
     ```
   - Return `{ browser, context, page }`

6. **`login(page, retries)`** — Authenticate using discovered selectors:
   - Navigate to login page
   - Wait for login form
   - Fill credentials
   - Submit (use `page.evaluate(() => submitBtn.click())` as workaround for mobile viewports)
   - Handle 429 rate limiting with retry (3s delay, up to 2 retries)
   - Verify navigation to authenticated page

7. **`waitForPageReady(page)`** — Layered wait strategy:
   - Wait for loading indicator to be hidden (5s timeout)
   - Wait for main app container to have content (8s timeout)
   - Wait for `networkidle` (3s timeout)
   - Fixed 500ms wait
   - If `--freeze-animations`, inject CSS to disable animations — **IMPORTANT**: Guard against duplicate injection:
     ```javascript
     if (hasFlag('freeze-animations')) {
         await page.evaluate(() => {
             if (!document.getElementById('__freeze-animations')) {
                 const style = document.createElement('style');
                 style.id = '__freeze-animations';
                 style.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
                 document.head.appendChild(style);
             }
         });
     }
     ```

8. **`setTheme(page, mode)`** — Toggle light/dark theme via the app's theme mechanism

### Phase 7: State Assertion Comparison Engine

Implement `assertComparison(actual, step, label)` supporting **14 comparison operators**.

**IMPORTANT**: The `label` parameter is optional — used for context in PASS/FAIL messages. Fallback chain: `label || step.path || 'value'`.

| Operator | Step Field | Logic |
|----------|-----------|-------|
| `equals` | `step.equals` | Deep JSON equality |
| `notEquals` | `step.notEquals` | Deep JSON inequality |
| `greaterThan` | `step.greaterThan` | Numeric `>` |
| `lessThan` | `step.lessThan` | Numeric `<` |
| `notNull` | `step.notNull` | Not null/undefined |
| `isNull` | `step.isNull` | Is null/undefined |
| `contains` | `step.contains` | String includes or array includes |
| `matches` | `step.matches` | Regex match |
| `between` | `step.between` | Value in `[min, max]` range |
| `in` | `step.in` | Value in array of options |
| `startsWith` | `step.startsWith` | String prefix |
| `endsWith` | `step.endsWith` | String suffix |
| `lengthGreaterThan` | `step.lengthGreaterThan` | Length of string/array `> N` |
| `lengthLessThan` | `step.lengthLessThan` | Length of string/array `< N` |

Also implement `resolveStatePath(state, dotPath)` to traverse nested objects by dot-separated path.

### Phase 8: Screenshot System

1. **`takeScreenshot(page, name, options)`**
   - Route to `baselines/` or `current/` based on `--baseline` flag
   - Support `fullPage` screenshots — respect `--full-page` flag globally
   - Support element masking via CSS selectors (for ignoring dynamic content)

2. **`takeEnhancedScreenshot(page, name, ctx, options)`**
   - Wraps `takeScreenshot` and saves a JSON metadata sidecar alongside each `.png`:
   ```json
   { "name": "...", "timestamp": "...", "url": "...", "viewport": "...", "theme": "...", "diagnostics": { ... } }
   ```

3. **`compareScreenshots(name, options)`**
   - Use `pixelmatch` and `pngjs` for pixel-level comparison
   - Support 4 match levels via `--match-level`:
     - `strict`: threshold 0.1
     - `layout`: Grayscale both images before comparing
     - `ignore-colors`: Higher threshold (0.5)
     - `ignore-antialiasing`: Disable anti-alias matching
   - Generate diff image in `diffs/`
   - Return `{ match, diffPixels, totalPixels, diffPercent, diffImage, threshold }`
   - **Note**: Install pixelmatch and pngjs as devDependencies, but gracefully handle if not installed with a helpful error message

### Phase 9: The 22 Commands

Implement each as an async function. **CRITICAL PATTERNS** to follow in every command:

#### Resource Management Rules
- **Always close browsers in `finally` blocks** — never in try body where an error could skip it
- **Use a `browserClosed` flag** to prevent double `browser.close()` in commands that may close early (like screenshot-all)
- **Declare `let browser` outside try** so the finally block can access it even if launchBrowser() throws

#### Post-Run Handling
- **ALL commands that run steps** must call `postRunHandler(data)` for consistent --report, --history, --webhook support
- Centralize this into a single function — do NOT inline report/history/webhook logic in each command

#### Trace & Video Support
- **ALL commands that run steps** must support `--trace` and `--video`:
  ```javascript
  if (hasFlag('trace')) {
      mkdirSync(TRACES_DIR, { recursive: true });
      await context.tracing.start({ screenshots: true, snapshots: true });
  }
  // ... run steps ...
  // In finally block:
  if (hasFlag('trace')) {
      const tracePath = join(TRACES_DIR, `trace-${Date.now()}.zip`);
      await context.tracing.stop({ path: tracePath });
      console.log(`Trace saved: ${tracePath}`);
  }
  ```

#### Command Table

| # | Command | Signature | Description |
|---|---------|-----------|-------------|
| 1 | `screenshot` | `cmdScreenshot(route, options)` | Screenshot a single page |
| 2 | `screenshot-all` | `cmdScreenshotAll(options)` | Screenshot all MAJOR_ROUTES + NO_LOGIN_ROUTES + SETTINGS_TABS. Use `browserClosed` flag to prevent double close. Respect `--full-page`. |
| 3 | `theme` | `cmdTheme(route)` | Light + dark screenshots of a route |
| 4 | `responsive` | `cmdResponsive(route)` | Desktop, tablet, mobile viewports |
| 5 | `toast` | `cmdToast(type)` | Trigger toast notification (success/error/warning/info) |
| 6 | `modal` | `cmdModal(type)` | Trigger modal dialog (confirm/confirm-danger/custom) |
| 7 | `validate` | `cmdValidate(route)` | Form validation test: empty submit, invalid data, valid data (3 screenshots) |
| 8 | `audit` | `cmdAudit(route)` | Page health check — console, network, performance, accessibility |
| 9 | `audit-all` | `cmdAuditAll()` | Audit all MAJOR_ROUTES. **Track `routeErrors` counter** — routes that throw must be counted in the totals summary, not silently omitted. |
| 10 | `compare` | `cmdCompare(name)` | Pixel-diff baseline vs current screenshot |
| 11 | `test-flow` | `cmdTestFlow(name)` | Run a built-in test flow by name |
| 12 | `interact` | `cmdInteract(stepsJson)` | Parse `--steps` JSON, run steps, print summary. Support `--trace`, `--video`, `--no-login`. |
| 13 | `run` | `cmdRun(file)` | Load JSON test file. **Teardown MUST be in finally block** so it runs even if login/setup throws. Support setup/teardown/matrix/groups. |
| 14 | `run-suite` | `cmdRunSuite(dirOrFiles)` | Multiple test files as a suite with sharding. **MUST support per-file setup/teardown** — run setup before steps, teardown after (in try-catch). Warn if shard/only filtering leaves 0 files. |
| 15 | `coverage` | `cmdCoverage(dir)` | Scan test files for `goto`/`navigate` steps, report route coverage %. **Warn about parse failures** — track count and report at end. |
| 16 | `trends` | `cmdTrends()` | Read `history.jsonl`, show last 10 runs + flaky test detection |
| 17 | `click` | `cmdClick(selector, options)` | Click element. Must support `--no-login`, create `PageContext`, print diagnostics, support `--screenshot-on-failure`. |
| 18 | `baseline-all` | `cmdBaselineAll()` | Screenshot all major routes as baselines. Respect `--full-page` and `--no-login`. |
| 19 | `a11y-audit` | `cmdA11yAudit(route)` | Inject axe-core CDN, run WCAG 2.0 AA audit |
| 20 | `compare-browsers` | `cmdCompareBrowsers(route)` | Screenshot in multiple browsers, pixel-diff between them. Declare `let browser` outside try, close in finally. |
| 21 | (no command) | default case | Print full help text |

#### Matrix Runner (`cmdRunMatrix`) Additional Rules
- **Validate matrix values** — every value must be an array: `if (!Array.isArray(val)) { console.error(...); return; }`
- **Execute setup/teardown** per combination
- **Guard against undefined in substitution**: `if (mVal === undefined || mVal === null) continue;`
- **Prevent trace filename collisions**: Include combination index in trace filename: `trace-matrix-${comboIdx}-${safeLabel}-${Date.now()}.zip`

### Phase 10: The Step Execution Engine — `runInteractSteps()`

This is the heart of the script (~3,200 lines). It:

1. Accepts `(page, steps, options)` where options = `{ failFast, maxRetries, ctx }`
2. Maintains: `assertionResults { passed, failed, errors }`, `stateSnapshots` Map, `variables` Map, `stepLog` array, `screenshots` array
3. Defines an `ASSERTION_ACTIONS` Set (all assertion step names — used to determine retry behavior)
4. Iterates steps sequentially with:
   - **Variable substitution**: `$varName` in string values replaced from `variables` Map
   - **Skip**: `step.skip === true` skips the step
   - **Conditional execution**: `step.if` / `step.unless` with selector or variable conditions
   - **Retry loop**: Only assertion actions get retried (up to `maxRetries`). On retry, roll back failure count and error array, wait 500ms, re-attempt.
   - **Auto-screenshot on failure**: When `--screenshot-on-failure` flag is set
   - **Auto-screenshot after step**: When `step.screenshot === true`
   - **Auto-wait**: After non-assertion steps when `--auto-wait` or `set-auto-wait` is configured
   - **Fail-fast**: Stop entire run on first failure when `--fail-fast`
   - **Per-step timeout**: `fill`, `select`, and `evaluate` actions should use `step.timeout` when provided
5. Returns `{ passed, failed, errors, stepLog, screenshots, variables }`

#### Variable Substitution Function — MUST BE RECURSIVE

**CRITICAL**: The substitution function must handle nested objects and arrays, not just flat string properties:

```javascript
function substituteVars(step, variables) {
    if (variables.size === 0) return step;
    function replaceInValue(val) {
        if (typeof val === 'string' && val.includes('$')) {
            return val.replace(/\$(\w+)/g, (_, name) =>
                variables.has(name) ? variables.get(name) : `$${name}`);
        }
        if (Array.isArray(val)) return val.map(replaceInValue);
        if (val && typeof val === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(val)) { out[k] = replaceInValue(v); }
            return out;
        }
        return val;
    }
    const replaced = {};
    for (const [key, val] of Object.entries(step)) { replaced[key] = replaceInValue(val); }
    return replaced;
}
```

### Phase 11: Complete Step Type Catalog (140+ types)

Implement ALL of the following step types inside the `switch(step.action)` in `runInteractSteps()`. Each step is a JSON object with at minimum an `action` field.

#### CORE ACTIONS (28 types)

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `goto` | `value` (route) | **Normalize hash**: `const hash = step.value.startsWith('#') ? step.value : '#' + step.value;` then navigate to `BASE_URL/${hash}`, call `waitForPageReady()` |
| `click` | `selector`, `timeout?` | `page.click(selector)`, wait 300ms |
| `fill` | `selector`, `value`, `timeout?` | `page.fill(selector, value)` — use `step.timeout` if provided |
| `select` | `selector`, `value`, `timeout?` | `page.selectOption(selector, value)` — use `step.timeout` if provided |
| `wait` | `selector?` or `value` (ms) | Wait for selector or timeout |
| `screenshot` | `name?`, `fullPage?`, `mask?` | Take screenshot, push to screenshots array |
| `hover` | `selector`, `timeout?` | `page.hover(selector)`, wait 300ms |
| `evaluate` | `value` (JS code string), `timeout?` | `page.evaluate(step.value)` — use `step.timeout` if provided, log result |
| `keyboard` | `key?`, `chord?` (array), `modifiers?` (array) | Press key, chord sequence, or modifier combo |
| `store-set` | `updates` (object) | `page.evaluate(() => store.setState(updates))` — adapt to app's state management |
| `navigate` | `route` or `value` | **MUST normalize hash** like `goto` does — strip leading `#`, pass bare route to router, use `'#' + route` in fallback. Prevents double-hash (`##route`) bug. |
| `intercept` | `url`, `status?`, `body?`, `abort?` | Mock API responses or abort requests via `page.route()` |
| `store-snapshot` | `name?` | Capture current state into `stateSnapshots` Map |
| `modal` | `type` (confirm/confirm-danger/custom), `data?`, `html?` | Trigger modal via app's modal system |
| `toast` | `type` (success/error/warning/info), `message?` | Trigger toast via app's toast system |
| `theme-toggle` | `mode` (light/dark) | Set theme via `setTheme()` |
| `wait-for-network` | `timeout?` | `page.waitForLoadState('networkidle')` |
| `validate-form` | `selector?` | Call `form.checkValidity()` and `form.reportValidity()` |
| `drag-drop` | `from`, `to` (selectors) | `page.dragAndDrop(from, to)` |
| `upload-file` | `selector?`, `files` (array of paths) | `fileInput.setInputFiles(files)` |
| `scroll` | `to` (top/bottom), `selector?` + `into-view?`, `y?` | Scroll to position/element |
| `reload` | — | `page.reload()` + `waitForPageReady()` |
| `right-click` | `selector` | `page.click(selector, { button: 'right' })` |
| `extract` | `selector`, `as` (variable name), `attribute?`, `property?` | Extract text/attribute from DOM, store in `variables` Map. **IMPORTANT**: If element not found and `step.as` is set, log a warning about downstream variable references that will fail. |
| `set-storage` | `type` (local/session), `key`, `value`, `clear?` | Set/clear localStorage or sessionStorage |
| `run-command` | `name`, `args?`, `commands?` (file path) | Load reusable step sequences from `screenshots/commands.json`, run with `$arg` substitution |
| `freeze-animations` | — | Inject `<style>` to set all `animation-duration` and `transition-duration` to `0s !important` |
| `unfreeze-animations` | — | Remove the injected freeze style |

#### ASSERTIONS (62+ types)

**Base `assert` action** — has an `assertion` sub-field:

| Action | Sub-assertion | Key Fields | Behavior |
|--------|--------------|-----------|----------|
| `assert` | `exists` | `selector` | Element exists in DOM |
| `assert` | `not-exists` | `selector` | Element does NOT exist |
| `assert` | `visible` | `selector` | Element is visible |
| `assert` | `hidden` | `selector` | Element is hidden |
| `assert` | `text` | `selector`, `value` | Element text contains value |
| `assert` | `text-matches` | `selector`, `pattern` or `value` | Element text matches regex |
| `assert` | `count` | `selector`, `value` (number) | Count of matching elements equals value |
| `assert` | `attribute` | `selector`, `attribute`, `value?`, `contains?` | Attribute value check |

**State & Style Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-state` | `path` (dot-separated), + comparison operators | Read app state via `store.state`, apply `assertComparison()` |
| `assert-css` | `selector`, `property`, `equals` or `matches` | Check computed CSS property value |
| `assert-class` | `selector`, `class`, `has` (bool, default true) | Check CSS class presence/absence |
| `assert-snapshot` | `name`, `path`, `changed` (bool) or comparison operators | Compare current state to a captured `store-snapshot` |
| `assert-computed-style` | `selector`, `property`, `value` | `getComputedStyle(el).getPropertyValue(prop)` |
| `assert-url` | `hash?`, `contains?`, `matches?` (regex) | Check current page URL |
| `assert-dimensions` | `selector`, `width?`, `height?` (each with `equals`/`greaterThan`/`lessThan`/`between`) | Check element bounding box dimensions |
| `assert-variable` | `name`, + comparison operators | Assert a previously `extract`ed variable's value |

**Toast, Context Menu, Clipboard:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-toast` | `type?`, `message?`, `visible?` (false = no toasts) | Find toast by type/message class match |
| `assert-toast-count` | `count` | Count of visible toast elements |
| `assert-context-menu` | `items` (array of expected text strings) | Context menu is visible and contains expected items |
| `assert-clipboard` | `equals?`, `contains?` | Read clipboard via `navigator.clipboard.readText()` |

**Sorting, Dropdowns, Inline Edit:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-sort` | `gridId`, `column?`, `direction?` | Check data grid sort state (adapt selectors to app's grid component) |
| `assert-dropdown` | `selector`, `open?` (bool), `items?` (array) | Dropdown open state and items check. Note: when both `open` and `items` are specified, each is a separate assertion (intentional multi-assertion). |
| `assert-inline-edit` | `field`, `editing?` (bool), `value?` | Check inline edit field state |

**Focus & Accessibility:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-focus` | `selector` | `document.activeElement === querySelector(sel)` |
| `assert-focus-trapped` | `container` (selector) | Tab from last to first wraps; Shift+Tab from first wraps back |
| `assert-a11y` | `standard?` (e.g. "wcag2aa"), `exclude?` (selectors), `maxViolations?` | Inject axe-core CDN, run audit, count violations |
| `assert-contrast` | `selector`, `level?` (AA/AAA) | Compute WCAG contrast ratio between foreground and background colors |
| `assert-aria` | `selector`, `attribute`, `value?` | Check ARIA attribute value |
| `assert-tab-order` | `selectors` (array) | Tab through and verify focus order matches |
| `assert-screen-reader` | `text` | Check aria-live regions and `.sr-only`/`.visually-hidden` elements for text |

**Performance & Console:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-performance` | `fcp?`, `dcl?`, `load?`, `fp?`, `ttfb?`, `cls?` (each with comparison operators) | Check Core Web Vitals via Performance API. **CRITICAL**: Use `?? null` (not `\|\| null`) for paint timing — `\|\| null` would incorrectly coerce a legitimate 0ms time to null. Pass metric label to `assertComparison()` for clear messages. **Warn if no metrics were actually asserted** (user may have typo'd field names). |
| `assert-console` | `errors?`, `warnings?` (count or comparison obj), `errorContains?` | Check captured console messages from PageContext. Pass label like `'console.errors'` to `assertComparison()`. |
| `assert-memory` | keys like `usedJSHeapSize` with `{ lessThan, greaterThan }` | Check `performance.memory` (Chromium only) |
| `assert-no-layout-shift` | `threshold?` (default 0.1) | Observe `layout-shift` entries for 1 second, check CLS |
| `assert-connection` | `online` (bool) | Check `navigator.onLine` |
| `assert-request` | `url?` (regex or glob), `method?`, `status?`, `count?` | Filter tracked requests from PageContext. **CRITICAL**: For glob patterns, properly distinguish `**` (any path) from single `*` (single path segment): convert `**` → `.*`, single `*` → `[^/]*`. **Increment `assertionResults.failed`** on failures — do not just log errors. |

**Scroll & Storage:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-scroll` | `y-greater-than?`, `y-less-than?`, `at-bottom?`, `at-top?` | Check `window.scrollY` |
| `assert-storage` | `type` (local/session), `key`, `equals?`, `notNull?`, `isNull?`, `contains?` | Check localStorage/sessionStorage |

**Form Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-field-error` | `selector`, `message?` | Check for error class/element on input |
| `assert-form-valid` | `selector` | `form.checkValidity()` |
| `assert-form-dirty` | `selector`, `dirty?` (default true) | Any input value differs from defaultValue |
| `assert-password-strength` | `selector`, `value?`, `minStrength` (weak/fair/good/strong) | Check password strength meter |
| `assert-form-progress` | `selector`, `percent` (with `equals`/`greaterThan`/`lessThan`) | Check progress bar percentage |

**Component Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-wizard` | `step?`, `totalSteps?` | Check wizard/stepper active step |
| `assert-tags` | `selector`, `count?`, `tags?` (array) | Check tag list |
| `assert-accordion` | `selector`, `open` (bool) | Check accordion expanded/collapsed |
| `assert-panel` | `type` (side-panel/bottom-sheet), `id`, `open` (bool) | Check panel open state |
| `assert-lightbox` | `open?` (bool), `index?` | Check lightbox state and slide index |
| `assert-date-range` | `selector`, `preset` (text to match) | Check date range display text |
| `assert-color` | `selector`, `color` (hex) | Check color picker value |
| `assert-toggle` | `selector`, `checked` (bool) | Check toggle/switch state |
| `assert-tree` | `selector`, `expanded?` (bool), `selected?` (bool) | Check tree node state |
| `assert-carousel` | `selector`, `index?`, `total?` | Check carousel active slide |
| `assert-select-value` | `selector`, `value` | Check `<select>` element value |
| `assert-spinner-value` | `selector`, `value` (number or comparison obj) | Check numeric spinner value |
| `assert-skeleton` | `selector`, `visible?` (default true) | Check if skeleton loader is visible |

**Navigation & Layout Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-pagination` | `selector?`, `currentPage?` | Check pagination active page |
| `assert-row-expanded` | `selector`, `expanded?` (default true) | Check expandable table row |
| `assert-bulk-selection` | `selector?`, `count` (number or comparison obj) | Count checked/selected items |
| `assert-table-export` | `formats` (array like ["csv", "pdf"]) | Check available export format buttons |
| `assert-column-visible` | `column` (header text), `visible?` (default true) | Check table column visibility |
| `assert-autocomplete` | `count` (number or comparison obj) | Count autocomplete suggestion items |
| `assert-command-palette` | `open?` (bool), `results?` (comparison obj) | Check command palette state |
| `assert-tab-active` | `selector?`, `tab` (text) | Check active tab |
| `assert-breadcrumbs` | `trail` (array of expected breadcrumb texts) | Check breadcrumb navigation |
| `assert-view-mode` | `mode` (grid/list/etc.) | Check current view mode |
| `assert-search-results` | `count?` (number or comparison obj), `contains?` | Check search results |
| `assert-order` | `selector`, `order` (array of expected text order) | Check DOM element order |

**Data Visualization Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-chart` | `selector`, `segments` (number or comparison obj) | Count chart segments (paths, rects, etc.). **CRITICAL**: Use `page.$eval()` (single element), NOT `page.$$eval()` (which passes an Array to the callback — calling `querySelectorAll` on an Array throws). |
| `assert-chart-tooltip` | `visible?` (bool), `contains?` | Check chart tooltip |
| `assert-chart-legend` | `selector`, `items` (array) | Check chart legend items |
| `assert-gauge` | `selector`, `value` (number or comparison obj) | Check gauge widget value |

**Notification Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-banner` | `type?`, `message?` | Check for banner/alert element |
| `assert-alert` | `type?`, `visible?` (default true) | Check `[role="alert"]` visibility |
| `assert-notification-count` | `count` (number or comparison obj) | Check notification badge count |
| `assert-snackbar` | `message?`, `hasUndo?` (bool) | Check snackbar/toast-message content and undo button |

**Business/Domain Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-kanban` | `column` (column title text), `count` (number or comparison obj) | Count cards in a kanban column |
| `assert-timeline` | `selector`, `events` (number or comparison obj) | Count timeline events |
| `assert-timeline-event` | `selector`, `index?`, `text` | Check specific timeline event text |
| `assert-goal` | `selector`, `progress` (comparison obj) | Check goal progress bar percentage |
| `assert-streak` | `selector`, `count` (number or comparison obj) | Check streak counter value |
| `assert-session` | `active?` (default true) | Check if user session is active (token in auth/cookie/localStorage) |

**Batch Assertions:**

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `assert-all` | `assertions` (array of step objects) | Run all sub-assertions, collect combined results. **IMPORTANT**: If `assertions` array is missing/invalid, increment `assertionResults.failed` and add error — do not silently skip. |

#### COMPONENT INTERACTION ACTIONS (50+ types)

| Action | Key Fields | Behavior |
|--------|-----------|----------|
| `screenshot-element` | `selector`, `name?` | Screenshot a single DOM element |
| `set-auto-wait` | `ms` | Set auto-wait delay after non-assertion steps |
| `set-context` | `geolocation?`, `locale?`, `timezone?` | Set browser context options |
| `wait-until` | `selector?` + `assertion` (visible/hidden/exists/not-exists), or `state` + comparison | Poll until condition met |
| `wait-animation` | `selector` | Wait for element's `getAnimations()` to be empty |
| `wait-toast-dismiss` | `timeout?` | Wait for toast to be detached from DOM |
| `sort-column` | `selector` | Click a sortable column header |
| `dropdown-toggle` | `selector` | Click to open/close dropdown |
| `dropdown-select` | `selector`, `item` (text) | Open dropdown if closed, find and click item by text |
| `inline-edit` | `field`, `value`, `cancel?`, `save?` | Click display, fill input, save/cancel |
| `context-menu-click` | `item` (text) | Find and click context menu item by text |
| `network-condition` | `preset` (offline/slow-3g/fast-4g/reset) | Simulate network conditions |
| `wizard-next` | `selector?` | Click wizard next button |
| `wizard-prev` | `selector?` | Click wizard prev button |
| `tag-add` | `selector`, `value` | Focus tag input, type value, press Enter |
| `tag-remove` | `selector`, `tag` (text) | Find tag by text, click its remove button |
| `accordion-toggle` | `selector` | Click accordion header |
| `panel-open` | `type` (side-panel/bottom-sheet), `id` | Open panel via app's panel system |
| `panel-close` | `type`, `id` | Close panel |
| `lightbox-open` | `selector` | Click to open lightbox |
| `lightbox-next` | — | Call `lightbox.next()` via evaluate |
| `lightbox-prev` | — | Call `lightbox.prev()` via evaluate |
| `lightbox-close` | — | Call `lightbox.close()` via evaluate |
| `date-range-select` | `selector`, `preset` (text) | Open date picker, click preset by text |
| `date-range-set` | `selector`, `start`, `end` | Set date range input values directly |
| `color-pick` | `selector`, `color` (hex) | Open color picker, fill hex input |
| `toggle` | `selector` | Click toggle/switch |
| `tree-expand` | `selector` | Click tree node toggle to expand |
| `tree-collapse` | `selector` | Click tree node toggle to collapse |
| `tree-select` | `selector` | Click tree node to select |
| `carousel-next` | `selector` | Click carousel next button |
| `carousel-prev` | `selector` | Click carousel prev button |
| `carousel-goto` | `selector`, `index` | Click carousel dot/indicator |
| `fill-autocomplete` | `selector`, `value`, `select?` (index) | Fill input, wait for suggestions, optionally click one |
| `submit-form` | `selector` | Call `form.submit()` or click submit button |
| `clear-input` | `selector` | `page.fill(selector, '')` |
| `press-enter` | `selector?` | Press Enter on element or globally |
| `fill-otp` | `selector`, `value` (digits string) | Fill OTP input fields one digit at a time |
| `spinner-increment` | `selector`, `times?` (default 1) | Click increment button |
| `spinner-decrement` | `selector`, `times?` (default 1) | Click decrement button |
| `command-palette-open` | — | Press Ctrl+K |
| `command-palette-search` | `value` | Fill command palette input |
| `command-palette-execute` | `index?` (default 0) | Click command palette result |
| `tab-click` | `selector?`, `tab` (text) | Click tab by text |
| `breadcrumb-click` | `item` (text) | Click breadcrumb link by text |
| `view-mode` | `mode` (grid/list/etc.) | Click view mode toggle |
| `global-search` | `value` | Fill global search input |
| `drag-reorder` | `selector`, `position` (1-based target index) | Mouse drag source to target position |
| `swipe` | `selector`, `direction` (left/right/up/down), `distance?` (default 200) | Simulate swipe gesture via mouse events |
| `pull-to-refresh` | `selector?` | Drag down 150px from top of element |
| `slider-drag` | `selector`, `position` (0-100 percent) | Drag slider handle to position |
| `chart-hover` | `selector`, `segment` (index) | Hover over chart segment |
| `chart-click` | `selector`, `bar` or `segment` (index) | Click chart element |
| `chart-legend-toggle` | `selector`, `series` (legend text) | Click legend item |
| `banner-dismiss` | `selector` | Click banner close/dismiss button |
| `notification-center-open` | — | Click notification bell |
| `notification-dismiss` | `index?` (default 0) | Click notification item close button |
| `snackbar-undo` | — | Click snackbar undo button |
| `inline-confirm` | `selector` | Click element to show inline confirmation |
| `inline-confirm-accept` | `selector` | Click the confirm-yes button |
| `kanban-drag` | `card` (selector), `toColumn` (selector) | Drag kanban card to target column |
| `pagination-next` | `selector?` | Click pagination next button |
| `pagination-goto` | `selector?`, `page` (number) | Click specific page number |
| `row-expand` | `selector` | Click expandable row toggle |
| `bulk-select-all` | `selector?` | Click select-all checkbox |
| `column-toggle` | `column` (header text), `visible` (bool) | Toggle column visibility |

### Phase 12: Built-in Test Flows

Define a `TEST_FLOWS` object with at least 5 built-in flows adapted to this project. Examples:

```javascript
const TEST_FLOWS = {
    'sidebar-toggle': [
        { action: 'goto', value: '<main_route>' },
        { action: 'assert', selector: '<sidebar_selector>', assertion: 'visible' },
        { action: 'click', selector: '<collapse_button>' },
        { action: 'screenshot', name: 'sidebar-collapsed' },
        // ...assert collapsed state, click again, assert expanded
    ],
    'dark-mode': [ /* Toggle theme, assert body class changes, screenshot both */ ],
    'navigation': [ /* Navigate between major pages, assert URL/state changes */ ],
    'keyboard-nav': [ /* Test keyboard shortcuts if the app has them */ ],
    'loading-states': [ /* Manipulate loading state, screenshot loading/loaded */ ]
};
```

### Phase 13: Test File Schema

The `run` command should support JSON files with this schema:

```json
{
    "name": "Test name",
    "steps": [{ "action": "...", ... }],
    "setup": [{ "action": "...", ... }],
    "teardown": [{ "action": "...", ... }],
    "noLogin": true,
    "skip": true,
    "skipReason": "...",
    "only": true,
    "todo": true,
    "matrix": { "viewport": ["desktop", "mobile"], "theme": ["light", "dark"] },
    "groups": [{ "name": "Group name", "steps": [...] }]
}
```

Matrix support generates Cartesian product of all combinations, each run in a fresh browser. Variables like `$viewport` and `$theme` are substituted into step strings (and nested objects/arrays via recursive substitution).

### Phase 14: Reporting System

Implement 3 report formats triggered by `--report html,junit,json`:

1. **HTML Report** — Self-contained HTML with:
   - Header with pass/fail badge and color
   - Summary cards (passed, failed, total steps, duration)
   - Per-file results table (for suites)
   - Step log table with action, selector, duration
   - Collapsible failure details
   - Screenshot gallery with base64-embedded images and click-to-zoom modal
   - All CSS inline (no external deps)
   - **CRITICAL**: Use `escapeHtml()` on ALL dynamic values (title, file names, action names, selectors, values, error messages, screenshot names) to prevent broken markup and XSS

2. **JUnit XML Report** — Standard CI format:
   ```xml
   <testsuites tests="..." failures="..." skipped="..." time="...">
     <testsuite name="..." tests="..." failures="..." time="...">
       <testcase name="Step N: action" time="..."><failure message="..."/></testcase>
     </testsuite>
   </testsuites>
   ```
   **IMPORTANT**: Include `skipped` attribute on `<testsuites>` element.

3. **JSON Report** — Machine-readable:
   ```json
   { "timestamp": "...", "duration": 0, "passed": 0, "failed": 0, "errors": [], "stepLog": [], "screenshots": [] }
   ```

**All report `writeFileSync` calls MUST be wrapped in try-catch** with clear error messages (path + reason), so a write failure doesn't crash the entire run:
```javascript
try {
    writeFileSync(outputPath, content);
    console.log(`Report saved: ${outputPath}`);
} catch (e) {
    console.error(`Failed to write report to ${outputPath}: ${e.message}`);
}
```

### Phase 15: Centralized Post-Run Handler

**CRITICAL**: Create a single `postRunHandler(data)` function that ALL step-running commands call. This prevents 5+ separate inline implementations of the same logic:

```javascript
async function postRunHandler(data) {
    // 1. Generate reports (--report flag)
    await generateReports(data);

    // 2. Append to history (--history flag)
    if (hasFlag('history')) {
        mkdirSync(dirname(HISTORY_FILE), { recursive: true });
        const entry = { timestamp, total, passed, failed, skipped, duration, files };
        appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
    }

    // 3. Send webhook (--webhook flag) with AbortController timeout
    const webhookUrl = getFlag('webhook');
    if (webhookUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            console.log(`Webhook ${resp.ok ? 'sent' : 'failed'}: ${webhookUrl} (${resp.status})`);
        } catch (e) {
            console.error(`Webhook error: ${e.message}`);
        }
    }
}
```

### Phase 16: History & Trends

- `--history` flag appends JSONL to `reports/history.jsonl`
- `trends` command reads history and shows:
  - Last 10 runs with pass/fail/skip counts
  - Average pass rate and duration
  - **Flaky test detection**: Tests that pass in some runs and fail in others

### Phase 17: The 24 CLI Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--headed` | boolean | false | Visible browser window |
| `--slow-mo` | value (ms) | 0 | Delay between actions |
| `--no-login` | boolean | false | Skip authentication |
| `--fail-fast` | boolean | false | Stop on first failure |
| `--report` | value | none | html, junit, json (comma-separated) |
| `--retry` | value | 0 | Retry failed assertions N times |
| `--threshold` | value (%) | 0 | Pixel diff tolerance |
| `--browser` | value | chromium | chromium, firefox, webkit |
| `--device` | value | none | Playwright device name |
| `--video` | boolean | false | Record video |
| `--trace` | boolean | false | Playwright trace recording |
| `--auto-wait` | value (ms) | 0 | Wait after each non-assertion step |
| `--webhook` | value (URL) | none | POST results on completion |
| `--history` | boolean | false | Append to history.jsonl |
| `--update-baselines` | boolean | false | Auto-update baselines on diff |
| `--freeze-animations` | boolean | false | Disable all CSS animations |
| `--full-page` | boolean | false | Full-page screenshots |
| `--screenshot-on-failure` | boolean | false | Screenshot when assertion fails |
| `--match-level` | value | strict | strict, layout, ignore-colors, ignore-antialiasing |
| `--shard` | value (X/Y) | none | Test sharding for `run-suite` |
| `--browsers` | value | chromium | Comma-separated for `compare-browsers` |
| `--baseline` | boolean | false | Save to baselines/ |
| `--theme` | value | none | Force light or dark |
| `--viewport` | value | desktop | desktop, tablet, mobile |

### Phase 18: Main Dispatcher

```javascript
(async () => {
    switch (command) {
        case 'screenshot':     await cmdScreenshot(args[1], { baseline, theme, viewport }); break;
        case 'screenshot-all': await cmdScreenshotAll({ includeMinor, theme, viewport }); break;
        case 'theme':          await cmdTheme(args[1]); break;
        case 'responsive':     await cmdResponsive(args[1]); break;
        case 'toast':          await cmdToast(args[1]); break;
        case 'modal':          await cmdModal(args[1]); break;
        case 'validate':       await cmdValidate(args[1]); break;
        case 'audit':          await cmdAudit(args[1]); break;
        case 'audit-all':      await cmdAuditAll(); break;
        case 'compare':        await cmdCompare(args[1]); break;
        case 'test-flow':      await cmdTestFlow(args[1]); break;
        case 'interact':       await cmdInteract(getFlag('steps')); break;
        case 'run':            await cmdRun(args[1]); break;
        case 'run-suite':      await cmdRunSuite(args[1]); break;
        case 'coverage':       cmdCoverage(args[1]); break;
        case 'click':          await cmdClick(args[1], options); break;
        case 'trends':         cmdTrends(); break;
        case 'baseline-all':   await cmdBaselineAll(); break;
        case 'a11y-audit':     await cmdA11yAudit(args[1]); break;
        case 'compare-browsers': await cmdCompareBrowsers(args[1]); break;
        default:               /* Print comprehensive help text */
    }
})();
```

### Phase 19: Help Text

The default case (no command) should print a comprehensive help text listing:
- All 22 commands with descriptions
- All 24 flags with types and descriptions
- Screenshot options
- Toast types, modal types, test flow names
- Run file JSON format
- All 140+ step types organized by category
- Assert-state comparison operators
- Variable substitution syntax
- Performance metrics
- Conditional step syntax
- Exit codes (0 = pass, 1 = failures, 2 = script error)
- Usage examples

### Phase 20: Adapt to This Project

After generating the script:
1. Replace all placeholder values (`<DISCOVERED_...>`) with actual project values
2. Populate MAJOR_ROUTES with this project's actual pages
3. Adapt the login flow to this project's auth mechanism
4. Adapt `store-set` and `assert-state` to this project's state management (Redux, Vuex, Zustand, MobX, custom, etc.)
5. Adapt modal/toast triggers to this project's UI library
6. Adapt `waitForPageReady()` to this project's loading indicators
7. Create a `.gitignore` entry for `screenshots/` if not already present
8. Ensure `pixelmatch` and `pngjs` are listed as devDependencies (install them if needed)
9. Ensure `playwright` is listed as a devDependency (install if needed)

### Phase 21: Verification

After creating the script:
1. Run `node scripts/visual-test.js` — should print the full help text
2. Run `node scripts/visual-test.js screenshot <some-route>` — should take a screenshot (requires dev server running)
3. Verify the `screenshots/` directory structure is created correctly

### EXIT CODE CONVENTION

```
0 = All assertions passed / command succeeded
1 = One or more assertion failures
2 = Script error (bad args, server unreachable, etc.)
```

### APPENDIX: Common Pitfalls to Avoid (from 49 real bugs found during hardening)

These are real bugs found during 5 rounds of rigorous auditing. The prompt above already incorporates fixes for all of them, but this checklist serves as a final verification:

1. **`$$eval` vs `$eval`** — `$$eval` passes an Array to the callback. If you need a single element, use `$eval`. Calling `.querySelectorAll()` on an Array always throws.
2. **`|| null` vs `?? null`** — `Math.round(0) || null` returns `null` (wrong). Use `?? null` to only coerce `undefined`/`null`.
3. **Hash normalization** — `goto` and `navigate` must both normalize the `#` prefix. If `navigate`'s fallback does `window.location.hash = route` where route is `"#foo"`, you get `##foo`.
4. **Browser close in finally** — ALWAYS close browsers in `finally` blocks, never only in `try`. Use a `browserClosed` flag when early-close is possible.
5. **Teardown in finally** — Teardown must run even if login/setup throws. Place it in `finally`.
6. **Setup/teardown in ALL runners** — `cmdRun`, `cmdRunGroups`, `cmdRunMatrix`, AND `cmdRunSuite` must all support file-level setup/teardown.
7. **Post-run handler centralization** — ONE function for --report, --history, --webhook. Don't inline in each command.
8. **Webhook timeout** — Use `AbortController` with 10s timeout. Never let a hung webhook block the script.
9. **Variable substitution must be recursive** — Flat `Object.entries` misses nested objects and arrays.
10. **HTML escaping in reports** — All dynamic content in HTML reports must use `escapeHtml()`.
11. **Assertion failure counting** — Every failed assertion MUST increment `assertionResults.failed` and push to `.errors`. Don't just `console.error` and break.
12. **Glob patterns in assert-request** — Single `*` = `[^/]*`, double `**` = `.*`. Use a two-pass replacement with sentinel to distinguish them.
13. **Matrix value validation** — Verify all matrix values are arrays before computing Cartesian product.
14. **Trace filename collisions** — Include combo index in matrix trace filenames.
15. **Report write errors** — Wrap all `writeFileSync` in try-catch so a write failure doesn't crash the run.
16. **Duplicate CSS injection** — Check `document.getElementById()` before injecting freeze-animation styles.
17. **Route errors in audit-all** — Count errored routes in the totals summary, don't silently omit them.
18. **PageContext memory** — Cap `allRequests` array (e.g., 10,000 entries FIFO) to prevent memory leaks in long runs.
19. **Per-step timeout** — `fill`, `select`, `evaluate` should respect `step.timeout`.
20. **Coverage parse warnings** — Track and report file parse failures instead of silently skipping.

## PROMPT END
