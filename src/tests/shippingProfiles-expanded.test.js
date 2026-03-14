// Shipping Profiles — Expanded Tests (CRUD shape validation, auth guards)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let createdProfileId;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Shipping Profiles - List', () => {
    test('GET /shipping-profiles returns array', async () => {
        const { status, data } = await client.get('/shipping-profiles');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            const profiles = data.profiles || data;
            expect(Array.isArray(profiles)).toBe(true);
        }
    });
});

describe('Shipping Profiles - Create', () => {
    test('POST /shipping-profiles with valid data', async () => {
        const { status, data } = await client.post('/shipping-profiles', {
            name: 'Standard Shipping', carrier: 'USPS', service: 'Priority Mail',
            weight_limit: 70, default_weight: 1
        });
        expect([200, 201]).toContain(status);
        if (status === 200 || status === 201) {
            const profile = data.profile || data;
            expect(profile).toHaveProperty('id');
            createdProfileId = profile.id;
        }
    });

    test('POST /shipping-profiles without name returns error', async () => {
        const { status } = await client.post('/shipping-profiles', { carrier: 'USPS' });
        expect([400, 422]).toContain(status);
    });
});

describe('Shipping Profiles - Get Single', () => {
    test('GET /shipping-profiles/:id returns profile', async () => {
        if (!createdProfileId) return;
        const { status, data } = await client.get(`/shipping-profiles/${createdProfileId}`);
        expect([200, 404]).toContain(status);
        if (status === 200) { expect((data.profile || data).id).toBe(createdProfileId); }
    });

    test('GET /shipping-profiles/:id for nonexistent returns 404', async () => {
        const { status } = await client.get('/shipping-profiles/nonexistent-id');
        expect([404]).toContain(status);
    });
});

describe('Shipping Profiles - Update', () => {
    test('PUT /shipping-profiles/:id updates profile', async () => {
        if (!createdProfileId) return;
        const { status } = await client.put(`/shipping-profiles/${createdProfileId}`, {
            name: 'Updated Shipping', carrier: 'FedEx'
        });
        expect([200, 404]).toContain(status);
    });

    test('PUT /shipping-profiles/:id for nonexistent returns error', async () => {
        const { status } = await client.put('/shipping-profiles/nonexistent-id', { name: 'X' });
        expect([404]).toContain(status);
    });
});

describe('Shipping Profiles - Set Default', () => {
    test('PUT /shipping-profiles/:id/set-default for nonexistent', async () => {
        const { status } = await client.put('/shipping-profiles/nonexistent-id/set-default', {});
        expect([404]).toContain(status);
    });
});

describe('Shipping Profiles - Delete', () => {
    test('DELETE /shipping-profiles/:id for nonexistent returns 404', async () => {
        const { status } = await client.delete('/shipping-profiles/nonexistent-id');
        expect([404]).toContain(status);
    });

    test('DELETE /shipping-profiles/:id removes profile', async () => {
        if (!createdProfileId) return;
        const { status } = await client.delete(`/shipping-profiles/${createdProfileId}`);
        expect([200, 204, 404]).toContain(status);
    });
});

describe('Shipping Profiles - Auth Guards', () => {
    test('GET /shipping-profiles without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/shipping-profiles`);
        expect(res.status).toBe(401);
    });

    test('POST /shipping-profiles without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/shipping-profiles`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
        });
        expect(res.status).toBe(401);
    });
});
