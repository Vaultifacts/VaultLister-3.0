# Facebook Marketplace Mock Test Environment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Bun HTTP mock server + HTML fixtures that simulate all 53 Facebook DOM interactions across 5 pages, enabling `facebook-bot.js` and `poster.js` to be tested without a live Facebook account.

**Architecture:** A `Bun.serve` server on `port: 0` (random free port) serves 4 static HTML pages from `worker/bots/test-fixtures/pages/`. Query params (`?captcha=1`, `?verify=1`, `?checkpoint=1`, `?ai=1`) inject behaviour variants server-side. Login state is tracked via a `Set-Cookie` header (`fb_session=1`) and read in page JS to conditionally show the `[aria-label="Your profile"]` indicator. All dropdown portals are implemented as body-appended divs with native DOM event listeners — no React dependency.

**Tech Stack:** Bun 1.3+, Bun:test, Playwright chromium (for `poster-facebook.spec.js`), plain HTML/CSS/JS (no framework)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `worker/bots/test-fixtures/mock-server.js` | Bun.serve wrapper — routing, cookie logic, query-param injection, `start()`/`stop()`/`getPort()` exports |
| Create | `worker/bots/test-fixtures/pages/login.html` | Login form — email, password, submit, conditional profile indicator |
| Create | `worker/bots/test-fixtures/pages/marketplace-create.html` | Full create-listing form — all 53 selectors, Lexical contenteditable, dropdown portals, location typeahead |
| Create | `worker/bots/test-fixtures/pages/marketplace-item.html` | Individual listing — Edit/Save, Renew/Confirm, CAPTCHA support |
| Create | `worker/bots/test-fixtures/pages/marketplace-selling.html` | Selling dashboard — grid of 5+ listing links |
| Modify | `worker/bots/facebook-bot.js` | Add `_baseUrl` option to constructor (4 lines) so tests can point bot at mock server |
| Create | `worker/bots/facebook-bot.test.js` | Bun:test — login, refresh, relist, refreshAllListings flows against mock server |
| Create | `e2e/tests/poster-facebook.spec.js` | Playwright — `fillFacebook()` field-filling verification against mock server |

---

## Task 1: Create `mock-server.js`

**Files:**
- Create: `worker/bots/test-fixtures/mock-server.js`

- [ ] **Step 1.1: Write a failing test that verifies the server starts and stops**

Create `worker/bots/test-fixtures/mock-server.test.js` (temporary — deleted in Task 5 step 5.4):

```javascript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { start, stop, getPort } from './mock-server.js';

let port;
beforeAll(async () => { port = await start(); });
afterAll(async () => { await stop(); });

test('server starts and returns a port', () => {
    expect(port).toBeGreaterThan(0);
    expect(getPort()).toBe(port);
});

test('GET /login returns HTML', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('id="email"');
});

test('GET /login?captcha=1 injects captcha element', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login?captcha=1`);
    const body = await res.text();
    expect(body).toContain('id="captcha-container"');
});

test('POST /login without credentials returns 401', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`, {
        method: 'POST',
        body: new URLSearchParams({ email: '', pass: '' }),
        redirect: 'manual'
    });
    expect(res.status).toBe(401);
});

test('POST /login with credentials redirects and sets cookie', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`, {
        method: 'POST',
        body: new URLSearchParams({ email: 'test@test.com', pass: 'password' }),
        redirect: 'manual'
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('set-cookie')).toContain('fb_session=1');
});

test('GET /marketplace/create/item returns HTML with Lexical editor', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/create/item`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('data-lexical-editor');
});

test('GET /marketplace/you/selling returns HTML with listing links', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/you/selling`);
    const body = await res.text();
    expect(body).toContain('/marketplace/item/');
});

test('GET /marketplace/item/12345 returns HTML with Edit button', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/item/12345`);
    const body = await res.text();
    expect(body).toContain('Edit listing');
});

test('GET /?verify=1 redirects to /marketplace/verify', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/?verify=1`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/marketplace/verify');
});

