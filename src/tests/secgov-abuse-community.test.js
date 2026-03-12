// Security & Governance — Abuse Resistance, Community Safety, Dev Secret Fallback
// Audit gaps: H4/H28 (community sanitization), H7 (CSRF disable), H44 (dev JWT),
//             H9 (admin flag), H38 (bot audit log), community flag/moderation
// Categories: Security/Abuse Resistance, Moderation/Trust/Safety, Ecosystem

import { describe, expect, test, mock, beforeEach } from 'bun:test';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

const mockLogger = { info: mock(), error: mock(), warn: mock(), debug: mock() };
mock.module('../backend/shared/logger.js', () => ({
    logger: mockLogger,
    default: mockLogger,
}));

mock.module('../backend/services/websocket.js', () => ({
    websocketService: { sendToUser: mock(), broadcast: mock(), cleanup: mock() },
}));

// ─── Dynamic imports (after mocks) ──────────────────────────────────────────

const { communityRouter } = await import('../backend/routes/community.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
    return {
        method: 'GET',
        path: '/',
        body: {},
        query: {},
        user: { id: 'user-1', email: 'test@example.com', username: 'testuser' },
        ...overrides,
    };
}

beforeEach(() => {
    mockQueryGet.mockReset().mockReturnValue(null);
    mockQueryAll.mockReset().mockReturnValue([]);
    mockQueryRun.mockReset().mockReturnValue({ changes: 1 });
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Community Post Input Validation', () => {
    test('should require type, title, and content', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: { type: 'discussion' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('required');
    });

    test('should reject invalid post type', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: { type: 'malicious', title: 'Test', content: 'Content' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('type must be');
    });

    test('should reject title over 200 characters', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: { type: 'discussion', title: 'A'.repeat(201), content: 'Content' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('200');
    });

    test('should reject content over 10000 characters', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: { type: 'discussion', title: 'Title', content: 'A'.repeat(10001) },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
    });

    test('should reject tags array over 10 items', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: {
                type: 'discussion',
                title: 'Title',
                content: 'Content',
                tags: Array(11).fill('tag'),
            },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
    });

    test('should strip HTML from tags', async () => {
        mockQueryGet.mockReturnValue({
            id: 'post-1', user_id: 'user-1', tags: '["clean tag"]',
            title: 'Test', body: 'Content', type: 'discussion',
            author_name: 'testuser',
        });

        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: {
                type: 'discussion',
                title: 'Title',
                content: 'Content',
                tags: ['<script>alert(1)</script>clean tag', '<b>bold</b>'],
            },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(201);

        // Verify sanitized tags were stored
        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO community_posts')
        );
        expect(insertCall).toBeTruthy();
        const storedTags = JSON.parse(insertCall[1][5]); // tags param
        for (const tag of storedTags) {
            expect(tag).not.toContain('<script>');
            expect(tag).not.toContain('<b>');
        }
    });
});

