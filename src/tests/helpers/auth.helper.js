// Auth Helper for Tests
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../../backend/db/database.js';
import { generateToken } from '../../backend/middleware/auth.js';

const TEST_BASE_URL = process.env.TEST_BASE_URL || '';
const BASE_ROOT = TEST_BASE_URL
    ? TEST_BASE_URL.replace(/\/+$/, '')
    : `http://localhost:${process.env.PORT || 3001}`;
const BASE_URL = BASE_ROOT.endsWith('/api') ? BASE_ROOT : `${BASE_ROOT}/api`;

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
    return data?.token || data?.data?.token || null;
}

export async function createTestUserWithToken(overrides = {}) {
    // Local provisioning path to avoid network auth/rate-limit coupling in tests.
    try {
        const now = Date.now();
        const rand = Math.random().toString(36).slice(2, 10);
        const email = overrides.email || `test${now}${rand}@example.com`;
        const password = overrides.password || 'TestPassword123!';
        const username = overrides.username || `testuser${now}${rand}`;
        const fullName = overrides.fullName || username;
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, 12);

        query.run(`
            INSERT INTO users (id, email, password_hash, username, full_name)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, email.toLowerCase(), passwordHash, username.toLowerCase(), fullName]);

        const user = query.get(
            'SELECT id, email, username, full_name, subscription_tier, is_active, email_verified, created_at FROM users WHERE id = ?',
            [userId]
        );

        const token = generateToken(user);
        if (token) {
            return { email, password, token, user };
        }
    } catch {
        // Fall back to HTTP-based flow if local provisioning fails.
    }

    const { data, credentials } = await registerUser(overrides);
    let token = data?.token || data?.data?.token || null;
    let user = data?.user || data?.data?.user || null;
    if (!token) {
        const fallback = await loginAsDemoUser();
        token = fallback?.data?.token || fallback?.data?.data?.token || null;
        user = fallback?.data?.user || fallback?.data?.data?.user || user;
    }
    if (!token) {
        const detail = JSON.stringify(data);
        throw new Error(`createTestUserWithToken failed to obtain token (register+demo fallback): ${detail}`);
    }
    return {
        email: credentials.email,
        password: credentials.password,
        token,
        user
    };
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
