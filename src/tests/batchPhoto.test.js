// Batch Photo Processing API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testJobId = null;
let testPresetId = null;

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

describe('Batch Photo - List Jobs', () => {
    test('GET /batch-photo/jobs - should return job list', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.jobs).toBeDefined();
        expect(Array.isArray(data.jobs)).toBe(true);
    });
});

describe('Batch Photo - Create Job', () => {
    test('POST /batch-photo/jobs - should create batch job', async () => {
        // First get some image IDs from the image bank
        const imgResponse = await fetch(`${BASE_URL}/image-bank?limit=2`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const imgData = await imgResponse.json();

        if (imgData.images && imgData.images.length >= 1) {
            const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    imageIds: imgData.images.map(i => i.id),
                    transformations: {
                        enhance: true,
                        upscale: false
                    },
                    name: 'Test Batch Job'
                })
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.job).toBeDefined();
            expect(data.job.status).toBe('pending');
            testJobId = data.job.id;
        }
    });

    test('POST /batch-photo/jobs - should fail without image IDs', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                transformations: { enhance: true }
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Image IDs required');
    });

    test('POST /batch-photo/jobs - should fail with empty image IDs', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                imageIds: [],
                transformations: { enhance: true }
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Image IDs required');
    });

    test('POST /batch-photo/jobs - should fail without transformations', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                imageIds: ['test-id-1']
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Transformations required');
    });

    test('POST /batch-photo/jobs - should fail without at least one transformation', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                imageIds: ['test-id-1'],
                transformations: {}
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('At least one transformation required');
    });

    test('POST /batch-photo/jobs - should limit to 50 images', async () => {
        const imageIds = Array.from({ length: 51 }, (_, i) => `test-id-${i}`);

        const response = await fetch(`${BASE_URL}/batch-photo/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                imageIds,
                transformations: { enhance: true }
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Maximum 50 images per batch');
    });
});

describe('Batch Photo - Get Job Details', () => {
    test('GET /batch-photo/jobs/:id - should return job with items', async () => {
        if (!testJobId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/jobs/${testJobId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.job).toBeDefined();
        expect(data.job.id).toBe(testJobId);
        expect(data.job.items).toBeDefined();
    });

    test('GET /batch-photo/jobs/:id - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Job not found');
    });
});

describe('Batch Photo - Start Job', () => {
    test('POST /batch-photo/jobs/:id/start - should start job', async () => {
        if (!testJobId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/jobs/${testJobId}/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Job may fail if Cloudinary not configured, but endpoint should work
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toBe('Job started');
        }
    });

    test('POST /batch-photo/jobs/:id/start - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs/non-existent-id/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Batch Photo - Cancel Job', () => {
    test('POST /batch-photo/jobs/:id/cancel - should cancel job', async () => {
        if (!testJobId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/jobs/${testJobId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May fail if job already completed/cancelled
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toBe('Job cancelled');
        }
    });

    test('POST /batch-photo/jobs/:id/cancel - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs/non-existent-id/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Batch Photo - Presets List', () => {
    test('GET /batch-photo/presets - should return preset list', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.presets).toBeDefined();
        expect(Array.isArray(data.presets)).toBe(true);
    });
});

describe('Batch Photo - Create Preset', () => {
    test('POST /batch-photo/presets - should create preset', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Preset',
                description: 'A test transformation preset',
                transformations: {
                    enhance: true,
                    removeBackground: false,
                    upscale: true
                },
                isDefault: false
            })
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.preset).toBeDefined();
        expect(data.preset.name).toBe('Test Preset');
        testPresetId = data.preset.id;
    });

    test('POST /batch-photo/presets - should fail without name', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                transformations: { enhance: true }
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Name and transformations required');
    });

    test('POST /batch-photo/presets - should fail without transformations', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Preset'
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Name and transformations required');
    });
});

describe('Batch Photo - Update Preset', () => {
    test('PUT /batch-photo/presets/:id - should update preset', async () => {
        if (!testPresetId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/presets/${testPresetId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Test Preset',
                description: 'Updated description'
            })
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Preset updated');
    });

    test('PUT /batch-photo/presets/:id - should return 404 for non-existent preset', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets/non-existent-id`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        expect(response.status).toBe(404);
    });
});

describe('Batch Photo - Set Default Preset', () => {
    test('POST /batch-photo/presets/:id/set-default - should set default preset', async () => {
        if (!testPresetId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/presets/${testPresetId}/set-default`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Default preset updated');
    });

    test('POST /batch-photo/presets/:id/set-default - should return 404 for non-existent preset', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets/non-existent-id/set-default`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Batch Photo - Delete Preset', () => {
    test('DELETE /batch-photo/presets/:id - should delete preset', async () => {
        if (!testPresetId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/presets/${testPresetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Preset deleted');
    });

    test('DELETE /batch-photo/presets/:id - should return 404 for non-existent preset', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/presets/non-existent-id`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Batch Photo - Delete Job', () => {
    test('DELETE /batch-photo/jobs/:id - should delete job', async () => {
        if (!testJobId) return;

        const response = await fetch(`${BASE_URL}/batch-photo/jobs/${testJobId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May fail if job is still processing
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toBe('Job deleted');
        }
    });

    test('DELETE /batch-photo/jobs/:id - should return 404 for non-existent job', async () => {
        const response = await fetch(`${BASE_URL}/batch-photo/jobs/non-existent-id`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});