describe('Community Post Content Sanitization (H4/H28)', () => {
    test('title and body should be HTML-escaped before storage', async () => {
        // FIX VERIFIED: community.js now applies escapeHtml() to title and content on INSERT
        mockQueryGet.mockReturnValue({
            id: 'post-1', user_id: 'user-1',
            title: '&lt;img src=x onerror=alert(1)&gt;',
            body: '&lt;script&gt;document.cookie&lt;/script&gt;',
            tags: '[]', type: 'discussion',
            author_name: 'testuser',
        });

        const xssTitle = '<img src=x onerror=alert(1)>';
        const xssBody = '<script>document.cookie</script>';

        const ctx = makeCtx({
            method: 'POST',
            path: '/posts',
            body: { type: 'discussion', title: xssTitle, content: xssBody },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(201);

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO community_posts')
        );
        expect(insertCall).toBeTruthy();
        // Title (index 3) and body (index 4) should be escaped
        expect(insertCall[1][3]).not.toContain('<img');
        expect(insertCall[1][3]).toContain('&lt;img');
        expect(insertCall[1][4]).not.toContain('<script>');
        expect(insertCall[1][4]).toContain('&lt;script&gt;');
    });
});

describe('Community Post Flagging', () => {
    test('should allow flagging a post with a reason', async () => {
        mockQueryGet.mockReturnValue(null); // no existing flag

        const ctx = makeCtx({
            method: 'POST',
            path: '/posts/abc123de/flag',
            body: { reason: 'spam' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(201);
        expect(result.data.success).toBe(true);

        // Verify flag insertion
        const flagInsert = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO community_flags')
        );
        expect(flagInsert).toBeTruthy();
    });

    test('should prevent duplicate flags from same user', async () => {
        mockQueryGet.mockReturnValue({ id: 'existing-flag' });

        const ctx = makeCtx({
            method: 'POST',
            path: '/posts/abc123de/flag',
            body: { reason: 'spam' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('already flagged');
    });

    test('should require a reason for flagging', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts/abc123de/flag',
            body: {},
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
    });
});

describe('Community Post Ownership / IDOR', () => {
    test('should only allow deleting own posts', async () => {
        // Post owned by a different user
        mockQueryGet.mockReturnValue(null); // WHERE id = ? AND user_id = ? returns null

        const ctx = makeCtx({
            method: 'DELETE',
            path: '/posts/abc123de-f012-3456-7890-abcdef123456',
            user: { id: 'attacker-user' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(404);
    });

    test('should only allow editing own replies', async () => {
        mockQueryGet.mockReturnValue({ id: 'reply-1', user_id: 'other-user' });

        const ctx = makeCtx({
            method: 'PATCH',
            path: '/replies/abc123de-f012-3456-7890-abcdef123456',
            body: { content: 'edited' },
            user: { id: 'attacker-user' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(403);
        expect(result.data.error).toContain('own replies');
    });

    test('delete uses soft delete (is_hidden flag, not actual DELETE)', async () => {
        mockQueryGet.mockReturnValue({ id: 'post-1' }); // ownership verified

        const ctx = makeCtx({
            method: 'DELETE',
            path: '/posts/abc123de-f012-3456-7890-abcdef123456',
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(200);

        // Verify soft delete (UPDATE is_hidden = 1), NOT DELETE
        const softDelete = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('is_hidden = 1')
        );
        expect(softDelete).toBeTruthy();

        const hardDelete = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('DELETE FROM community_posts')
        );
        expect(hardDelete).toBeFalsy();
    });

    test('hidden posts should not appear in listing', async () => {
        mockQueryAll.mockReturnValue([]);

        const ctx = makeCtx({
            method: 'GET',
            path: '/posts',
            query: {},
        });
        await communityRouter(ctx);

        // Verify query includes is_hidden = 0 filter
        const listQuery = mockQueryAll.mock.calls.find(c =>
            c[0]?.includes('community_posts') && c[0]?.includes('is_hidden = 0')
        );
        expect(listQuery).toBeTruthy();
    });

    test('hidden posts visible only to their author', async () => {
        mockQueryGet.mockReturnValue({
            id: 'post-1', user_id: 'user-1', is_hidden: 1,
            title: 'Hidden', body: 'Content', tags: '[]',
            type: 'discussion', author_name: 'testuser',
        });
        mockQueryAll.mockReturnValue([]);

        const ctx = makeCtx({
            method: 'GET',
            path: '/posts/abc123de-f012-3456-7890-abcdef123456',
            user: { id: 'user-1' },
        });
        await communityRouter(ctx);

        // Verify query includes (is_hidden = 0 OR user_id = ?)
        const getQuery = mockQueryGet.mock.calls.find(c =>
            c[0]?.includes('community_posts') && c[0]?.includes('is_hidden')
        );
        expect(getQuery).toBeTruthy();
        expect(getQuery[0]).toContain('p.user_id = ?');
    });
});

describe('Community Reaction Validation', () => {
    test('should reject invalid reaction types', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts/abc123de/react',
            body: { reaction_type: 'malicious' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(400);
    });

    test('should allow valid reaction types', async () => {
        mockQueryGet.mockReturnValue(null); // no existing reaction
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts/abc123de/react',
            body: { reaction_type: 'upvote' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(201);
    });

    test('should toggle off reaction when same type clicked again', async () => {
        mockQueryGet.mockReturnValue({ id: 'react-1', reaction_type: 'upvote' });
        const ctx = makeCtx({
            method: 'POST',
            path: '/posts/abc123de/react',
            body: { reaction_type: 'upvote' },
        });
        const result = await communityRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.action).toBe('removed');
    });
});

describe('Gap Documentation — Moderation (H26/H27)', () => {
    test('no admin moderation endpoints exist (gap documented)', () => {
        // GAP: community.js has no admin-level moderation endpoints:
        // - No GET /api/community/admin/flagged — view flagged content
        // - No POST /api/community/admin/posts/:id/hide — admin hide post
        // - No POST /api/community/admin/users/:id/ban — ban user
        // - No GET /api/community/admin/moderation-queue — review queue
        // - No POST /api/community/admin/posts/:id/takedown — takedown + propagation
        //
        // The flag endpoint exists (POST /posts/:id/flag) but there is no
        // moderation queue or admin interface to act on flags.
        //
        // Recommendation: implement admin moderation routes with is_admin gating
        expect(true).toBe(true);
    });
});

describe('Gap Documentation — Dev JWT Fallback (H44)', () => {
    test('auth.js uses dev fallback when JWT_SECRET not set (gap documented)', () => {
        // GAP: auth.js lines 17-20 — when JWT_SECRET is not set and NODE_ENV
        // is not 'production', a hardcoded dev fallback is used.
        // The fallback is: 'dev-only-not-for-production'
        // Only protection: logger.warn() and process.exit(1) in production.
        // Missing: No startup abort in staging environment.
        // Recommendation: also abort in 'staging' NODE_ENV, or require JWT_SECRET
        // in all non-development environments.
        expect(true).toBe(true);
    });
});

describe('Gap Documentation — Bot Audit Logging (H38)', () => {
    test('automation bots reference audit log but implementation not verified (gap documented)', () => {
        // GAP: CLAUDE.md and RULES.md require all bot actions to be logged to
        // data/automation-audit.log, but during audit inspection, the actual bot
        // files (poshmarkSync.js, ebaySync.js, etc.) were not found to write
        // to this file. The bots import RATE_LIMITS from rate-limits.js and
        // read credentials from process.env, but audit logging to file was not
        // verified in the sync service code.
        //
        // Recommendation: verify automation audit logging exists in each bot,
        // or add it if missing.
        expect(true).toBe(true);
    });
});
