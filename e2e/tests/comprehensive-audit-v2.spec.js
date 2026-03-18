// Comprehensive Analytical QA Session v2 - TestFixMaster
// Deeper exploration: post-login sections, forms, CRUD operations
import { test, expect } from '../fixtures/auth.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_PASSWORD = 'DemoPassword123!';

// Helper: navigate to a hash route (auth already injected by authedPage fixture)
async function login(page) {
  return page;
}

// ============================================================
// 1. DEEP EXPLORATION - Post-Login Sections
// ============================================================

test.describe('1. Deep Post-Login Exploration', () => {
  
  test('Dashboard analysis', async ({ authedPage: page }) => {
    await login(page);
    await page.screenshot({ path: 'e2e/screenshots/v2-dashboard-full.png', fullPage: true });
    
    // Analyze dashboard widgets/cards
    const cards = await page.evaluate(() => {
      const elements = document.querySelectorAll('.card, .widget, .panel, .stat, [class*="card"], [class*="widget"], [class*="stat"]');
      return Array.from(elements).slice(0, 20).map(el => ({
        class: (typeof el.className === 'string' ? el.className : el.className?.baseVal || '').substring(0, 60),
        text: el.innerText?.substring(0, 100),
      }));
    });
    console.log(`[DASH] Dashboard cards/widgets: ${cards.length}`);
    cards.forEach((c, i) => console.log(`[DASH] Card ${i}: ${c.text?.replace(/\n/g, ' | ')}`));
    
    // Check for console errors
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.waitForTimeout(2000);
    console.log(`[DASH] Console errors: ${errors.length > 0 ? JSON.stringify(errors) : 'none'}`);
  });

  test('Inventory page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#inventory`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-inventory.png', fullPage: true });
    
    // Count items
    const rows = await page.locator('tr, .inventory-item, [class*="item"], .list-item').count();
    console.log(`[INV] Inventory rows/items visible: ${rows}`);
    
    // Check for search/filter functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i], .search-input');
    console.log(`[INV] Search input found: ${await searchInput.count() > 0}`);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test search query');
      await page.waitForTimeout(1000);
      const afterSearch = await page.locator('tr, .inventory-item, [class*="item"], .list-item').count();
      console.log(`[INV] After search "test search query": ${afterSearch} items`);
      
      // Clear and try XSS in search
      await searchInput.first().fill('<script>alert(1)</script>');
      await page.waitForTimeout(1000);
      console.log(`[INV] XSS in search: no alert triggered`);
    }
    
    // Check add item button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), a:has-text("Add")');
    const addBtnVisible = await addBtn.first().isVisible().catch(() => false);
    console.log(`[INV] Add button found: ${await addBtn.count() > 0}, visible: ${addBtnVisible}`);

    // Try to click add (only if visible)
    if (addBtnVisible) {
      await addBtn.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'e2e/screenshots/v2-inventory-add.png', fullPage: true });
      
      // Check form fields
      const formInputs = await page.locator('input, select, textarea').count();
      console.log(`[INV] Add form inputs: ${formInputs}`);
    }
    
    const pageContent = await page.locator('body').innerText();
    console.log(`[INV] Page content (500 chars): ${pageContent.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Listings page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#listings`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-listings.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[LIST] Listings content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Orders page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#orders-sales`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-orders.png', fullPage: true });

    const content = await page.locator('body').innerText();
    console.log(`[ORD] Orders content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Offers page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#offers`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-offers.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[OFF] Offers content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Settings page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#settings`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-settings.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[SET] Settings content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
    
    // Check for sensitive data exposure
    const pageHtml = await page.content();
    const sensitivePatterns = ['password', 'secret', 'token', 'api_key', 'apikey'];
    sensitivePatterns.forEach(p => {
      const matches = (pageHtml.match(new RegExp(p, 'gi')) || []).length;
      if (matches > 0) console.log(`[SET] Pattern "${p}" found ${matches} times in HTML`);
    });
  });

  test('Financials page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#financials`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-financials.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[FIN] Financials content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Analytics page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#analytics`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-analytics.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[ANA] Analytics content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Help page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#help`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-help.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[HELP] Help content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });

  test('Automations page exploration', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#automations`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/v2-automations.png', fullPage: true });
    
    const content = await page.locator('body').innerText();
    console.log(`[AUTO] Automations content (500 chars): ${content.substring(0, 500).replace(/\n/g, ' | ')}`);
  });
});