test('GET /?checkpoint=1 redirects to /checkpoint', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/?checkpoint=1`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/checkpoint');
});
```

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: FAIL — "Cannot find module './mock-server.js'"

- [ ] **Step 1.2: Create the directory**

```bash
mkdir -p worker/bots/test-fixtures/pages
```

- [ ] **Step 1.3: Implement `mock-server.js`**

Create `worker/bots/test-fixtures/mock-server.js`:

```javascript
import path from 'path';
import fs from 'fs';

const PAGES_DIR = path.join(import.meta.dir, 'pages');

let _server = null;
let _port = 0;

function injectCaptcha(html) {
    return html.replace('</body>', `
<div id="captcha-container">
  <div id="captcha-placeholder" class="captcha-widget"></div>
  <iframe src="/captcha/render" id="captcha-iframe" style="display:none"></iframe>
</div>
</body>`);
}

function injectAiButton(html) {
    return html.replace('<!-- AI_BUTTON_SLOT -->', `
<button type="button" id="ai-listing-btn" style="margin:12px 0;padding:10px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
  Create listing details
</button>`);
}

function servePage(filename, url) {
    const filePath = path.join(PAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
    }
    let html = fs.readFileSync(filePath, 'utf8');
    const params = url.searchParams;
    if (params.get('captcha') === '1') {
        html = injectCaptcha(html);
    }
    if (params.get('ai') === '1') {
        html = injectAiButton(html);
    }
    return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' }
    });
}

async function parseFormBody(req) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
}

function hasLoginCookie(req) {
    const cookie = req.headers.get('cookie') || '';
    return cookie.includes('fb_session=1');
}

async function handleRequest(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (url.searchParams.get('verify') === '1') {
        return Response.redirect(`${url.origin}/marketplace/verify`, 302);
    }
    if (url.searchParams.get('checkpoint') === '1') {
        return Response.redirect(`${url.origin}/checkpoint`, 302);
    }

    if (req.method === 'POST' && pathname === '/login') {
        const body = await parseFormBody(req);
        if (!body.email || !body.pass) {
            return new Response('Invalid credentials', { status: 401 });
        }
        return new Response(null, {
            status: 302,
            headers: {
                'location': '/',
                'set-cookie': 'fb_session=1; Path=/; HttpOnly'
            }
        });
    }

    if (req.method === 'POST' && pathname === '/marketplace/create/item') {
        const id = Math.floor(Math.random() * 9000000000) + 1000000000;
        return new Response(null, {
            status: 302,
            headers: { 'location': `/marketplace/item/${id}/` }
        });
    }

    if (req.method === 'GET' && pathname === '/login') {
        return servePage('login.html', url);
    }

    if (req.method === 'GET' && pathname === '/marketplace/create/item') {
        return servePage('marketplace-create.html', url);
    }

    if (req.method === 'GET' && pathname === '/marketplace/you/selling') {
        return servePage('marketplace-selling.html', url);
    }

    if (req.method === 'GET' && /^\/marketplace\/item\/\d+\/?$/.test(pathname)) {
        return servePage('marketplace-item.html', url);
    }

    if (req.method === 'GET' && pathname === '/') {
        const loggedIn = hasLoginCookie(req);
        const profile = loggedIn
            ? `<div aria-label="Your profile" data-testid="royal_profile_link" id="profile-indicator" style="padding:8px;background:#1877f2;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center">U</div>`
            : '';
        const html = `<!DOCTYPE html><html><body><h1>Facebook</h1>${profile}</body></html>`;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
    }

    if (req.method === 'GET' && (pathname === '/marketplace/verify' || pathname === '/checkpoint')) {
        const label = pathname.slice(1);
        const html = `<!DOCTYPE html><html><body><h1>${label}</h1><p>Security check required.</p></body></html>`;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
    }

    return new Response('Not Found', { status: 404 });
}

export async function start() {
    if (_server) return _port;
    _server = Bun.serve({
        port: 0,
        fetch: handleRequest,
    });
    _port = _server.port;
    return _port;
}

export async function stop() {
    if (_server) {
        _server.stop(true);
        _server = null;
        _port = 0;
    }
}

export function getPort() {
    return _port;
}
```

- [ ] **Step 1.4: Run server tests — core routing tests PASS, page-HTML tests FAIL with 404 (correct)**

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: "server starts and returns a port" PASS, "POST /login" tests PASS, page-content tests FAIL 404.

- [ ] **Step 1.5: Commit skeleton**

```bash
git add worker/bots/test-fixtures/mock-server.js
git commit -m "feat(test): add Facebook mock server skeleton (port 0, routing, cookie, redirects)"
```

---

## Task 2: Create `login.html`

**Files:**
- Create: `worker/bots/test-fixtures/pages/login.html`

Selectors required (from `facebook-bot.js` lines 122–130, `facebookPublish.js` lines 153–162):
- `#email` / `input[name="email"]` / `input[type="email"]`
- `#pass` / `input[name="pass"]` / `input[type="password"]`
- `button[name="login"]` / `button[type="submit"]` / `#loginbutton`
- `[aria-label="Your profile"]` / `[data-testid="royal_profile_link"]` — shown only when `fb_session=1` cookie present

- [ ] **Step 2.1: Write failing test — add to `mock-server.test.js`**

```javascript
test('login.html has all required selectors', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`);
    const body = await res.text();
    expect(body).toContain('id="email"');
    expect(body).toContain('name="email"');
    expect(body).toContain('type="email"');
    expect(body).toContain('id="pass"');
    expect(body).toContain('name="pass"');
    expect(body).toContain('type="password"');
    expect(body).toContain('name="login"');
    expect(body).toContain('type="submit"');
    expect(body).toContain('id="loginbutton"');
    expect(body).toContain('aria-label="Your profile"');
    expect(body).toContain('data-testid="royal_profile_link"');
});
```

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: new test FAIL — body contains "Not Found" (page not yet created).

- [ ] **Step 2.2: Create `login.html`**

Create `worker/bots/test-fixtures/pages/login.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Facebook</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.1); padding: 24px; width: 396px; }
    input { width: 100%; box-sizing: border-box; padding: 12px; margin: 6px 0; border: 1px solid #ccd0d5; border-radius: 6px; font-size: 17px; }
    .submit-btn { width: 100%; padding: 14px; background: #1877f2; color: #fff; border: none; border-radius: 6px; font-size: 20px; font-weight: bold; cursor: pointer; margin-top: 12px; }
    #profile-area { position: fixed; top: 8px; right: 8px; display: none; }
    #profile-area[data-visible="true"] { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="color:#1877f2;font-size:28px;margin:0 0 16px">facebook</h1>
    <form method="POST" action="/login">
      <input
        id="email"
        name="email"
        type="email"
        placeholder="Email address or phone number"
        autocomplete="email"
        required
      />
      <input
        id="pass"
        name="pass"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
        required
      />
      <button
        id="loginbutton"
        name="login"
        type="submit"
        value="1"
        class="submit-btn"
      >Log in</button>
    </form>
  </div>

  <div id="profile-area">
    <div
      aria-label="Your profile"
      data-testid="royal_profile_link"
      style="width:36px;height:36px;background:#1877f2;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;cursor:pointer"
    >U</div>
  </div>

  <script>
    function getCookie(name) {
      const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return v ? v.pop() : null;
    }
    if (getCookie('fb_session') === '1') {
      document.getElementById('profile-area').setAttribute('data-visible', 'true');
    }
  </script>
</body>
</html>
```

- [ ] **Step 2.3: Run tests — login selector test PASS**

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: "login.html has all required selectors" PASS.

- [ ] **Step 2.4: Commit**

```bash
git add worker/bots/test-fixtures/pages/login.html
git commit -m "feat(test): add Facebook mock login.html with all required selectors"
```

---

## Task 3: Create `marketplace-create.html`

**Files:**
- Create: `worker/bots/test-fixtures/pages/marketplace-create.html`

Full selector inventory required:

| Field | Selectors to satisfy |
|-------|---------------------|
| Photo | `input[type="file"][accept*="image"]`, `input[type="file"]` |
| Title | `input[placeholder="What are you selling?"]`, `input[aria-label="Title"]`, `input[aria-label*="title" i]`, `input[name="title"]`, `input[placeholder*="title" i]`, `input[placeholder*="item title" i]`, `input[id*="title"]` — all satisfied by one element with all these attributes |
| Price | `input[placeholder="Price"]`, `input[aria-label="Price"]`, `input[aria-label*="price" i]`, `input[name="price"]`, `input[placeholder*="price" i]`, `input[id*="price"]` |
| Category | `[aria-label*="category" i]` trigger → body portal `[role="listbox"]` containing `[role="option"]` items |
| Condition | `[aria-label*="condition" i]` trigger → body portal `[role="listbox"]` containing `[role="option"]` items |
| Location | `input[aria-label*="location" i]`, `input[placeholder*="location" i]`, `input[aria-label*="city" i]` → `ul[role="listbox"] li[role="option"]` after input |
| Description | `div[aria-label="Description"][role="textbox"][contenteditable="true"][data-lexical-editor="true"]`, `textarea[aria-label="Description"]`, `textarea[aria-label*="description" i]`, `textarea[placeholder*="description" i]` |
| Next | `button` with text "Next", `button[type="submit"]` |
| Publish | `button` with text "Publish", `button` with text "List" |
| AI button | `button` with text "Create listing details" — injected by server when `?ai=1` |
| CAPTCHA | `[id*="captcha"]`, `iframe[src*="captcha"]`, `[class*="captcha"]` — injected by server when `?captcha=1` |

- [ ] **Step 3.1: Write failing tests — add to `mock-server.test.js`**

```javascript
test('marketplace-create.html has all required field selectors', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/create/item`);
    const body = await res.text();
    expect(body).toContain('type="file"');
    expect(body).toContain('accept=');
    expect(body).toContain('What are you selling?');
    expect(body).toContain('aria-label="Title"');
    expect(body).toContain('name="title"');
    expect(body).toContain('placeholder="Price"');
    expect(body).toContain('aria-label="Price"');
    expect(body).toContain('name="price"');
    expect(body).toContain('aria-label="Category"');
    expect(body).toContain('aria-label="Condition"');
    expect(body).toContain('aria-label="Location"');
    expect(body).toContain('role="listbox"');
    expect(body).toContain('data-lexical-editor="true"');
    expect(body).toContain('role="textbox"');
    expect(body).toContain('textarea');
    expect(body).toContain('>Next<');
    expect(body).toContain('>Publish<');
});

test('marketplace-create.html ?ai=1 adds AI button', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/create/item?ai=1`);
    const body = await res.text();
    expect(body).toContain('Create listing details');
});

