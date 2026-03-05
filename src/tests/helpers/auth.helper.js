// Auth Helper for Tests
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
