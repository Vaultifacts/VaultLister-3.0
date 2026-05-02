import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'path';

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const DOCS_DIR = join(import.meta.dir, '..', '..', 'public', 'api-docs');

describe('API Documentation', () => {
    test('openapi.yaml exists and is non-empty', () => {
        const yamlPath = join(DOCS_DIR, 'openapi.yaml');
        expect(existsSync(yamlPath)).toBe(true);
        const content = readFileSync(yamlPath, 'utf-8');
        expect(content.length).toBeGreaterThan(1000);
    });

    test('openapi.yaml has valid OpenAPI 3.0 structure', () => {
        const content = readFileSync(join(DOCS_DIR, 'openapi.yaml'), 'utf-8');
        expect(content).toContain('openapi: 3.0');
        expect(content).toContain('info:');
        expect(content).toContain('paths:');
        expect(content).toContain('components:');
        expect(content).toContain('securitySchemes:');
        expect(content).toContain('bearerAuth:');
    });

    test('openapi.yaml contains all major route groups', () => {
        const content = readFileSync(join(DOCS_DIR, 'openapi.yaml'), 'utf-8');
        const requiredPaths = [
            '/auth/login:',
            '/inventory:',
            '/listings:',
            '/sales:',
            '/orders/',
            '/offers/',
            '/tasks/',
            '/checklists/',
            '/calendar/',
            '/notifications:',
            '/chatbot/',
            '/financials/',
            '/monitoring/',
            '/security/',
            '/gdpr/',
            '/billing/',
            '/feedback/',
            '/community/',
            '/help/',
            '/legal/',
            '/image-vault/',
            '/shipping-labels/',
            '/whatnot/',
            '/relisting/',
            '/recently-deleted:',
            '/extension/',
            '/onboarding/',
        ];
        for (const p of requiredPaths) {
            expect(content).toContain(p);
        }
    });

    test('openapi.yaml has at least 300 path entries', () => {
        const content = readFileSync(join(DOCS_DIR, 'openapi.yaml'), 'utf-8');
        // Count path entries (lines that match '  /something:' at indent level 2)
        const pathLines = content.split('\n').filter(line => /^  \/[^:]+:\r?$/.test(line));
        expect(pathLines.length).toBeGreaterThanOrEqual(300);
    });

    test('index.html exists and references Swagger UI', () => {
        const htmlPath = join(DOCS_DIR, 'index.html');
        expect(existsSync(htmlPath)).toBe(true);
        const content = readFileSync(htmlPath, 'utf-8');
        expect(content).toContain('swagger-ui');
        expect(content).toContain('openapi.yaml');
    });

    test('GET /api-docs/openapi.yaml returns 200', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api-docs/openapi.yaml`);
            expect(res.status).toBe(200);
            const text = await res.text();
            expect(text).toContain('openapi: 3.0');
        } catch (e) {
            // Server may not be running in CI
            if (e.code === 'ECONNREFUSED') return;
            throw e;
        }
    });

    test('GET /api-docs/index.html returns 200', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api-docs/index.html`);
            expect(res.status).toBe(200);
            const text = await res.text();
            expect(text).toContain('swagger-ui');
        } catch (e) {
            if (e.code === 'ECONNREFUSED') return;
            throw e;
        }
    });

    test('openapi.yaml contains all expected tags', () => {
        const content = readFileSync(join(DOCS_DIR, 'openapi.yaml'), 'utf-8');
        const expectedTags = [
            'Authentication', 'Inventory', 'Listings', 'Sales', 'Orders',
            'Offers', 'Tasks', 'Templates', 'Checklists', 'Calendar',
            'Shops', 'OAuth', 'Webhooks', 'Push Notifications', 'Email',
            'Notion', 'Automations', 'Analytics', 'Security', 'GDPR',
            'Monitoring', 'Financials', 'Notifications', 'Chatbot',
            'Watermark', 'Whatnot', 'Community', 'Feedback', 'Roadmap',
            'Help Center', 'Legal', 'Onboarding', 'AI', 'Health',
        ];
        for (const tag of expectedTags) {
            expect(content).toContain(`name: ${tag}`);
        }
    });

    test('openapi.yaml has reusable component schemas', () => {
        const content = readFileSync(join(DOCS_DIR, 'openapi.yaml'), 'utf-8');
        const requiredSchemas = [
            'Error', 'AuthResponse', 'User', 'InventoryItem',
            'Listing', 'Sale', 'Shop', 'Automation', 'AnalyticsOverview',
            'Order', 'Offer', 'Notification', 'Transaction',
        ];
        for (const schema of requiredSchemas) {
            expect(content).toContain(`    ${schema}:`);
        }
    });
});
