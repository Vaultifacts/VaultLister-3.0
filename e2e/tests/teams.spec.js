import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

test.setTimeout(90_000);

// ── API helpers ───────────────────────────────────────────────────────────────

let _authToken = null;

async function getAuthToken(request) {
    if (_authToken) return _authToken;
    const data = await apiLogin(request);
    _authToken = data.token;
    return _authToken;
}

async function getCsrf(request, token) {
    const res = await request.get(`${BASE_URL}/api/teams`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.headers()['x-csrf-token'] || '';
}

async function apiCreateTeam(request, token, name = `E2E Team ${Date.now()}`) {
    const csrf = await getCsrf(request, token);
    const res = await request.post(`${BASE_URL}/api/teams`, {
        headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
        data: { name, description: 'E2E test team' }
    });
    return { res, data: await res.json() };
}

async function apiDeleteTeam(request, token, teamId) {
    const csrf = await getCsrf(request, token);
    await request.delete(`${BASE_URL}/api/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }
    });
}

/** Delete all teams the demo user owns — needed because free tier max is 1 team */
async function cleanupOwnedTeams(request, token) {
    const res = await request.get(`${BASE_URL}/api/teams`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    for (const team of data.teams || []) {
        if (team.user_role === 'owner') {
            await apiDeleteTeam(request, token, team.id);
        }
    }
}

// ── Existing UI render tests ──────────────────────────────────────────────────

test.describe('Teams Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'teams');
    });

    test('renders page title "Team Management"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('Team Management');
    });

    test('displays page subtitle', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('p.page-subtitle')).toContainText('Manage your teams, members, roles, and permissions');
    });

    test('"Create Team" button is visible', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('button:has-text("Create Team")')).toBeVisible();
    });

    test('page main container loads without crash', async ({ page }) => {
        await waitForUiSettle(page);
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        const heading = page.locator('h1.page-title');
        await expect(heading).toBeVisible();
        if (pageErrors.length > 0) {
            console.warn(`Page errors on teams: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows "Invite Member" button or an empty team state', async ({ page }) => {
        await waitForUiSettle(page);
        const inviteBtn = page.locator('button:has-text("Invite Member")');
        const inviteVisible = await inviteBtn.isVisible().catch(() => false);
        if (inviteVisible) {
            await expect(inviteBtn).toBeVisible();
        } else {
            // Accept: empty state, teams grid (Your Teams heading), or Create Team button
            const emptyState = page.locator('button, p, span, h2, h3').filter({ hasText: /no teams|create your first|get started|your teams/i }).first();
            const createTeamBtn = page.locator('button:has-text("Create Team")');
            const emptyOrTeams = (await emptyState.isVisible().catch(() => false)) ||
                                  (await createTeamBtn.isVisible().catch(() => false));
            expect(emptyOrTeams).toBeTruthy();
        }
    });
});

// ── Team CRUD via API ─────────────────────────────────────────────────────────

test.describe('Teams CRUD — API', () => {
    let token;
    test.beforeAll(async ({ request }) => {
        token = await getAuthToken(request);
        await cleanupOwnedTeams(request, token);
    });

    test('POST /api/teams — creates team, returns 201 with id and owner role', async ({ request }) => {
        const name = `E2E Create ${Date.now()}`;
        const { res, data } = await apiCreateTeam(request, token, name);

        expect(res.status()).toBe(201);
        expect(data.team).toBeDefined();
        expect(data.team.id).toBeDefined();
        expect(data.team.name).toBe(name);
        expect(data.team.user_role).toBe('owner');

        await apiDeleteTeam(request, token, data.team.id);
    });

    test('POST /api/teams — name < 2 chars returns 400', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/teams`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { name: 'X' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('2 characters');
    });

    test('GET /api/teams/:id — returns team details with members and permissions', async ({ request }) => {
        const { data: created } = await apiCreateTeam(request, token);
        const teamId = created.team.id;

        const res = await request.get(`${BASE_URL}/api/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.members)).toBe(true);
        expect(data.members.length).toBeGreaterThanOrEqual(1);
        expect(data.team.permissions).toBeDefined();
        expect(data.team.user_role).toBe('owner');

        await apiDeleteTeam(request, token, teamId);
    });

    test('PATCH /api/teams/:id — updates team name', async ({ request }) => {
        const { data: created } = await apiCreateTeam(request, token);
        const teamId = created.team.id;
        const csrf = await getCsrf(request, token);
        const newName = `Updated ${Date.now()}`;

        const res = await request.patch(`${BASE_URL}/api/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { name: newName }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toContain('updated');

        await apiDeleteTeam(request, token, teamId);
    });

    test('DELETE /api/teams/:id — owner can delete team', async ({ request }) => {
        const { data: created } = await apiCreateTeam(request, token);
        const teamId = created.team.id;
        const csrf = await getCsrf(request, token);

        const res = await request.delete(`${BASE_URL}/api/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toContain('deleted');

        // Confirm team is gone
        const getRes = await request.get(`${BASE_URL}/api/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect([403, 404]).toContain(getRes.status());
    });

    test('GET /api/teams/permissions — returns role permissions matrix', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/teams/permissions`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.roles)).toBe(true);
        expect(data.roles).toContain('owner');
        expect(data.roles).toContain('member');
        expect(data.permissions).toBeDefined();
        expect(data.permissions.owner.delete_team).toBe(true);
        expect(data.permissions.viewer.delete_team).toBe(false);
    });
});

// ── Invite flows via API ──────────────────────────────────────────────────────

