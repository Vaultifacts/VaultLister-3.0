# The Perfect Anti-Detection System for Facebook Marketplace Automation

**Document type:** Design specification / North star  
**Scope:** Facebook Marketplace automation within VaultLister 3.0  
**Status:** Aspirational — describes the theoretically ideal system  
**Last updated:** 2026-04-15

---

## Purpose

This document describes the theoretically perfect anti-detection system for automating Facebook Marketplace listings through VaultLister. It is a design specification, not an implementation plan. No technical or financial constraints are assumed. The goal is to define the north star — the system we are always moving toward, even if some components are never fully reachable.

Facebook's anti-automation systems are among the most sophisticated of any consumer platform. They operate across behavioral, fingerprint, network, account trust, and content signal dimensions simultaneously. A system that defeats any single layer while failing another will still get flagged. The perfect system must address all layers coherently and in concert.

---

## 1. Architecture Overview

The perfect system is a multi-layer stack. Each layer addresses a distinct category of detection signal. The layers are not independent — they must be coherent with each other. A perfect behavioral simulation on a poisoned IP defeats itself. A perfect proxy with a mismatched fingerprint defeats itself.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 0: Mobile App (highest algorithmic visibility)    │
│           23% more impressions — but no automation path  │
├─────────────────────────────────────────────────────────┤
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
├─────────────────────────────────────────────────────────┤
│  Layer 9: Cross-Platform Intelligence                   │
│           Signals learned from eBay/Poshmark/Mercari    │
└─────────────────────────────────────────────────────────┘
```

A violation at any layer can cause a ban. The system is only as strong as its weakest layer. All layers must be configured and active before any automation session starts.

### Facebook-Specific Detection Infrastructure (Confirmed)

The following Facebook-internal systems are confirmed through Meta engineering publications and transparency reports:

**Sigma rule engine.** Every interaction on Facebook — posts, likes, messages, listing submissions — is evaluated in real time by Sigma, a Haskell-based rule engine. This is not sampling or statistical analysis after the fact; it is synchronous evaluation of every action against enforcement rules before the action is committed. (Source: Engineering at Meta, 2015)

**Silent trust score (0-1).** Every Facebook user has an internal trustworthiness score from 0 to 1, informed by behavioral patterns, report history, account age, and activity. This score is invisible to users and feeds into all enforcement decisions including Marketplace listing distribution. (Source: Washington Post, 2018; confirmed still active)

**Real-time behavioral telemetry.** Meta's Turbine stream processing platform processes hundreds of gigabytes per second across thousands of pipelines. The Meta Pixel fires behavioral events to Meta's servers in near-real-time as user interactions occur. Behavioral signals are available to enforcement systems within sub-second latency — not batched. (Source: Engineering at Meta, 2020)

**PDQ perceptual hash for photo matching.** Meta open-sourced PDQ (256-bit DCT-based perceptual hash) in 2019. It is more collision-resistant than standard pHash and is deployed at scale for abuse content detection. The same infrastructure that powers content matching trivially supports Marketplace photo duplicate detection across accounts. (Source: Meta, 2019)

**FIRE + Global Signal Exchange (GSE).** Meta's Fraud Intelligence Reciprocal Exchange (launched 2025, 50+ financial institutions) and the Global Signal Exchange (370M threat signals from 230+ organizations) feed cross-industry IP reputation, domain blocklists, and fraud signals directly into Meta's enforcement pipeline. IP addresses associated with financial fraud on any FIRE member platform are flagged before they reach Marketplace. (Source: Meta, 2025-2026)

**Mobile-native listing algorithmic preference.** A/B testing (2024) showed app-created Marketplace listings receive ~23% more impressions and 17% faster buyer responses compared to identical desktop-created listings. Facebook detects the creation pathway and weights it algorithmically. This means Playwright-automated desktop listings are penalized in visibility even if they pass all detection checks — reinforcing the Chrome extension as the preferred path. (Source: reseller community A/B data, 2024)

**GPS/IP geographic cross-check.** Facebook cross-checks IP address against device GPS data. A VPN changes IP but not device GPS, producing a detectable "Location Mismatch" that is an active enforcement signal. Frequent location changes also trigger flagging. On desktop (no GPS), the system relies on IP geolocation vs fingerprint timezone consistency — which is addressed in Layer 3. (Source: documented enforcement cases)

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

**TLS and HTTP fingerprint authenticity.** The TLS handshake (JA4 fingerprint) matches the exact declared browser version — same cipher suites, same extensions, same GREASE values, same ordering. The HTTP/2 SETTINGS frame (initial window size, header table size, max frame size, HPACK compression) matches the real browser's observed values. Detection vendors maintain version-specific SETTINGS tables: Chrome sends exactly four of six standard SETTINGS parameters in a version-specific order, and a UA claiming Chrome 130 with SETTINGS values from Chrome 120 is an instant flag. These transport-layer fingerprints are invisible to JavaScript but are inspectable at the network layer; a perfect system ensures they are indistinguishable from the real browser. Using a real browser engine (Camoufox/Firefox) produces genuine Firefox HTTP/2 SETTINGS — the risk is version drift between the UA string and the engine's actual SETTINGS values.

**No CDP serialization leaks.** Anti-bot systems (Castle, DataDome) detect CDP instrumentation by injecting JavaScript challenges that trigger observable side effects of CDP's JSON serialization. For example, defining a `toJSON` getter on an object passed to `JSON.stringify()` — if the getter fires during serialization, CDP is actively inspecting the page's JavaScript environment. This signal is unique to automation-instrumented browsers. The perfect system either uses no CDP communication at all, or ensures its automation protocol never serializes user-created JavaScript objects in a way that triggers these property getters.

**WebGPU fingerprint resistance.** The AtomicIncrement technique (ACM WiSec 2025) exploits GPU compute shader scheduling behavior to produce a hardware-specific fingerprint with 70% re-identification accuracy from 500 devices. It survives incognito mode and cannot be spoofed with JavaScript patches. On Linux containers without GPU access, WebGPU adapter info returns software renderer values (`llvmpipe`, `softpipe`) that are obviously non-consumer hardware. The perfect system either disables WebGPU entirely or overrides adapter info to match the declared GPU in the fingerprint profile. Note: Chrome 137+ removed the SwiftShader fallback entirely — headless Chrome now fails WebGL initialization rather than returning `Google SwiftShader`, which changes the detection surface.

**Full Playwright API compatibility.** The engine supports all Playwright APIs — `evaluate`, `route`, `locators`, `expect`, `keyboard`, `mouse`, `touch` — without any of these APIs leaving detectable footprints in the page's JavaScript context. `page.route()` is available but the perfect system does not use it to intercept Facebook's own requests (see Layer 4).

**Resistance to named detection profiles.** Commercial anti-bot vendors (DataDome, Akamai, Cloudflare) maintain detection profiles for specific anti-detect browsers by name. DataDome has published a specific Camoufox detection page targeting Canvas/WebGL coherence, AudioContext signatures, and timezone consistency. The perfect engine is either not catalogued by name in any vendor's detection database, or its fingerprint outputs are indistinguishable from a real browser on every axis these vendors probe. Periodic retesting against vendor-specific bot test suites (DataDome's challenge page, Akamai's bot manager) is required to verify the engine has not been fingerprinted.

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

**Cross-attribute consistency enforcement.** Anti-bot systems (DataDome FP-Inconsistent, ACM IMC 2025) specifically test whether fingerprint attributes are mutually consistent. A browser claiming Firefox must not expose `navigator.deviceMemory` or `performance.memory` (Chrome-only APIs). A Windows UA must not enumerate Linux-only fonts (`DejaVu Sans`). A `performance.now()` returning values clamped to exact 1ms steps indicates Firefox RFP (Resist Fingerprinting) is active — which no standard Firefox installation enables by default. The perfect system validates cross-attribute consistency at profile generation time and flags any combination that would fail a mutual-consistency check.

**Service Worker isolation.** Platforms and third-party anti-bot vendors can install Service Workers that persist across browser sessions within a given profile. These Service Workers can store client identifiers in their own cache scope — surviving cookie and localStorage clears — and use them to link sessions or detect profile switching. The favicon-cache supercookie technique stores unique identifiers in the browser's favicon cache, which persists even in incognito mode in some browsers. The perfect system clears or audits Service Worker registrations and favicon cache between sessions when profiles are reused. Profiles must never be shared across different target platforms — if the same profile visits eBay and Facebook and both use DataDome, the vendor can correlate sessions through SW-stored identifiers.

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

**TLS/JA4 fingerprinting is now infrastructure-level.** As of March 2025, AWS WAF and Cloudflare both offer JA4 fingerprint matching as a built-in feature — any platform behind either CDN gets JA4 bot detection without writing application code. The TLS handshake fingerprint is checked before any JavaScript runs. If the automation browser's JA4 hash matches a known automation tool profile, the request is blocked at the CDN edge. The perfect system's browser engine produces a JA4 fingerprint indistinguishable from the declared browser version. This must be verified periodically — not assumed — because CDN vendors update their JA4 hash databases continuously.

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

**Per-account behavioral parameter profiles.** eBay's BehaviorClustering system (published January 2025) uses GPU-powered HDBSCAN clustering to link accounts whose click-stream sequences are statistically similar — even when they share no IP, device, or payment method. Commercial vendors like Sardine compute a "Same User Score" from typing cadence, mouse movement patterns, and session flow. If multiple automated accounts use the same behavioral parameters (typing speed range, pause distribution, mouse curve coefficients), their sessions will cluster together and expose them as related. The perfect system generates a unique behavioral parameter profile at account creation time — stored alongside the fingerprint identity — with account-specific distributions for:
- Typing speed: mean and standard deviation (e.g., account A: μ=180ms σ=45ms; account B: μ=220ms σ=55ms)
- Inter-field pause: mean and range
- Mouse curve overshoot magnitude
- Scroll chunk size distribution
- Typo frequency and correction delay
These parameters are loaded at session start and used by all behavioral simulation functions.

**Paste-vs-compose detection.** Fraud detection vendors (Sardine, confirmed) specifically track whether text was composed character-by-character or pasted from the clipboard. "Copy and paste of long-term memory fields" is explicitly listed as a high-risk signal. Even simulated typing via `page.keyboard.type()` may not fully replicate the timing patterns of genuine composition — real humans pause to think between clauses, vary speed within a sentence, and occasionally delete and rephrase. The perfect system never uses clipboard paste, `page.fill()`, `element.value = text`, or any other value-injection method for any user-visible text field. All text entry uses character-by-character keyboard input with composition-aware pauses (longer pauses at sentence boundaries, shorter pauses mid-word).

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

**Offer cancellation rate monitoring (Mercari).** Mercari actively tracks seller cancellation rates and applies account restrictions — including listing removal, cancellation fees (5% of item price, max $25), and account suspension — when cancellations exceed an unpublished threshold. For multi-platform sellers using VaultLister, the primary risk is inventory sync lag: an item sells on Platform A, but an offer accepted on Mercari must then be cancelled because the item is no longer available. The perfect system never auto-accepts offers when inventory sync status is uncertain. Before accepting any offer, the system verifies real-time inventory availability across all platforms. Per-account cancellation rate is tracked, and offer acceptance is paused if the rate approaches the warning threshold.

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

**Off-platform payment and contact keyword blocklist.** Depop (confirmed) automatically scans listing descriptions and messages for payment service names and social platform handles, suspending accounts that mention them — even in negation ("I don't have Venmo" has triggered bans). The perfect content scanner blocks or warns on any listing text containing: Venmo, Zelle, Cash App, CashApp, PayPal F&F, PayPal Friends, Interac e-Transfer, Apple Pay (as payment instruction), Google Pay (as payment instruction), Instagram, WhatsApp, Telegram, Signal, Discord, "DM me", "text me", or any phone number variant. This applies to all platforms, not just Depop — Facebook and Mercari have similar policies against off-platform transactions.

**PDQ perceptual hash duplicate detection.** Meta's PDQ hash (256-bit, DCT-based, open-sourced 2019) is deployed at scale for content matching. The perfect content scanner computes a PDQ hash for every listing image before submission and checks it against: (a) all images previously submitted by this account, (b) all images submitted by any account managed by this operator, and (c) a local database of known-flagged images. PDQ is more collision-resistant than standard pHash and should be used instead of (or in addition to) pHash for pre-flight duplicate checking. Images that produce PDQ hash collisions with previously submitted images on any account are blocked.

**Etsy-specific image authenticity requirements.** Etsy's automated enforcement system (enhanced June 2025) performs reverse image searches across the internet and uses AI to analyze visual content for policy violations. Listing images found elsewhere online — stock photos, wholesale catalog images, AI-generated product renders — are flagged and removed. The perfect system enforces that all listing images for Etsy are original photographs taken by the seller. Images must not be sourced from stock databases, AI image generators, manufacturer product shots, or any third-party catalog. A perceptual hash check against known stock image databases should run as a pre-flight step for Etsy-bound listings.

**Output:** The scanner produces a PASS, WARN, or BLOCK result. BLOCK listings are never submitted and require manual review. WARN listings are submitted but flagged for follow-up. All results are logged to the audit trail.

---

## 9. Cross-Platform Intelligence (Layer 9)

### The Problem

Facebook Marketplace does not exist in isolation. Other marketplaces — eBay, Poshmark, Mercari, Depop, Grailed — deploy overlapping detection systems, and signals that flag automation on those platforms often predict Facebook's detection evolution. A seller automating on multiple platforms simultaneously faces correlated risk: a ban on one platform may trigger scrutiny on others if the platforms share fraud-intelligence data or if the seller's operational patterns are consistent across platforms.

Cross-platform intelligence means understanding and defending against detection methods observed across the broader marketplace ecosystem, even where Facebook has not been publicly confirmed to use them yet. Assuming Facebook does not use a signal that every other major marketplace uses is a losing bet.

### Cross-Platform Detection Signals

**Device ID and hardware fingerprint linking.** eBay and Mercari track persistent device identifiers — advertising IDs on mobile, hardware serial numbers where available, and platform-generated client IDs stored in IndexedDB and localStorage that survive cookie clears. If two accounts share the same device identifier, both are flagged as related. On desktop, this manifests as persistent browser storage keys that the platform's JavaScript writes on first visit and checks on every subsequent visit. The perfect system ensures that each account's browser profile has a completely isolated storage footprint — no shared IndexedDB keys, no leaked `clientId` values, no shared service worker registrations. Device IDs generated by the platform's JavaScript must be unique per account and stable across sessions. Browser profile isolation (Layer 3) is the primary defense, but the system must also audit persistent storage after each session to detect any cross-account leakage.

**Bank account and payment method linking.** Poshmark, eBay, and Mercari cross-reference payment methods — bank accounts, PayPal emails, credit card BIN + last-four fingerprints — across all accounts on the platform. Two accounts linked to the same bank account are immediately flagged as a coordinated operation, regardless of how clean their browser fingerprints and behavioral patterns are. This is the single hardest signal to defeat because it operates entirely outside the browser layer. The perfect system mandates that each automated account uses a completely distinct payment method — no shared bank accounts, no shared PayPal emails, no shared card numbers. This is an operational constraint, not a technical one; no amount of browser automation can mask shared financial instruments. Operators must be warned at account setup time that payment method reuse across accounts is a permanent, irrevocable linking signal.

**SSN and identity document linking.** Platforms that require identity verification — eBay (for managed payments), Poshmark (for Direct Deposit), Mercari (for high-value items or payout thresholds) — link government-issued IDs and tax identification numbers across accounts. Two accounts verified with the same SSN, driver's license, or passport number are permanently linked in the platform's identity graph. This link survives account deletion, name changes, and all other forms of obfuscation. The perfect system operates within the hard constraint that each automated account must be backed by a distinct legal identity if identity verification is ever required. Attempting to reuse the same identity across multiple automated accounts defeats every other isolation measure in this document. The system should track which accounts have undergone identity verification and never run those accounts from shared infrastructure.

**Relist-to-delist ratio monitoring.** eBay and Depop monitor the ratio of relisted items to organically new listings. An account that deletes and immediately relists the same items on a recurring cycle — to game search freshness algorithms — triggers a velocity anomaly flag. The pattern is distinctive: high delist rate + high relist rate + same item titles/photos reappearing = systematic manipulation. The perfect system enforces:
- Maximum relist frequency per item: no more than once per 14 days
- Relist timing variation: spread across days, never batch all relists into one session
- Daily relist cap: never delete and relist more than 20% of active listings in a single day
- Title and photo variation on relist: change at least the title phrasing and lead photo when relisting to break exact-match duplicate detection
- Relist patterns should mimic a seller who occasionally refreshes stale listings, not one who systematically cycles inventory on a schedule

**AI-generated content detection and bot ban policies.** Mercari, Depop, and Poshmark explicitly prohibit AI-generated listing descriptions in their terms of service. Facebook's Commerce Policies reserve the right to reject listings produced by automated tools. Platforms are deploying NLP classifiers trained to detect AI-generated text — looking for telltale patterns: excessive hedging language, formulaic bullet-point structures, unnaturally polished grammar, and repetitive sentence openers. The perfect system's AI-generated descriptions must be indistinguishable from human-written text:
- Varied sentence structure (mix of short declarative sentences and longer compound ones)
- Natural imperfections (occasional sentence fragments, informal punctuation, brand-appropriate slang)
- No AI-telltale patterns (avoid "This [item] features...", "Perfect for...", "Whether you're..." openers)
- Match the seller's historical writing style (if the account has prior manual listings, analyze their tone and replicate it)
- Pass descriptions through a humanization layer before submission: vary punctuation, introduce minor grammatical variations, adjust formality level per platform
- Never submit identical AI-generated descriptions across multiple platforms — each platform version should be distinctly worded

**Intent-based session classification (DataDome, deployed April 2025).** Commercial WAF vendor DataDome announced intent-based AI models that classify sessions not by fingerprint or behavior alone, but by what the session is attempting to accomplish. A session that navigates directly to a listing creation form, fills it out, submits, and exits exhibits mechanically direct intent that no organic user shows — real users browse, get distracted, compare listings, and arrive at the creation form as one step in a longer session. This applies beyond Facebook: any platform behind DataDome, Akamai, or similar WAF services benefits from intent classification. The perfect system ensures that every automation session on every platform includes organic pre-task and post-task browsing activity — not just on Facebook (where Layer 5 already specifies warmup), but on eBay, Poshmark, Mercari, Depop, and all other target platforms.

**Cross-account behavioral clustering (eBay BehaviorClustering, published January 2025).** eBay deploys a GPU-powered behavioral clustering system that links accounts based on statistical similarity of click-stream sequences — a "soft link" graph that operates independently of shared devices, IPs, or payment methods. If multiple automated accounts execute the same Playwright script with the same timing parameters, their behavioral sequences cluster together and expose them as a coordinated operation. Sardine's "Same User Score" offers equivalent capability to any platform using their SDK. The defense is described in Layer 5 (per-account behavioral parameter profiles): each account's behavioral distributions must be distinct and stored permanently, not drawn from a shared range at runtime.

---

## 10. Monitoring Dashboard

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

## 11. Gap Analysis: Current Implementation vs the Perfect System

This section is a candid assessment. Knowing the gap is how we prioritize what to build next.

| Layer | Perfect System | Current Implementation | Gap |
|-------|---------------|----------------------|-----|
| **1 — Chrome Extension** | Pre-fills Facebook Marketplace listing form in user's own browser; zero detection risk | Extension exists (`src/extension/`) with Facebook Marketplace host permission; content script injects import button. **No Facebook listing form pre-fill implemented.** | Extension infrastructure exists but cross-listing via the extension is not implemented for Facebook. No automation risk at this layer — but also no functionality. |
| **2 — Anti-Detect Browser Engine** | Real unmodified browser binary; zero CDP leaks; same-day version updates; no automation artifacts; resistance to named detection profiles | Camoufox (Firefox-based anti-detect browser, `launchCamoufox()` in `stealth.js`). `puppeteer-extra-plugin-stealth` applied to Chromium path. `injectChromeRuntimeStub()` fills the partial `chrome.runtime` gap. | Camoufox is a real Firefox derivative with good anti-detect properties but is not an unmodified browser. `chrome.runtime` stub is hand-written and will score failures on strict tests like CreepJS. No same-day update automation. TLS/JA4 and HTTP/2 SETTINGS authenticity unverified — **JA4 is now passive at CDN level (AWS WAF + Cloudflare, March 2025)**. DataDome has published a **named Camoufox detection profile** targeting Canvas/WebGL/AudioContext/timezone coherence. |
| **3 — Fingerprint Identity System** | One permanent fingerprint per account; all components internally consistent and geo-derived; stable canvas/WebGL hashes | `stealthContextOptions()` generates a UA + viewport + locale + timezone per session from fixed pools. Navigator hardware properties are randomized per session (not per account). Canvas/WebGL are patched by Camoufox and stealth plugin. No per-account fingerprint persistence. | UA, viewport, locale, and timezone are randomized each session rather than fixed per account. No fingerprint record stored in the database. Hardware concurrency and device memory change every session. No geographic coherence enforcement between proxy IP and fingerprint timezone. |
| **4 — Network Layer** | Sticky residential proxy per account; DNS and TLS through proxy; WebRTC blocked; IPv6 disabled; no page.route() on FB requests | `FACEBOOK_PROXY_URL` env var fed to Camoufox. `block_webrtc: true` set in Camoufox options. `page.route()` calls removed (2026-04-15) — Camoufox's built-in uBlock Origin handles analytics blocking. No per-account proxy assignment — all accounts share one proxy URL. | Single shared proxy URL means multiple accounts share one IP. No per-account sticky proxy assignment. ~~`page.route()` detection vector~~ **RESOLVED** (removed 2026-04-15). DNS leak status unverified. |
| **5 — Behavioral Simulation Engine** | 3-5 minute session warmup; 4-8 minutes per listing; natural typing with typos; drag-and-drop photo upload; dropdown scroll behavior; per-account behavioral parameter profiles; paste-vs-compose awareness | `humanType()` types at 50-150ms per character. `humanClick()` uses bezier-ish mouse movement with overshoot. `humanScroll()` chunks scrolls. `mouseWiggle()` adds inter-action movement. `jitteredDelay()` adds ±30% to base delays. | ~~No session warmup~~ **PARTIALLY RESOLVED** (2026-04-15): `warmup()` browses homepage feed + marketplace listings before automation. Still missing: typos, drag-and-drop upload, dropdown scroll, post-listing browsing, inter-listing idle. Typing speed (50-150ms) is uniform — no sentence-level pauses, no typos. No dropdown scroll simulation. No drag-and-drop photo upload. No post-listing verification browsing. No inter-listing idle periods. Total listing time well under the 3-minute minimum. **No per-account behavioral parameter profiles** — all accounts share the same typing/pause/mouse distributions, enabling cross-account behavioral clustering (eBay BehaviorClustering, Sardine Same User Score). `facebookPublish.js` uses `page.fill()` for clearing fields — clipboard/value-injection methods are tracked by behavioral biometrics vendors. |
| **6 — Account Lifecycle Manager** | 30-day warmup; gradual velocity ramp; rest days; one IP + profile + fingerprint per account | `minAccountAgeDays` check in rate limits (configurable, default 3). Daily listing cap: 10/day (`maxListingsPerDay`). Login cap: 3/day. Per-profile usage tracking via `browser-profiles.js`. Profile pool of 3. | No structured warmup phase (30-day warmup is enforced only by `minAccountAgeDays`, which defaults to 3). No velocity ramp — the full 10/day cap applies from day 4. No rest days enforced. No social activity warmup (browsing, liking, messaging). No account-to-profile-to-proxy binding persisted in the database. |
| **7 — Detection Response System** | Immediate halt on any anomaly; 24h escalating cooldown; escalation to quarantine on 3 events; alerting; audit trail | CAPTCHA detection throws an error and halts the session. Checkpoint/lockout URLs detected and cause immediate stop. Profile is flagged in `profiles.json` after detection. Audit log entry written. | No cooldown timer stored or enforced — a flagged profile could be manually unflagged and reused immediately. No escalating schedule. No email/in-app alerting. No automatic cooldown period enforcement. No cross-account detection event aggregation (platform-wide event detection absent). |
| **8 — Content Safety Scanner** | Pre-flight scan for prohibited words, image duplicates, NSFW, URLs/phone numbers in text, pricing sanity; off-platform payment keyword blocklist; Etsy image authenticity checks | Not implemented. No pre-flight content scanner exists. | Entire layer absent. Content is submitted to Facebook's moderation AI with no pre-screening. External URLs, phone numbers, duplicate photos, and placeholder prices are all submitted unchecked. No off-platform payment keyword blocklist (Depop auto-bans for mentioning Venmo/CashApp/etc). No Etsy image reverse-search pre-screening. |
| **9 — Cross-Platform Intelligence** | Per-account isolated storage auditing; distinct payment methods per account; distinct legal identities per account; relist ratio caps (1 per 14 days per item, 20% daily cap); AI text humanization layer; no cross-platform description reuse | No storage isolation auditing. No payment method or identity linking warnings. No relist ratio enforcement. AI descriptions from `@anthropic-ai/sdk` are used directly with no humanization pass. No cross-platform description deduplication. | Entire layer absent. No operational guidance for payment/identity isolation. No relist velocity controls beyond the daily listing cap. AI-generated text goes directly to Facebook with no humanization or per-platform variation. |
| **Monitoring Dashboard** | Per-account health, detection events, velocity metrics, proxy health, cooldown status | Basic `getStats()` on `FacebookBot` returns runtime session counts (refreshes, relists, errors). Admin backend likely has some monitoring but no Facebook-specific health view. | No monitoring dashboard for Facebook automation health. No per-account health scores. No detection event history view. No proxy health checks. No cooldown status display. |

### Summary of the Biggest Gaps

Ranked by detection risk, not implementation complexity:

1. ~~**No session warmup**~~ — **PARTIALLY RESOLVED** (2026-04-15). `warmup()` method added to `FacebookBot` (homepage feed scroll → marketplace sidebar → browse 2-3 listings). `facebookPublish.js` now browses homepage and marketplace before navigating to the create form. Not yet a full 3-5 minute warmup with post-listing verification, but eliminates the "direct navigation to listing creation" signal.

2. ~~**No per-account sticky proxy assignment**~~ — **PARTIALLY RESOLVED** (2026-05-02). `browser-profiles.js` exposes `setProfileProxy(id, proxyUrl)` to assign a distinct proxy per profile, and `validateProfiles()` warns when multiple profiles share the same proxy URL. The infrastructure is in place; full resolution requires the operator to configure distinct residential proxy endpoints per account in `profiles.json`.

3. ~~**Fingerprints are session-random, not account-persistent**~~ — **RESOLVED** (2026-05-02). `stealth.js:346-371` saves a `.fingerprint-config.json` into each profile's `user_data_dir` on first launch and reloads it on subsequent launches. Timezone, locale, and hardware properties are stable across sessions per profile.

4. ~~**`page.route()` blocks Facebook analytics requests**~~ — **RESOLVED** (2026-04-15). `page.route()` calls removed from both `facebook-bot.js` and `facebookPublish.js`. Camoufox's built-in uBlock Origin handles analytics blocking without detection risk.

5. ~~**No Content Safety Scanner**~~ — **PARTIALLY RESOLVED** (2026-04-15). `contentSafetyScanner.js` added with payment keyword blocklist, URL/phone/email pattern detection, price sanity, ALL CAPS detection, title/description checks. Wired into all 9 platform publish paths. Still missing: PDQ image hash, NSFW classifier.

6. ~~**No rest days or velocity ramp**~~ — **RESOLVED** (2026-04-15). Rest day enforced when 6+ active days in last 7. Velocity ramp: 2/day (days 1-7), 4/day (8-14), 6/day (15-30), 10/day (31+).

7. ~~**No AI description humanization**~~ — **RESOLVED** (2026-05-02). `src/shared/ai/humanize-text.js` implements 5 humanization passes (opener variation, punctuation variation, contractions, platform tone, trailing period drop). `listing-generator.js:686` calls `humanizeDescription(r.description, { platform })` for every generated description before returning.

8. ~~**No relist ratio enforcement**~~ — **RESOLVED** (2026-04-15). Per-item relist frequency tracked in `.fb-relist-tracker.json` — max once per 14 days. Auto-prunes entries older than 30 days.

9. ~~**No payment method or identity isolation guidance**~~ — **RESOLVED** (2026-05-02). Dismissible warning banner added to My Shops page (pages-deferred.js, commit b72ce6b0) — renders when 2+ accounts are connected, reminding operators to use separate payment methods, emails, and identity documents per account.

10. **DataDome has a named Camoufox detection profile** — DataDome publishes specific detection pages for anti-detect browsers including Camoufox, targeting Canvas/WebGL coherence, AudioContext signatures, and timezone consistency. Any platform behind DataDome has Camoufox-specific fingerprint checks. **Maintenance cadence: retest monthly** against https://antoinevastel.com/bots/datadome and https://bot.sannysoft.com/ from Railway (Linux). If score degrades, evaluate CloverLabsAI/camoufox upgrade (FF146, see item 17) or Patchright as Chromium fallback. Platforms confirmed behind DataDome: Depop, Grailed.

11. ~~**No per-account behavioral parameter profiles**~~ — **RESOLVED** (2026-04-15). `getProfileBehavior()` generates unique typing speed, pause, mouse overshoot, typo frequency per profile. `humanType()` uses gaussian speed + mid-typing pauses + occasional typos. Params persisted in `profiles.json`.

12. **JA4 fingerprinting is now passive at CDN infrastructure level** — AWS WAF (March 2025) and Cloudflare offer JA4 hash matching as a built-in feature. Camoufox's JA4 fingerprint has not been verified against target platform CDNs. A block at the CDN edge prevents any JavaScript from running.

13. ~~**No off-platform payment keyword blocklist**~~ — **RESOLVED** (2026-04-15). `contentSafetyScanner.js` blocks 20+ payment/contact keywords (Venmo, CashApp, PayPal F&F, Instagram, WhatsApp, etc). Depop-specific warning included.

14. **No Mercari cancellation rate tracking** — multi-platform inventory sync lag can cause accepted offers to be cancelled on Mercari, accumulating against the account's health score independently of bot detection.

15. **CDP serialization leak** — TOOLING BUILT (`fingerprint-self-test.js` tests for `JSON.stringify` getter leak). Run on Railway/Linux to verify. Cannot run on Windows (Camoufox instability).

16. **WebGPU adapter info** — TOOLING BUILT (`fingerprint-self-test.js` checks WebGPU adapter vendor/device). Run on Railway to verify whether Camoufox overrides the software renderer string.

17. **Camoufox upgrade path identified** — EVALUATED (2026-04-15). CloverLabsAI/camoufox **is the official continuation** (daijro's README links to it). Firefox 146 base (vs our 135), per-context fingerprint isolation (8 C++ patches), hardware spoofing per context. Available via `cloverlabs-camoufox` pip package (v0.5.5). No npm package yet — `camoufox-js` is hardcoded to daijro's FF135 builds. **Migration path**: use `cloverlabs-camoufox` Python package on Railway, or manually point `camoufox-js` at the FF146 binary via `executablePath`. Issue #328 remains open in both forks.

18. ~~**Service Worker / favicon supercookie persistence**~~ — **RESOLVED** (2026-04-15). `cleanProfileServiceWorkers()` clears SW registrations and favicon cache from profile dirs. Called in `FacebookBot.init()` before every session.

19. **Desktop listings algorithmically penalized** — Facebook gives app-created listings ~23% more impressions than desktop-created ones. Playwright automation creates desktop listings by definition, reducing visibility even when detection is avoided. The Chrome extension path does not have this penalty (it runs in the user's real mobile or desktop browser). This reinforces the Chrome extension as the primary recommended path. **No code fix possible** — inherent to desktop automation.

20. ~~**No PDQ hash pre-flight checking**~~ — **RESOLVED** (2026-04-15). `imageHasher.js` provides SHA-256 exact duplicate detection, cross-account reuse blocking, and within-submission duplicate detection. Wired into `facebookPublish.js`. Image hashes recorded after successful publish and auto-pruned at 90 days.

21. **FIRE/GSE cross-industry IP reputation** — Meta's IP reputation checking now draws from 370M+ threat signals across 230+ organizations including 50+ banks. Datacenter and VPN IPs are flagged before reaching Marketplace. Per-profile proxy assignment is implemented (`getProfileProxy()`), but purchasing residential proxies is an operational requirement. **No code fix** — requires proxy service subscription.

### Diagnostic Tools

Two self-test tools are available to verify configuration before going live:

1. **`worker/bots/anti-detection-diagnostic.js`** — Checks profiles, proxy isolation, rate limits, env vars, cooldown status, camoufox-js version. Runs without Camoufox. Usage: `bun worker/bots/anti-detection-diagnostic.js`

2. **`worker/bots/fingerprint-self-test.js`** — Launches Camoufox and tests for CDP serialization leak, navigator.webdriver, Chrome-only API exposure, WebGL/WebGPU renderer, performance.now() RFP clamping, UA consistency, canvas hash stability, fingerprint config persistence. Requires Camoufox (Linux/Railway only). Usage: `bun worker/bots/fingerprint-self-test.js`

---

## Appendix: What Requires Paid Services or Is Not Fully Achievable

**Residential proxy with per-account sticky sessions** — residential proxy providers charge per GB of data or per IP. A true residential proxy (Oxylabs, Smartproxy, Bright Data residential) costs roughly $3-15/GB. Shared datacenter or VPN proxies are not equivalent and will not produce the same trust signal. This is a hard cost of doing multi-account automation at scale. No free alternative exists.

**Real unmodified browser binary** — using an unmodified Chrome or Firefox binary while driving it programmatically (without CDP leaking) is not achievable with current open-source tools. CDP is the mechanism by which Playwright controls the browser, and it leaves detectable artifacts. Camoufox is currently the closest open-source approximation. Commercial anti-detect browsers (AdsPower, Multilogin, GoLogin) use patched binaries that are closer to unmodified but still not identical. True zero-artifact automation using an unmodified binary would require OS-level input injection (not currently supported by any cross-platform framework).

**Canvas and WebGL deterministic fingerprints matching real hardware** — making a server's GPU produce the same canvas hash as a specific real laptop is not achievable. The best achievable outcome is a stable, account-specific hash that is consistent across sessions — which is sufficient. It will not match a known real-device hash, but it will appear consistent rather than randomly changing.

**TLS/JA4 fingerprint matching the declared browser exactly** — when using a proxy CONNECT tunnel, the TLS client hello is generated by the browser itself (Camoufox/Firefox), so the JA4 fingerprint is Firefox's, regardless of what user agent is declared. Chrome fingerprints with a Firefox JA3/JA4 are detectable at the network layer by any system that logs TLS handshakes. Matching TLS fingerprint to browser UA requires using a browser whose TLS stack matches the declared UA — which is one reason Camoufox (Firefox-based) should be declared as Firefox rather than Chrome.

**Facebook warmup social activity automation** — automating the warmup activities (liking posts, messaging sellers, joining groups) carries its own detection risk and its own rate limits. The warmup phase is safer when performed manually by a human operator during the account's first month. Automating warmup is the second-order problem; it is achievable in principle but adds significant complexity to Layer 6.

**Content moderation AI avoidance** — Facebook's image-based content moderation AI cannot be defeated by any pre-screening system; it can only be anticipated. A local NSFW classifier can catch obvious violations, but Facebook's models detect subtle violations (partial brand logos, specific patterns associated with counterfeits, images matching previously flagged listings) that no local model can replicate. Pre-screening reduces false positives but does not eliminate them.

**Camoufox engine status and upgrade path (evaluated April 2026).** The official `daijro/camoufox` stable release is Firefox 135.0.1-beta.24 — frozen since March 2025. **CloverLabsAI/camoufox is the official continuation** (daijro's README links to it as the active development home). Key differences:

| | daijro (current) | CloverLabsAI (upgrade) |
|--|---|---|
| Firefox | 135.0.1 | 146.0.1 |
| Per-context fingerprints | No | Yes (8 C++ patches) |
| Hardware spoofing per context | No | Yes |
| pip package | `camoufox` | `cloverlabs-camoufox 0.5.5` |
| npm (camoufox-js) | Yes (Apify, v0.10.2) | No — manual `executablePath` only |
| Platform builds | Win/Mac/Linux | Linux + macOS arm64 only |
| Issue #328 (fingerprint consistency) | Open | Open |

**Migration path for VaultLister**: Railway runs Linux, so the CloverLabsAI Linux builds are compatible. Install via `pip install cloverlabs-camoufox` on Railway, or download the FF146 binary and configure `camoufox-js` with a custom `executablePath`. The per-context fingerprint isolation feature directly addresses our Gap #3 (fingerprint persistence) — each BrowserContext gets a unique, deterministic fingerprint via 16 `window.setXxx()` init functions that self-destruct after first call.

**Chromium alternatives** worth monitoring if Firefox-based detection becomes untenable:
- **Patchright** — 22 AST-modified Playwright patches for Chromium, passing DataDome/Cloudflare/CreepJS (Chromium-only)
- **CloakBrowser** — C++-level Chromium source patches compiled into custom binary, 30/30 bot tests passed (Chromium-only)
- **rebrowser-patches** — patches Playwright's Node.js code to eliminate `Runtime.Enable` CDP detection vector (Chromium-only)

Switching to Chromium would provide higher market-share camouflage (Chrome's TLS/JA4 fingerprint is far more common than Firefox's) but requires updating all fingerprint assumptions.