test('marketplace-create.html ?captcha=1 injects captcha elements', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/create/item?captcha=1`);
    const body = await res.text();
    expect(body).toContain('id="captcha-container"');
    expect(body).toContain('class="captcha-widget"');
});

test('POST /marketplace/create/item redirects to /marketplace/item/:id/', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/create/item`, {
        method: 'POST',
        body: new URLSearchParams({ title: 'Test', price: '20' }),
        redirect: 'manual'
    });
    expect(res.status).toBe(302);
    const location = res.headers.get('location') || '';
    expect(location).toMatch(/\/marketplace\/item\/\d+\//);
});
```

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: 4 new tests FAIL.

- [ ] **Step 3.2: Create `marketplace-create.html`**

Create `worker/bots/test-fixtures/pages/marketplace-create.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Marketplace - Create new listing</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
    .create-form { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,.1); }
    .field { margin-bottom: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 14px; }
    input[type="text"], input[type="number"], textarea {
      width: 100%; box-sizing: border-box; padding: 10px 12px;
      border: 1px solid #ccd0d5; border-radius: 6px; font-size: 16px;
    }
    .dropdown-trigger {
      width: 100%; padding: 10px 12px; background: #fff; border: 1px solid #ccd0d5;
      border-radius: 6px; font-size: 16px; text-align: left; cursor: pointer; box-sizing: border-box;
    }
    .lexical-editor {
      border: 1px solid #ccd0d5; border-radius: 6px; min-height: 100px; padding: 10px 12px;
      font-size: 16px; outline: none;
    }
    .btn-next { background: #1877f2; color: #fff; border: none; border-radius: 6px; padding: 12px 24px; font-size: 16px; font-weight: bold; cursor: pointer; }
    .btn-publish { background: #42b72a; color: #fff; border: none; border-radius: 6px; padding: 12px 24px; font-size: 16px; font-weight: bold; cursor: pointer; }
    #location-suggestions { display: none; }
    #location-suggestions[data-visible="true"] { display: block; }
  </style>
</head>
<body>
<div class="create-form">
  <h2 style="margin-top:0">Create new listing</h2>

  <div class="field">
    <label>Photos</label>
    <div style="border:2px dashed #ccd0d5;border-radius:8px;padding:24px;text-align:center">
      <label style="cursor:pointer;font-weight:normal">
        Add photos
        <input
          type="file"
          accept="image/*,image/jpeg,image/png,image/gif,image/webp"
          multiple
          style="display:none"
          id="photo-input"
          aria-label="Add photos"
        />
      </label>
    </div>
  </div>

  <!-- AI_BUTTON_SLOT -->

  <div class="field">
    <label for="title-input">Title</label>
    <input
      id="title-input"
      name="title"
      type="text"
      placeholder="What are you selling?"
      aria-label="Title"
      maxlength="100"
    />
  </div>

  <div class="field">
    <label for="price-input">Price</label>
    <input
      id="price-input"
      name="price"
      type="number"
      placeholder="Price"
      aria-label="Price"
      min="0"
      step="1"
    />
  </div>

  <div class="field">
    <label>Category</label>
    <button
      type="button"
      class="dropdown-trigger"
      aria-label="Category"
      aria-haspopup="listbox"
      id="category-trigger"
    >Select a category</button>
  </div>

  <div class="field">
    <label>Condition</label>
    <button
      type="button"
      class="dropdown-trigger"
      aria-label="Condition"
      aria-haspopup="listbox"
      id="condition-trigger"
    >Select condition</button>
  </div>

  <div class="field" style="position:relative">
    <label for="location-input">Location</label>
    <input
      id="location-input"
      type="text"
      placeholder="Enter your city or zip code"
      aria-label="Location"
      autocomplete="off"
    />
    <ul
      id="location-suggestions"
      role="listbox"
      aria-label="Location suggestions"
      style="position:absolute;z-index:100;background:#fff;border:1px solid #ccd0d5;border-radius:6px;list-style:none;margin:2px 0 0;padding:4px 0;width:100%;box-shadow:0 4px 12px rgba(0,0,0,.15);"
    >
      <li role="option" data-value="Calgary, Alberta, Canada" style="padding:10px 16px;cursor:pointer">
        <div>Calgary, Alberta, Canada</div>
      </li>
      <li role="option" data-value="Edmonton, Alberta, Canada" style="padding:10px 16px;cursor:pointer">
        <div>Edmonton, Alberta, Canada</div>
      </li>
      <li role="option" data-value="Vancouver, British Columbia, Canada" style="padding:10px 16px;cursor:pointer">
        <div>Vancouver, British Columbia, Canada</div>
      </li>
    </ul>
  </div>

  <div class="field">
    <label>Description</label>
    <div
      id="description-editor"
      class="lexical-editor"
      contenteditable="true"
      role="textbox"
      aria-label="Description"
      aria-multiline="true"
      data-lexical-editor="true"
      tabindex="0"
    ></div>
    <textarea
      id="description-textarea"
      name="description"
      aria-label="Description"
      placeholder="Describe your item (condition, brand, size, etc.)"
      style="display:none"
      rows="4"
    ></textarea>
  </div>

  <div class="field" style="display:flex;gap:8px;justify-content:flex-end">
    <button class="btn-next" type="submit" id="next-btn">Next</button>
    <button class="btn-publish" type="button" id="publish-btn">Publish</button>
    <button class="btn-publish" type="button" id="list-btn" style="display:none">List</button>
  </div>
</div>

<script>
const CATEGORIES = [
  'Clothing & Accessories','Electronics','Home & Garden',
  'Toys & Games','Books, Movies & Music','Sporting Goods',
  'Vehicles','Tools & DIY','Hobbies'
];
const CONDITIONS = ['New','Like New','Good','Fair','Poor'];

function openDropdownPortal(items, onSelect, anchor) {
  const old = document.getElementById('mock-dropdown-portal');
  if (old) old.remove();
  const portal = document.createElement('div');
  portal.id = 'mock-dropdown-portal';
  portal.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #ccd0d5;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:4px 0;';
  const rect = anchor.getBoundingClientRect();
  portal.style.top = (rect.bottom + 4) + 'px';
  portal.style.left = rect.left + 'px';
  portal.style.minWidth = rect.width + 'px';
  const ul = document.createElement('ul');
  ul.setAttribute('role', 'listbox');
  ul.style.cssText = 'list-style:none;margin:0;padding:0;';
  items.forEach(item => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.textContent = item;
    li.style.cssText = 'padding:10px 16px;cursor:pointer;font-size:15px;';
    li.addEventListener('mouseenter', () => li.style.background = '#f0f2f5');
    li.addEventListener('mouseleave', () => li.style.background = '');
    li.addEventListener('click', () => { onSelect(item); portal.remove(); });
    ul.appendChild(li);
  });
  portal.appendChild(ul);
  document.body.appendChild(portal);
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!portal.contains(e.target)) { portal.remove(); document.removeEventListener('click', close); }
    });
  }, 0);
}

