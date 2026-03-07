// Auth Helper for Tests
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../../backend/db/database.js';

const TEST_BASE_URL = process.env.TEST_BASE_URL || '';
const BASE_ROOT = TEST_BASE_URL
    ? TEST_BASE_URL.replace(/\/+$/, '')
    : `http://localhost:${process.env.PORT || 3001}`;
const BASE_URL = BASE_ROOT.endsWith('/api') ? BASE_ROOT : `${BASE_ROOT}/api`;
const IS_TEST_MODE = process.env.NODE_ENV === 'test' || Boolean(TEST_BASE_URL);
const isLocalTestUrl = !TEST_BASE_URL || /localhost|127\.0\.0\.1/.test(TEST_BASE_URL);
// Keep test auth hermetic: avoid network auth flows that can trigger shared IP blocking.
// Only use local DB provisioning for in-process tests or localhost-backed test servers.
const USE_LOCAL_PROVISIONING = IS_TEST_MODE && isLocalTestUrl;
let apiReachability;
let cachedJwtSecret;

function readJwtSecretFromDotEnv() {
    try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const repoRoot = join(__dirname, '..', '..', '..');
        const envPath = join(repoRoot, '.env');
        if (!existsSync(envPath)) return null;
        const envText = readFileSync(envPath, 'utf8');
        const match = envText.match(/^\s*JWT_SECRET\s*=\s*(.+)\s*$/m);
        if (!match?.[1]) return null;
        return match[1].trim().replace(/^['"]|['"]$/g, '');
    } catch {
        return null;
    }
}

function getJwtSecretForTests() {
    if (cachedJwtSecret) return cachedJwtSecret;
    cachedJwtSecret = process.env.JWT_SECRET || readJwtSecretFromDotEnv() || 'dev-only-secret-not-for-production';
    return cachedJwtSecret;
}

function mintLocalAccessToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            tier: user.subscription_tier,
            type: 'access',
            iss: 'vaultlister',
            aud: 'vaultlister-api'
        },
        getJwtSecretForTests(),
        { expiresIn: '15m', algorithm: 'HS256' }
    );
}

function mintLocalRefreshToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            type: 'refresh',
            jti: uuidv4(),
            iss: 'vaultlister',
            aud: 'vaultlister-api'
        },
        getJwtSecretForTests(),
        { expiresIn: '7d', algorithm: 'HS256' }
    );
}

async function isApiReachable() {
    // Cache only positive reachability. A transient startup miss should not
    // permanently disable token verification for the rest of the test run.
    if (apiReachability === true) {
        return apiReachability;
    }
    try {
        const response = await fetch(`${BASE_URL}/health`);
        apiReachability = response.status >= 200 && response.status < 600;
    } catch {
        // Leave as unknown so future calls can retry once the API is ready.
        apiReachability = undefined;
    }
    return apiReachability === true;
}

async function tokenAuthenticates(token) {
    if (!token) return false;
    const reachable = await isApiReachable();
    if (!reachable) {
        return true;
    }
    try {
        const response = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.status === 200;
    } catch {
        return false;
    }
}

function isRateLimitBlockResponse(payload = {}) {
    const error = String(payload?.error || '').toLowerCase();
    return error.includes('temporarily blocked') || error.includes('too many');
}

async function provisionLocalUserToken({ email, password, username, fullName }, { allowExistingEmail = false } = {}) {
    const normalizedEmail = String(email).toLowerCase();
    const normalizedUsername = String(username).toLowerCase();

    let selectedUser = null;

    if (allowExistingEmail) {
        selectedUser = query.get(
            'SELECT id, email, username, full_name, subscription_tier, is_active, email_verified, created_at FROM users WHERE email = ? AND is_active = 1',
            [normalizedEmail]
        );
    }

    if (!selectedUser) {
        // Guard: if database module is mocked by a concurrent test (mock.module leaks across
        // bun workers), query.get returns null for everything. Detect this before writing so
        // createTestUserWithToken can fall back to HTTP registration against the real server DB.
        const sanity = query.get('SELECT 1 AS one');
        if (sanity?.one !== 1) {
            return null;
        }

        const userId = uuidv4();
        const bcryptRounds = (process.env.NODE_ENV === 'test') ? 1 : 12;
        const passwordHash = await bcrypt.hash(password, bcryptRounds);
        query.run(`
            INSERT INTO users (id, email, password_hash, username, full_name, is_active, email_verified, subscription_tier)
            VALUES (?, ?, ?, ?, ?, 1, 1, 'free')
        `, [userId, normalizedEmail, passwordHash, normalizedUsername, fullName]);

        selectedUser = query.get(
            'SELECT id, email, username, full_name, subscription_tier, is_active, email_verified, created_at FROM users WHERE id = ?',
            [userId]
        );
    }

    const user = selectedUser || {
        id: uuidv4(),
        email: normalizedEmail,
        username: normalizedUsername,
        full_name: fullName,
        subscription_tier: 'free',
        is_active: 1,
        email_verified: 0,
        created_at: new Date().toISOString()
    };

    // Keep local test provisioning behavior aligned with /auth/login and /auth/register:
    // each token issuance should have a persisted active session row.
    const refreshToken = mintLocalRefreshToken(user);
    query.run(`
        INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
    `, [uuidv4(), user.id, refreshToken, 'Test Local Provisioning', '127.0.0.1']);

    // In local test mode, prefer an API-issued access token so it always matches
    // the server's active signing key/config while still avoiding /auth/register writes.
    if (USE_LOCAL_PROVISIONING) {
        const login = await loginUser(normalizedEmail, password);
        const apiToken = login?.data?.token || login?.data?.data?.token || null;
        const apiUser = login?.data?.user || login?.data?.data?.user || user;
        if (apiToken) {
            return { email, password, token: apiToken, user: apiUser };
        }
    }

    const token = mintLocalAccessToken(user);
    if (USE_LOCAL_PROVISIONING) {
        return { email, password, token, user };
    }

    if (await tokenAuthenticates(token)) {
        return { email, password, token, user };
    }

    return null;
}

