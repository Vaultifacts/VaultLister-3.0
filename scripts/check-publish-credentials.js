// scripts/check-publish-credentials.js
// Checks .env for all marketplace publish credentials and reports status.
// Run: bun scripts/check-publish-credentials.js
//
// Does NOT print secret values — only reports PRESENT or MISSING.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

function loadEnvKeys(filePath) {
    if (!existsSync(filePath)) return new Set();
    const lines = readFileSync(filePath, 'utf-8').split('\n');
    const keys = new Set();
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed.slice(eq + 1).trim();
            // Only count as present if value is non-empty and not a placeholder
            if (val && !val.startsWith('your-') && val !== 'CHANGE_ME' && val !== '') {
                keys.add(key);
            }
        }
    }
    return keys;
}

const PLATFORMS = [
    {
        name: 'eBay (OAuth)',
        type: 'oauth',
        vars: ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET'],
        note: 'Connect via My Shops → Connect eBay'
    },
    {
        name: 'Etsy (OAuth + PKCE)',
        type: 'oauth',
        vars: ['ETSY_CLIENT_ID', 'ETSY_CLIENT_SECRET'],
        note: 'Connect via My Shops → Connect Etsy (PKCE flow active)'
    },
    {
        name: 'Poshmark (Automation)',
        type: 'automation',
        vars: ['POSHMARK_USERNAME', 'POSHMARK_PASSWORD'],
        note: 'Add POSHMARK_USERNAME and POSHMARK_PASSWORD to .env'
    },
    {
        name: 'Mercari (Automation)',
        type: 'automation',
        vars: ['MERCARI_USERNAME', 'MERCARI_PASSWORD'],
        note: 'Add MERCARI_USERNAME and MERCARI_PASSWORD to .env'
    },
    {
        name: 'Depop (Automation)',
        type: 'automation',
        vars: ['DEPOP_USERNAME', 'DEPOP_PASSWORD'],
        note: 'Add DEPOP_USERNAME and DEPOP_PASSWORD to .env'
    },
    {
        name: 'Grailed (Automation)',
        type: 'automation',
        vars: ['GRAILED_USERNAME', 'GRAILED_PASSWORD'],
        note: 'Add GRAILED_USERNAME and GRAILED_PASSWORD to .env'
    },
    {
        name: 'Facebook Marketplace (Automation)',
        type: 'automation',
        vars: ['FACEBOOK_EMAIL', 'FACEBOOK_PASSWORD'],
        note: 'Add FACEBOOK_EMAIL and FACEBOOK_PASSWORD to .env'
    },
    {
        name: 'Whatnot (Automation)',
        type: 'automation',
        vars: ['WHATNOT_USERNAME', 'WHATNOT_PASSWORD'],
        note: 'Add WHATNOT_USERNAME and WHATNOT_PASSWORD to .env'
    },
    {
        name: 'Shopify (REST API)',
        type: 'api',
        vars: ['SHOPIFY_STORE_URL', 'SHOPIFY_ACCESS_TOKEN'],
        note: 'Add SHOPIFY_STORE_URL (e.g. my-store.myshopify.com) and SHOPIFY_ACCESS_TOKEN (shpat_...) to .env'
    }
];

const presentKeys = loadEnvKeys(ENV_PATH);
const envExists = existsSync(ENV_PATH);

console.log('\n=== VaultLister Publish Credential Check ===\n');

if (!envExists) {
    console.log('ERROR: .env file not found at', ENV_PATH);
    console.log('Copy .env.example to .env and fill in your values.\n');
    process.exit(1);
}

let readyCount = 0;
let missingCount = 0;

for (const platform of PLATFORMS) {
    const allPresent = platform.vars.every(v => presentKeys.has(v));
    const anyPresent = platform.vars.some(v => presentKeys.has(v));
    const missingVars = platform.vars.filter(v => !presentKeys.has(v));

    if (allPresent) {
        console.log(`  ✅  ${platform.name}`);
        readyCount++;
    } else if (anyPresent) {
        console.log(`  ⚠️   ${platform.name} — partially configured`);
        console.log(`       Missing: ${missingVars.join(', ')}`);
        missingCount++;
    } else {
        console.log(`  ❌  ${platform.name}`);
        if (platform.type === 'automation') {
            console.log(`       → ${platform.note}`);
        } else {
            console.log(`       → ${platform.note}`);
        }
        missingCount++;
    }
}

console.log(`\n  ${readyCount}/${PLATFORMS.length} platforms ready`);

if (missingCount > 0) {
    console.log('\n--- Missing automation credentials (add to .env) ---');
    for (const p of PLATFORMS) {
        if (p.type === 'automation' && !p.vars.every(v => presentKeys.has(v))) {
            for (const v of p.vars) {
                if (!presentKeys.has(v)) {
                    console.log(`  ${v}=`);
                }
            }
        }
    }
    console.log('');
}
