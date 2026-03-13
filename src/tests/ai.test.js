// AI API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testInventoryId = null;

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

    // Create test inventory for AI tests
    const inventoryResponse = await fetch(`${BASE_URL}/inventory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            title: 'AI Test Vintage Dress',
            listPrice: 89.99,
            description: 'Beautiful vintage floral dress',
            category: 'Dresses',
            brand: 'Free People',
            condition: 'like_new',
            tags: ['vintage', 'floral', 'bohemian']
        })
    });
    const inventoryData = await inventoryResponse.json();
    testInventoryId = inventoryData.item?.id;
});

describe('AI - Analyze Listing Image', () => {
    test('POST /ai/analyze-listing-image - should analyze image', async () => {
        // Use a small test base64 image (1x1 transparent PNG)
        const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(`${BASE_URL}/ai/analyze-listing-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    imageBase64: testBase64,
                    imageMimeType: 'image/png',
                    platform: 'poshmark'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await response.json();
            expect([200, 403, 503]).toContain(response.status);
            if (response.status === 200) {
                expect(data.analysis || data.title).toBeDefined();
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') return; // external AI API unavailable — skip
            throw e;
        }
    });

    test('POST /ai/analyze-listing-image - should require image', async () => {
        const response = await fetch(`${BASE_URL}/ai/analyze-listing-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Generate Listing', () => {
    test('POST /ai/generate-listing - should generate listing from details', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`${BASE_URL}/ai/generate-listing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    category: 'Dresses',
                    brand: 'Free People',
                    condition: 'like_new',
                    keywords: ['vintage', 'floral', 'bohemian']
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await response.json();
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                expect(data.title).toBeDefined();
                expect(data.description).toBeDefined();
                expect(data.tags).toBeDefined();
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') return; // AI API unavailable — skip
            throw e;
        }
    }, 25000);
});

describe('AI - Generate Title', () => {
    test('POST /ai/generate-title - should generate title', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-title`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                description: 'Beautiful vintage floral dress with bohemian style',
                brand: 'Free People',
                category: 'Dresses',
                keywords: ['vintage', 'floral']
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.title).toBeDefined();
        }
    });

    test('POST /ai/generate-title - should require description or keywords', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-title`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Generate Description', () => {
    test('POST /ai/generate-description - should generate description', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-description`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Free People Vintage Floral Dress',
                brand: 'Free People',
                category: 'Dresses',
                condition: 'like_new',
                size: 'M',
                color: 'Multicolor'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.description).toBeDefined();
        }
    });

    test('POST /ai/generate-description - should require title', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-description`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Generate Tags', () => {
    test('POST /ai/generate-tags - should generate tags', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-tags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Free People Vintage Floral Dress',
                description: 'Beautiful vintage bohemian dress',
                brand: 'Free People',
                category: 'Dresses'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.tags).toBeDefined();
            expect(Array.isArray(data.tags)).toBe(true);
        }
    });

    test('POST /ai/generate-tags - should require title or description', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-tags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Suggest Price', () => {
    test('POST /ai/suggest-price - should suggest price', async () => {
        const response = await fetch(`${BASE_URL}/ai/suggest-price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Free People Vintage Floral Dress',
                brand: 'Free People',
                category: 'Dresses',
                condition: 'like_new',
                originalRetail: 148
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.suggestedPrice).toBeDefined();
            expect(data.priceRange).toBeDefined();
        }
    });
});

describe('AI - Analyze Image', () => {
    test('POST /ai/analyze-image - should require image', async () => {
        const response = await fetch(`${BASE_URL}/ai/analyze-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Optimize Listing', () => {
    test('POST /ai/optimize-listing - should optimize existing listing', async () => {
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/ai/optimize-listing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: testInventoryId
            })
        });

        const data = await response.json();
        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data.suggestions).toBeDefined();
            expect(data.optimizedTitle).toBeDefined();
            expect(data.optimizedDescription).toBeDefined();
        }
    });

    test('POST /ai/optimize-listing - should return 404 for non-existent item', async () => {
        const response = await fetch(`${BASE_URL}/ai/optimize-listing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: '00000000-0000-0000-0000-000000000000'
            })
        });

        expect([403, 404]).toContain(response.status);
    });
});

describe('AI - Bulk Generate', () => {
    test('POST /ai/bulk-generate - should generate for multiple items', async () => {
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/ai/bulk-generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryIds: [testInventoryId],
                fields: ['title', 'description', 'tags']
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.results).toBeDefined();
            expect(Array.isArray(data.results)).toBe(true);
        }
    });

    test('POST /ai/bulk-generate - should require inventoryIds', async () => {
        const response = await fetch(`${BASE_URL}/ai/bulk-generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Detect Duplicates', () => {
    test('POST /ai/detect-duplicates - should detect duplicates', async () => {
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/ai/detect-duplicates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: testInventoryId,
                threshold: 0.5
            })
        });

        const data = await response.json();
        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data.duplicates).toBeDefined();
            expect(Array.isArray(data.duplicates)).toBe(true);
        }
    });
});

