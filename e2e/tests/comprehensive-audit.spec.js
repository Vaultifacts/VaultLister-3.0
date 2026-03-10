// Comprehensive Analytical QA Session - TestFixMaster
// Covers: Exploration, Accessibility, Visual, Performance, Security, Edge Cases, Flakiness
import { test, expect } from '@playwright/test';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_PASSWORD = 'DemoPassword123!';

// ============================================================
// 1. HUMAN-LIKE EXPLORATION
// ============================================================

test.describe('1. Human-Like Exploration', () => {
  test('Login page renders correctly', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    // Check login form elements exist
    const emailInput = page.locator('input[type="email"], input[name="email"], #email');
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password');
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign"), button:has-text("Log in")');
    
    // Take screenshot of login page
    await page.screenshot({ path: 'e2e/screenshots/login-page.png', fullPage: true });
    
    const emailCount = await emailInput.count();
    const passCount = await passwordInput.count();
    const btnCount = await loginButton.count();
    
    console.log(`[AUDIT] Login page elements - email: ${emailCount}, password: ${passCount}, button: ${btnCount}`);
    console.log(`[AUDIT] Page title: ${await page.title()}`);
    console.log(`[AUDIT] URL: ${page.url()}`);
  });

  test('Normal login flow', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    // Try to find and fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password');
    
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await passwordInput.first().fill(DEMO_PASSWORD);
      
      const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")');
      if (await loginButton.count() > 0) {
        await loginButton.first().click();
        await page.waitForTimeout(3000);
        
        console.log(`[AUDIT] After login URL: ${page.url()}`);
        await page.screenshot({ path: 'e2e/screenshots/after-login.png', fullPage: true });
        
        // Check what page we landed on
        const bodyText = await page.locator('body').innerText();
        console.log(`[AUDIT] Post-login page content (first 500 chars): ${bodyText.substring(0, 500)}`);
      }
    } else {
      console.log('[AUDIT] WARNING: No email input found on login page');
      const html = await page.content();
      console.log(`[AUDIT] Page HTML (first 2000): ${html.substring(0, 2000)}`);
    }
  });

  test('Navigation after login - explore all sections', async ({ page }) => {
    // Login first
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await passwordInput.first().fill(DEMO_PASSWORD);
      const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")');
      if (await loginButton.count() > 0) await loginButton.first().click();
      await page.waitForTimeout(3000);
    }
    
    // Find all navigation links
    const navLinks = page.locator('nav a, .sidebar a, .nav a, [role="navigation"] a, a[href*="#"]');
    const linkCount = await navLinks.count();
    console.log(`[AUDIT] Found ${linkCount} navigation links`);
    
    const sections = [];
    for (let i = 0; i < Math.min(linkCount, 30); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      const text = await navLinks.nth(i).innerText().catch(() => '');
      sections.push({ href, text: text.trim() });
    }
    console.log(`[AUDIT] Navigation sections: ${JSON.stringify(sections, null, 2)}`);
    
    // Visit each section
    for (const section of sections.filter(s => s.href)) {
      try {
        if (section.href.startsWith('#') || section.href.startsWith('/')) {
          const url = section.href.startsWith('#') ? `${BASE}/${section.href}` : `${BASE}${section.href}`;
          await page.goto(url);
          await page.waitForTimeout(1000);
          const errors = [];
          page.on('pageerror', err => errors.push(err.message));
          console.log(`[AUDIT] Section "${section.text}" (${section.href}): loaded, errors: ${errors.length}`);
        }
      } catch (e) {
        console.log(`[AUDIT] Section "${section.text}" ERROR: ${e.message}`);
      }
    }
  });

  test('Edge case inputs on login', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password');
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")');
    
    if (await emailInput.count() === 0) { console.log('[AUDIT] No email input found'); return; }
    
    const testCases = [
      { email: '', password: '', desc: 'Empty fields' },
      { email: 'notanemail', password: 'test', desc: 'Invalid email format' },
      { email: 'test@test.com', password: 'wrong', desc: 'Wrong credentials' },
      { email: '<script>alert(1)</script>', password: 'test', desc: 'XSS in email' },
      { email: "' OR 1=1 --", password: 'test', desc: 'SQL injection email' },
      { email: 'a'.repeat(500) + '@test.com', password: 'test', desc: 'Very long email' },
      { email: DEMO_EMAIL, password: '', desc: 'Missing password' },
      { email: ' ' + DEMO_EMAIL + ' ', password: DEMO_PASSWORD, desc: 'Email with spaces' },
    ];
    
    for (const tc of testCases) {
      await page.goto(`${BASE}/#login`);
      await page.waitForLoadState('domcontentloaded');
      await emailInput.first().fill(tc.email);
      await passwordInput.first().fill(tc.password);
      if (await loginButton.count() > 0) {
        await loginButton.first().click();
        await page.waitForTimeout(1000);

        const url = page.url();
        const errorMsg = await page.locator('.error, .alert-danger, .toast-error, [role="alert"], .notification-error, .error-message').first().innerText({ timeout: 2000 }).catch(() => 'none');
        console.log(`[AUDIT] Edge case "${tc.desc}": URL=${url}, Error="${errorMsg}"`);
      }
    }
  });
});

