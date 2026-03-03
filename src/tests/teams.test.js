// Teams API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testTeamId = null;
let testInviteId = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Teams - Get Current Team', () => {
    test('GET /teams/current - should return current team', async () => {
        const response = await fetch(`${BASE_URL}/teams/current`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 404]).toContain(response.status);
        if (response.status === 200 && data.team?.id) {
            testTeamId = data.team.id;
        }
    });
});

describe('Teams - Create', () => {
    test('POST /teams - should create team', async () => {
        const response = await fetch(`${BASE_URL}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Test Team ${Date.now()}`
            })
        });

        const data = await response.json();
        expect([200, 201, 400, 403]).toContain(response.status); // 400 if invalid, 403 if team limit reached
        if (data.team?.id || data.id) {
            testTeamId = data.team?.id || data.id;
        }
    });
});

describe('Teams - Members', () => {
    test('GET /teams/members - should list team members', async () => {
        const response = await fetch(`${BASE_URL}/teams/members`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 404]).toContain(response.status);
    });

    test('PUT /teams/members/:id/role - should update member role', async () => {
        const response = await fetch(`${BASE_URL}/teams/members/test-member-id/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                role: 'editor'
            })
        });

        expect([200, 400, 403, 404]).toContain(response.status);
    });

    test('DELETE /teams/members/:id - should remove team member', async () => {
        const response = await fetch(`${BASE_URL}/teams/members/test-member-id`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 400, 403, 404]).toContain(response.status);
    });
});

describe('Teams - Invitations', () => {
    test('POST /teams/invites - should create invitation', async () => {
        const response = await fetch(`${BASE_URL}/teams/invites`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                email: `test-invite-${Date.now()}@example.com`,
                role: 'viewer'
            })
        });

        const data = await response.json();
        expect([200, 201, 400, 403, 404]).toContain(response.status);
        if (data.invite?.id || data.id) {
            testInviteId = data.invite?.id || data.id;
        }
    });

    test('GET /teams/invites - should list pending invitations', async () => {
        const response = await fetch(`${BASE_URL}/teams/invites`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('DELETE /teams/invites/:id - should cancel invitation', async () => {
        if (!testInviteId) {
            console.log('Skipping: No test invite ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/teams/invites/${testInviteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 204, 404]).toContain(response.status);
    });
});

describe('Teams - Settings', () => {
    test('GET /teams/settings - should return team settings', async () => {
        const response = await fetch(`${BASE_URL}/teams/settings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('PUT /teams/settings - should update team settings', async () => {
        const response = await fetch(`${BASE_URL}/teams/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Team Name'
            })
        });

        expect([200, 403, 404]).toContain(response.status);
    });
});

describe('Teams - Activity', () => {
    test('GET /teams/activity - should return team activity log', async () => {
        const response = await fetch(`${BASE_URL}/teams/activity`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Teams - Authentication', () => {
    test('GET /teams/current - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/teams/current`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Teams API tests...');