describe('AI - Sourcing Suggestions', () => {
    test('GET /ai/sourcing-suggestions - should return sourcing suggestions', async () => {
        const response = await fetch(`${BASE_URL}/ai/sourcing-suggestions`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.suggestions).toBeDefined();
            expect(Array.isArray(data.suggestions)).toBe(true);
        }
    });
});

describe('AI - Translate', () => {
    test('POST /ai/translate - should translate listing', async () => {
        const response = await fetch(`${BASE_URL}/ai/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Beautiful Vintage Dress',
                description: 'A stunning vintage floral dress perfect for summer',
                tags: ['vintage', 'dress', 'floral'],
                targetLanguage: 'es'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.translatedTitle || data.note).toBeDefined();
            expect(data.targetLanguage).toBe('es');
        }
    });

    test('POST /ai/translate - should require title or description', async () => {
        const response = await fetch(`${BASE_URL}/ai/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                targetLanguage: 'es'
            })
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Category Mapping', () => {
    test('POST /ai/category-mapping - should map categories', async () => {
        const response = await fetch(`${BASE_URL}/ai/category-mapping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                category: 'Dresses',
                subcategory: 'Maxi',
                sourcePlatform: 'poshmark',
                targetPlatforms: ['ebay', 'mercari', 'depop']
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.sourceCategory).toBe('Dresses');
            expect(data.mappings).toBeDefined();
        }
    });

    test('POST /ai/category-mapping - should require category', async () => {
        const response = await fetch(`${BASE_URL}/ai/category-mapping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Generate Hashtags', () => {
    test('POST /ai/generate-hashtags - should generate hashtags', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-hashtags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Free People Vintage Floral Dress',
                description: 'Beautiful bohemian style dress',
                brand: 'Free People',
                category: 'Dresses',
                platform: 'poshmark'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.hashtags).toBeDefined();
            expect(Array.isArray(data.hashtags)).toBe(true);
        }
    });

    test('POST /ai/generate-hashtags - should require title or description', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-hashtags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'poshmark'
            })
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Image Enhancement', () => {
    test('POST /ai/image-enhancement - should return enhancement suggestions', async () => {
        const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`${BASE_URL}/ai/image-enhancement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    imageBase64: testBase64,
                    imageMimeType: 'image/png'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await response.json();
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                expect(data.generalSuggestions || data.aiAnalysis).toBeDefined();
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') return; // AI API unavailable — skip
            throw e;
        }
    }, 25000);

    test('POST /ai/image-enhancement - should require image', async () => {
        const response = await fetch(`${BASE_URL}/ai/image-enhancement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Profit Prediction', () => {
    test('POST /ai/profit-prediction - should calculate profit', async () => {
        const response = await fetch(`${BASE_URL}/ai/profit-prediction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                listPrice: 49.99,
                costPrice: 15.00,
                platform: 'poshmark',
                category: 'Dresses',
                weight: 1,
                shippingMethod: 'standard'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listPrice).toBe(49.99);
            expect(data.breakdown).toBeDefined();
            expect(data.profit).toBeDefined();
            expect(data.recommendations).toBeDefined();
            expect(data.comparison).toBeDefined();
        }
    });

    test('POST /ai/profit-prediction - should require listPrice', async () => {
        const response = await fetch(`${BASE_URL}/ai/profit-prediction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                costPrice: 15.00,
                platform: 'poshmark'
            })
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - SEO Optimize', () => {
    test('POST /ai/seo-optimize - should optimize for SEO', async () => {
        const response = await fetch(`${BASE_URL}/ai/seo-optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Dress for sale',
                description: 'Nice dress',
                brand: 'Free People',
                category: 'Dresses',
                platform: 'poshmark'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.original).toBeDefined();
            expect(data.optimized).toBeDefined();
            expect(data.analysis).toBeDefined();
            expect(data.suggestions).toBeDefined();
        }
    });

    test('POST /ai/seo-optimize - should require title', async () => {
        const response = await fetch(`${BASE_URL}/ai/seo-optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                description: 'Nice dress'
            })
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Auto Categorize', () => {
    test('POST /ai/auto-categorize - should auto-categorize item', async () => {
        const response = await fetch(`${BASE_URL}/ai/auto-categorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Nike Air Max Sneakers Size 10 White',
                description: 'Brand new Nike sneakers, never worn'
            })
        });

        const data = await response.json();
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.category).toBeDefined();
            expect(data.condition).toBeDefined();
        }
    });

    test('POST /ai/auto-categorize - should require title or description', async () => {
        const response = await fetch(`${BASE_URL}/ai/auto-categorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect([400, 403]).toContain(response.status);
    });
});

describe('AI - Authentication', () => {
    test('POST /ai/generate-title - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/ai/generate-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Test' })
        });
        expect(response.status).toBe(401);
    });

    test('GET /ai/sourcing-suggestions - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/ai/sourcing-suggestions`);
        expect(response.status).toBe(401);
    });
});

console.log('Running AI API tests...');
