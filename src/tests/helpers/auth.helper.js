// Auth Helper for Tests
const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`;

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
    return data.token;
}

export async function createTestUserWithToken(overrides = {}) {
    const { data, credentials } = await registerUser(overrides);
    return {
        email: credentials.email,
        password: credentials.password,
        token: data.token,
        user: data.user
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
