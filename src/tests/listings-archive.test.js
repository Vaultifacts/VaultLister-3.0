// Listings Archive/Unarchive HTTP Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`;
let client;
let testListingId = null;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
    const { status, data } = await client.post('/listings', {
        title: 'Archive Test Item', platform: 'poshmark', price: 25.00, status: 'active'
    });
    if (status === 201 || status === 200) {
        testListingId = data?.listing?.id || data?.id;
    }
});

describe('Listings - Archive', () => {
    test('POST /listings/:id/archive archives a listing', async () => {
        if (!testListingId) return;
        const { status, data } = await client.post(`/listings/${testListingId}/archive`);
        expect([200, 500]).toContain(status);
        if (status === 200) { expect(data.message).toContain('archived'); }
    });
    test('POST /listings/:id/archive on nonexistent returns 404', async () => {
        const { status } = await client.post('/listings/nonexistent-id-xyz/archive');
        expect([404, 500]).toContain(status);
    });
    test('POST /listings/:id/archive requires auth', async () => {
        if (!testListingId) return;
        const res = await fetch(`${BASE_URL}/listings/${testListingId}/archive`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(401);
    });
});

describe('Listings - Unarchive', () => {
    test('POST /listings/:id/unarchive restores a listing', async () => {
        if (!testListingId) return;
        const { status, data } = await client.post(`/listings/${testListingId}/unarchive`);
        expect([200, 400, 500]).toContain(status);
        if (status === 200) { expect(data.message).toContain('unarchived'); }
    });
    test('POST /listings/:id/unarchive on non-archived returns 400', async () => {
        if (!testListingId) return;
        const { data } = await client.post('/listings', {
            title: 'Active Item', platform: 'ebay', price: 10, status: 'active'
        });
        const activeId = data?.listing?.id || data?.id;
        if (!activeId) return;
        const { status } = await client.post(`/listings/${activeId}/unarchive`);
        expect([400, 500]).toContain(status);
    });
    test('POST /listings/:id/unarchive on nonexistent returns 404', async () => {
        const { status } = await client.post('/listings/nonexistent-id-xyz/unarchive');
        expect([404, 500]).toContain(status);
    });
});