// ============================================================
// 2. ACCESSIBILITY (basic checks without axe-core dep)
// ============================================================

test.describe('2. Accessibility Checks', () => {
  test('Login page accessibility', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    // Check for ARIA labels
    const inputsWithoutLabel = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      const issues = [];
      inputs.forEach(input => {
        const hasLabel = input.labels?.length > 0;
        const hasAriaLabel = input.getAttribute('aria-label');
        const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
        const hasPlaceholder = input.getAttribute('placeholder');
        const hasTitle = input.getAttribute('title');
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
          issues.push({
            tag: input.tagName,
            type: input.type,
            id: input.id,
            name: input.name,
            hasPlaceholder: !!hasPlaceholder
          });
        }
      });
      return issues;
    });
    console.log(`[A11Y] Inputs without labels: ${JSON.stringify(inputsWithoutLabel)}`);
    
    // Check heading hierarchy
    const headings = await page.evaluate(() => {
      const h = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(h).map(el => ({ tag: el.tagName, text: el.innerText.substring(0, 50) }));
    });
    console.log(`[A11Y] Heading hierarchy: ${JSON.stringify(headings)}`);
    
    // Check for alt text on images
    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return Array.from(imgs).filter(img => !img.alt).map(img => ({ src: img.src?.substring(0, 80) }));
    });
    console.log(`[A11Y] Images without alt: ${JSON.stringify(imagesWithoutAlt)}`);
    
    // Check color contrast (basic - check if there are low contrast elements)
    const contrastIssues = await page.evaluate(() => {
      const issues = [];
      const elements = document.querySelectorAll('button, a, label, p, span, h1, h2, h3, input');
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        if (color === bg && color !== 'rgba(0, 0, 0, 0)') {
          issues.push({ tag: el.tagName, text: el.innerText?.substring(0, 30), color, bg });
        }
      });
      return issues;
    });
    console.log(`[A11Y] Same fg/bg color elements: ${JSON.stringify(contrastIssues)}`);
    
    // Tab order check
    const focusableElements = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
      return Array.from(els).map(el => ({
        tag: el.tagName,
        tabindex: el.tabIndex,
        text: (el.innerText || el.value || el.placeholder || '').substring(0, 30)
      }));
    });
    console.log(`[A11Y] Focusable elements: ${focusableElements.length}`);
    
    // Check skip links
    const skipLink = await page.locator('a[href="#main"], a[href="#content"], .skip-link').count();
    console.log(`[A11Y] Skip navigation link: ${skipLink > 0 ? 'present' : 'MISSING'}`);
    
    // Check lang attribute
    const lang = await page.evaluate(() => document.documentElement.lang);
    console.log(`[A11Y] HTML lang attribute: ${lang || 'MISSING'}`);
  });
  
  test('Keyboard navigation on login', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    // Tab through the page
    const tabOrder = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return { tag: el?.tagName, id: el?.id, type: el?.type, text: (el?.innerText || el?.value || '').substring(0, 30) };
      });
      tabOrder.push(focused);
    }
    console.log(`[A11Y] Tab order: ${JSON.stringify(tabOrder)}`);
    
    // Try Enter to submit form
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      console.log(`[A11Y] Enter key submit: URL=${page.url()}`);
    }
  });
});

// ============================================================
// 3. VISUAL REGRESSION - Screenshots at different viewports
// ============================================================

