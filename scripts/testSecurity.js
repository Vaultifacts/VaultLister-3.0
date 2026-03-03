#!/usr/bin/env bun
// Security Features Test Suite
// Tests rate limiting, CSRF protection, input validation, and security headers

const BASE_URL = 'http://localhost:3000';

console.log('=== VaultLister Security Features Test ===\n');

const results = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function pass(test) {
    results.passed++;
    console.log(`✓ ${test}`);
}

function fail(test, error) {
    results.failed++;
    console.log(`✗ ${test}: ${error}`);
}

function warn(test, message) {
    results.warnings++;
    console.log(`⚠ ${test}: ${message}`);
}

// Helper to make API requests
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
        });

        let data;
        try {
            data = await response.json();
        } catch {
            data = await response.text();
        }

        return { status: response.status, data, headers };
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

// Test 1: XSS Protection
console.log('\n🛡️  Testing XSS Protection...\n');

try {
    const loginResponse = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });

    if (loginResponse.status === 200 && loginResponse.data.token) {
        const token = loginResponse.data.token;

        // Get CSRF token first
        const csrfResponse = await apiRequest('/api/inventory?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const csrfToken = csrfResponse.headers['x-csrf-token'];

        // Try to create item with XSS payload
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<iframe src="evil.com"></iframe>'
        ];

        for (const payload of xssPayloads) {
            const response = await apiRequest('/api/inventory', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-CSRF-Token': csrfToken || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: payload,
                    listPrice: 50
                })
            });

            if (response.status === 400 || response.status === 403) {
                // Request blocked or validated
                pass(`XSS blocked: ${payload.substring(0, 30)}...`);
            } else if (response.data.item) {
                // Check if sanitized
                const title = response.data.item.title;
                if (!title.includes('<script>') && !title.includes('onerror') && !title.includes('javascript:')) {
                    pass(`XSS sanitized: ${payload.substring(0, 30)}...`);
                } else {
                    fail(`XSS not sanitized`, payload);
                }
            }
        }
    } else {
        warn('Authentication', 'Could not login to test XSS protection');
    }
} catch (error) {
    warn('XSS Test', error.message);
}

// Test 2: CSRF Protection
console.log('\n🔒 Testing CSRF Protection...\n');

try {
    const loginResponse = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });

    if (loginResponse.data.token) {
        const token = loginResponse.data.token;

        // Test POST without CSRF token
        const noTokenResponse = await apiRequest('/api/inventory', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Test Item',
                listPrice: 50
            })
        });

        if (noTokenResponse.status === 403 && noTokenResponse.data.error?.includes('CSRF')) {
            pass('CSRF: POST blocked without token');
        } else {
            fail('CSRF Protection', 'POST allowed without CSRF token');
        }

        // Get CSRF token
        const csrfResponse = await apiRequest('/api/inventory?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const csrfToken = csrfResponse.headers['x-csrf-token'];

        if (csrfToken) {
            pass('CSRF: Token generated and provided');

            // Test POST with valid CSRF token
            const validTokenResponse = await apiRequest('/api/inventory', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-CSRF-Token': csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: 'Test CSRF Item',
                    listPrice: 45.00
                })
            });

            if (validTokenResponse.status === 201 || validTokenResponse.status === 200) {
                pass('CSRF: POST allowed with valid token');
            } else {
                warn('CSRF', `POST with token returned status ${validTokenResponse.status}`);
            }
        } else {
            warn('CSRF', 'No CSRF token in response headers');
        }
    }
} catch (error) {
    warn('CSRF Test', error.message);
}

// Test 3: Rate Limiting
console.log('\n⏱️  Testing Rate Limiting...\n');

try {
    const loginResponse = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });

    if (loginResponse.data.token) {
        const token = loginResponse.data.token;

        // Make multiple requests to trigger rate limit (default: 100/min)
        console.log('Making 105 rapid requests...');
        let rateLimited = false;

        for (let i = 0; i < 105; i++) {
            const response = await apiRequest('/api/inventory?limit=1', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 429) {
                pass(`Rate Limiting: Triggered after ${i + 1} requests`);
                rateLimited = true;

                // Check for rate limit headers
                if (response.headers['retry-after']) {
                    pass('Rate Limiting: Retry-After header present');
                }
                if (response.headers['x-ratelimit-limit']) {
                    pass('Rate Limiting: X-RateLimit headers present');
                }

                break;
            }
        }

        if (!rateLimited) {
            warn('Rate Limiting', 'No rate limit triggered after 105 requests');
        }
    }
} catch (error) {
    warn('Rate Limit Test', error.message);
}

// Test 4: Security Headers
console.log('\n🛡️  Testing Security Headers...\n');

try {
    const response = await apiRequest('/api/inventory?limit=1', {
        method: 'GET'
    });

    const requiredHeaders = [
        { name: 'content-security-policy', friendly: 'Content-Security-Policy' },
        { name: 'x-frame-options', friendly: 'X-Frame-Options' },
        { name: 'x-content-type-options', friendly: 'X-Content-Type-Options' },
        { name: 'x-xss-protection', friendly: 'X-XSS-Protection' }
    ];

    for (const { name, friendly } of requiredHeaders) {
        if (response.headers[name]) {
            pass(`Security Header: ${friendly} present`);
        } else {
            warn('Security Header', `${friendly} missing`);
        }
    }

    // Check CSP content
    const csp = response.headers['content-security-policy'];
    if (csp) {
        if (csp.includes("frame-ancestors 'none'")) {
            pass('CSP: Clickjacking protection enabled');
        }
        if (csp.includes('default-src')) {
            pass('CSP: Default source policy defined');
        }
    }

} catch (error) {
    warn('Security Headers Test', error.message);
}

// Test 5: Input Validation
console.log('\n✅ Testing Input Validation...\n');

try {
    const loginResponse = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });

    if (loginResponse.data.token) {
        const token = loginResponse.data.token;

        // Get CSRF token
        const csrfResponse = await apiRequest('/api/inventory?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const csrfToken = csrfResponse.headers['x-csrf-token'];

        // Test length validation
        const longTitle = 'A'.repeat(600);
        const response = await apiRequest('/api/inventory', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken || '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: longTitle,
                listPrice: 50
            })
        });

        if (response.status === 400 && response.data.errors) {
            pass('Input Validation: Title length limit enforced');
        } else {
            warn('Input Validation', 'Long title not rejected');
        }

        // Test negative price validation
        const negPriceResponse = await apiRequest('/api/inventory', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken || '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Test Item',
                listPrice: -10
            })
        });

        if (negPriceResponse.status === 400) {
            pass('Input Validation: Negative price rejected');
        } else {
            fail('Input Validation', 'Negative price not rejected');
        }
    }
} catch (error) {
    warn('Input Validation Test', error.message);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('SECURITY TEST SUMMARY');
console.log('='.repeat(60) + '\n');

console.log(`✓ Passed:   ${results.passed}`);
console.log(`⚠ Warnings: ${results.warnings}`);
console.log(`✗ Failed:   ${results.failed}\n`);

if (results.failed > 0) {
    console.log('❌ Some security tests failed');
    process.exit(1);
} else if (results.warnings > 0) {
    console.log('⚠️  Security tests passed with warnings');
    process.exit(0);
} else {
    console.log('✅ All security tests passed');
    process.exit(0);
}
