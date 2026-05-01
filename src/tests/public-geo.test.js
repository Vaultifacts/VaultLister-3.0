import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'path';

function htmlFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            files.push(...htmlFiles(path));
        } else if (path.endsWith('.html')) {
            files.push(path);
        }
    }
    return files;
}

describe('public geo localization', () => {
    test('does not call third-party geo services from browser pages', () => {
        const publicDir = join(process.cwd(), 'public');
        const offenders = htmlFiles(publicDir).filter(file => {
            const body = readFileSync(file, 'utf8');
            return body.includes('https://ipapi.co/json/');
        });

        expect(offenders).toEqual([]);
    });
});