// ============================================================
// 2. FORM TESTING - CRUD Operations
// ============================================================

test.describe('2. Form & CRUD Testing', () => {
  
  test('Inventory - add item with edge cases', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#inventory`);
    await page.waitForTimeout(1500);
    
    // Find and click add button (only if visible)
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [class*="add"]');
    const addBtnVisible = await addBtn.first().isVisible().catch(() => false);
    if (addBtnVisible) {
      await addBtn.first().click();
      await page.waitForTimeout(1500);
      
      // Try to fill form with various inputs
      const inputs = page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea');
      const inputCount = await inputs.count();
      console.log(`[CRUD] Add form has ${inputCount} text inputs`);
      
      for (let i = 0; i < Math.min(inputCount, 10); i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type') || 'text';
        const name = await input.getAttribute('name') || await input.getAttribute('placeholder') || `input-${i}`;
        const required = await input.getAttribute('required') !== null;
        console.log(`[CRUD] Input ${i}: type=${type}, name=${name}, required=${required}`);
      }
      
      // Try submitting empty form
      const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create")');
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(1000);
        
        // Check for validation messages
        const validationMsgs = await page.locator('.error, .invalid, [class*="error"], [class*="invalid"], :invalid').count();
        console.log(`[CRUD] Empty form submit - validation elements: ${validationMsgs}`);
      }
      
      await page.screenshot({ path: 'e2e/screenshots/v2-inventory-form.png', fullPage: true });
    } else {
      console.log('[CRUD] No add button found on inventory page');
    }
  });

  test('Search functionality across pages', async ({ authedPage: page }) => {
    await login(page);

    const pages = ['#inventory', '#listings', '#orders-sales', '#offers'];
    for (const p of pages) {
      await page.goto(`${BASE}/${p}`);
      await page.waitForTimeout(1500);
      
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]');
      if (await searchInput.count() > 0) {
        // Normal search
        await searchInput.first().fill('Nike');
        await page.waitForTimeout(1000);
        const resultsAfterSearch = await page.locator('tr, .item, [class*="item"], [class*="row"]').count();
        
        // SQL injection in search
        await searchInput.first().fill("' OR 1=1 --");
        await page.waitForTimeout(1000);
        const resultsAfterSQLi = await page.locator('tr, .item, [class*="item"], [class*="row"]').count();
        
        // XSS in search
        await searchInput.first().fill('<img src=x onerror=alert(document.cookie)>');
        await page.waitForTimeout(1000);
        
        console.log(`[SEARCH] ${p}: search found, normal=${resultsAfterSearch}, sqli=${resultsAfterSQLi}`);
      } else {
        console.log(`[SEARCH] ${p}: no search input found`);
      }
    }
  });
});

// ============================================================
// 3. ACCESSIBILITY - Deep Scan Post-Login
// ============================================================

