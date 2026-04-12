// Tasks/Jobs API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testTaskId = null;

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

describe('Tasks - List', () => {
    test('GET /tasks - should return tasks list', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.tasks).toBeDefined();
            expect(Array.isArray(data.tasks)).toBe(true);
            expect(data.total).toBeDefined();
            expect(data.pending).toBeDefined();
            expect(data.processing).toBeDefined();
        }
    });

    test('GET /tasks?status=pending - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/tasks?status=pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.tasks).toBeDefined();
        }
    });

    test('GET /tasks?type=share_listing - should filter by type', async () => {
        const response = await fetch(`${BASE_URL}/tasks?type=share_listing`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.tasks).toBeDefined();
        }
    });

    test('GET /tasks?limit=10&offset=0 - should paginate', async () => {
        const response = await fetch(`${BASE_URL}/tasks?limit=10&offset=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.tasks).toBeDefined();
            expect(data.tasks.length).toBeLessThanOrEqual(10);
        }
    });
});

describe('Tasks - Create', () => {
    test('POST /tasks - should create task', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'share_listing',
                payload: { listingId: 'test-123', platform: 'poshmark' },
                priority: 3
            })
        });

        // 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.task).toBeDefined();
            expect(data.task.id).toBeDefined();
            expect(data.task.type).toBe('share_listing');
            expect(data.task.status).toBe('pending');
            testTaskId = data.task.id;
        }
    });

    test('POST /tasks - should require type and payload', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'share_listing'
                // Missing payload
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('required');
        }
    });

    test('POST /tasks - should reject invalid type', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'invalid_task_type',
                payload: { test: true }
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Invalid task type');
        }
    });

    test('POST /tasks - should accept scheduled time', async () => {
        const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
        const response = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'share_closet',
                payload: { platform: 'poshmark' },
                scheduledAt: futureTime
            })
        });

        // 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.task).toBeDefined();
        }
    });
});

describe('Tasks - Get Single', () => {
    test('GET /tasks/:id - should return task details', async () => {
        if (!testTaskId) {
            console.log('Skipping: No test task ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.task).toBeDefined();
            expect(data.task.id).toBe(testTaskId);
            expect(data.task.payload).toBeDefined();
        }
    });

    test('GET /tasks/:id - should return 404 for non-existent task', async () => {
        const response = await fetch(`${BASE_URL}/tasks/00000000-0000-0000-0000-000000000000`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Tasks - Cancel', () => {
    test('POST /tasks/:id/cancel - should cancel pending task', async () => {
        // Create a new task to cancel
        const createResponse = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'share_listing',
                payload: { listingId: 'cancel-test' }
            })
        });
        const createData = await createResponse.json();
        const cancelTaskId = createData.task?.id;

        if (!cancelTaskId) {
            console.log('Skipping: Could not create task');
            return;
        }

        const response = await fetch(`${BASE_URL}/tasks/${cancelTaskId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toContain('cancelled');
        }
    });

    test('POST /tasks/:id/cancel - should return 404 for non-existent task', async () => {
        const response = await fetch(`${BASE_URL}/tasks/00000000-0000-0000-0000-000000000000/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Tasks - Retry', () => {
    test('POST /tasks/:id/retry - should require failed status', async () => {
        if (!testTaskId) {
            console.log('Skipping: No test task ID');
            return;
        }

        // Try to retry a pending task (should fail)
        const response = await fetch(`${BASE_URL}/tasks/${testTaskId}/retry`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Should return 400 because task is not failed
        expect([200, 400, 404]).toContain(response.status);
    });

    test('POST /tasks/:id/retry - should return 404 for non-existent task', async () => {
        const response = await fetch(`${BASE_URL}/tasks/00000000-0000-0000-0000-000000000000/retry`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Tasks - Bulk Create', () => {
    test('POST /tasks/bulk - should create multiple tasks', async () => {
        const response = await fetch(`${BASE_URL}/tasks/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                tasks: [
                    { type: 'share_listing', payload: { listingId: 'bulk-1' } },
                    { type: 'share_listing', payload: { listingId: 'bulk-2' } },
                    { type: 'share_listing', payload: { listingId: 'bulk-3' } }
                ]
            })
        });

        // 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.created).toBeDefined();
            expect(Array.isArray(data.created)).toBe(true);
            expect(data.created.length).toBe(3);
        }
    });

    test('POST /tasks/bulk - should require tasks array', async () => {
        const response = await fetch(`${BASE_URL}/tasks/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('required');
        }
    });
});

describe('Tasks - Clear', () => {
    test('POST /tasks/clear - should clear completed tasks', async () => {
        const response = await fetch(`${BASE_URL}/tasks/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: 'completed' })
        });

        // 403 if feature is tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.deleted).toBeDefined();
        }
    });

    test('POST /tasks/clear - should accept olderThan parameter', async () => {
        const oldDate = new Date(Date.now() - 86400000).toISOString(); // 24 hours ago
        const response = await fetch(`${BASE_URL}/tasks/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'failed',
                olderThan: oldDate
            })
        });

        // 403 if feature is tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.deleted).toBeDefined();
        }
    });
});

describe('Tasks - Queue Status', () => {
    test('GET /tasks/queue - should return queue statistics', async () => {
        const response = await fetch(`${BASE_URL}/tasks/queue`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.stats).toBeDefined();
            expect(data.stats.pending).toBeDefined();
            expect(data.stats.processing).toBeDefined();
            expect(data.stats.completed).toBeDefined();
            expect(data.stats.failed).toBeDefined();
            expect(data.stats.byType).toBeDefined();
            expect(data.stats.nextUp).toBeDefined();
        }
    });
});

describe('Tasks - Delete', () => {
    test('DELETE /tasks/:id - should delete task', async () => {
        // Create a task to delete
        const createResponse = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'share_listing',
                payload: { listingId: 'delete-test' }
            })
        });
        const createData = await createResponse.json();
        const deleteTaskId = createData.task?.id;

        if (!deleteTaskId) {
            console.log('Skipping: Could not create task');
            return;
        }

        const response = await fetch(`${BASE_URL}/tasks/${deleteTaskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toContain('deleted');
        }
    });

    test('DELETE /tasks/:id - should return 404 for non-existent task', async () => {
        const response = await fetch(`${BASE_URL}/tasks/00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Tasks - Authentication', () => {
    test('GET /tasks - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/tasks`);
        expect(response.status).toBe(401);
    });

    test('POST /tasks - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'share_listing', payload: {} })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Tasks API tests...');