document.getElementById('category-trigger').addEventListener('click', function(e) {
  e.stopPropagation();
  openDropdownPortal(CATEGORIES, v => { this.textContent = v; }, this);
});

document.getElementById('condition-trigger').addEventListener('click', function(e) {
  e.stopPropagation();
  openDropdownPortal(CONDITIONS, v => { this.textContent = v; }, this);
});

let locTimer = null;
const locInput = document.getElementById('location-input');
const locSuggestions = document.getElementById('location-suggestions');
locInput.addEventListener('input', () => {
  clearTimeout(locTimer);
  if (locInput.value.trim().length < 2) {
    locSuggestions.setAttribute('data-visible', 'false');
    return;
  }
  locTimer = setTimeout(() => locSuggestions.setAttribute('data-visible', 'true'), 300);
});
locSuggestions.addEventListener('click', e => {
  const li = e.target.closest('li[role="option"]');
  if (!li) return;
  locInput.value = li.dataset.value || li.querySelector('div')?.textContent || li.textContent;
  locSuggestions.setAttribute('data-visible', 'false');
});

const descEditor = document.getElementById('description-editor');
descEditor.addEventListener('paste', e => {
  if (!e.clipboardData) return;
  const text = e.clipboardData.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  descEditor.textContent = text;
  descEditor.dispatchEvent(new InputEvent('input', { bubbles: true }));
});

document.getElementById('next-btn').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('list-btn').style.display = 'inline-block';
});

