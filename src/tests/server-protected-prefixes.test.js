import { describe, expect, test } from 'bun:test';

const serverSource = await Bun.file(new URL('../backend/server.js', import.meta.url)).text();

function protectedPrefixesBlock() {
    const match = serverSource.match(/const protectedPrefixes = \[([\s\S]*?)\];/);
    return match?.[1] || '';
}

describe('server protectedPrefixes', () => {
    test('includes authenticated financial settings routes', () => {
        const prefixes = protectedPrefixesBlock();

        for (const route of ['/api/goals', '/api/budget']) {
            expect(prefixes).toContain(`'${route}'`);
        }
    });
});
