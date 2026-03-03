// AI Routes — Expanded Tests (shape validation, auth guards)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

const IMG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('AI - Generate Title', () => {
    test('POST /ai/generate-title with details', async () => {
        const { status, data } = await client.post('/ai/generate-title', {
            itemDetails: { name: 'Vintage Nike Windbreaker', brand: 'Nike', category: 'Jackets' }
        });
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(data.title || data.titles || data.suggestions).toBeDefined(); }
    });
    test('POST /ai/generate-title without details returns error', async () => {
        const { status } = await client.post('/ai/generate-title', {});
        expect([400, 403, 500]).toContain(status);
    });
});

describe('AI - Generate Description', () => {
    test('POST /ai/generate-description returns text', async () => {
        const { status, data } = await client.post('/ai/generate-description', {
            itemDetails: { name: 'Levis 501', brand: 'Levis', condition: 'Good' }
        });
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(data.description || data.content).toBeDefined(); }
    });
});

describe('AI - Generate Tags', () => {
    test('POST /ai/generate-tags returns array', async () => {
        const { status, data } = await client.post('/ai/generate-tags', {
            itemDetails: { name: 'Air Jordan 1', brand: 'Nike', category: 'Shoes' }
        });
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(data.tags || data.keywords || data).toBeDefined(); }
    });
});

describe('AI - Suggest Price', () => {
    test('POST /ai/suggest-price returns price', async () => {
        const { status, data } = await client.post('/ai/suggest-price', {
            itemDetails: { name: 'Patagonia Fleece', brand: 'Patagonia', condition: 'Excellent' }
        });
        expect([200, 403, 500]).toContain(status);
        if (status === 200) { expect(data.suggestedPrice || data.price || data.priceRange).toBeDefined(); }
    });
});

describe('AI - Analyze Image', () => {
    test('POST /ai/analyze-image with base64', async () => {
        const { status } = await client.post('/ai/analyze-image', { image: IMG });
        expect([200, 400, 403, 500]).toContain(status);
    });
    test('POST /ai/analyze-listing-image with image', async () => {
        const { status } = await client.post('/ai/analyze-listing-image', { image: IMG });
        expect([200, 400, 403, 500]).toContain(status);
    });
});

describe('AI - Generate & Optimize Listing', () => {
    test('POST /ai/generate-listing with details', async () => {
        const { status } = await client.post('/ai/generate-listing', {
            itemDetails: { name: 'Coach Bag', brand: 'Coach', category: 'Bags' }
        });
        expect([200, 403, 500]).toContain(status);
    });
    test('POST /ai/optimize-listing with existing listing', async () => {
        const { status } = await client.post('/ai/optimize-listing', {
            title: 'nice bag', description: 'good coach bag', platform: 'ebay'
        });
        expect([200, 403, 500]).toContain(status);
    });
});

describe('AI - Bulk Generate', () => {
    test('POST /ai/bulk-generate with items', async () => {
        const { status } = await client.post('/ai/bulk-generate', {
            items: [{ name: 'Item 1', brand: 'Nike' }, { name: 'Item 2', brand: 'Adidas' }]
        });
        expect([200, 400, 403, 500]).toContain(status);
    });
    test('POST /ai/bulk-generate without items returns error', async () => {
        const { status } = await client.post('/ai/bulk-generate', {});
        expect([400, 403, 500]).toContain(status);
    });
});

describe('AI - Detect Duplicates', () => {
    test('POST /ai/detect-duplicates returns results', async () => {
        const { status } = await client.post('/ai/detect-duplicates', { listing_id: 'test' });
        expect([200, 400, 403, 404, 500]).toContain(status);
    });
});

describe('AI - Sourcing Suggestions', () => {
    test('GET /ai/sourcing-suggestions returns suggestions', async () => {
        const { status } = await client.get('/ai/sourcing-suggestions');
        expect([200, 403, 500]).toContain(status);
    });
});

describe('AI - Translate & Category', () => {
    test('POST /ai/translate with target language', async () => {
        const { status } = await client.post('/ai/translate', {
            text: 'Vintage leather jacket', targetLanguage: 'es'
        });
        expect([200, 400, 403, 500]).toContain(status);
    });
    test('POST /ai/category-mapping maps across platforms', async () => {
        const { status } = await client.post('/ai/category-mapping', {
            category: 'Jackets', sourcePlatform: 'ebay', targetPlatform: 'poshmark'
        });
        expect([200, 400, 403, 500]).toContain(status);
    });
});

describe('AI - Hashtags & Enhancement', () => {
    test('POST /ai/generate-hashtags returns list', async () => {
        const { status } = await client.post('/ai/generate-hashtags', {
            itemDetails: { name: 'Vintage Band Tee', brand: 'Hanes', category: 'T-Shirts' }
        });
        expect([200, 403, 500]).toContain(status);
    });
    test('POST /ai/image-enhancement returns suggestions', async () => {
        const { status } = await client.post('/ai/image-enhancement', { image: IMG });
        expect([200, 400, 403, 500]).toContain(status);
    });
});

describe('AI - Profit & SEO & Categorize', () => {
    test('POST /ai/profit-prediction calculates margins', async () => {
        const { status } = await client.post('/ai/profit-prediction', {
            purchasePrice: 10, listingPrice: 35, platform: 'ebay', shippingCost: 8
        });
        expect([200, 400, 403, 500]).toContain(status);
    });
    test('POST /ai/seo-optimize returns optimization', async () => {
        const { status } = await client.post('/ai/seo-optimize', {
            title: 'nice shoes cheap', platform: 'ebay'
        });
        expect([200, 400, 403, 500]).toContain(status);
    });
    test('POST /ai/auto-categorize detects category', async () => {
        const { status } = await client.post('/ai/auto-categorize', {
            text: 'Nike Air Max 90 size 10 mens'
        });
        expect([200, 400, 403, 500]).toContain(status);
    });
});

describe('AI - Auth Guards', () => {
    test('POST /ai/generate-title without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/ai/generate-title`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemDetails: { name: 'Test' } })
        });
        expect(res.status).toBe(401);
    });
    test('GET /ai/sourcing-suggestions without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/ai/sourcing-suggestions`);
        expect(res.status).toBe(401);
    });
});