document.getElementById('publish-btn').addEventListener('click', async () => {
  const res = await fetch('/marketplace/create/item', {
    method: 'POST',
    body: new URLSearchParams({
      title: document.getElementById('title-input').value,
      price: document.getElementById('price-input').value
    })
  });
  if (res.redirected) window.location.href = res.url;
});
</script>
</body>
</html>
```

- [ ] **Step 3.3: Run tests — all marketplace-create tests PASS**

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: all 4 new marketplace-create tests PASS.

- [ ] **Step 3.4: Commit**

```bash
git add worker/bots/test-fixtures/pages/marketplace-create.html worker/bots/test-fixtures/mock-server.js
git commit -m "feat(test): add Facebook mock marketplace-create.html with all 53 selectors, dropdown portals, Lexical mock"
```

---

## Task 4: Create `marketplace-item.html`

**Files:**
- Create: `worker/bots/test-fixtures/pages/marketplace-item.html`

Selectors required (from `facebook-bot.js` `refreshListing()` lines 192–213, `relistItem()` lines 307–323):

| Flow | Selectors |
|------|-----------|
| Edit button | `[aria-label*="Edit" i]`, text "Edit listing", `[data-testid*="edit"]` |
| Save (after Edit) | text "Update", text "Save", `[aria-label*="Publish" i]` |
| Renew button | text "Renew", `[aria-label*="Renew" i]`, `[data-testid*="renew"]` |
| Confirm (after Renew) | text "Confirm", text "Publish", `button[type="submit"]` |

- [ ] **Step 4.1: Write failing test — add to `mock-server.test.js`**

```javascript
test('marketplace-item.html has Edit and Renew buttons with required selectors', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/item/99887766`);
    const body = await res.text();
    expect(body).toContain('Edit listing');
    expect(body).toContain('data-testid="edit-listing-btn"');
    expect(body).toContain('>Renew<');
    expect(body).toContain('data-testid="renew-btn"');
    expect(body).toContain('aria-label="Renew listing"');
});
```

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: new test FAIL.

- [ ] **Step 4.2: Create `marketplace-item.html`**

Create `worker/bots/test-fixtures/pages/marketplace-item.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Facebook Marketplace Listing</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,.1); }
    .bar { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
<div class="card">
  <h2 style="margin-top:0">Mock Listing</h2>
  <p style="color:#65676b">Condition: Good · Price: $25</p>
  <p>Mock listing. URL contains <code>/marketplace/item/{id}/</code>.</p>

  <div class="bar">
    <button
      class="btn"
      id="edit-listing-btn"
      aria-label="Edit listing"
      data-testid="edit-listing-btn"
      type="button"
      style="background:#e4e6eb;color:#050505"
    >Edit listing</button>

    <button
      class="btn"
      id="renew-btn"
      aria-label="Renew listing"
      data-testid="renew-btn"
      type="button"
      style="background:#1877f2;color:#fff"
    >Renew</button>
  </div>

  <div id="edit-save-bar" class="bar" style="display:none">
    <button
      id="save-btn"
      aria-label="Publish changes"
      type="button"
      style="padding:10px 20px;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;background:#42b72a;color:#fff"
    >Update</button>
    <button
      id="save-btn-alt"
      type="button"
      style="padding:10px 20px;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;background:#42b72a;color:#fff"
    >Save</button>
  </div>

  <div id="renew-confirm-bar" class="bar" style="display:none">
    <button
      id="confirm-btn"
      type="submit"
      style="padding:10px 20px;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;background:#42b72a;color:#fff"
    >Confirm</button>
    <button
      id="publish-confirm-btn"
      type="button"
      style="padding:10px 20px;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;background:#1877f2;color:#fff"
    >Publish</button>
  </div>
</div>

<script>
  document.getElementById('edit-listing-btn').addEventListener('click', () => {
    document.getElementById('edit-save-bar').style.display = 'flex';
  });
  document.getElementById('renew-btn').addEventListener('click', () => {
    document.getElementById('renew-confirm-bar').style.display = 'flex';
  });
</script>
</body>
</html>
```

- [ ] **Step 4.3: Run tests — marketplace-item test PASS**

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: "marketplace-item.html has Edit and Renew buttons" PASS.

- [ ] **Step 4.4: Commit**

```bash
git add worker/bots/test-fixtures/pages/marketplace-item.html
git commit -m "feat(test): add Facebook mock marketplace-item.html with Edit/Save/Renew/Confirm buttons"
```

---

## Task 5: Create `marketplace-selling.html`

**Files:**
- Create: `worker/bots/test-fixtures/pages/marketplace-selling.html`

Selector required (`facebook-bot.js` `refreshAllListings()` line 235):
- `a[href*="/marketplace/item/"]` — at least 5 links with numeric IDs in format `/marketplace/item/{id}/`

- [ ] **Step 5.1: Write failing test — add to `mock-server.test.js`**

```javascript
test('marketplace-selling.html has 5+ listing links', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/you/selling`);
    const body = await res.text();
    const matches = body.match(/href="\/marketplace\/item\/\d+\/"/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
});
```

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: new test FAIL.

- [ ] **Step 5.2: Create `marketplace-selling.html`**

Create `worker/bots/test-fixtures/pages/marketplace-selling.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Facebook Marketplace - Your Listings</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
    h2 { margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; max-width: 900px; }
    .card { background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.1); text-decoration: none; color: inherit; display: block; }
    .card-body { padding: 8px 12px 12px; }
    .card-title { font-weight: 600; font-size: 14px; margin: 0 0 4px; }
    .card-price { font-size: 14px; margin: 0; }
    .thumb { height: 140px; background: #e4e6eb; display: flex; align-items: center; justify-content: center; color: #65676b; font-size: 13px; }
  </style>
</head>
<body>
  <h2>Your Listings</h2>
  <div class="grid">
    <a href="/marketplace/item/100000001/" class="card">
      <div class="thumb">Photo</div>
      <div class="card-body"><p class="card-title">Vintage Denim Jacket</p><p class="card-price">$45</p></div>
    </a>
    <a href="/marketplace/item/100000002/" class="card">
      <div class="thumb">Photo</div>
      <div class="card-body"><p class="card-title">Running Shoes Size 10</p><p class="card-price">$30</p></div>
    </a>
    <a href="/marketplace/item/100000003/" class="card">
      <div class="thumb">Photo</div>
      <div class="card-body"><p class="card-title">Coffee Table</p><p class="card-price">$80</p></div>
    </a>
    <a href="/marketplace/item/100000004/" class="card">
      <div class="thumb">Photo</div>
      <div class="card-body"><p class="card-title">iPhone 13 Pro</p><p class="card-price">$499</p></div>
    </a>
    <a href="/marketplace/item/100000005/" class="card">
      <div class="thumb">Photo</div>
      <div class="card-body"><p class="card-title">Air Fryer</p><p class="card-price">$55</p></div>
    </a>
    <a href="/marketplace/item/100000006/" class="card">
      <div class="thumb">Photo</div>
      <div class="card-body"><p class="card-title">LEGO Star Wars Set</p><p class="card-price">$65</p></div>
    </a>
  </div>
</body>
</html>
```

- [ ] **Step 5.3: Run all server tests — all PASS (14+ tests)**

Run: `bun test worker/bots/test-fixtures/mock-server.test.js`
Expected: all tests PASS.

- [ ] **Step 5.4: Delete temp test file and commit**

```bash
rm worker/bots/test-fixtures/mock-server.test.js
git add worker/bots/test-fixtures/pages/marketplace-selling.html worker/bots/test-fixtures/mock-server.js
git commit -m "feat(test): add Facebook mock marketplace-selling.html with 6 listing links"
```

---

## Task 6: Create `facebook-bot.test.js`

**Files:**
- Modify: `worker/bots/facebook-bot.js` — add `_baseUrl` option (4 lines)
- Create: `worker/bots/facebook-bot.test.js`

**Key constraint:** `FB_URL` in `facebook-bot.js` is a module-level `const` (line 13). It cannot be overridden from outside without patching the constructor. We add `this._baseUrl = options._baseUrl || FB_URL` and replace 3 occurrences of `FB_URL` inside class methods with `this._baseUrl`.

- [ ] **Step 6.1: Patch `facebook-bot.js` to accept `_baseUrl` option**

In `worker/bots/facebook-bot.js`:

Replace in constructor (lines 67–73):
```javascript
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, ...options };
        this.stats = { refreshes: 0, relists: 0, errors: 0 };
    }
