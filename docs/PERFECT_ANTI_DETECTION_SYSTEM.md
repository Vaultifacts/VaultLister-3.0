# The Perfect Anti-Detection System for Facebook Marketplace Automation

**Document type:** Design specification / North star  
**Scope:** Facebook Marketplace automation within VaultLister 3.0  
**Status:** Aspirational — describes the theoretically ideal system  
**Last updated:** 2026-04-14

---

## Purpose

This document describes the theoretically perfect anti-detection system for automating Facebook Marketplace listings through VaultLister. It is a design specification, not an implementation plan. No technical or financial constraints are assumed. The goal is to define the north star — the system we are always moving toward, even if some components are never fully reachable.

Facebook's anti-automation systems are among the most sophisticated of any consumer platform. They operate across behavioral, fingerprint, network, account trust, and content signal dimensions simultaneously. A system that defeats any single layer while failing another will still get flagged. The perfect system must address all layers coherently and in concert.

---

## 1. Architecture Overview

The perfect system is a multi-layer stack. Each layer addresses a distinct category of detection signal. The layers are not independent — they must be coherent with each other. A perfect behavioral simulation on a poisoned IP defeats itself. A perfect proxy with a mismatched fingerprint defeats itself.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Chrome Extension (user's own browser)         │
│           Inherently undetectable — always preferred     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Anti-Detect Browser Engine (server-side)      │
│           Real browser binary, zero automation leaks     │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Fingerprint Identity System                   │
│           One stable identity per FB account, forever   │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Network Layer                                 │
│           Sticky residential proxy, no leaks            │
├─────────────────────────────────────────────────────────┤
│  Layer 5: Behavioral Simulation Engine                  │
│           Human-speed, session-warm, never mechanical   │
├─────────────────────────────────────────────────────────┤
│  Layer 6: Account Lifecycle Manager                     │
│           Warmup, velocity caps, rest days, aging       │
├─────────────────────────────────────────────────────────┤
│  Layer 7: Detection Response System                     │
│           Immediate halt, escalating cooldown, alerting │
├─────────────────────────────────────────────────────────┤
│  Layer 8: Content Safety Scanner                        │
│           Pre-flight check for prohibited content       │
└─────────────────────────────────────────────────────────┘
```

A violation at any layer can cause a ban. The system is only as strong as its weakest layer. All layers must be configured and active before any automation session starts.

---

## 2. Anti-Detect Browser Engine (Layer 2)

### The Problem

Server-side automation using any standard browser driver — Playwright, Puppeteer, Selenium — produces detectable artifacts. Facebook's client-side JavaScript probes the DOM, the browser API surface, the timing of events, and the network transport layer for these artifacts. Patches applied post-hoc (like `puppeteer-extra-plugin-stealth`) cover most of the obvious signals but leave residue. The browser binary itself — when modified or shimmed — introduces subtle deviations from the real browser that statistical detectors catch over time.

### The Perfect Engine

The perfect anti-detect browser engine would have these properties:

**Browser binary authenticity.** It uses a real, unmodified browser binary — the same executable a normal user downloads. Not a patched Chromium, not a stripped Firefox build. The binary is updated on the same day the browser vendor releases an update. Version skew between the declared user agent and the actual rendering engine is one of the most reliable bot signals; the perfect system has zero skew.

**Zero automation protocol leaks.** The perfect engine exposes no CDP (Chrome DevTools Protocol) listening socket to the host network, or it fully masks any indication of CDP presence at the JavaScript layer. It produces no `navigator.webdriver` property, no `window.__selenium_*` globals, no `chrome.runtime` with the wrong extension ID, no `_phantom`, no `callSelenium`, no `driver` on the `window` object. The Juggler protocol artifacts present in some Firefox-based anti-detect browsers are absent. There is nothing in the page's JavaScript environment that a fingerprint test can point to.

**No memory leaks in long sessions.** The browser does not accumulate DOM nodes, event listeners, or V8 heap across multiple listing sessions. At a configurable threshold (e.g., every 10 listings), the browser profile is checkpointed cleanly, the session is handed off to a fresh process, and the session cookies are rehydrated from the persistent profile directory — not from a storageState JSON file, which is itself a detectable pattern.

**Persistent profile state.** Each Facebook account maps to one permanent browser profile directory on disk. Cookies, localStorage, IndexedDB, and cache are persisted across sessions. The browser "remembers" the account the way a real user's laptop remembers it. Sessions never start cold.

**Headless rendering without artifacts.** On Linux servers, the browser runs headless but produces identical rendering outputs (canvas hashes, WebGL frames, font metrics) to the headed version on the declared OS. No headless-specific rendering artifacts appear in canvas or WebGL fingerprints. The display is virtual but the rendering pipeline is identical.

**TLS and HTTP fingerprint authenticity.** The TLS handshake (JA4 fingerprint) matches the exact declared browser version — same cipher suites, same extensions, same GREASE values, same ordering. The HTTP/2 SETTINGS frame (initial window size, header table size, max frame size, HPACK compression) matches the real browser's observed values. These transport-layer fingerprints are invisible to JavaScript but are inspectable at the network layer; a perfect system ensures they are indistinguishable from the real browser.

**Full Playwright API compatibility.** The engine supports all Playwright APIs — `evaluate`, `route`, `locators`, `expect`, `keyboard`, `mouse`, `touch` — without any of these APIs leaving detectable footprints in the page's JavaScript context. `page.route()` is available but the perfect system does not use it to intercept Facebook's own requests (see Layer 4).

---

## 3. Fingerprint Identity System (Layer 3)

### The Problem

A fingerprint is the set of browser and device characteristics that, taken together, uniquely identify a session. Facebook's detection system correlates fingerprints across sessions. A user who logs into a real Facebook account always comes from the same laptop with the same screen resolution, the same fonts, the same canvas rendering. A bot that randomizes its fingerprint on every session looks like a user who switched computers with every login — anomalous.

The second problem is internal consistency. A fingerprint composed of randomly mixed signals is immediately suspicious. Windows screen sizes with Linux fonts. A Chrome UA with Firefox plugin data. A US timezone with a Brazilian IP. Any single inconsistency is noise; multiple inconsistencies are signal.

### The Perfect Fingerprint System

**One fingerprint per Facebook account, forever.** At account creation time, a fingerprint identity is generated and stored in the account record. Every automation session for that account uses the exact same fingerprint. There is no rotation, no variation. From Facebook's perspective, this account's user always comes from the same device.

**Fingerprint components and their perfect values:**

| Component | Perfect Behavior |
|-----------|-----------------|
| Screen resolution | Fixed for the account's lifetime. Chosen from real-world distribution (1920x1080, 1536x864, 1440x900, 1366x768 — never 1280x800 which is a Playwright default) |
| Color depth | 24 (universal) |
| Timezone | Derived from the account's residential proxy city. Never changes. |
| Locale | `en-US` or `en-CA` consistent with the proxy's country |
| Installed fonts | Consistent with the declared OS. Windows fingerprints include Calibri, Segoe UI, Tahoma. macOS fingerprints include San Francisco, Helvetica Neue, Arial. Never a Windows UA with macOS system fonts. |
| Browser plugins | Matches the declared Chrome version. Chrome PDF Plugin, Chrome PDF Viewer, Native Client — exactly as enumerated by that version. |
| Hardware concurrency | Fixed integer (4, 6, 8, or 12). Never random per session. |
| Device memory | Fixed integer (4, 8, or 16 GB). Never random per session. |
| WebGL renderer | Fixed string consistent with a real GPU. Intel Iris, NVIDIA GeForce, AMD Radeon — matched to the declared OS and screen size. |
| WebGL vendor | Matching the declared renderer's manufacturer |
| Canvas hash | Deterministic for the account. Same canvas instructions produce the same hash every time. Not randomized; randomization is itself a signal. |
| AudioContext fingerprint | Fixed for the account. Audio processing produces the same floating-point output every session. |
| Battery status | Plausible laptop values. Charging: true, level: 0.85-1.0. Fixed per account. |
| Connection type | Fixed: `4g`, downlink 8-12 Mbps, rtt 40-80ms |
| Speech synthesis voices | Matches the declared OS. Windows voices (David, Zira) for Windows fingerprints. macOS voices (Alex, Samantha) for macOS fingerprints. |
| navigator.languages | `["en-US", "en"]` for US accounts. `["en-CA", "en"]` for Canadian accounts. Fixed per account. |
| Intl.DateTimeFormat timezone | Exactly matches the account's proxy city timezone |
| Touch support | False for desktop fingerprints (maxTouchPoints = 0) |

**Geographic coherence.** The fingerprint is generated at account setup time and is seeded from the proxy's geolocation. The system queries the proxy's IP for its city, region, and country, then generates a fingerprint where timezone, locale, languages, and screen size are all internally consistent with a real user living in that city using a Windows or macOS laptop.

**Deterministic rendering hashes.** Canvas and WebGL fingerprints are not randomized — randomization is a detectable pattern. Instead, the fingerprint includes a fixed noise seed that is injected at the canvas API level before the first pixel is drawn. This produces a stable, account-specific hash that is different from the server's baseline but consistent across sessions. Facebook's canvas hash database sees the same value every time this account logs in, just as it would for a real user's laptop.

**Fingerprint storage.** Each fingerprint is stored encrypted in the database alongside the Facebook account credentials. It is loaded into the browser context at session initialization and applied before the browser makes any network request.

---

## 4. Network Layer (Layer 4)

### The Problem

An IP address is the most durable single identifier available to Facebook. It predates session cookies, predates fingerprints, and survives all browser-level isolation. A datacenter IP has near-zero organic Facebook traffic associated with it; using one immediately elevates the risk score of every action taken from it. An IP shared across multiple accounts creates a cross-account link that Facebook can use to identify related automation activity even if each account individually looks clean.

### The Perfect Network Layer

**Sticky residential proxy per account.** Each Facebook account is assigned one specific residential proxy IP address that never changes. The proxy is sourced from a residential ISP (not datacenter, not VPN, not mobile) in the same city the account is associated with. "Sticky" means the same IP is requested every session by specifying the session ID to the proxy provider. The IP is not rotated unless the account is banned, at which point a new permanent IP is assigned for a new account.

**No IP sharing across accounts.** Two Facebook accounts never share an IP address, even momentarily. The proxy pool is sized so that each active account maps to a dedicated proxy endpoint. Shared IPs are one of Facebook's primary signals for detecting farm operations.

**Geo-location consistency.** The proxy's IP resolves to a specific city. The fingerprint's timezone, locale, and languages are derived from that city. The two never diverge.

**DNS through the proxy.** All DNS resolution for Facebook domains occurs through the proxy, not through the server's default resolver. DNS queries from the server's IP would reveal the server's real network location even if HTTP traffic flows through the proxy. The perfect system routes DNS through the proxy tunnel.

**TLS origination from the proxy.** The TLS handshake originates from the proxy's IP, not from the server. If the proxy operates as a CONNECT tunnel (as most residential proxies do), the TLS fingerprint is applied by the client-side browser — which is correct. The perfect system ensures no TLS inspection occurs at the proxy layer that would alter cipher suite ordering.

**WebRTC completely blocked.** `RTCPeerConnection` is either removed from the page's JavaScript context or configured with no ICE servers. `navigator.mediaDevices` returns empty device lists. WebRTC is the most common IP leak vector in browser automation; the perfect system eliminates it at the context level before any page loads.

**IPv6 disabled.** IPv6 is disabled at the browser context level. Many residential proxies are IPv4-only; an IPv6 fallback would route through the server's native IPv6 address, leaking the true server IP.

**No `page.route()` interception of Facebook requests.** Playwright's `page.route()` intercepts requests at the CDP level and prevents them from being sent normally. Facebook's front-end JavaScript can detect that expected telemetry or analytics requests are being dropped. The perfect system lets all Facebook-originated requests flow unimpeded — including telemetry. The user-level benefit of blocking telemetry is far outweighed by the detection risk.

**Proxy health monitoring.** The proxy's IP is checked against known blacklists (Spamhaus, SORBS, proxy reputation databases) before each session. If the IP appears on any blacklist, the session is aborted and the operator is alerted. Proxy health is logged as a metric in the monitoring dashboard.

---

## 5. Behavioral Simulation Engine (Layer 5)

### The Problem

Even with a perfect browser, a perfect fingerprint, and a clean IP, behavioral signals are Facebook's most sensitive detection channel. Real humans are irregular. They hesitate. They mistype. They read before they click. They wander off-task. They take breaks. Automation code is mechanical — it is faster than any human, more consistent than any human, and more direct than any human. These deviations from human norms are what Facebook's behavioral models are tuned to detect.

### The Perfect Behavioral Engine

**Session warmup before every listing.** No automation session begins by navigating directly to the listing creation form. Every session begins with a minimum 60-second warm-up phase:

1. Navigate to `facebook.com` (homepage, not marketplace)
2. Wait for the feed to load fully
3. Scroll through 4-8 feed items at variable speed
4. Hover over 1-2 posts for a few seconds each (reading dwell time)
5. Click one post title or link and spend 10-20 seconds on it before backing out
6. Navigate to Marketplace via the left sidebar nav — not by typing the URL directly
7. Browse 2-3 existing marketplace listings in the same category as the item to be listed
8. Only then navigate to the listing creation form

This 3-5 minute warmup looks like a real user who just happened to be on Facebook, browsed for a bit, and decided to list something.

**Form filling that feels like reading and thinking.**

*Field entry sequence:*
- Click the field. Pause 1-3 seconds (the human equivalent of reading the label and deciding what to type).
- Begin typing at 150-280ms per character with a standard deviation of about 60ms. No uniform spacing.
- Every 15-25 characters, pause for 400-900ms (natural mid-word hesitation or re-reading).
- 1 in 20 characters: introduce a typo, pause 200-500ms, press Backspace, retype the correct character.
- Tab or mouse-click to the next field — never immediate programmatic focus change.
- Pause 3-10 seconds between fields. Longer pauses on fields that require more thought (description, price).
- Total form fill time for a standard item: 4-8 minutes. Never under 3 minutes.

*Category and condition dropdowns:*
- Click the dropdown, wait 600-1200ms for the options to render fully.
- Move the mouse through 1-2 non-target options before landing on the correct one.
- Brief hover (300-800ms) on each intermediate option.
- Select the correct option and wait 500-1000ms for the UI to update before continuing.

*Price field:*
- Type each digit individually at human speed.
- Pause after the last digit, as if double-checking the number.
- Tab away from the field. Never click directly to the next field without first leaving the price field.

*Description field:*
- Type in a cadence that suggests the user is composing the text, not pasting it.
- Natural pause patterns between sentences (1-3 seconds).
- If a template is used, it is typed character by character with composition pauses, not injected by setting the field value directly.

**Photo upload via drag-and-drop simulation.**

The perfect photo upload does not use `setInputFiles()`. It constructs a `DataTransfer` object with the image files, dispatches a `dragenter` event on the upload zone, follows it with `dragover`, then `drop`. After the drop, it waits for the upload progress indicator to reach 100% before proceeding — not a fixed timeout, but actual observation of the upload UI. After upload, the cursor moves over the uploaded thumbnails as if reviewing them (1-3 seconds per photo).

**Location typeahead.**

- Type the location name at human speed (200-300ms per character).
- After each character, observe whether the suggestion dropdown has updated.
- Wait 2-4 seconds after the suggestions appear before interacting with them.
- Move the mouse through 1-2 non-target suggestions.
- Click the correct suggestion. Wait for the location field to show the confirmed selection.

**Submission sequence.**

- Before clicking Next or Publish on any step, scroll to the bottom of the form to "review" it.
- Pause 2-5 seconds on the preview step. Move the mouse over the preview image.
- Click Publish with a natural mouse trajectory from wherever the cursor currently is.
- After the confirmation page loads, stay on it for 8-15 seconds. Move the mouse as if reading the confirmation.
- Navigate to the Marketplace selling page to verify the listing appeared.
- Browse 1-2 more pages naturally before the session ends or before the next listing begins.

**Inter-listing behavior.**

Between consecutive listings in a session:
- Navigate away from the listing form entirely. Visit a non-marketplace Facebook page.
- Spend 2-5 minutes browsing feed or marketplace listings.
- Return to the listing form as if the user just decided to list the next item.
- Never start a new listing within 20 minutes of completing the previous one.

**Mouse trajectories.**

The perfect mouse movement uses Bezier curves with slight overshoot past the target, micro-corrections, and a brief pause before the actual click. The cursor never teleports. The cursor never moves in a straight line at constant velocity. The cursor approaches clickable targets from wherever it naturally would be given the last action.

**Scroll behavior.**

Scrolls are chunked into 3-6 sub-movements with variable speed and 80-200ms pauses between chunks. The page is never scrolled an exact pixel-perfect amount. Occasional over-scroll followed by slight scroll-back is natural.

---

## 6. Account Lifecycle Manager (Layer 6)

### The Problem

Facebook's trust score for an account is cumulative. A new account that immediately starts posting listings is almost certainly a bot or spam account. A well-aged account with organic social activity, purchase history, and a listing pattern that grows gradually over time is trusted. The perfect system treats account age and trust score as a resource that must be carefully cultivated before being spent on automation.

### The Perfect Account Lifecycle

**Phase 1: Warmup (Days 1-30). No listings.**

| Days | Activities |
|------|-----------|
| 1-7 | Browse Facebook via the bot for 15-20 minutes per day. Like posts on the main feed. Follow 2-3 local community pages or groups relevant to the account's geographic location. Fill in basic profile fields (city, general interests). Upload a profile photo. |
| 8-14 | Browse Marketplace as a buyer. Click into 3-5 listings per day. Message one seller a genuine-looking question about a listed item. React to 1-2 Marketplace listings with the "heart" or offer UI without purchasing. |
| 15-21 | List 1 item every 2-3 days. Items are real, low-value, local pickup only. No shipping. Category is common (clothing, furniture, or electronics). Price is realistic. |
| 22-30 | List 1 item per day. Mix of local pickup and shipping. Respond to any incoming messages within 24 hours. |

**Phase 2: Active (Day 31-90). Gradual ramp.**

| Week | Max listings/day | Notes |
|------|-----------------|-------|
| 5-6 | 2-3 | Continue organic browsing on non-listing days |
| 7-8 | 3-5 | Vary item categories; not all from the same template |
| 9-12 | 5-8 | Introduce 1-2 rest days per week |
| 13+ | 8-10 max | Never exceed 10/day regardless of account age |

**Permanent velocity caps (never exceeded, regardless of account age):**
- Maximum 10 listings per day
- Minimum 20 minutes between consecutive listings
- Minimum 1 rest day (zero listings) per week
- No listings between 11pm and 7am local time
- No more than 3 automation sessions per day
- Sessions distributed across the day, not all in the morning

**Content diversity rules:**
- Never post two listings with identical titles
- Never post two listings with identical photos (checked by hash)
- Never use identical description templates without variation (sentence structure varied, not just fields swapped)
- Rotate item categories — not all clothing, not all electronics
- Realistic and varied pricing — nothing priced at $1 as a placeholder

**Multi-account isolation:**
- One residential IP per account — never shared
- One browser profile per account — never shared
- One fingerprint per account — never shared
- Never run two account automation sessions simultaneously from the same server process
- Stagger listing times across accounts by at least 10-15 minutes so that simultaneous bursts from the same server IP are never visible at the network layer
- If accounts are related to the same business, they must never message each other, like each other's listings, or appear in each other's social graphs

---

## 7. Detection Response System (Layer 7)

### The Problem

No automation system, no matter how sophisticated, will avoid all detection events forever. Facebook changes its detection models continuously. New signals are added. Thresholds are adjusted. The perfect system assumes it will occasionally be detected and responds appropriately — avoiding the escalation from a temporary review to a permanent ban.

### The Perfect Response System

**Anomaly detection — what to watch for:**
- CAPTCHA (any form: reCAPTCHA, hCaptcha, Facebook's own image CAPTCHAs)
- Checkpoint pages (`/checkpoint/`, `/security/`, `/identity/`)
- Account locked or disabled pages
- Seller verification gates (`/marketplace/verify/`, `/seller-verification/`)
- Unusual redirect after login (not landing on the Facebook homepage)
- Login form presented mid-session (session expired unexpectedly)
- Page load stall exceeding 15 seconds on a known Facebook route
- Expected UI element absent (e.g., the listing creation form not rendering)
- Error messages containing "suspicious activity", "unusual activity", "verify identity"

**Response protocol on any anomaly:**
1. Stop all automation immediately. Do not attempt to dismiss the anomaly or click through it.
2. Take a screenshot and save it to the audit log with a timestamp.
3. Log the event with full context: account ID, proxy IP, fingerprint ID, action being performed, URL, element or text that triggered the detection.
4. Set the account's status to "cooling down" in the database.
5. Do not close the browser. Leave the session open for a manual review window.
6. Alert the user via email and in-app notification within 60 seconds.

**Escalating cooldown schedule:**
| Detection count (in 7 days) | Cooldown |
|----------------------------|---------|
| 1 | 24 hours |
| 2 | 48 hours |
| 3 | 72 hours |
| 4 or more | Quarantined — manual review required before resumption |

After each cooldown, automation resumes at 50% of the pre-detection velocity cap. The cap is restored to normal after 7 consecutive clean days.

**Never retry the exact triggering action.** If a CAPTCHA appeared during the listing creation form's photo upload step, the next session does not attempt to upload photos in the same way. It uses a different field interaction sequence, a different photo, or flags the listing for manual completion.

**Proxy and profile handling on detection:**
- If the detection appears account-specific (checkpoint, identity verification): flag the browser profile; do not reuse it for automation until the account owner manually resolves it.
- If the detection appears IP-specific (rate limiting signals, bulk ban of similar IPs): flag the proxy; request a new sticky session from the proxy provider before the next attempt.
- If multiple accounts on different proxies experience detection simultaneously: pause all automation for 48 hours. This is a platform-wide detection event, possibly triggered by a model update.

---

## 8. Content Safety Scanner (Layer 8)

### The Problem

Facebook's content moderation AI pre-screens listing content before publication and continues to scan it afterward. A listing that passes the bot's automation layer but fails Facebook's content moderation creates a different kind of ban event — one that is directly account-harming and difficult to attribute to automation specifically. The perfect system prevents prohibited content from ever being submitted.

### The Perfect Content Scanner

**Pre-flight checks run before every listing submission:**

**Title and description text analysis:**
- Strip and flag any external URLs (even partial ones like "see my website")
- Strip and flag phone numbers in any format (+1-800, (403) 555-1234, international formats)
- Check against a locally maintained prohibited words list, updated from publicly known Facebook Commerce Policy
- Check for ALL CAPS abuse (more than 30% of text in capitals signals spam)
- Check for excessive punctuation or emoji density
- Check for price-in-description patterns ("DM for price", "price negotiable" — disallowed in some categories)
- Check category-content consistency: a listing categorized as "Clothing" with a description that mentions power tools is flagged for review

**Image analysis:**
- Compute a perceptual hash (pHash) for each image before submission
- Check the hash against a per-account image history table — reject duplicates
- Check for duplicate images across accounts (shared photo assets are a farm signal)
- Run a lightweight NSFW classifier for explicit content
- Check for text overlaid on images (phone numbers, watermarks, external URLs embedded in photos)
- Check image resolution — Facebook requires a minimum; submitting undersized images causes UI errors that look like bot failures

**Pricing sanity checks:**
- Reject $0 or $1 prices (placeholder values that trigger spam detection)
- Flag prices that are more than 80% below the category average for the declared condition
- Flag prices that are identical across many listings (template values not replaced)

**Duplicate detection:**
- Check if an identical or near-identical listing title already exists in the account's active listings
- Check if the item has already been listed in the last 30 days (relisting too soon)

**Output:** The scanner produces a PASS, WARN, or BLOCK result. BLOCK listings are never submitted and require manual review. WARN listings are submitted but flagged for follow-up. All results are logged to the audit trail.

---

## 9. Monitoring Dashboard

The perfect monitoring system gives the operator full visibility into every automation event, account health state, and system metric in a single view.

**Per-account health panel:**
- Health score: GREEN (clean), YELLOW (1 detection in last 7 days), RED (quarantined or cooling down)
- Current status: Active, Cooling down, Warmup phase, Quarantined, Manual review required
- Warmup progress bar (days elapsed / days needed per phase)
- Listing velocity: today / 7-day average / lifetime total
- Last successful listing: timestamp
- Next available listing time (considering velocity caps and cooldown)
- Active proxy IP + last geo-check result
- Fingerprint ID + last consistency check timestamp

**Detection event log:**
- Timestamp of every anomaly
- Type: CAPTCHA / Checkpoint / Login gate / Redirect / Element not found
- Action being performed at time of detection
- Account ID + proxy IP + fingerprint ID
- Screenshot thumbnail (click to expand)
- Resolution: Auto-cooled / Manually resolved / Still open

**Listing performance:**
- Success rate by day (listings published / listings attempted)
- Average time per listing (behavioral health metric — sudden drops indicate template drift toward automation-speed)
- Content scanner block/warn rate
- Photo upload success rate

**Network layer health:**
- Per-proxy IP blacklist check status (last checked, result)
- DNS leak test result (last checked)
- WebRTC leak test result (last checked)

**System alerts (email + in-app):**
- Detection event for any account
- Proxy IP appears on blacklist
- Daily velocity cap reached for any account
- Account enters warmup phase 4 (quarantine)
- Multiple accounts experience detection within 24 hours (platform-wide event)

---

## 10. Gap Analysis: Current Implementation vs the Perfect System

This section is a candid assessment. Knowing the gap is how we prioritize what to build next.

| Layer | Perfect System | Current Implementation | Gap |
|-------|---------------|----------------------|-----|
| **1 — Chrome Extension** | Pre-fills Facebook Marketplace listing form in user's own browser; zero detection risk | Extension exists (`src/extension/`) with Facebook Marketplace host permission; content script injects import button. **No Facebook listing form pre-fill implemented.** | Extension infrastructure exists but cross-listing via the extension is not implemented for Facebook. No automation risk at this layer — but also no functionality. |
| **2 — Anti-Detect Browser Engine** | Real unmodified browser binary; zero CDP leaks; same-day version updates; no automation artifacts | Camoufox (Firefox-based anti-detect browser, `launchCamoufox()` in `stealth.js`). `puppeteer-extra-plugin-stealth` applied to Chromium path. `injectChromeRuntimeStub()` fills the partial `chrome.runtime` gap. | Camoufox is a real Firefox derivative with good anti-detect properties but is not an unmodified browser. `chrome.runtime` stub is hand-written and will score failures on strict tests like CreepJS. No same-day update automation. TLS/JA4 and HTTP/2 SETTINGS authenticity unverified. |
| **3 — Fingerprint Identity System** | One permanent fingerprint per account; all components internally consistent and geo-derived; stable canvas/WebGL hashes | `stealthContextOptions()` generates a UA + viewport + locale + timezone per session from fixed pools. Navigator hardware properties are randomized per session (not per account). Canvas/WebGL are patched by Camoufox and stealth plugin. No per-account fingerprint persistence. | UA, viewport, locale, and timezone are randomized each session rather than fixed per account. No fingerprint record stored in the database. Hardware concurrency and device memory change every session. No geographic coherence enforcement between proxy IP and fingerprint timezone. |
| **4 — Network Layer** | Sticky residential proxy per account; DNS and TLS through proxy; WebRTC blocked; IPv6 disabled; no page.route() on FB requests | `FACEBOOK_PROXY_URL` env var fed to Camoufox. `block_webrtc: true` set in Camoufox options. Analytics/tracking routes intercepted via `page.route()`. No per-account proxy assignment — all accounts share one proxy URL. | Single shared proxy URL means multiple accounts share one IP. No per-account sticky proxy assignment. `page.route()` is used to block analytics/tracking requests — this is a detectable pattern (Facebook's telemetry requests are dropped). DNS leak status unverified. |
| **5 — Behavioral Simulation Engine** | 3-5 minute session warmup; 4-8 minutes per listing; natural typing with typos; drag-and-drop photo upload; dropdown scroll behavior | `humanType()` types at 50-150ms per character. `humanClick()` uses bezier-ish mouse movement with overshoot. `humanScroll()` chunks scrolls. `mouseWiggle()` adds inter-action movement. `jitteredDelay()` adds ±30% to base delays. | No session warmup — bot navigates directly to the listing URL. No pre-listing browsing. Typing speed (50-150ms) is uniform — no sentence-level pauses, no typos. No dropdown scroll simulation. No drag-and-drop photo upload. No post-listing verification browsing. No inter-listing idle periods. Total listing time well under the 3-minute minimum. |
| **6 — Account Lifecycle Manager** | 30-day warmup; gradual velocity ramp; rest days; one IP + profile + fingerprint per account | `minAccountAgeDays` check in rate limits (configurable, default 3). Daily listing cap: 10/day (`maxListingsPerDay`). Login cap: 3/day. Per-profile usage tracking via `browser-profiles.js`. Profile pool of 3. | No structured warmup phase (30-day warmup is enforced only by `minAccountAgeDays`, which defaults to 3). No velocity ramp — the full 10/day cap applies from day 4. No rest days enforced. No social activity warmup (browsing, liking, messaging). No account-to-profile-to-proxy binding persisted in the database. |
| **7 — Detection Response System** | Immediate halt on any anomaly; 24h escalating cooldown; escalation to quarantine on 3 events; alerting; audit trail | CAPTCHA detection throws an error and halts the session. Checkpoint/lockout URLs detected and cause immediate stop. Profile is flagged in `profiles.json` after detection. Audit log entry written. | No cooldown timer stored or enforced — a flagged profile could be manually unflagged and reused immediately. No escalating schedule. No email/in-app alerting. No automatic cooldown period enforcement. No cross-account detection event aggregation (platform-wide event detection absent). |
| **8 — Content Safety Scanner** | Pre-flight scan for prohibited words, image duplicates, NSFW, URLs/phone numbers in text, pricing sanity | Not implemented. No pre-flight content scanner exists. | Entire layer absent. Content is submitted to Facebook's moderation AI with no pre-screening. External URLs, phone numbers, duplicate photos, and placeholder prices are all submitted unchecked. |
| **Monitoring Dashboard** | Per-account health, detection events, velocity metrics, proxy health, cooldown status | Basic `getStats()` on `FacebookBot` returns runtime session counts (refreshes, relists, errors). Admin backend likely has some monitoring but no Facebook-specific health view. | No monitoring dashboard for Facebook automation health. No per-account health scores. No detection event history view. No proxy health checks. No cooldown status display. |

### Summary of the Biggest Gaps

Ranked by detection risk, not implementation complexity:

1. **No session warmup** — the bot navigates directly to listing creation, which is the clearest possible automation signal. Implementing even a 60-second warmup (homepage → marketplace → form) would reduce behavioral detection substantially.

2. **No per-account sticky proxy assignment** — all accounts share one proxy. Cross-account IP correlation is one of Facebook's strongest ban signals for coordinated automation.

3. **Fingerprints are session-random, not account-persistent** — timezone, locale, and hardware properties change every session. From Facebook's models, the account's "device" changes with every login.

4. **`page.route()` blocks Facebook analytics requests** — the current bot drops telemetry and tracking requests that a real browser always sends. This is detectable at the server side.

5. **No Content Safety Scanner** — listings with external URLs or phone numbers in the description will trigger automatic content moderation flags, which are account health events independent of automation detection.

6. **No rest days or velocity ramp** — the full 10/day cap applies from day 4. A real human reseller on a new account would never post 10 items on day 4.

---

## Appendix: What Requires Paid Services or Is Not Fully Achievable

**Residential proxy with per-account sticky sessions** — residential proxy providers charge per GB of data or per IP. A true residential proxy (Oxylabs, Smartproxy, Bright Data residential) costs roughly $3-15/GB. Shared datacenter or VPN proxies are not equivalent and will not produce the same trust signal. This is a hard cost of doing multi-account automation at scale. No free alternative exists.

**Real unmodified browser binary** — using an unmodified Chrome or Firefox binary while driving it programmatically (without CDP leaking) is not achievable with current open-source tools. CDP is the mechanism by which Playwright controls the browser, and it leaves detectable artifacts. Camoufox is currently the closest open-source approximation. Commercial anti-detect browsers (AdsPower, Multilogin, GoLogin) use patched binaries that are closer to unmodified but still not identical. True zero-artifact automation using an unmodified binary would require OS-level input injection (not currently supported by any cross-platform framework).

**Canvas and WebGL deterministic fingerprints matching real hardware** — making a server's GPU produce the same canvas hash as a specific real laptop is not achievable. The best achievable outcome is a stable, account-specific hash that is consistent across sessions — which is sufficient. It will not match a known real-device hash, but it will appear consistent rather than randomly changing.

**TLS/JA4 fingerprint matching the declared browser exactly** — when using a proxy CONNECT tunnel, the TLS client hello is generated by the browser itself (Camoufox/Firefox), so the JA4 fingerprint is Firefox's, regardless of what user agent is declared. Chrome fingerprints with a Firefox JA3/JA4 are detectable at the network layer by any system that logs TLS handshakes. Matching TLS fingerprint to browser UA requires using a browser whose TLS stack matches the declared UA — which is one reason Camoufox (Firefox-based) should be declared as Firefox rather than Chrome.

**Facebook warmup social activity automation** — automating the warmup activities (liking posts, messaging sellers, joining groups) carries its own detection risk and its own rate limits. The warmup phase is safer when performed manually by a human operator during the account's first month. Automating warmup is the second-order problem; it is achievable in principle but adds significant complexity to Layer 6.

**Content moderation AI avoidance** — Facebook's image-based content moderation AI cannot be defeated by any pre-screening system; it can only be anticipated. A local NSFW classifier can catch obvious violations, but Facebook's models detect subtle violations (partial brand logos, specific patterns associated with counterfeits, images matching previously flagged listings) that no local model can replicate. Pre-screening reduces false positives but does not eliminate them.
