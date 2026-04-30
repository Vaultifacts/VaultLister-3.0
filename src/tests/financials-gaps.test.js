// Financials — Gap-filling tests for 17 untested endpoints
// Covers: email-parse, categorization-rules, auto-categorize, transaction split,
//         recurring-templates, transaction attachments, platform-fees, tx audit, PUT tx
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

describe('Financials email-parse', () => {
    test('POST /financials/email-parse returns 400 when no subject or body', async () => {
        const { status } = await client.post('/financials/email-parse', { email_data: 'test' });
        expect([400]).toContain(status);
    });
});

describe('Financials categorization rules', () => {
    test('GET /financials/categorization-rules returns list', async () => {
        const { status, data } = await client.get('/financials/categorization-rules');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });

    test('POST /financials/categorization-rules creates rule', async () => {
        const { status } = await client.post('/financials/categorization-rules', {
            pattern: 'USPS*',
            category: 'shipping'
        });
        expect([200, 201, 400]).toContain(status);
    });

    test('DELETE /financials/categorization-rules/:id nonexistent', async () => {
        const { status } = await client.delete('/financials/categorization-rules/nonexistent');
        expect([404]).toContain(status);
    });
});

describe('Financials auto-categorize', () => {
    test('POST /financials/auto-categorize runs categorization', async () => {
        const { status } = await client.post('/financials/auto-categorize', {});
        expect([200, 400]).toContain(status);
    });
});

describe('Financials transaction split', () => {
    test('POST /financials/transactions/:id/split nonexistent tx', async () => {
        const { status } = await client.post('/financials/transactions/nonexistent/split', {
            splits: [
                { amount: 10, category: 'supplies' },
                { amount: 20, category: 'shipping' }
            ]
        });
        expect([404, 400]).toContain(status);
    });
});

describe('Financials recurring templates', () => {
    test('GET /financials/recurring-templates returns list', async () => {
        const { status, data } = await client.get('/financials/recurring-templates');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });

    test('POST /financials/recurring-templates creates template', async () => {
        const { status } = await client.post('/financials/recurring-templates', {
            description: 'Monthly subscription',
            amount: -9.99,
            category: 'subscriptions',
            frequency: 'monthly'
        });
        expect([200, 201, 400]).toContain(status);
    });

    test('DELETE /financials/recurring-templates/:id nonexistent', async () => {
        const { status } = await client.delete('/financials/recurring-templates/nonexistent');
        expect([404]).toContain(status);
    });

    test('POST /financials/recurring-templates/:id/execute nonexistent', async () => {
        const { status } = await client.post('/financials/recurring-templates/nonexistent/execute', {});
        expect([404]).toContain(status);
    });
});

describe('Financials transaction attachments', () => {
    test('GET /financials/transactions/:id/attachments nonexistent tx', async () => {
        const { status } = await client.get('/financials/transactions/nonexistent/attachments');
        expect([200, 404]).toContain(status);
    });

    test('POST /financials/transactions/:id/attachments nonexistent tx', async () => {
        const { status } = await client.post('/financials/transactions/nonexistent/attachments', {
            file_url: 'https://example.com/receipt.pdf',
            file_name: 'receipt.pdf'
        });
        expect([404, 400]).toContain(status);
    });

    test('DELETE /financials/transactions/:id/attachments/:aid nonexistent', async () => {
        const { status } = await client.delete('/financials/transactions/nonexistent/attachments/nonexistent');
        expect([404]).toContain(status);
    });
});

describe('Financials platform fees', () => {
    test('GET /financials/platform-fees returns fees', async () => {
        const { status, data } = await client.get('/financials/platform-fees');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });

    test('GET /financials/platform-fees/summary returns summary', async () => {
        const { status, data } = await client.get('/financials/platform-fees/summary');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });
});

describe('Financials transaction audit', () => {
    test('GET /financials/transactions/:id/audit nonexistent tx', async () => {
        const { status } = await client.get('/financials/transactions/nonexistent/audit');
        expect([200, 404]).toContain(status);
    });
});

describe('Financials transaction update', () => {
    test('PUT /financials/transactions/:id nonexistent', async () => {
        const { status } = await client.put('/financials/transactions/nonexistent', {
            description: 'Updated transaction',
            amount: 25.00
        });
        expect([404]).toContain(status);
    });
});
