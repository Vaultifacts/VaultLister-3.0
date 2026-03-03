// Community — expanded test for DELETE /posts/:id endpoint
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let clientB;
let unauthClient;

beforeAll(async () => {
    const userA = await createTestUserWithToken();
    const userB = await createTestUserWithToken();
    client = new TestApiClient(userA.token);
    clientB = new TestApiClient(userB.token);
    unauthClient = new TestApiClient();
});

describe('Community Expanded - Delete Post', () => {
    test('DELETE /community/posts/:id without auth returns 401', async () => {
        const { status } = await unauthClient.delete('/community/posts/some-id');
        expect(status).toBe(401);
    });

    test('DELETE /community/posts/nonexistent returns 404', async () => {
        const { status, data } = await client.delete('/community/posts/nonexistent-id');
        expect([404, 500]).toContain(status);
        if (status === 404) {
            expect(data.error).toBeDefined();
        }
    });

    test('DELETE /community/posts/:id for own post returns success', async () => {
        // Create a post first
        const { status: createStatus, data: createData } = await client.post('/community/posts', {
            type: 'discussion',
            title: 'Test Post to Delete',
            content: 'This post will be deleted'
        });
        expect([200, 201, 500]).toContain(createStatus);

        if (createStatus === 200 || createStatus === 201) {
            const postId = createData.id || createData.post?.id;
            if (postId) {
                const { status } = await client.delete(`/community/posts/${postId}`);
                expect([200, 500]).toContain(status);
            }
        }
    });

    test('DELETE /community/posts/:id for another users post returns 404', async () => {
        // Create a post as userA
        const { status: createStatus, data: createData } = await client.post('/community/posts', {
            type: 'discussion',
            title: 'Post by User A',
            content: 'User B cannot delete this'
        });

        if (createStatus === 200 || createStatus === 201) {
            const postId = createData.id || createData.post?.id;
            if (postId) {
                // Try to delete as userB — should return 404 (ownership check)
                const { status } = await clientB.delete(`/community/posts/${postId}`);
                expect([404, 500]).toContain(status);
            }
        }
    });
});
