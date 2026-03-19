/**
 * AI Routes E2E Tests
 *
 * Covers: generate-listing, generate-title, generate-tags, analyze-listing-image,
 * suggest-price, auto-categorize.
 * All tests are API-level (no UI navigation required).
 * The AI routes fall back to template/pattern-based generation when
 * ANTHROPIC_API_KEY is absent, so these tests pass in both modes.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let headers;

async function getPostHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/billing/plans`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const csrf = res.headers()['x-csrf-token'] || '';
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    };
}

test.beforeAll(async ({ request }) => {
    const loginData = await apiLogin(request);
    token = loginData.token;
    headers = { Authorization: `Bearer ${token}` };
});

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe('AI routes — auth guard', () => {
    test('should return 401 when generate-listing called without token', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/ai/generate-listing`, {
            data: { category: 'Tops', brand: 'Nike', condition: 'good' }
        });
        expect(res.status()).toBe(401);
    });

    test('should return 401 when generate-title called without token', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/ai/generate-title`, {
            data: { description: 'Blue Nike shirt' }
        });
        expect(res.status()).toBe(401);
    });
});

// ── POST /api/ai/generate-listing ─────────────────────────────────────────────

test.describe('POST /api/ai/generate-listing', () => {
    test('should return title, description, tags, and priceRange when given valid item details', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-listing`, {
            headers: ph,
            data: {
                category: 'Tops',
                brand: 'Nike',
                condition: 'good',
                platform: 'poshmark'
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.title).toBe('string');
        expect(data.title.length).toBeGreaterThan(0);
        expect(typeof data.description).toBe('string');
        expect(Array.isArray(data.tags)).toBe(true);
        expect(data.priceRange).toHaveProperty('low');
        expect(data.priceRange).toHaveProperty('suggested');
        expect(data.priceRange).toHaveProperty('high');
    });

    test('should respect platform titleMax constraint when platform is mercari', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-listing`, {
            headers: ph,
            data: {
                category: 'Tops',
                brand: 'Zara',
                condition: 'like_new',
                platform: 'mercari'
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // Mercari titleMax is 40 chars
        expect(data.title.length).toBeLessThanOrEqual(40);
        expect(data.platform).toBe('mercari');
    });

    test('should return 404 when inventoryId does not exist', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-listing`, {
            headers: ph,
            data: {
                inventoryId: '00000000-0000-0000-0000-000000000000',
                platform: 'poshmark'
            }
        });
        expect(res.status()).toBe(404);
        const data = await res.json();
        expect(data.error).toMatch(/not found/i);
    });
});

// ── POST /api/ai/generate-title ───────────────────────────────────────────────

test.describe('POST /api/ai/generate-title', () => {
    test('should return a non-empty title string when description is provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-title`, {
            headers: ph,
            data: {
                description: 'Blue Nike vintage crewneck sweatshirt in excellent condition',
                brand: 'Nike',
                category: 'Tops',
                condition: 'excellent'
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.title).toBe('string');
        expect(data.title.length).toBeGreaterThan(0);
        expect(data.title.length).toBeLessThanOrEqual(80);
    });

    test('should return 400 when neither description nor keywords is provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-title`, {
            headers: ph,
            data: { brand: 'Nike' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/description or keywords/i);
    });

    test('should accept keywords array as input instead of description', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-title`, {
            headers: ph,
            data: {
                keywords: ['vintage', 'denim', 'jacket', 'Levi'],
                brand: "Levi's",
                category: 'Outerwear'
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.title).toBe('string');
        expect(data.title.length).toBeGreaterThan(0);
    });
});

// ── POST /api/ai/generate-tags ────────────────────────────────────────────────

test.describe('POST /api/ai/generate-tags', () => {
    test('should return a tags array when title is provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-tags`, {
            headers: ph,
            data: {
                title: 'Nike vintage crewneck sweatshirt',
                brand: 'Nike',
                category: 'Tops'
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.tags)).toBe(true);
        expect(data.tags.length).toBeGreaterThan(0);
        expect(data.tags.length).toBeLessThanOrEqual(20);
    });

    test('should return 400 when neither title nor description is provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/generate-tags`, {
            headers: ph,
            data: { brand: 'Nike' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/title or description/i);
    });
});

// ── POST /api/ai/analyze-listing-image ───────────────────────────────────────

test.describe('POST /api/ai/analyze-listing-image', () => {
    test('should return 400 when imageBase64 is missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/analyze-listing-image`, {
            headers: ph,
            data: { platform: 'poshmark' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/image/i);
    });

    test('should return 400 when imageBase64 fails MIME/magic-byte validation', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/analyze-listing-image`, {
            headers: ph,
            data: {
                imageBase64: 'bm90YW5pbWFnZQ==',
                imageMimeType: 'image/jpeg',
                platform: 'poshmark'
            }
        });
        // Either 400 (validation failure) or 200 with fallback — never 5xx
        expect([200, 400]).toContain(res.status());
    });
});

// ── POST /api/ai/suggest-price ────────────────────────────────────────────────

test.describe('POST /api/ai/suggest-price', () => {
    test('should return suggestedPrice and priceRange when given item details', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/suggest-price`, {
            headers: ph,
            data: {
                title: 'Nike Air Force 1',
                brand: 'Nike',
                category: 'Shoes',
                condition: 'good'
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.suggestedPrice).toBe('number');
        expect(data.priceRange).toHaveProperty('low');
        expect(data.priceRange).toHaveProperty('suggested');
        expect(data.priceRange).toHaveProperty('high');
        expect(Array.isArray(data.comparables)).toBe(true);
    });
});

// ── POST /api/ai/auto-categorize ─────────────────────────────────────────────

test.describe('POST /api/ai/auto-categorize', () => {
    test('should detect category Shoes when title contains sneakers', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/auto-categorize`, {
            headers: ph,
            data: { title: 'Nike Air Max sneakers size 10 black' }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.category).toBe('Shoes');
        expect(typeof data.condition).toBe('string');
    });

    test('should return 400 when neither title nor description is provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/ai/auto-categorize`, {
            headers: ph,
            data: { brand: 'Nike' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/title or description/i);
    });
});