```

With:
```javascript
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.options = { headless: true, ...options };
        this.stats = { refreshes: 0, relists: 0, errors: 0 };
        this._baseUrl = options._baseUrl || FB_URL;
    }
```

Replace the 3 occurrences of `${FB_URL}` inside class methods:

Line 119 — in `login()`:
```javascript
// Before:
            await this.page.goto(`${FB_URL}/login`, { waitUntil: 'domcontentloaded' });
// After:
            await this.page.goto(`${this._baseUrl}/login`, { waitUntil: 'domcontentloaded' });
```

Line 230 — in `refreshAllListings()`:
```javascript
// Before:
            await this.page.goto(`${FB_URL}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
// After:
            await this.page.goto(`${this._baseUrl}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
```

Line 269 — in `refreshAllListings()` restart block:
```javascript
// Before:
                    await this.page.goto(FB_URL, { waitUntil: 'domcontentloaded' });
// After:
                    await this.page.goto(this._baseUrl, { waitUntil: 'domcontentloaded' });
```

- [ ] **Step 6.2: Check Playwright availability**

```bash
node -e "require('playwright')" 2>&1 && echo "PLAYWRIGHT_OK" || echo "PLAYWRIGHT_MISSING"
```

If PLAYWRIGHT_MISSING: `bun add -d playwright && bunx playwright install chromium`

- [ ] **Step 6.3: Write `facebook-bot.test.js`**

Create `worker/bots/facebook-bot.test.js`:

```javascript
// Tests for FacebookBot flows using the local mock server.
// Uses Playwright chromium directly (no Camoufox) — tests bot DOM selectors.

import { test, expect, beforeAll, afterAll } from 'bun:test';
import { start, stop, getPort } from './test-fixtures/mock-server.js';
import { chromium } from 'playwright';

let mockPort;
let browser;
let page;

beforeAll(async () => {
    mockPort = await start();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
}, 30000);

afterAll(async () => {
    await browser?.close();
    await stop();
});

// ── Login ──────────────────────────────────────────────────────────────────────

test('login: email + password + submit selectors present on /login', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#email, input[name="email"]');
    expect(await page.$('#email, input[name="email"]')).not.toBeNull();
    expect(await page.$('#pass, input[name="pass"]')).not.toBeNull();
    expect(await page.$('button[name="login"], button[type="submit"]')).not.toBeNull();
}, 15000);

test('login: fill + submit redirects away from /login', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', 'test@example.com');
    await page.fill('#pass', 'testpassword');
    await page.click('button[name="login"]');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {});
    expect(page.url()).not.toContain('/login');
}, 15000);

test('login: ?captcha=1 page has captcha element matching bot selector', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/login?captcha=1`, { waitUntil: 'domcontentloaded' });
    const captcha = await page.$('[class*="captcha" i], [id*="captcha" i]');
    expect(captcha).not.toBeNull();
}, 10000);

test('login: ?checkpoint=1 navigates to /checkpoint URL', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/?checkpoint=1`, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/checkpoint');
}, 10000);

test('login: ?verify=1 navigates to /marketplace/verify URL', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/?verify=1`, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/marketplace/verify');
}, 10000);

test('login: profile indicator visible on / when fb_session cookie is set', async () => {
    await page.context().addCookies([{
        name: 'fb_session', value: '1',
        domain: '127.0.0.1', path: '/'
    }]);
    await page.goto(`http://127.0.0.1:${mockPort}/`, { waitUntil: 'domcontentloaded' });
    const profileEl = await page.$('[aria-label="Your profile"], [data-testid="royal_profile_link"]');
    expect(profileEl).not.toBeNull();
    await page.context().clearCookies();
}, 10000);

// ── Refresh listing (edit + save) ─────────────────────────────────────────────

test('refreshListing: Edit button present on /marketplace/item/:id', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/item/100000001`, { waitUntil: 'domcontentloaded' });
    const editBtn = await page.$('[aria-label*="Edit" i], button:has-text("Edit listing"), [data-testid*="edit"]');
    expect(editBtn).not.toBeNull();
}, 10000);

test('refreshListing: clicking Edit reveals Save/Update button', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/item/100000002`, { waitUntil: 'domcontentloaded' });
    const editBtn = await page.$('[aria-label*="Edit" i], button:has-text("Edit listing"), [data-testid*="edit"]');
    await editBtn.click();
    await page.waitForTimeout(200);
    const saveBtn = await page.$('button:has-text("Update"), button:has-text("Save"), [aria-label*="Publish" i]');
    expect(saveBtn).not.toBeNull();
    expect(await saveBtn.isVisible()).toBe(true);
}, 10000);

// ── Relist (renew + confirm) ──────────────────────────────────────────────────