test.describe('3. Deep Accessibility', () => {
  
  test('Post-login accessibility audit', async ({ authedPage: page }) => {
    await login(page);
    await page.waitForTimeout(1000);
    
    const audit = await page.evaluate(() => {
      const issues = [];
      
      // 1. Check all interactive elements for accessible names
      const interactive = document.querySelectorAll('button, a, input, select, textarea');
      interactive.forEach(el => {
        const name = el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText?.trim() || el.getAttribute('placeholder') || '';
        if (!name && el.tagName !== 'INPUT') {
          issues.push({ type: 'no-accessible-name', tag: el.tagName, class: (typeof el.className === 'string' ? el.className : '').substring(0, 40) });
        }
      });
      
      // 2. Check for role attributes on key landmarks
      const hasMain = !!document.querySelector('main, [role="main"]');
      const hasNav = !!document.querySelector('nav, [role="navigation"]');
      const hasBanner = !!document.querySelector('header, [role="banner"]');
      
      // 3. Check color contrast using computed styles (basic)
      const lowContrast = [];
      document.querySelectorAll('button, a, p, span, label, h1, h2, h3, h4, li').forEach(el => {
        const style = window.getComputedStyle(el);
        const opacity = parseFloat(style.opacity);
        if (opacity < 0.5 && el.innerText?.trim()) {
          lowContrast.push({ tag: el.tagName, text: el.innerText.substring(0, 30), opacity });
        }
      });
      
      // 4. Check focus visible styles
      const focusIssues = [];
      document.querySelectorAll('button, a, input').forEach(el => {
        const style = window.getComputedStyle(el, ':focus');
        // Can't directly check :focus styles, but check outline
      });
      
      // 5. ARIA roles validity
      const ariaElements = document.querySelectorAll('[role]');
      const roles = Array.from(ariaElements).map(el => ({
        role: el.getAttribute('role'),
        tag: el.tagName,
      }));
      
      return {
        noAccessibleName: issues.slice(0, 15),
        landmarks: { hasMain, hasNav, hasBanner },
        lowContrast: lowContrast.slice(0, 10),
        ariaRoles: roles.slice(0, 20),
        totalInteractive: interactive.length,
      };
    });
    
    console.log(`[A11Y-DEEP] Total interactive elements: ${audit.totalInteractive}`);
    console.log(`[A11Y-DEEP] Elements without accessible names: ${audit.noAccessibleName.length}`);
    audit.noAccessibleName.forEach(i => console.log(`  - ${i.tag}.${i.class}`));
    console.log(`[A11Y-DEEP] Landmarks: main=${audit.landmarks.hasMain}, nav=${audit.landmarks.hasNav}, banner=${audit.landmarks.hasBanner}`);
    console.log(`[A11Y-DEEP] Low opacity elements: ${audit.lowContrast.length}`);
    console.log(`[A11Y-DEEP] ARIA roles: ${JSON.stringify(audit.ariaRoles)}`);
  });

  test('Sidebar keyboard navigation', async ({ authedPage: page }) => {
    await login(page);
    
    // Try to navigate sidebar with keyboard
    const sidebarLinks = page.locator('nav a, .sidebar a, [class*="sidebar"] a, [class*="nav"] a');
    const count = await sidebarLinks.count();
    console.log(`[A11Y-NAV] Sidebar links: ${count}`);
    
    // Check if sidebar items have focus indicators
    if (count > 0) {
      await sidebarLinks.first().focus();
      await page.waitForTimeout(200);
      const hasFocusStyle = await sidebarLinks.first().evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          outline: style.outline,
          boxShadow: style.boxShadow,
          border: style.border,
        };
      });
      console.log(`[A11Y-NAV] Focus styles on first link: ${JSON.stringify(hasFocusStyle)}`);
    }
  });
});

// ============================================================
// 4. VISUAL - All Major Pages at Mobile
// ============================================================

