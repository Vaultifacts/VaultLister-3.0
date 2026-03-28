#!/usr/bin/env bun
// VaultLister API Test Runner
// Runs all API tests for the 5 new features and existing features

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

console.log('🧪 VaultLister API Test Suite\n');
console.log('Running comprehensive API tests for all features...\n');

const testFiles = [
    // Existing feature tests
    'src/tests/api.test.js',
    'src/tests/security.test.js',

    // New feature tests (Phase 1-9)
    'src/tests/imageBank.test.js',
    'src/tests/chatbot.test.js',
    'src/tests/community.test.js',
    'src/tests/extension.test.js',
    'src/tests/help.test.js'
];

let totalPassed = 0;
let totalFailed = 0;

async function runTest(testFile) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📝 Running: ${testFile}`);
        console.log('='.repeat(60));

        const test = spawn('bun', ['test', testFile], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            shell: true  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
        });

        test.on('close', (code) => {
            if (code === 0) {
                totalPassed++;
                console.log(`✅ ${testFile} - PASSED`);
            } else {
                totalFailed++;
                console.log(`❌ ${testFile} - FAILED`);
            }
            resolve(code);
        });
    });
}

async function runAllTests() {
    const startTime = Date.now();

    for (const testFile of testFiles) {
        await runTest(testFile);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total Test Files: ${testFiles.length}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('='.repeat(60));

    if (totalFailed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
        process.exit(1);
    }
}

// Check if server is running
console.log('Checking if server is running on http://localhost:3000...');
try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'test' })
    });

    console.log('✅ Server is running\n');
    runAllTests();
} catch (error) {
    console.error('\n❌ Error: Server is not running!');
    console.error('Please start the server first: bun run src/backend/server.js\n');
    process.exit(1);
}
