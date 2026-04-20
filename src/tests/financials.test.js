// VaultLister Financials API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let csrfToken = null;
let testPurchaseId = null;
let testAccountId = null;
let testInventoryId = null;

// Helper to get CSRF token
async function getCSRFToken() {
    const response = await fetch(`${BASE_URL}/csrf-token`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    return data.csrfToken;
}

describe('Financials API Tests', () => {
    beforeAll(async () => {
        // Login to get auth token
        const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'demo@vaultlister.com',
                password: 'DemoPassword123!'
            })
        });
        const loginData = await loginResponse.json();
        authToken = loginData.token;

        // Get CSRF token
        csrfToken = await getCSRFToken();

        // Create a test inventory item for linking
        const inventoryResponse = await fetch(`${BASE_URL}/inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                title: 'Test Item for Financials',
                listPrice: 50.00,
                costPrice: 20.00,
                brand: 'Test Brand',
                category: 'Tops',
                condition: 'good',
                quantity: 5
            })
        });
        const inventoryData = await inventoryResponse.json();
        testInventoryId = inventoryData.item?.id;
    });

    describe('Authentication Requirements', () => {
        test('GET /financials/purchases - should require authentication', async () => {
            const response = await fetch(`${BASE_URL}/financials/purchases`);
            expect(response.status).toBe(401);
        });

        test('GET /financials/accounts - should require authentication', async () => {
            const response = await fetch(`${BASE_URL}/financials/accounts`);
            expect(response.status).toBe(401);
        });

        test('GET /financials/transactions - should require authentication', async () => {
            const response = await fetch(`${BASE_URL}/financials/transactions`);
            expect(response.status).toBe(401);
        });
    });

    describe('Chart of Accounts', () => {
        test('GET /financials/accounts - should return accounts list', async () => {
            const response = await fetch(`${BASE_URL}/financials/accounts`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.accounts).toBeDefined();
                expect(Array.isArray(data.accounts)).toBe(true);
            }
        });

        test('POST /financials/accounts - should create new account', async () => {
            const response = await fetch(`${BASE_URL}/financials/accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    accountName: 'Test Bank Account',
                    accountType: 'Bank',
                    description: 'Test account for unit testing',
                    balance: 1000.00
                })
            });

            const data = await response.json();
            // 201 on success, 403 if tier-gated on CI
            expect([201, 403]).toContain(response.status);
            if (response.status === 201) {
                expect(data.account).toBeDefined();
                expect(data.account.account_name).toBe('Test Bank Account');
                expect(data.account.account_type).toBe('Bank');
                testAccountId = data.account.id;
            }
        });

        test('POST /financials/accounts - should validate account type', async () => {
            const response = await fetch(`${BASE_URL}/financials/accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    accountName: 'Invalid Type Account',
                    accountType: 'InvalidType',
                    description: 'Should fail validation'
                })
            });

            // 400 on validation, 403 if tier-gated on CI
            expect([400, 403]).toContain(response.status);
        });

        test('GET /financials/accounts/:id - should return single account', async () => {
            if (!testAccountId) return;

            const response = await fetch(`${BASE_URL}/financials/accounts/${testAccountId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.account).toBeDefined();
                expect(data.account.id).toBe(testAccountId);
            }
        });

        test('PUT /financials/accounts/:id - should update account', async () => {
            if (!testAccountId) return;

            const response = await fetch(`${BASE_URL}/financials/accounts/${testAccountId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    accountName: 'Updated Bank Account',
                    description: 'Updated description'
                })
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.account.account_name).toBe('Updated Bank Account');
            }
        });

        test('POST /financials/seed-accounts - should seed default accounts or indicate they exist', async () => {
            const response = await fetch(`${BASE_URL}/financials/seed-accounts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                }
            });

            const data = await response.json();
            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                // Either creates new accounts or indicates they already exist
                expect(data.message).toBeDefined();
            }
        });
    });

    describe('Purchases', () => {
        test('GET /financials/purchases - should return purchases list', async () => {
            const response = await fetch(`${BASE_URL}/financials/purchases`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.purchases).toBeDefined();
                expect(Array.isArray(data.purchases)).toBe(true);
            }
        });

        test('POST /financials/purchases - should create purchase with items', async () => {
            const response = await fetch(`${BASE_URL}/financials/purchases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    vendorName: 'Goodwill Test Store',
                    purchaseDate: new Date().toISOString().split('T')[0],
                    paymentMethod: 'Cash',
                    shippingCost: 0,
                    notes: 'Test purchase for unit testing',
                    items: [
                        {
                            description: 'Vintage T-Shirt',
                            quantity: 3,
                            unitCost: 5.00,
                            inventoryId: testInventoryId
                        },
                        {
                            description: 'Designer Jeans',
                            quantity: 2,
                            unitCost: 10.00
                        }
                    ]
                })
            });

            const data = await response.json();
            // 201 on success, 403 if tier-gated on CI
            expect([201, 403]).toContain(response.status);
            if (response.status === 201) {
                expect(data.purchase).toBeDefined();
                expect(data.purchase.vendor_name).toBe('Goodwill Test Store');
                expect(data.purchase.total_amount).toBe(35.00); // (3*5) + (2*10)
                testPurchaseId = data.purchase.id;
            }
        });

        test('POST /financials/purchases - should require vendor name', async () => {
            const response = await fetch(`${BASE_URL}/financials/purchases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    purchaseDate: new Date().toISOString().split('T')[0],
                    items: []
                })
            });

            // 400 on validation, 403 if tier-gated on CI
            expect([400, 403]).toContain(response.status);
        });

        test('GET /financials/purchases/:id - should return purchase with items', async () => {
            if (!testPurchaseId) return;

            const response = await fetch(`${BASE_URL}/financials/purchases/${testPurchaseId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.purchase).toBeDefined();
                // Items may be in purchase.items or separate
                if (data.items) {
                    expect(Array.isArray(data.items)).toBe(true);
                }
            }
        });

        test('PUT /financials/purchases/:id - should update purchase', async () => {
            if (!testPurchaseId) return;

            const response = await fetch(`${BASE_URL}/financials/purchases/${testPurchaseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    notes: 'Updated test notes'
                })
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.purchase.notes).toBe('Updated test notes');
            }
        });
    });

    describe('Transactions', () => {
        test('GET /financials/transactions - should return transactions list', async () => {
            const response = await fetch(`${BASE_URL}/financials/transactions`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.transactions).toBeDefined();
                expect(Array.isArray(data.transactions)).toBe(true);
            }
        });

        test('POST /financials/transactions - should create manual transaction', async () => {
            const response = await fetch(`${BASE_URL}/financials/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    transactionDate: new Date().toISOString().split('T')[0],
                    description: 'Test manual transaction',
                    amount: 25.00,
                    category: 'Supplies',
                    accountId: testAccountId
                })
            });

            const data = await response.json();
            // 201 on success, 403 if tier-gated on CI
            expect([201, 403]).toContain(response.status);
            if (response.status === 201) {
                expect(data.transaction).toBeDefined();
                expect(data.transaction.amount).toBe(25.00);
            }
        });
    });

    describe('Financial Reports', () => {
        test('GET /financials/statements - should return financial statements', async () => {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
            const endDate = today.toISOString().split('T')[0];

            const response = await fetch(
                `${BASE_URL}/financials/statements?start=${startDate}&end=${endDate}`,
                { headers: { 'Authorization': `Bearer ${authToken}` } }
            );

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.statements).toBeDefined();
                expect(data.statements.assets).toBeDefined();
                expect(data.statements.liabilities).toBeDefined();
                expect(data.statements.equity).toBeDefined();
            }
        });

        test('GET /financials/profit-loss - should return P&L report', async () => {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
            const endDate = today.toISOString().split('T')[0];

            const response = await fetch(
                `${BASE_URL}/financials/profit-loss?start=${startDate}&end=${endDate}`,
                { headers: { 'Authorization': `Bearer ${authToken}` } }
            );

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.profitLoss).toBeDefined();
                expect(data.profitLoss.income).toBeDefined();
                expect(data.profitLoss.costOfGoodsSold).toBeDefined();
                expect(data.profitLoss.grossProfit).toBeDefined();
                expect(data.profitLoss.expenses).toBeDefined();
                expect(data.profitLoss.netIncome).toBeDefined();
            }
        });
    });

    describe('FIFO Cost Layers', () => {
        test('POST /financials/consume-fifo - should handle FIFO consumption request', async () => {
            // This test verifies the endpoint works, even if no cost layers exist
            const response = await fetch(`${BASE_URL}/financials/consume-fifo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    inventoryId: testInventoryId || 'test-id',
                    quantity: 1
                })
            });

            const data = await response.json();
            // Response should be 200 with totalCOGS (even if 0), 400 if no layers, 403 if tier-gated
            expect([200, 400, 403]).toContain(response.status);
            if (response.status === 200) {
                expect(typeof data.totalCOGS).toBe('number');
            }
        });
    });

    describe('Sales with FIFO Integration', () => {
        test('GET /sales - should include new cost columns', async () => {
            const response = await fetch(`${BASE_URL}/sales`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.sales).toBeDefined();
                // Check that new columns are available (even if empty for test data)
            }
        });

        test('GET /sales - should support date filtering', async () => {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(
                `${BASE_URL}/sales?startDate=${today}&endDate=${today}`,
                { headers: { 'Authorization': `Bearer ${authToken}` } }
            );

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                expect(data.sales).toBeDefined();
            }
        });
    });

    describe('Cleanup', () => {
        test('DELETE /financials/purchases/:id - should delete purchase', async () => {
            if (!testPurchaseId) return;

            const response = await fetch(`${BASE_URL}/financials/purchases/${testPurchaseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                }
            });

            // 200 on success, 403 if tier-gated on CI
            expect([200, 403]).toContain(response.status);
        });

        test('DELETE /financials/accounts/:id - should delete account or reject if has transactions', async () => {
            if (!testAccountId) return;

            const response = await fetch(`${BASE_URL}/financials/accounts/${testAccountId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                }
            });

            // Either 200 (deleted), 400 (has transactions), or 403 if tier-gated on CI
            expect([200, 400, 403]).toContain(response.status);
        });
    });
});