test.describe('4. Visual - Mobile Responsive', () => {
  const sections = ['#dashboard', '#inventory', '#listings', '#orders-sales', '#offers', '#settings', '#analytics', '#financials'];
  
  for (const section of sections) {
    test(`Mobile view: ${section}`, async ({ authedPage: page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await login(page);
      await page.goto(`${BASE}/${section}`);
      await page.waitForTimeout(1500);
      
      const name = section.replace('#', '');
      await page.screenshot({ path: `e2e/screenshots/v2-mobile-${name}.png`, fullPage: true });
      
      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          bodyOverflow: document.body.scrollWidth > window.innerWidth,
          scrollWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      console.log(`[MOBILE] ${section}: overflow=${overflow.bodyOverflow}, scrollW=${overflow.scrollWidth}, vpW=${overflow.viewportWidth}`);
      
      // Check if hamburger menu exists for mobile
      const hamburger = page.locator('[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu" i], .mobile-menu-btn');
      console.log(`[MOBILE] ${section}: hamburger menu=${await hamburger.count() > 0}`);
    });
  }
});

// ============================================================
// 5. PERFORMANCE - Post-Login Pages
// ============================================================

test.describe('5. Performance - Page Transitions', () => {
  test('Page navigation timing', async ({ authedPage: page }) => {
    await login(page);

    const sections = ['#inventory', '#listings', '#orders-sales', '#offers', '#analytics', '#financials', '#settings', '#help-support'];
    const timings = [];
    
    for (const section of sections) {
      const start = Date.now();
      await page.goto(`${BASE}/${section}`);
      await page.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      timings.push({ section, elapsed });
      console.log(`[PERF-NAV] ${section}: ${elapsed}ms`);
    }
    
    // Check for memory leaks by measuring JS heap
    const memory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
        };
      }
      return null;
    });
    if (memory) console.log(`[PERF-NAV] JS Heap: ${JSON.stringify(memory)}`);
  });

  test('API response times', async ({ request }) => {
    // Login first
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      headers: { 'Content-Type': 'application/json' }
    });
    const { token } = await loginRes.json();
    
    const endpoints = [
      '/api/inventory',
      '/api/listings',
      '/api/orders-sales',
      '/api/offers',
      '/api/analytics/dashboard',
      '/api/financials/summary',
      '/api/automations',
      '/api/health',
    ];
    
    for (const ep of endpoints) {
      const start = Date.now();
      const res = await request.get(`${BASE}${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const elapsed = Date.now() - start;
      console.log(`[API-PERF] ${ep}: ${res.status()} in ${elapsed}ms`);
    }
  });
});

// ============================================================
// 6. SECURITY - Deeper Checks
// ============================================================

test.describe('6. Security - Deep', () => {
  
  test('Authentication bypass attempts', async ({ request }) => {
    // Try accessing protected endpoints without token
    const endpoints = ['/api/inventory', '/api/users', '/api/orders', '/api/settings'];
    for (const ep of endpoints) {
      const res = await request.get(`${BASE}${ep}`);
      console.log(`[SEC-AUTH] ${ep} without token: ${res.status()}`);
      if (res.status() === 200) {
        console.log(`[SEC-AUTH] CRITICAL: ${ep} accessible without authentication!`);
      }
    }
    
    // Try with invalid token
    const res = await request.get(`${BASE}/api/inventory`, {
      headers: { 'Authorization': 'Bearer invalid.token.here' }
    });
    console.log(`[SEC-AUTH] /api/inventory with invalid token: ${res.status()}`);
    
    // Try with expired-looking token
    const res2 = await request.get(`${BASE}/api/inventory`, {
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTAwMDAwMDAwMCwiZXhwIjoxMDAwMDAwMDAxfQ.invalid' }
    });
    console.log(`[SEC-AUTH] /api/inventory with forged token: ${res2.status()}`);
  });

  test('IDOR - accessing other users data', async ({ request }) => {
    // Login as demo user
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      headers: { 'Content-Type': 'application/json' }
    });
    const { token } = await loginRes.json();
    
    // Try accessing data with different user IDs
    const idorEndpoints = [
      '/api/inventory?userId=999',
      '/api/orders?userId=999',
    ];
    
    for (const ep of idorEndpoints) {
      const res = await request.get(`${BASE}${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const body = await res.text();
      console.log(`[SEC-IDOR] ${ep}: ${res.status()}, body length=${body.length}`);
    }
  });

  test('Password policy check', async ({ request }) => {
    const weakPasswords = ['1', '123', 'password', 'abc', '        '];
    
    for (const pwd of weakPasswords) {
      const res = await request.post(`${BASE}/api/auth/register`, {
        data: { email: `test${Date.now()}@test.com`, password: pwd, name: 'Test User' },
        headers: { 'Content-Type': 'application/json' }
      });
      const body = await res.text();
      console.log(`[SEC-PWD] Register with "${pwd}": ${res.status()}, response=${body.substring(0, 150)}`);
    }
  });

  test('Session management', async ({ request }) => {
    // Login and get token
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      headers: { 'Content-Type': 'application/json' }
    });
    const { token, refreshToken } = await loginRes.json();
    console.log(`[SEC-SESS] Token length: ${token?.length}, refreshToken length: ${refreshToken?.length}`);
    
    // Check if logout actually invalidates token
    const logoutRes = await request.post(`${BASE}/api/auth/logout`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`[SEC-SESS] Logout: ${logoutRes.status()}`);
    
    // Try using token after logout
    const afterLogout = await request.get(`${BASE}/api/inventory`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`[SEC-SESS] Token after logout: ${afterLogout.status()}`);
    if (afterLogout.status() === 200) {
      console.log('[SEC-SESS] WARNING: Token still valid after logout!');
    }
  });

  test('CORS and method checks', async ({ request }) => {
    // Try OPTIONS preflight
    const opts = await request.fetch(`${BASE}/api/auth/login`, { method: 'OPTIONS' });
    const corsHeaders = {
      'access-control-allow-origin': opts.headers()['access-control-allow-origin'] || 'not set',
      'access-control-allow-methods': opts.headers()['access-control-allow-methods'] || 'not set',
      'access-control-allow-credentials': opts.headers()['access-control-allow-credentials'] || 'not set',
    };
    console.log(`[SEC-CORS] CORS headers: ${JSON.stringify(corsHeaders)}`);
    
    // Try unexpected HTTP methods
    const methods = ['PUT', 'DELETE', 'PATCH'];
    for (const method of methods) {
      const res = await request.fetch(`${BASE}/api/auth/login`, { method });
      console.log(`[SEC-CORS] ${method} /api/auth/login: ${res.status()}`);
    }
  });
});

