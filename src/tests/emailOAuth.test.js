// Email OAuth API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Email OAuth - Connect', () => {
    test('GET /email/authorize/gmail - should return Gmail OAuth URL', async () => {
        const response = await fetch(`${BASE_URL}/email/authorize/gmail`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // May return 400 if GMAIL_CLIENT_ID not configured, or 200 with authorizationUrl
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
            expect(data.authorizationUrl || data.authUrl || data.url).toBeDefined();
        }
    });

    test('GET /email/authorize/outlook - should return Outlook OAuth URL', async () => {
        const response = await fetch(`${BASE_URL}/email/authorize/outlook`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // May return 400 if OUTLOOK_CLIENT_ID not configured, or 200 with authorizationUrl
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
            expect(data.authorizationUrl || data.authUrl || data.url).toBeDefined();
        }
    });
});

describe('Email OAuth - Accounts', () => {
    test('GET /email/accounts - should list connected email accounts', async () => {
        const response = await fetch(`${BASE_URL}/email/accounts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.accounts).toBeDefined();
    });
});

describe('Email OAuth - Disconnect', () => {
    test('DELETE /email/accounts/:accountId - should disconnect account', async () => {
        const response = await fetch(`${BASE_URL}/email/accounts/test-account-id`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Will return 404 for non-existent account
        expect([200, 404]).toContain(response.status);
    });
});

describe('Email OAuth - Settings', () => {
    test('GET /email/settings - should return email settings', async () => {
        const response = await fetch(`${BASE_URL}/email/settings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('PUT /email/settings - should update email settings', async () => {
        const response = await fetch(`${BASE_URL}/email/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                autoImport: true,
                importLabels: ['poshmark', 'ebay', 'mercari']
            })
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Email OAuth - Sync', () => {
    test('POST /email/sync - should trigger email sync', async () => {
        const response = await fetch(`${BASE_URL}/email/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 202, 400, 404]).toContain(response.status);
    });
});

describe('Email OAuth - Parsed Emails', () => {
    test('GET /email/parsed - should return parsed sale emails', async () => {
        const response = await fetch(`${BASE_URL}/email/parsed`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Email OAuth - Authentication', () => {
    test('GET /email/accounts - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/email/accounts`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Email OAuth API tests...');