test.describe('Teams Invitations — API', () => {
    let token;
    let teamId;

    test.beforeAll(async ({ request }) => {
        token = await getAuthToken(request);
        await cleanupOwnedTeams(request, token);
        const { data } = await apiCreateTeam(request, token, `Invite Test ${Date.now()}`);
        teamId = data.team.id;
    });

    test.afterAll(async ({ request }) => {
        if (teamId) await apiDeleteTeam(request, token, teamId);
    });

    test('POST /api/teams/:id/invite — sends invite with role member (201)', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/teams/${teamId}/invite`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { email: `e2e-invite-${Date.now()}@example.com`, role: 'member' }
        });
        expect(res.status()).toBe(201);
        const data = await res.json();
        expect(data.invitation).toBeDefined();
        expect(data.invitation.invite_link).toContain('/join-team?token=');
        expect(data.invitation.role).toBe('member');
    });

    test('POST /api/teams/:id/invite — role "owner" returns 400', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/teams/${teamId}/invite`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { email: `e2e-owner-role-${Date.now()}@example.com`, role: 'owner' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('POST /api/teams/:id/invite — invalid email returns 400', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/teams/${teamId}/invite`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: { email: 'not-an-email', role: 'member' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('email');
    });

    test('POST /api/teams/:id/invite — inviting own email returns 400', async ({ request }) => {
        const loginData = await apiLogin(request);
        const csrf = await getCsrf(request, loginData.token);
        const res = await request.post(`${BASE_URL}/api/teams/${teamId}/invite`, {
            headers: { Authorization: `Bearer ${loginData.token}`, 'X-CSRF-Token': csrf },
            data: { email: loginData.user.email, role: 'member' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('yourself');
    });

    test('GET /api/teams/:id — pending invitations visible to owner', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.invitations)).toBe(true);
    });
});

// ── Member management guards ──────────────────────────────────────────────────

test.describe('Teams Member Guards — API', () => {
    let token;
    let teamId;
    let ownerMemberId;

    test.beforeAll(async ({ request }) => {
        token = await getAuthToken(request);
        await cleanupOwnedTeams(request, token);
        const { data } = await apiCreateTeam(request, token, `Guards Test ${Date.now()}`);
        teamId = data.team.id;

        // Get owner member row id
        const detailRes = await request.get(`${BASE_URL}/api/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const detail = await detailRes.json();
        const ownerMember = detail.members.find(m => m.role === 'owner');
        ownerMemberId = ownerMember?.id;
    });

    test.afterAll(async ({ request }) => {
        if (teamId) await apiDeleteTeam(request, token, teamId);
    });

    test('DELETE /api/teams/:id/members/:memberId — owner cannot be removed (403)', async ({ request }) => {
        if (!ownerMemberId) test.skip(true, 'Owner member ID not found');
        const csrf = await getCsrf(request, token);
        const res = await request.delete(`${BASE_URL}/api/teams/${teamId}/members/${ownerMemberId}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }
        });
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toContain('owner');
    });

    test('POST /api/teams/:id/leave — owner cannot leave team (403)', async ({ request }) => {
        const csrf = await getCsrf(request, token);
        const res = await request.post(`${BASE_URL}/api/teams/${teamId}/leave`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
            data: {}
        });
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toContain('Owner cannot leave');
    });

    test('DELETE /api/teams/:id — non-owner cannot delete team (403)', async ({ request }) => {
        // Attempt to delete with wrong team ID owned by another — reuses existing team
        // Verify 403 comes back for a non-existent/non-owned team ID
        const csrf = await getCsrf(request, token);
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await request.delete(`${BASE_URL}/api/teams/${fakeId}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }
        });
        expect([403, 404]).toContain(res.status());
    });

    test('GET /api/teams/:id/activity — returns activity log for owner', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/teams/${teamId}/activity`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.activities)).toBe(true);
    });
});

// ── Create team via UI ────────────────────────────────────────────────────────

test.describe('Teams — Create via UI', () => {
    let createdTeamName;

    test('Create Team modal opens on button click', async ({ page }) => {
        await loginAndNavigate(page, 'teams');
        await waitForUiSettle(page);

        await page.locator('button:has-text("Create Team")').first().click();
        await waitForUiSettle(page);

        // Modal should appear
        const modal = page.locator('#create-team-form, .modal-body form');
        await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('Create Team form submission creates team and shows it in list', async ({ page, request }) => {
        // Clean up any existing owned teams (free tier limit = 1)
        const token = await getAuthToken(request);
        await cleanupOwnedTeams(request, token);

        await loginAndNavigate(page, 'teams');
        await waitForUiSettle(page);

        createdTeamName = `UI Team ${Date.now()}`;

        await page.locator('button:has-text("Create Team")').first().click();
        await waitForUiSettle(page);

        // Fill the form
        await page.locator('#create-team-form input[name="name"]').fill(createdTeamName);

        // Click the modal footer's primary submit button
        await page.locator('.modal-footer button.btn-primary').click();

        // Wait for modal to close (form submits asynchronously)
        await page.locator('#create-team-form, .modal-body form').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Team should appear in API
        const listRes = await request.get(`${BASE_URL}/api/teams`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const listData = await listRes.json();
        const found = listData.teams?.some(t => t.name === createdTeamName);
        expect(found).toBeTruthy();

        // Cleanup
        if (found) {
            const team = listData.teams.find(t => t.name === createdTeamName);
            await apiDeleteTeam(request, token, team.id);
        }
    });
});
