#!/usr/bin/env bun
// OAuth Encryption Key Rotation Script (REM-06)
//
// Re-encrypts all OAuth tokens from the old key to the new key.
//
// Usage:
//   OAUTH_ENCRYPTION_KEY=<new-key> OAUTH_ENCRYPTION_KEY_OLD=<old-key> bun scripts/rotate-encryption-key.js
//
// Prerequisites:
//   1. Set OAUTH_ENCRYPTION_KEY to the NEW key in .env
//   2. Set OAUTH_ENCRYPTION_KEY_OLD to the CURRENT (old) key in .env
//   3. Run this script
//   4. Verify all tokens decrypt correctly
//   5. Remove OAUTH_ENCRYPTION_KEY_OLD from .env
//
// The script:
//   - Reads all encrypted tokens from oauth_accounts
//   - Decrypts each with the old key (via OAUTH_ENCRYPTION_KEY_OLD fallback)
//   - Re-encrypts with the new key (OAUTH_ENCRYPTION_KEY)
//   - Updates the database row
//   - Reports success/failure counts

import crypto from 'crypto';
import { query } from '../src/backend/db/database.js';
import { encryptToken, decryptToken } from '../src/backend/utils/encryption.js';
import { logger } from '../src/backend/shared/logger.js';

const NEW_KEY = process.env.OAUTH_ENCRYPTION_KEY;
const OLD_KEY = process.env.OAUTH_ENCRYPTION_KEY_OLD;

if (!NEW_KEY) {
    console.error('ERROR: OAUTH_ENCRYPTION_KEY (new key) must be set.');
    process.exit(1);
}

if (!OLD_KEY) {
    console.error('ERROR: OAUTH_ENCRYPTION_KEY_OLD (current/old key) must be set.');
    console.error('Set it to the key currently used to encrypt tokens.');
    process.exit(1);
}

if (NEW_KEY === OLD_KEY) {
    console.error('ERROR: OAUTH_ENCRYPTION_KEY and OAUTH_ENCRYPTION_KEY_OLD are the same. Nothing to rotate.');
    process.exit(1);
}

console.log('=== OAuth Encryption Key Rotation ===');
console.log(`Old key length: ${OLD_KEY.length} chars`);
console.log(`New key length: ${NEW_KEY.length} chars`);

// Fetch all OAuth accounts with encrypted tokens
const accounts = query.all(`
    SELECT id, platform, access_token, refresh_token
    FROM oauth_accounts
    WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL
`);

console.log(`Found ${accounts.length} OAuth account(s) to re-encrypt.\n`);

let success = 0;
let failed = 0;
let skipped = 0;

for (const acct of accounts) {
    try {
        let newAccessToken = acct.access_token;
        let newRefreshToken = acct.refresh_token;
        let changed = false;

        // Re-encrypt access token
        if (acct.access_token) {
            const plaintext = decryptToken(acct.access_token);
            newAccessToken = encryptToken(plaintext);
            changed = true;
        }

        // Re-encrypt refresh token
        if (acct.refresh_token) {
            const plaintext = decryptToken(acct.refresh_token);
            newRefreshToken = encryptToken(plaintext);
            changed = true;
        }

        if (changed) {
            query.run(`
                UPDATE oauth_accounts
                SET access_token = ?, refresh_token = ?, updated_at = datetime('now')
                WHERE id = ?
            `, [newAccessToken, newRefreshToken, acct.id]);

            // Verify round-trip: decrypt the newly encrypted tokens
            if (newAccessToken) decryptToken(newAccessToken);
            if (newRefreshToken) decryptToken(newRefreshToken);

            console.log(`  ✓ ${acct.platform} (${acct.id}) — re-encrypted`);
            success++;
        } else {
            console.log(`  - ${acct.platform} (${acct.id}) — no tokens, skipped`);
            skipped++;
        }
    } catch (err) {
        console.error(`  ✗ ${acct.platform} (${acct.id}) — FAILED: ${err.message}`);
        failed++;
    }
}

console.log(`\n=== Results ===`);
console.log(`  Success: ${success}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Failed:  ${failed}`);

if (failed > 0) {
    console.error('\nWARNING: Some tokens failed to re-encrypt. Do NOT remove OAUTH_ENCRYPTION_KEY_OLD yet.');
    console.error('Investigate the failures above, then re-run this script.');
    process.exit(1);
} else {
    console.log('\nAll tokens re-encrypted successfully.');
    console.log('Next steps:');
    console.log('  1. Verify the app works correctly with the new key');
    console.log('  2. Remove OAUTH_ENCRYPTION_KEY_OLD from .env');
    console.log('  3. Restart the application');
}