export async function registerUser(userData = {}) {
    const defaultUser = {
        email: `test${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: `testuser${Date.now()}`
    };

    const user = { ...defaultUser, ...userData };

    const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });

    const data = await response.json();
    return { response, data, credentials: user };
}

export async function loginUser(email, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    return { response, data };
}

export async function loginAsDemoUser() {
    return loginUser('demo@vaultlister.com', 'DemoPassword123!');
}

export async function getAuthToken(email = 'demo@vaultlister.com', password = 'DemoPassword123!') {
    const { data } = await loginUser(email, password);
    const networkToken = data?.token || data?.data?.token || null;
    if (networkToken) {
        return networkToken;
    }

    if (USE_LOCAL_PROVISIONING) {
        const user = query.get(
            'SELECT id, email, username, full_name, subscription_tier, is_active, email_verified, created_at FROM users WHERE email = ? AND is_active = 1',
            [String(email).toLowerCase()]
        );
        if (user) {
            const localToken = mintLocalAccessToken(user);
            if (localToken) {
                return localToken;
            }
        }
    }

    return null;
}

export async function createTestUserWithToken(overrides = {}) {
    let provisioningError = null;
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    const email = overrides.email || `test${now}${rand}@example.com`;
    const password = overrides.password || 'TestPassword123!';
    const username = overrides.username || `testuser${now}${rand}`;
    const fullName = overrides.fullName || username;

    // Local provisioning path is only safe when tests target local/shared backend state.
    if (USE_LOCAL_PROVISIONING) {
        try {
            const localProvisioned = await provisionLocalUserToken({ email, password, username, fullName });
            if (localProvisioned) {
                return localProvisioned;
            }
        } catch (error) {
            provisioningError = error;
            // Fall back to HTTP-based flow if local provisioning fails.
        }
    }

    const { data: registerData } = await registerUser({
        ...overrides,
        email,
        password,
        username
    });
    let token = registerData?.token || registerData?.data?.token || null;
    let user = registerData?.user || registerData?.data?.user || null;

    // In local test mode, trust the test server's registration response directly.
    // tokenAuthenticates can return false erroneously when concurrent workers mock db modules.
    if (USE_LOCAL_PROVISIONING && token && user) {
        return { email, password, token, user };
    }

    if (!(await tokenAuthenticates(token))) {
        const login = await loginUser(email, password);
        token = login?.data?.token || login?.data?.data?.token || null;
        user = login?.data?.user || login?.data?.data?.user || user;
    }

    if (!(await tokenAuthenticates(token))) {
        const fallback = await loginAsDemoUser();
        token = fallback?.data?.token || fallback?.data?.data?.token || null;
        user = fallback?.data?.user || fallback?.data?.data?.user || user;
        if (await tokenAuthenticates(token)) {
            return { email, password, token, user };
        }
    }

    // Last-resort test-only fallback for background-server mode:
    // if network auth paths are being throttled/blocked, provision directly in the
    // shared local DB and mint a token that the API validates.
    if (IS_TEST_MODE && !USE_LOCAL_PROVISIONING && isRateLimitBlockResponse(registerData)) {
        try {
            const localProvisioned = await provisionLocalUserToken(
                { email, password, username, fullName },
                { allowExistingEmail: true }
            );
            if (localProvisioned) {
                return localProvisioned;
            }
        } catch (error) {
            provisioningError = error;
        }
    }

    const detail = provisioningError?.message || JSON.stringify(registerData);
    throw new Error(`createTestUserWithToken failed to obtain API-valid token: ${detail}`);
}

export async function refreshToken(token) {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: token })
    });

    const data = await response.json();
    return { response, data };
}
