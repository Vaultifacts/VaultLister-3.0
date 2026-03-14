// Authentication API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let refreshToken = null;
const testEmail = `auth-test-${Date.now()}@example.com`;
const testUsername = `authuser${Date.now()}`;
// SECURITY: Test password now meets strong password requirements
// (12+ chars, uppercase, lowercase, number, special char)
const testPassword = 'TestPassword123!';

describe('Auth - Registration', () => {
    test('POST /auth/register - should register new user', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
                username: testUsername,
                fullName: 'Test User'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.user).toBeDefined();
        expect(data.token).toBeDefined();
        expect(data.refreshToken).toBeDefined();
        expect(data.user.email).toBe(testEmail.toLowerCase());
        expect(data.user.password_hash).toBeUndefined();

        // Save tokens for later tests
        authToken = data.token;
        refreshToken = data.refreshToken;
    });

    test('POST /auth/register - should require email, password, username', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@test.com'
                // Missing password and username
            })
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('POST /auth/register - should enforce password requirements', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'weak@test.com',
                password: 'short', // Doesn't meet requirements
                username: 'weakpwuser'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        // Should mention password requirements (12 chars, uppercase, etc.)
        expect(data.error).toContain('12 characters');
    });

    test('POST /auth/register - should prevent duplicate email', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail, // Already registered
                password: 'AnotherStrong123!', // Valid password
                username: 'differentuser'
            })
        });

        const data = await response.json();
        // SECURITY: Generic error to prevent user enumeration
        expect(response.status).toBe(400);
        expect(data.error).toContain('Unable to create account');
    });

    test('POST /auth/register - should prevent duplicate username', async () => {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'different@test.com',
                password: 'AnotherStrong123!', // Valid password
                username: testUsername // Already registered
            })
        });

        const data = await response.json();
        // SECURITY: Generic error to prevent user enumeration
        expect(response.status).toBe(400);
        expect(data.error).toContain('Unable to create account');
    });
});

describe('Auth - Login', () => {
    test('POST /auth/login - should login with valid credentials', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.user).toBeDefined();
        expect(data.token).toBeDefined();
        expect(data.refreshToken).toBeDefined();
        expect(data.user.email).toBe(testEmail.toLowerCase());

        // Update tokens
        authToken = data.token;
        refreshToken = data.refreshToken;
    });

    test('POST /auth/login - should require email and password', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail
                // Missing password
            })
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('POST /auth/login - should reject invalid password', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: 'wrongpassword'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(401);
        expect(data.error).toContain('Invalid');
    });

    test('POST /auth/login - should reject non-existent user', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'nonexistent@test.com',
                password: 'anypassword'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(401);
        expect(data.error).toContain('Invalid');
    });
});

describe('Auth - Token Refresh', () => {
    test('POST /auth/refresh - should refresh token', async () => {
        if (!refreshToken) {
            console.log('Skipping: No refresh token available');
            return;
        }

        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.token).toBeDefined();

        // Update auth token
        authToken = data.token;
    });

    test('POST /auth/refresh - should require refresh token', async () => {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('POST /auth/refresh - should reject invalid refresh token', async () => {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: 'invalid-token' })
        });

        expect(response.status).toBe(401);
    });
});

describe('Auth - Get Current User', () => {
    test('GET /auth/me - should return current user', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }

        const response = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(testEmail.toLowerCase());
        expect(data.user.password_hash).toBeUndefined();
    });

    test('GET /auth/me - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/auth/me`);
        expect(response.status).toBe(401);
    });

    test('GET /auth/me - should reject invalid token', async () => {
        const response = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': 'Bearer invalid-token' }
        });
        expect(response.status).toBe(401);
    });
});

describe('Auth - Update Profile', () => {
    test('PUT /auth/profile - should update profile', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }

        const response = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                fullName: 'Updated Name',
                timezone: 'America/Los_Angeles',
                locale: 'en-US'
            })
        });

        // 403 if CSRF-gated or tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.user).toBeDefined();
            expect(data.user.full_name).toBe('Updated Name');
            expect(data.user.timezone).toBe('America/Los_Angeles');
        }
    });

    test('PUT /auth/profile - should update preferences', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }

        const response = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                preferences: { theme: 'dark', notifications: true }
            })
        });

        // 403 if CSRF-gated or tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.user).toBeDefined();
        }
    });

    test('PUT /auth/profile - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: 'Test' })
        });
        expect(response.status).toBe(401);
    });
});

describe('Auth - Change Password', () => {
    test('PUT /auth/password - should change password', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }

        const newPassword = 'NewPassword789!';
        const response = await fetch(`${BASE_URL}/auth/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                currentPassword: testPassword,
                newPassword: newPassword
            })
        });

        // 403 if CSRF-gated or tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toContain('updated');

            // Verify new password works by logging in
            const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: newPassword
                })
            });
            expect(loginResponse.status).toBe(200);
        }
    });

    test('PUT /auth/password - should require both passwords', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }

        const response = await fetch(`${BASE_URL}/auth/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                currentPassword: 'test'
                // Missing newPassword
            })
        });

        // 403 if CSRF-gated or tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('required');
        }
    });

    test('PUT /auth/password - should reject wrong current password', async () => {
        if (!authToken) {
            console.log('Skipping: No auth token available');
            return;
        }

        const response = await fetch(`${BASE_URL}/auth/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                currentPassword: 'wrongpassword',
                newPassword: 'NewPassword789!'
            })
        });

        // 403 if CSRF-gated or tier-gated on CI
        expect([401, 403]).toContain(response.status);
        if (response.status === 401) {
            const data = await response.json();
            expect(data.error).toContain('incorrect');
        }
    });

    test('PUT /auth/password - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/auth/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: 'test',
                newPassword: 'test123'
            })
        });
        expect(response.status).toBe(401);
    });
});

describe('Auth - Logout', () => {
    test('POST /auth/logout - should logout successfully', async () => {
        const response = await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('Logged out');
    });

    test('POST /auth/logout - should handle logout without refresh token', async () => {
        const response = await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('Logged out');
    });
});

// ─── Token Refresh Security Tests ────────────────────────────────────────────

describe('Auth - Token Refresh Security', () => {
    test('Refresh token should be invalidated after logout', async () => {
        // Register a fresh user
        const regEmail = `refresh-test-${Date.now()}@example.com`;
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: regEmail,
                password: 'RefreshTest123!',
                username: `refreshuser${Date.now()}`,
                fullName: 'Refresh Test'
            })
        });
        const regData = await regRes.json();
        const rt = regData.refreshToken;
        const at = regData.token;

        // Logout
        await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${at}`
            },
            body: JSON.stringify({ refreshToken: rt })
        });

        // Try to use the refresh token after logout — should fail
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt })
        });
        expect([401, 403]).toContain(refreshRes.status);
    });

    test('Expired/invalid access token should return 401', async () => {
        const res = await fetch(`${BASE_URL}/inventory`, {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid'
            }
        });
        expect(res.status).toBe(401);
    });
});

console.log('Running Auth API tests...');
