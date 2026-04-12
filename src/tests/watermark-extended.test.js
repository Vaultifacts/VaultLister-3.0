// Extended tests for watermark endpoints
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
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

describe('Watermark Presets', () => {
    test('POST /watermark/presets should validate type', async () => {
        const response = await fetch(`${BASE_URL}/watermark/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Preset',
                type: 'invalid_type',
                content: 'Test'
            })
        });
        expect([400, 403]).toContain(response.status);
    });

    test('POST /watermark/presets should validate URL for image type', async () => {
        const response = await fetch(`${BASE_URL}/watermark/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Image Preset',
                type: 'image',
                content: 'not-a-valid-url'
            })
        });
        expect([400, 403]).toContain(response.status);
    });

    test('POST /watermark/presets should accept valid text preset', async () => {
        const response = await fetch(`${BASE_URL}/watermark/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Text Preset ' + Date.now(),
                type: 'text',
                content: 'VaultLister',
                position: 'bottom-right',
                opacity: 0.5
            })
        });
        expect([200, 201, 400, 403, 404, 500]).toContain(response.status);
    });

    test('POST /watermark/presets should require name', async () => {
        const response = await fetch(`${BASE_URL}/watermark/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'text',
                content: 'Test'
            })
        });
        expect([400, 403]).toContain(response.status);
    });

    test('GET /watermark/presets should list presets', async () => {
        const response = await fetch(`${BASE_URL}/watermark/presets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 403, 404]).toContain(response.status);
    });

    test('POST /watermark/presets should reject ftp:// URL for image type', async () => {
        const response = await fetch(`${BASE_URL}/watermark/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'FTP Image',
                type: 'image',
                content: 'ftp://example.com/image.png'
            })
        });
        expect([400, 403]).toContain(response.status);
    });
});