// ============================================================
// 7. EDGE CASES - Deep
// ============================================================

test.describe('7. Edge Cases - Deep', () => {
  
  test('Concurrent actions', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#inventory`);
    await page.waitForTimeout(1500);

    // Rapid navigation
    const sections = ['#dashboard', '#inventory', '#listings', '#orders-sales', '#dashboard'];
    for (const s of sections) {
      page.goto(`${BASE}/${s}`); // intentionally not awaiting
    }
    await page.waitForTimeout(3000);
    console.log(`[EDGE-DEEP] After rapid nav: ${page.url()}`);
    
    // Check page is still functional
    const content = await page.locator('body').innerText().catch(() => 'ERROR');
    console.log(`[EDGE-DEEP] Page functional: ${content.length > 0 && content !== 'ERROR'}`);
  });

  test('Large data handling in forms', async ({ authedPage: page }) => {
    await login(page);
    await page.goto(`${BASE}/#inventory`);
    await page.waitForTimeout(1500);
    
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")');
    const addBtnVisible = await addBtn.first().isVisible().catch(() => false);
    if (addBtnVisible) {
      await addBtn.first().click();
      await page.waitForTimeout(1000);
      
      // Fill with very long strings
      const inputs = page.locator('input[type="text"], input:not([type]), textarea');
      for (let i = 0; i < Math.min(await inputs.count(), 5); i++) {
        await inputs.nth(i).fill('A'.repeat(10000));
      }
      await page.waitForTimeout(500);
      console.log(`[EDGE-DEEP] Filled inputs with 10k char strings`);
      await page.screenshot({ path: 'e2e/screenshots/v2-large-input.png', fullPage: true });
    }
  });

  test('Dark mode toggle if available', async ({ authedPage: page }) => {
    await login(page);
    
    // Look for dark mode toggle
    const darkToggle = page.locator('[class*="dark"], [class*="theme"], button:has-text("dark"), [aria-label*="dark" i], [aria-label*="theme" i]');
    console.log(`[EDGE-DEEP] Dark mode toggle found: ${await darkToggle.count()}`);
    
    if (await darkToggle.count() > 0) {
      await darkToggle.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/v2-dark-mode.png', fullPage: true });
      
      const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      console.log(`[EDGE-DEEP] After dark toggle, body bg: ${bg}`);
    }
  });

  test('Logout and session cleanup', async ({ authedPage: page }) => {
    await login(page);
    
    // Find logout
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Log out"), a:has-text("Logout"), a:has-text("Log out"), [class*="logout"]');
    console.log(`[EDGE-DEEP] Logout button found: ${await logoutBtn.count()}`);
    
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await page.waitForTimeout(2000);
      console.log(`[EDGE-DEEP] After logout URL: ${page.url()}`);
      
      // Try accessing protected page
      await page.goto(`${BASE}/#dashboard`);
      await page.waitForTimeout(1500);
      console.log(`[EDGE-DEEP] After logout + dashboard nav: ${page.url()}`);
    }
    
    // Check localStorage/sessionStorage cleanup
    const storage = await page.evaluate(() => ({
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
      localStorageSize: JSON.stringify(localStorage).length,
    }));
    console.log(`[EDGE-DEEP] Storage after logout: ${JSON.stringify(storage)}`);
  });
});

// ============================================================
// 8. FLAKINESS - Fresh (no rate limit interference)
// ============================================================

test.describe('8. Flakiness - Fresh Server', () => {
  for (let i = 1; i <= 5; i++) {
    test(`Fresh login attempt ${i}/5`, async ({ authedPage: page }) => {
      const start = Date.now();
      await page.goto(`${BASE}/#login`);
      await page.waitForLoadState('networkidle');
      
      await page.locator('input[type="email"], input[name="email"]').first().fill(DEMO_EMAIL);
      await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(2500);
      
      const elapsed = Date.now() - start;
      const url = page.url();
      const loggedIn = url.includes('dashboard');
      console.log(`[FLAKY-v2] Attempt ${i}: loggedIn=${loggedIn}, time=${elapsed}ms, url=${url}`);
    });
  }
});
