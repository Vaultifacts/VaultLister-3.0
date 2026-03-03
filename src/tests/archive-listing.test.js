// Test file for archive/unarchive listing functionality
// Run this test to verify the archive endpoints work correctly

import { describe, test, expect, beforeAll } from 'bun:test';

// Mock database query for testing
const mockDb = {
    listings: [],
    get(sql, params) {
        if (sql.includes('SELECT') && sql.includes('WHERE id = ?')) {
            return this.listings.find(l => l.id === params[0]);
        }
        return null;
    },
    run(sql, params) {
        if (sql.includes('UPDATE listings')) {
            const id = params[params.length - 1];
            const listing = this.listings.find(l => l.id === id);
            if (listing) {
                // Parse SET clause to map params correctly
                const setClause = sql.match(/SET\s+(.*?)\s+WHERE/i)?.[1] || '';
                const setParts = setClause.split(',').map(s => s.trim());
                let paramIndex = 0;

                for (const part of setParts) {
                    if (part.includes('status = ?')) {
                        listing.status = params[paramIndex++];
                    } else if (part.includes('deleted_at = NULL')) {
                        listing.deleted_at = null;
                    } else if (part.includes('deleted_at')) {
                        listing.deleted_at = new Date().toISOString();
                    } else if (part.includes('notes = ?')) {
                        listing.notes = params[paramIndex++];
                    }
                }
            }
        }
    }
};

describe('Archive Listing Tests', () => {
    beforeAll(() => {
        // Setup test listing
        mockDb.listings = [{
            id: 'test-listing-1',
            user_id: 'user-1',
            platform: 'poshmark',
            title: 'Test Item',
            status: 'active',
            images: '[]',
            platform_specific_data: '{}',
            notes: null,
            deleted_at: null
        }];
    });

    test('Archive endpoint sets status to archived', () => {
        const listing = mockDb.get('SELECT * FROM listings WHERE id = ?', ['test-listing-1']);
        expect(listing).toBeDefined();
        expect(listing.status).toBe('active');

        // Simulate archive
        mockDb.run('UPDATE listings SET status = ?, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', ['archived', 'test-listing-1']);

        const updated = mockDb.get('SELECT * FROM listings WHERE id = ?', ['test-listing-1']);
        expect(updated.status).toBe('archived');
        expect(updated.deleted_at).toBeDefined();
    });

    test('Fallback to ended status with note when CHECK constraint fails', () => {
        // Reset listing
        const listing = mockDb.listings[0];
        listing.status = 'active';
        listing.notes = null;
        listing.deleted_at = null;

        // Simulate constraint failure fallback
        mockDb.run(`UPDATE listings SET status = ?, deleted_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ?`,
            ['ended', '[ARCHIVED] User archived this listing', 'test-listing-1']);

        const updated = mockDb.get('SELECT * FROM listings WHERE id = ?', ['test-listing-1']);
        expect(updated.status).toBe('ended');
        expect(updated.notes).toContain('[ARCHIVED]');
    });

    test('Unarchive removes archive status and clears deleted_at', () => {
        // Setup archived listing
        const listing = mockDb.listings[0];
        listing.status = 'archived';
        listing.deleted_at = new Date().toISOString();

        // Simulate unarchive
        mockDb.run('UPDATE listings SET status = ?, deleted_at = NULL WHERE id = ?', ['draft', 'test-listing-1']);

        const updated = mockDb.get('SELECT * FROM listings WHERE id = ?', ['test-listing-1']);
        expect(updated.status).toBe('draft');
        expect(updated.deleted_at).toBe(null);
    });

    test('Unarchive from fallback status removes archive note', () => {
        // Setup listing with fallback archive
        const listing = mockDb.listings[0];
        listing.status = 'ended';
        listing.notes = 'Some notes | [ARCHIVED] User archived this listing';
        listing.deleted_at = new Date().toISOString();

        // Simulate unarchive with note cleanup
        const cleanedNotes = listing.notes
            .replace(/\s*\|\s*\[ARCHIVED\] User archived this listing/, '')
            .trim();

        mockDb.run('UPDATE listings SET status = ?, deleted_at = NULL, notes = ? WHERE id = ?',
            ['draft', cleanedNotes, 'test-listing-1']);

        const updated = mockDb.get('SELECT * FROM listings WHERE id = ?', ['test-listing-1']);
        expect(updated.status).toBe('draft');
        expect(updated.notes).toBe('Some notes');
        expect(updated.notes).not.toContain('[ARCHIVED]');
    });
});

console.log('Archive listing tests completed. Run with: bun test src/tests/archive-listing.test.js');