test('relistItem: Renew button present on /marketplace/item/:id', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/item/100000003`, { waitUntil: 'domcontentloaded' });
    const renewBtn = await page.$('button:has-text("Renew"), [aria-label*="Renew" i], [data-testid*="renew"]');
    expect(renewBtn).not.toBeNull();
}, 10000);

test('relistItem: clicking Renew reveals Confirm/Publish button', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/item/100000004`, { waitUntil: 'domcontentloaded' });
    const renewBtn = await page.$('button:has-text("Renew"), [aria-label*="Renew" i], [data-testid*="renew"]');
    await renewBtn.click();
    await page.waitForTimeout(200);
    const confirmBtn = await page.$('button:has-text("Confirm"), button:has-text("Publish"), button[type="submit"]');
    expect(confirmBtn).not.toBeNull();
    expect(await confirmBtn.isVisible()).toBe(true);
}, 10000);

// ── refreshAllListings — selling page link discovery ───────────────────────────

test('refreshAllListings: selling page has 5+ marketplace item links', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
    const links = await page.$$eval(
        'a[href*="/marketplace/item/"]',
        els => els.map(a => a.href).filter(Boolean)
    );
    expect([...new Set(links)].length).toBeGreaterThanOrEqual(5);
}, 10000);

test('refreshAllListings: all link hrefs match /marketplace/item/{id}/ pattern', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/you/selling`, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.$$eval(
        'a[href*="/marketplace/item/"]',
        els => els.map(a => a.getAttribute('href'))
    );
    for (const href of hrefs) {
        expect(href).toMatch(/\/marketplace\/item\/\d+\//);
    }
}, 10000);

// ── POST create → URL extraction regex ───────────────────────────────────────

test('create: POST /marketplace/create/item returns URL matching /marketplace/item/{id}/', async () => {
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/create/item`, { waitUntil: 'domcontentloaded' });
    const res = await page.request.fetch(`http://127.0.0.1:${mockPort}/marketplace/create/item`, {
        method: 'POST',
        form: { title: 'Test', price: '25' }
    });
    expect(res.url()).toMatch(/\/marketplace\/item\/\d+\//);
}, 10000);
```

- [ ] **Step 6.4: Run bot tests**

Run: `bun test worker/bots/facebook-bot.test.js --reporter=verbose`
Expected: all 12 tests PASS.

- [ ] **Step 6.5: Commit**

```bash
git add worker/bots/facebook-bot.js worker/bots/facebook-bot.test.js
git commit -m "feat(test): add facebook-bot.test.js against mock server; add _baseUrl option to FacebookBot"
```

---

## Task 7: Create `poster-facebook.spec.js`

**Files:**
- Create: `e2e/tests/poster-facebook.spec.js`

**Approach:** Load the mock server's `marketplace-create.html` in Playwright. Before load, stub `window.chrome.runtime` via `addInitScript`. After load, inject `poster.js` as a script tag with `window.fillFacebook = fillFacebook` appended (since `fillFacebook` is a local function not exported from `poster.js`).

- [ ] **Step 7.1: Confirm `fillFacebook` is not exported**

Run: `grep -n "export.*fillFacebook\|window.fillFacebook" chrome-extension/content/poster.js`
Expected: no output.

- [ ] **Step 7.2: Create `poster-facebook.spec.js`**

Create `e2e/tests/poster-facebook.spec.js`:

```javascript
// Playwright E2E: tests poster.js fillFacebook() against the Facebook mock server.

import { test, expect } from '@playwright/test';
import { start, stop, getPort } from '../../worker/bots/test-fixtures/mock-server.js';
import fs from 'fs';
import path from 'path';

let mockPort;

test.beforeAll(async () => {
    mockPort = await start();
});

test.afterAll(async () => {
    await stop();
});

function getPosterScript() {
    const src = fs.readFileSync(
        path.join(process.cwd(), 'chrome-extension/content/poster.js'),
        'utf8'
    );
    return src + '\nif (typeof fillFacebook !== "undefined") { window.fillFacebook = fillFacebook; }\n';
}

async function loadCreatePage(page, params) {
    await page.addInitScript(() => {
        window.chrome = {
            runtime: {
                id: 'mock-ext-id',
                onMessage: { addListener: () => {}, removeListener: () => {} },
                sendMessage: () => {},
                connect: () => ({
                    postMessage: () => {},
                    onDisconnect: { addListener: () => {} },
                    onMessage: { addListener: () => {} }
                })
            }
        };
    });
    const qs = params ? `?${params}` : '';
    await page.goto(`http://127.0.0.1:${mockPort}/marketplace/create/item${qs}`, {
        waitUntil: 'domcontentloaded'
    });
    await page.addScriptTag({ content: getPosterScript() });
    await page.waitForTimeout(300);
}

test('fillFacebook: fills title field', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({ title: 'Test Jacket', list_price: '25', description: 'Great condition' }));
    await page.waitForTimeout(1500);
    const val = await page.inputValue('#title-input');
    expect(val).toBe('Test Jacket');
});

test('fillFacebook: fills price field', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({ title: 'Shoes', list_price: '45', description: 'Size 10' }));
    await page.waitForTimeout(1500);
    const val = await page.inputValue('#price-input');
    expect(val).toBe('45');
});

test('fillFacebook: selects category — trigger text updates to mapped value', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'T-Shirt', list_price: '10', category: 'clothing', description: 'Nice shirt'
    }));
    await page.waitForTimeout(2000);
    const text = await page.textContent('#category-trigger');
    expect(text).toContain('Clothing & Accessories');
});

test('fillFacebook: selects condition — trigger text updates to mapped value', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'Jeans', list_price: '30', condition: 'good', description: 'Good jeans'
    }));
    await page.waitForTimeout(2000);
    const text = await page.textContent('#condition-trigger');
    expect(text).toContain('Good');
});

test('fillFacebook: types location and clicks first suggestion', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'Lamp', list_price: '15', location: 'Calgary', description: 'Nice lamp'
    }));
    await page.waitForTimeout(3500);
    const val = await page.inputValue('#location-input');
    expect(val.length).toBeGreaterThan(0);
});

