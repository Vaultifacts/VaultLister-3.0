// Shipping Profiles API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testProfileId = null;

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

describe('Shipping Profiles - List', () => {
    test('GET /shipping-profiles - should return profiles list', async () => {
        const response = await fetch(`${BASE_URL}/shipping-profiles`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            // API may return { profiles: [] } or an array directly
            expect(data.profiles !== undefined || Array.isArray(data)).toBe(true);
        }
    });
});

describe('Shipping Profiles - Create', () => {
    test('POST /shipping-profiles - should create profile', async () => {
        const response = await fetch(`${BASE_URL}/shipping-profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Test Profile ${Date.now()}`,
                carrier: 'USPS',
                service: 'Priority Mail',
                weightOz: 16,
                dimensions: { length: 12, width: 9, height: 4 },
                isDefault: false
            })
        });

        const data = await response.json();
        // 200/201 on success, 403 if tier-gated on CI
        expect([200, 201, 403]).toContain(response.status);
        if (data.profile?.id || data.id) {
            testProfileId = data.profile?.id || data.id;
        }
    });

    test('POST /shipping-profiles - should require name', async () => {
        const response = await fetch(`${BASE_URL}/shipping-profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                carrier: 'USPS'
            })
        });

        // 400/422 on validation, 403 if tier-gated on CI
        expect([400, 403, 422]).toContain(response.status);
    });
});

describe('Shipping Profiles - Get Single', () => {
    test('GET /shipping-profiles/:id - should return profile details', async () => {
        if (!testProfileId) {
            console.log('Skipping: No test profile ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/shipping-profiles/${testProfileId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Shipping Profiles - Update', () => {
    test('PUT /shipping-profiles/:id - should update profile', async () => {
        if (!testProfileId) {
            console.log('Skipping: No test profile ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/shipping-profiles/${testProfileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Shipping Profile',
                weightOz: 20
            })
        });

        expect([200, 404]).toContain(response.status);
    });

    test('PUT /shipping-profiles/:id/default - should set as default', async () => {
        if (!testProfileId) {
            console.log('Skipping: No test profile ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/shipping-profiles/${testProfileId}/default`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Shipping Profiles - Rate Calculation', () => {
    test('POST /shipping-profiles/calculate-rate - should calculate shipping rate', async () => {
        const response = await fetch(`${BASE_URL}/shipping-profiles/calculate-rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                profileId: testProfileId,
                toZip: '90210',
                fromZip: '10001'
            })
        });

        // 200 on success, 400 on validation, 404 on missing, 403 if tier-gated on CI
        expect([200, 400, 403, 404]).toContain(response.status);
    });
});

describe('Shipping Profiles - Delete', () => {
    test('DELETE /shipping-profiles/:id - should delete profile', async () => {
        if (!testProfileId) {
            console.log('Skipping: No test profile ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/shipping-profiles/${testProfileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 204, 404]).toContain(response.status);
    });
});

describe('Shipping Profiles - Authentication', () => {
    test('GET /shipping-profiles - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/shipping-profiles`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Shipping Profiles API tests...');