test.describe('3. Visual Regression', () => {
  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];
  
  for (const vp of viewports) {
    test(`Login page at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/#login`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `e2e/screenshots/login-${vp.name}.png`, fullPage: true });
      
      // Check for layout issues
      const overflows = await page.evaluate(() => {
        const body = document.body;
        const issues = [];
        if (body.scrollWidth > window.innerWidth) {
          issues.push(`Body overflow: scrollWidth=${body.scrollWidth} > viewportWidth=${window.innerWidth}`);
        }
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
            issues.push(`${el.tagName}.${(el.getAttribute('class') || '').substring(0,30)} overflows right: ${rect.right}`);
          }
        });
        return issues.slice(0, 10);
      });
      console.log(`[VISUAL] ${vp.name} overflow issues: ${JSON.stringify(overflows)}`);
    });
  }
  
  test('Post-login screenshots', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await passwordInput.first().fill(DEMO_PASSWORD);
      const btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
      if (await btn.count() > 0) await btn.first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'e2e/screenshots/dashboard-desktop.png', fullPage: true });
      
      // Mobile view of dashboard
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/dashboard-mobile.png', fullPage: true });
    }
  });
});

// ============================================================
// 4. PERFORMANCE ANALYSIS
// ============================================================

test.describe('4. Performance Analysis', () => {
  test('Login page load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    const perfMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      return {
        domContentLoaded: nav?.domContentLoadedEventEnd - nav?.startTime,
        loadComplete: nav?.loadEventEnd - nav?.startTime,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        transferSize: nav?.transferSize,
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });
    
    console.log(`[PERF] Login page load: ${loadTime}ms`);
    console.log(`[PERF] Metrics: ${JSON.stringify(perfMetrics)}`);
    
    // Check resource sizes
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(r => ({
        name: r.name.split('/').pop()?.substring(0, 40),
        type: r.initiatorType,
        size: r.transferSize,
        duration: Math.round(r.duration),
      })).sort((a, b) => b.size - a.size).slice(0, 10);
    });
    console.log(`[PERF] Top resources by size: ${JSON.stringify(resources, null, 2)}`);
  });
  
  test('Login action performance', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
      
      const startLogin = Date.now();
      const btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
      if (await btn.count() > 0) await btn.first().click();
      await page.waitForLoadState('networkidle');
      const loginTime = Date.now() - startLogin;
      console.log(`[PERF] Login action time: ${loginTime}ms`);
    }
  });
});

// ============================================================
// 5. SECURITY CHECKS
// ============================================================

test.describe('5. Security Checks', () => {
  test('Security headers', async ({ page }) => {
    const response = await page.goto(`${BASE}/`);
    const headers = response.headers();
    
    const securityHeaders = {
      'content-security-policy': headers['content-security-policy'] || 'MISSING',
      'strict-transport-security': headers['strict-transport-security'] || 'MISSING (expected in production)',
      'x-content-type-options': headers['x-content-type-options'] || 'MISSING',
      'x-frame-options': headers['x-frame-options'] || 'MISSING',
      'x-xss-protection': headers['x-xss-protection'] || 'MISSING',
      'referrer-policy': headers['referrer-policy'] || 'MISSING',
      'permissions-policy': headers['permissions-policy'] || 'MISSING',
    };
    console.log(`[SEC] Security headers: ${JSON.stringify(securityHeaders, null, 2)}`);
  });
  
  test('API security - login endpoint', async ({ request }) => {
    // Test CSRF
    const loginResponse = await request.post(`${BASE}/api/auth/login`, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[SEC] Login API status: ${loginResponse.status()}`);
    const loginBody = await loginResponse.json().catch(() => ({}));
    console.log(`[SEC] Login response keys: ${Object.keys(loginBody)}`);
    
    // Check if token is in response body (should be httpOnly cookie instead)
    if (loginBody.token) {
      console.log('[SEC] WARNING: JWT token returned in response body (consider httpOnly cookie)');
    }
    
    // Check cookie flags
    const cookies = await loginResponse.headersArray();
    const setCookies = cookies.filter(h => h.name.toLowerCase() === 'set-cookie');
    setCookies.forEach(c => {
      console.log(`[SEC] Cookie: ${c.value.substring(0, 100)}`);
      if (!c.value.includes('HttpOnly')) console.log('[SEC] WARNING: Cookie missing HttpOnly flag');
      if (!c.value.includes('Secure')) console.log('[SEC] WARNING: Cookie missing Secure flag (ok for localhost)');
      if (!c.value.includes('SameSite')) console.log('[SEC] WARNING: Cookie missing SameSite attribute');
    });
  });
  
  test('Rate limiting check', async ({ request }) => {
    const results = [];
    for (let i = 0; i < 15; i++) {
      const res = await request.post(`${BASE}/api/auth/login`, {
        data: { email: 'fake@test.com', password: 'wrongpassword' },
        headers: { 'Content-Type': 'application/json' }
      });
      results.push(res.status());
    }
    console.log(`[SEC] Rate limit test (15 bad logins): ${JSON.stringify(results)}`);
    const rateLimited = results.some(s => s === 429);
    console.log(`[SEC] Rate limiting active: ${rateLimited}`);
  });
  
  test('SQL injection on login', async ({ request }) => {
    const injections = [
      { email: "' OR '1'='1", password: "' OR '1'='1" },
      { email: "admin'--", password: "anything" },
      { email: "' UNION SELECT * FROM users --", password: "test" },
    ];
    
    for (const inj of injections) {
      const res = await request.post(`${BASE}/api/auth/login`, {
        data: inj,
        headers: { 'Content-Type': 'application/json' }
      });
      const body = await res.text();
      console.log(`[SEC] SQLi "${inj.email}": status=${res.status()}, body=${body.substring(0, 200)}`);
      if (res.status() === 200) {
        console.log('[SEC] CRITICAL: SQL injection may have succeeded!');
      }
    }
  });
  
  test('XSS reflection check', async ({ page }) => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
    ];
    
    for (const payload of xssPayloads) {
      await page.goto(`${BASE}/#login`);
      await page.waitForLoadState('networkidle');
      const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
      if (await emailInput.count() > 0) {
        await emailInput.first().fill(payload);
        await page.locator('input[type="password"]').first().fill(payload);
        const btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
        if (await btn.count() > 0) await btn.first().click();
        await page.waitForTimeout(1000);
        
        // Check if script executed
        const alertTriggered = await page.evaluate(() => {
          return window.__xss_triggered || false;
        });
        console.log(`[SEC] XSS "${payload.substring(0, 30)}": reflected=${alertTriggered}`);
      }
    }
  });
});

