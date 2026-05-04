import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const serverSource = readFileSync(join(ROOT, 'src/backend/server.js'), 'utf8');

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
