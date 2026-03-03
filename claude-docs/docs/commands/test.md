# /test - Run and Fix Tests

Run tests and fix any failures.

## Usage
```
/test [type] [file]
```

Types: `api`, `e2e`, `security`, `all`

## Workflow

1. **Run tests**
   ```bash
   # API/Unit tests
   bun test src/tests/

   # E2E tests
   bunx playwright test e2e/

   # Specific file
   bun test src/tests/<file>.test.js
   bunx playwright test e2e/tests/<file>.spec.js
   ```

2. **Analyze failures**
   - Read error messages and stack traces
   - Identify root cause (code bug vs test bug)
   - Check if test expectations are correct

3. **Fix issues**
   - Update code if bug found
   - Update test if expectation wrong
   - Add missing fixtures/mocks if needed

4. **Re-run tests** to verify fix

5. **Report results**
   - Number of tests passed/failed
   - Summary of fixes made

## Test File Locations
- API tests: `src/tests/*.test.js`
- E2E tests: `e2e/tests/*.spec.js`
- Test fixtures: `e2e/fixtures/`

## Writing New Tests

### API Test Template
```javascript
import { describe, it, expect, beforeAll } from 'bun:test';

describe('Feature', () => {
    let authToken;

    beforeAll(async () => {
        // Setup: get auth token
        const res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
        });
        const data = await res.json();
        authToken = data.token;
    });

    it('should do something', async () => {
        const res = await fetch('http://localhost:3000/api/endpoint', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(200);
    });
});
```

### E2E Test Template
```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        // Login if needed
    });

    test('should do something', async ({ page }) => {
        await page.click('button:text("Click me")');
        await expect(page.locator('.result')).toBeVisible();
    });
});
```
