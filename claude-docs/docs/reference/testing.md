# Testing Reference
> Last reviewed: 2026-03-28

## Test Framework
## Test Framework

- **Unit/API Tests:** Bun:test (built-in)
- **E2E Tests:** Playwright

---

## Directory Structure

```
src/tests/             # 299+ unit/integration test files
├── api.test.js           # Core API tests
├── auth.test.js          # Authentication tests
├── security.test.js      # Security middleware tests
├── chatbot.test.js       # Vault Buddy tests
├── financials.test.js    # Financial API tests
├── analytics.test.js     # Analytics tests
├── billing.test.js       # Billing tests
├── automations.test.js   # Automation tests
└── ... (299 total)

e2e/
├── tests/
│   ├── auth.spec.js      # Auth flows
│   ├── inventory.spec.js # Inventory CRUD
│   ├── community.spec.js # Community E2E
│   └── ...
└── fixtures/
    └── test-data.js      # Test fixtures
```

---

## Running Tests

**All tests:**
```bash
bun run test:all
```

**Specific test file:**
```bash
bun test src/tests/chatbot.test.js
```

**With security disabled (for API testing):**
```bash
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun test
```

**E2E tests:**
```bash
bun run test:e2e
# or
npx playwright test
```

---

## Test Server Setup

Tests require a running server. Start with security disabled:

```bash
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun run src/backend/server.js
```

Or use the test script:
```bash
bun run scripts/run-api-tests.js
```

---

## API Test Pattern

```javascript
import { describe, test, expect, beforeAll } from 'bun:test';

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

beforeAll(async () => {
    // Login to get auth token
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'demo123'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Feature Tests', () => {
    test('GET /endpoint - should return data', async () => {
        const response = await fetch(`${BASE_URL}/endpoint`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.items).toBeDefined();
    });

    test('POST /endpoint - should create item', async () => {
        const response = await fetch(`${BASE_URL}/endpoint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        expect(response.status).toBe(201);
    });
});
```

---

## E2E Test Pattern (Playwright)

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('http://localhost:3000');
        await page.fill('#email', 'demo@vaultlister.com');
        await page.fill('#password', 'demo123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard');
    });

    test('should display dashboard', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Dashboard');
    });

    test('should create item', async ({ page }) => {
        await page.click('text=Add Item');
        await page.fill('#title', 'Test Item');
        await page.click('button:has-text("Save")');
        await expect(page.locator('text=Test Item')).toBeVisible();
    });
});
```

---

## Test Fixtures

**Demo user (pre-seeded):**
```javascript
{
    email: 'demo@vaultlister.com',
    password: 'demo123'
}
```

**Creating test data:**
```javascript
// In beforeAll or beforeEach
const item = await api.post('/inventory', {
    title: 'Test Item',
    list_price: 29.99
});
testItemId = item.id;

// Cleanup in afterAll
await api.delete(`/inventory/${testItemId}`);
```

---

## Common Assertions

```javascript
// Status codes
expect(response.status).toBe(200);
expect([200, 201]).toContain(response.status);

// Response data
expect(data.success).toBe(true);
expect(data.items).toBeDefined();
expect(data.items.length).toBeGreaterThan(0);
expect(typeof data.total).toBe('number');

// Error responses
expect(response.status).toBe(400);
expect(data.error).toBeDefined();
```

---

## Debugging Tests

**Verbose output:**
```bash
bun test --verbose src/tests/api.test.js
```

**Single test:**
```bash
bun test --filter "should create item"
```

**Playwright debug mode:**
```bash
npx playwright test --debug
```

**Playwright UI mode:**
```bash
npx playwright test --ui
```

---

## Test Database

Tests use the same database as development. For isolation:

1. Use unique test data identifiers
2. Clean up test data in `afterAll`
3. Or reset database before tests: `bun run db:reset`

---

## CI/CD Testing

For automated testing, ensure:
1. Server starts before tests
2. Security middleware disabled
3. Proper exit codes on failure

```bash
# Start server in background
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun run src/backend/server.js &
sleep 3

# Run tests
bun test

# Cleanup
pkill -f "bun run src/backend/server.js"
```

---

## Coverage

Bun doesn't have built-in coverage. For coverage reports:
1. Track tested endpoints manually
2. Use E2E tests for critical paths
3. Focus on business logic coverage