// ============================================================
// 6. EDGE & NEGATIVE TESTING
// ============================================================

test.describe('6. Edge & Negative Testing', () => {
  test('Browser back/forward after login', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
      const btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
      if (await btn.count() > 0) await btn.first().click();
      await page.waitForTimeout(3000);
      
      const postLoginUrl = page.url();
      console.log(`[EDGE] Post-login URL: ${postLoginUrl}`);
      
      // Go back
      await page.goBack();
      await page.waitForTimeout(1000);
      console.log(`[EDGE] After back: ${page.url()}`);
      
      // Go forward
      await page.goForward();
      await page.waitForTimeout(1000);
      console.log(`[EDGE] After forward: ${page.url()}`);
    }
  });
  
  test('Double-click login button', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(DEMO_EMAIL);
      await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
      const btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
      if (await btn.count() > 0) {
        await btn.first().dblclick();
        await page.waitForTimeout(3000);
        console.log(`[EDGE] After double-click login: ${page.url()}`);
      }
    }
  });

  test('API health endpoint', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    console.log(`[EDGE] Health endpoint: ${res.status()}, body: ${await res.text()}`);
  });
  
  test('404 handling', async ({ page }) => {
    const response = await page.goto(`${BASE}/nonexistent-page`);
    console.log(`[EDGE] 404 test: status=${response?.status()}, url=${page.url()}`);
    await page.screenshot({ path: 'e2e/screenshots/404-page.png' });
  });
  
  test('Zoomed view (200%)', async ({ page }) => {
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { document.body.style.zoom = '2'; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/login-zoomed-200.png', fullPage: true });
    
    const overflows = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    console.log(`[EDGE] Zoomed 200% overflow: ${overflows}`);
  });
});

// ============================================================
// 7. FLAKINESS CHECK - Run login 10 times
// ============================================================

test.describe('7. Flakiness Check', () => {
  for (let i = 1; i <= 10; i++) {
    test(`Login attempt ${i}/10`, async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE}/#login`);
      await page.waitForLoadState('networkidle');
      
      const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[placeholder*="email" i]');
      if (await emailInput.count() > 0) {
        await emailInput.first().fill(DEMO_EMAIL);
        await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
        const btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
        if (await btn.count() > 0) await btn.first().click();
        await page.waitForTimeout(2000);
        
        const elapsed = Date.now() - start;
        const url = page.url();
        const loggedIn = !url.includes('login');
        console.log(`[FLAKY] Attempt ${i}: loggedIn=${loggedIn}, time=${elapsed}ms, url=${url}`);
      }
    });
  }
});
