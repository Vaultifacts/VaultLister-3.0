/**
 * Fix Notion Page Titles
 * Run: bun scripts/fix-notion-page-titles.js
 *
 * Searches for pages with "(Items to Approve)" suffix, checks if "Waiting for Manual Approval"
 * section is empty, and removes the suffix if so.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get script directory and resolve .env path
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

// Load .env file manually
const envFile = Bun.file(envPath);
const envText = await envFile.text();
for (const line of envText.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    const eqIndex = trimmedLine.indexOf('=');
    if (eqIndex > 0) {
        const key = trimmedLine.slice(0, eqIndex).trim();
        const value = trimmedLine.slice(eqIndex + 1).trim();
        process.env[key] = value;
    }
}

const NOTION_API_TOKEN = process.env.NOTION_INTEGRATION_TOKEN;

if (!NOTION_API_TOKEN) {
    console.error('ERROR: NOTION_INTEGRATION_TOKEN not found in .env file');
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${NOTION_API_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
};

// Page names to check
const pageNamesToCheck = [
    'My Listings',
    'Size Charts',
    'Transactions',
    'Financials',
    'Analytics',
    'Help & Support',
    'Orders',
    'Image Bank'
];

async function searchPages(query) {
    const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            query: query,
            filter: { property: 'object', value: 'page' }
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Search failed: ${response.status} - ${text}`);
    }
    return response.json();
}

async function fetchBlocks(blockId) {
    const url = `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch blocks for ${blockId}: ${response.status} - ${errorText}`);
    }
    return response.json();
}

async function updatePageTitle(pageId, newTitle) {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            properties: {
                title: {
                    title: [
                        {
                            type: 'text',
                            text: { content: newTitle }
                        }
                    ]
                }
            }
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update page ${pageId}: ${response.status} - ${text}`);
    }
    return response.json();
}

function extractTextFromBlock(block) {
    if (!block) return '';

    const richTextArray =
        block.paragraph?.rich_text ||
        block.heading_1?.rich_text ||
        block.heading_2?.rich_text ||
        block.heading_3?.rich_text ||
        block.bulleted_list_item?.rich_text ||
        block.numbered_list_item?.rich_text ||
        block.to_do?.rich_text ||
        [];

    return richTextArray.map(rt => rt.plain_text).join('').trim();
}

function getPageTitle(page) {
    const titleProp = page.properties?.title?.title || [];
    return titleProp.map(t => t.plain_text).join('');
}

async function checkWaitingForApprovalSection(pageId) {
    try {
        const blocks = await fetchBlocks(pageId);

        let inWaitingSection = false;
        let hasItems = false;

        for (const block of blocks.results) {
            const text = extractTextFromBlock(block);

            // Check for section headers
            if (block.type === 'heading_2') {
                if (text.includes('Waiting for Manual Approval')) {
                    inWaitingSection = true;
                } else if (inWaitingSection) {
                    // Hit another heading, exit waiting section
                    break;
                }
                continue;
            }

            // Check for items in waiting section (non-empty, non-header blocks)
            if (inWaitingSection && text && block.type !== 'child_page') {
                hasItems = true;
                break;
            }
        }

        return hasItems;
    } catch (error) {
        console.log(`    Warning: Could not check blocks: ${error.message}`);
        return null; // Unknown
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('NOTION PAGE TITLE FIXER');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const results = {
        checked: [],
        renamed: [],
        leftAlone: [],
        errors: []
    };

    try {
        // First, search for all pages we can access
        console.log('Searching for accessible pages...\n');

        const searchResult = await searchPages('');
        console.log(`Found ${searchResult.results.length} accessible pages total.\n`);

        // Filter to pages matching our target names
        const relevantPages = [];

        for (const page of searchResult.results) {
            const title = getPageTitle(page);
            const baseName = title.replace(' (Items to Approve)', '').trim();

            if (pageNamesToCheck.includes(baseName) || pageNamesToCheck.includes(title)) {
                relevantPages.push({
                    id: page.id,
                    currentTitle: title,
                    baseName: baseName
                });
            }
        }

        console.log(`Found ${relevantPages.length} pages matching our target names:\n`);

        for (const pageInfo of relevantPages) {
            console.log(`- ${pageInfo.baseName} (ID: ${pageInfo.id})`);
            console.log(`    Current title: "${pageInfo.currentTitle}"`);

            // Check if it has the suffix
            const hasSuffix = pageInfo.currentTitle.includes('(Items to Approve)');
            console.log(`    Has suffix: ${hasSuffix ? 'YES' : 'NO'}`);

            if (hasSuffix) {
                // Check the waiting for approval section
                await new Promise(r => setTimeout(r, 350)); // Rate limit
                const hasItems = await checkWaitingForApprovalSection(pageInfo.id);

                if (hasItems === null) {
                    console.log(`    Could not determine waiting items status`);
                    results.errors.push({ name: pageInfo.baseName, reason: 'could not check blocks' });
                } else if (hasItems) {
                    console.log(`    Has waiting items: YES - keeping suffix`);
                    results.leftAlone.push({ name: pageInfo.baseName, reason: 'has items waiting for approval' });
                } else {
                    console.log(`    Has waiting items: NO - removing suffix`);
                    const newTitle = pageInfo.baseName;

                    await new Promise(r => setTimeout(r, 350)); // Rate limit
                    await updatePageTitle(pageInfo.id, newTitle);

                    console.log(`    -> Renamed to: "${newTitle}"`);
                    results.renamed.push({ name: pageInfo.baseName, from: pageInfo.currentTitle, to: newTitle });
                }
            } else {
                results.leftAlone.push({ name: pageInfo.baseName, reason: 'no suffix present' });
            }

            results.checked.push(pageInfo);
            console.log('');
        }

        // Summary
        console.log('='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));

        console.log('\nPages RENAMED:');
        if (results.renamed.length === 0) {
            console.log('  (none)');
        } else {
            results.renamed.forEach(r => {
                console.log(`  - ${r.name}: "${r.from}" -> "${r.to}"`);
            });
        }

        console.log('\nPages LEFT ALONE:');
        if (results.leftAlone.length === 0) {
            console.log('  (none)');
        } else {
            results.leftAlone.forEach(r => {
                console.log(`  - ${r.name}: ${r.reason}`);
            });
        }

        if (results.errors.length > 0) {
            console.log('\nPages with ERRORS:');
            results.errors.forEach(r => {
                console.log(`  - ${r.name}: ${r.reason}`);
            });
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();