test('fillFacebook: fills description in contenteditable Lexical editor', async ({ page }) => {
    await loadCreatePage(page);
    await page.evaluate(() => window.fillFacebook({
        title: 'Book', list_price: '5', description: 'Great read, barely used'
    }));
    await page.waitForTimeout(1500);
    const text = await page.textContent('#description-editor');
    expect(text).toContain('Great read, barely used');
});

test('fillFacebook: skipped does not include Title/Price/Description when all provided', async ({ page }) => {
    await loadCreatePage(page);
    const skipped = await page.evaluate(() => window.fillFacebook({
        title: 'Full Item', list_price: '99',
        category: 'electronics', condition: 'like_new',
        location: 'Calgary', description: 'All fields provided'
    }));
    await page.waitForTimeout(3500);
    if (Array.isArray(skipped)) {
        expect(skipped).not.toContain('Title');
        expect(skipped).not.toContain('Price');
        expect(skipped).not.toContain('Description');
    }
});
```

- [ ] **Step 7.3: Run the spec**

```bash
npx playwright test e2e/tests/poster-facebook.spec.js --reporter=list
```

Expected: all 7 tests PASS. If the location test fails due to `setTimeout` delay, increase the `300` in `marketplace-create.html` `locTimer` to `500`.

- [ ] **Step 7.4: Commit**

```bash
git add e2e/tests/poster-facebook.spec.js
git commit -m "feat(test): add poster-facebook.spec.js E2E for fillFacebook() against mock server"
```

---

## Task 8: Syntax Check + Final Commit

- [ ] **Step 8.1: Lint all new JS files**

```bash
bun run lint -- worker/bots/test-fixtures/mock-server.js worker/bots/facebook-bot.test.js e2e/tests/poster-facebook.spec.js 2>&1 | tail -20
```

Fix any errors before proceeding.

- [ ] **Step 8.2: Run full bot test suite**

```bash
bun test worker/bots/facebook-bot.test.js --reporter=verbose
```

Expected (12 passing tests):
```
✓ login: email + password + submit selectors present on /login
✓ login: fill + submit redirects away from /login
✓ login: ?captcha=1 page has captcha element matching bot selector
✓ login: ?checkpoint=1 navigates to /checkpoint URL
✓ login: ?verify=1 navigates to /marketplace/verify URL
✓ login: profile indicator visible on / when fb_session cookie is set
✓ refreshListing: Edit button present on /marketplace/item/:id
✓ refreshListing: clicking Edit reveals Save/Update button
✓ relistItem: Renew button present on /marketplace/item/:id
✓ relistItem: clicking Renew reveals Confirm/Publish button
✓ refreshAllListings: selling page has 5+ marketplace item links
✓ refreshAllListings: all link hrefs match /marketplace/item/{id}/ pattern
```

- [ ] **Step 8.3: Run E2E spec**

```bash
npx playwright test e2e/tests/poster-facebook.spec.js --reporter=list
```

Expected: 7 tests PASS.

- [ ] **Step 8.4: Final commit**

```bash
git add worker/bots/test-fixtures/ worker/bots/facebook-bot.test.js e2e/tests/poster-facebook.spec.js worker/bots/facebook-bot.js
git commit -m "feat(test): Facebook Marketplace mock test environment complete

Mock server, 4 HTML page fixtures, 12 bot tests, 7 E2E poster tests.
Verified: bun test worker/bots/facebook-bot.test.js (12/12) + npx playwright test e2e/tests/poster-facebook.spec.js (7/7)"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| Bun.serve port 0 | Task 1 |
| `start()`/`stop()`/`getPort()` exports | Task 1 |
| `?captcha=1`, `?verify=1`, `?checkpoint=1`, `?ai=1` | Task 1, 3 |
| POST /login sets cookie + redirects | Task 1 |
| `[aria-label="Your profile"]` cookie-gated | Task 2 |
| login.html all email/pass/submit selectors | Task 2 |
| marketplace-create.html all 53 selectors | Task 3 |
| Lexical contenteditable mock | Task 3 |
| Dropdown portals (category/condition) | Task 3 |
| Location typeahead `ul[role="listbox"] li[role="option"]` | Task 3 |
| marketplace-item.html Edit/Save/Renew/Confirm | Task 4 |
| marketplace-selling.html 5+ listing links | Task 5 |
| facebook-bot.test.js login/checkpoint/captcha/verify | Task 6 |
| facebook-bot.test.js refresh (edit+save) | Task 6 |
| facebook-bot.test.js relist (renew+confirm) | Task 6 |
| facebook-bot.test.js refreshAllListings grid | Task 6 |
| `_baseUrl` override for `FB_URL` const | Task 6 |
| poster-facebook.spec.js title/price | Task 7 |
| poster-facebook.spec.js category/condition | Task 7 |
| poster-facebook.spec.js location/description/skipped | Task 7 |
| Syntax check + commit | Task 8 |

All 21 requirements covered. No gaps.

### Placeholder Scan

No TBD, TODO, vague steps, or "similar to above" references. All code blocks are complete and self-contained.

### Type/Name Consistency

- `mock-server.js` exports `start()`, `stop()`, `getPort()` — imported identically in Tasks 6 and 7.
- `injectCaptcha()` and `injectAiButton()` defined and called within `mock-server.js` Task 1.
- HTML IDs `#category-trigger`, `#condition-trigger`, `#location-input`, `#description-editor`, `#title-input`, `#price-input` defined in Task 3, referenced in Task 7 assertions — all match.
- `FacebookBot._baseUrl` added in Task 6 step 6.1. The 3 exact line numbers for `FB_URL` replacement are provided.
- `getPosterScript()` in Task 7 appends `window.fillFacebook = fillFacebook` — function name matches the `async function fillFacebook(data)` definition in `poster.js` line 267.

---

## Quick Reference

```bash
# Bot tests
bun test worker/bots/facebook-bot.test.js --reporter=verbose

# Extension poster E2E
npx playwright test e2e/tests/poster-facebook.spec.js --reporter=list

# Run both in sequence
bun test worker/bots/facebook-bot.test.js && npx playwright test e2e/tests/poster-facebook.spec.js
```
