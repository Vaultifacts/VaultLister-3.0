// Test Data Factories and Fixtures

export const fixtures = {
    user: (overrides = {}) => ({
        email: `test${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: `testuser${Date.now()}`,
        fullName: 'Test User',
        ...overrides
    }),

    inventoryItem: (overrides = {}) => ({
        title: `Test Item ${Date.now()}`,
        description: 'A test inventory item for automated testing',
        brand: 'Test Brand',
        category: 'Tops',
        subcategory: 'T-Shirts',
        size: 'M',
        color: 'Blue',
        condition: 'good',
        costPrice: 10.00,
        listPrice: 25.00,
        quantity: 1,
        tags: ['test', 'automated'],
        ...overrides
    }),

    listing: (inventoryId, overrides = {}) => ({
        inventoryId,
        platform: 'poshmark',
        title: `Test Listing ${Date.now()}`,
        price: 25.00,
        ...overrides
    }),

    automationRule: (overrides = {}) => ({
        name: `Test Rule ${Date.now()}`,
        type: 'share',
        platform: 'poshmark',
        schedule: '0 9 * * *',
        conditions: { minPrice: 10 },
        actions: { shareAll: true },
        isEnabled: true,
        ...overrides
    }),

    offer: (listingId, overrides = {}) => ({
        listingId,
        platform: 'poshmark',
        buyerUsername: 'test_buyer',
        offerAmount: 20.00,
        status: 'pending',
        ...overrides
    }),

    sale: (overrides = {}) => ({
        platform: 'poshmark',
        buyerUsername: 'happy_buyer',
        salePrice: 50.00,
        platformFee: 10.00,
        shippingCost: 7.67,
        status: 'pending',
        ...overrides
    })
};

// Security test payloads
export const securityPayloads = {
    sqlInjection: [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'--",
        "1; SELECT * FROM users",
        "' UNION SELECT password FROM users --",
        "'; UPDATE users SET password='hacked' WHERE '1'='1",
        "1' OR '1' = '1' /*",
        "' OR 1=1--",
        "') OR ('1'='1"
    ],

    xss: [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert(document.cookie)</script>',
        "javascript:alert('xss')",
        '<svg onload=alert("xss")>',
        '<body onload=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')">',
        '<input onfocus=alert("xss") autofocus>',
        '{{constructor.constructor("alert(1)")()}}'
    ],

    malformedTokens: [
        'not.a.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        '',
        'null',
        'undefined',
        'Bearer',
        '...',
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiIxMjM0NSJ9.',
        'a]b[c'
    ],

    pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f',
        '..%252f..%252f'
    ],

    commandInjection: [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(id)',
        '&& rm -rf /'
    ]
};

// Demo user credentials (from seed data)
// Password meets security requirements: 12+ chars, uppercase, lowercase, number, special char
export const demoUser = {
    email: 'demo@vaultlister.com',
    password: 'DemoPassword123!'
};
