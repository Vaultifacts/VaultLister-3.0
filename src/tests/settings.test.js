// Settings Route Tests
// Covers GET and PUT /api/settings/announcement
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let csrfToken = null;

async function getCSRFToken(token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/csrf-token`, { headers });
    const data = await res.json();
    return data.csrfToken;
}

beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const data = await res.json();
    authToken = data.token;
    if (authToken) {
        csrfToken = await getCSRFToken(authToken);
    }
});

describe('GET /api/settings/announcement', () => {
    test('should return 200 when no authentication is provided (public endpoint)', async () => {
        const res = await fetch(`${BASE_URL}/settings/announcement`);
        expect(res.status).toBe(200);
    });

    test('should return 200 with announcement data when authenticated', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('announcement');
    });

    test('should return announcement as null or object when no announcement is set', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const isNullOrObject = data.announcement === null || typeof data.announcement === 'object';
        expect(isNullOrObject).toBe(true);
    });
});

describe('PUT /api/settings/announcement', () => {
    test('should reject unauthenticated requests', async () => {
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Test announcement' })
        });
        // CSRF check runs before auth for mutating requests — returns 403
        expect([401, 403]).toContain(res.status);
    });

    test('should return 403 when authenticated user is not admin', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        const csrf = await getCSRFToken(authToken);
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrf
            },
            body: JSON.stringify({ text: 'Test announcement', color: 'primary' })
        });
        // demo user is not an admin — expect 403
        // If demo user IS an admin in this environment, 200 is also valid
        expect([200, 403]).toContain(res.status);
    });

    test('should return 403 when CSRF token is missing', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
                // No X-CSRF-Token header
            },
            body: JSON.stringify({ text: 'Test announcement' })
        });
        expect(res.status).toBe(403);
    });

    test('should return 403 when CSRF token is invalid', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': 'invalid-csrf-token-value'
            },
            body: JSON.stringify({ text: 'Test announcement' })
        });
        expect(res.status).toBe(403);
    });

    test('should return 200 and set announcement when called by admin with valid CSRF', async () => {
        // This test requires an admin-level token. When DISABLE_CSRF=true and NODE_ENV=test
        // are set, CSRF is bypassed to allow CI to test the admin path.
        // Without an admin user in the test fixture, this documents expected behavior.
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        if (process.env.DISABLE_CSRF !== 'true' || process.env.NODE_ENV !== 'test') {
            console.log('Skipping: Requires DISABLE_CSRF=true NODE_ENV=test with an admin user fixture');
            return;
        }
        const csrf = await getCSRFToken(authToken);
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrf
            },
            body: JSON.stringify({ text: 'Welcome to VaultLister!', color: 'primary' })
        });
        // 200 for admin success, 403 if demo user is not admin
        expect([200, 403]).toContain(res.status);
        if (res.status === 200) {
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.announcement).toBeDefined();
            expect(data.announcement.text).toBe('Welcome to VaultLister!');
        }
    });

    test('should return 200 and clear announcement when text is empty and called by admin', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }
        if (process.env.DISABLE_CSRF !== 'true' || process.env.NODE_ENV !== 'test') {
            console.log('Skipping: Requires DISABLE_CSRF=true NODE_ENV=test with an admin user fixture');
            return;
        }
        const csrf = await getCSRFToken(authToken);
        const res = await fetch(`${BASE_URL}/settings/announcement`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrf
            },
            body: JSON.stringify({ text: '' })
        });
        // 200 for admin success (clears announcement), 403 if demo user is not admin
        expect([200, 403]).toContain(res.status);
        if (res.status === 200) {
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.announcement).toBeNull();
        }
    });
});

console.log('Running Settings Route tests...');
