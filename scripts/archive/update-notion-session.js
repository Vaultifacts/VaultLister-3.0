/**
 * Notion Session Update Script for VaultLister
 * Run: node scripts/update-notion-session.js
 *
 * This script:
 * 1. Transfers approved items from "Approved to Move" to "Completed Issues and Features"
 * 2. Adds new completed work items to "Waiting for Manual Approval"
 *
 * Usage:
 *   node scripts/update-notion-session.js transfer           - Transfer approved items to completed
 *   node scripts/update-notion-session.js add <page> <item>  - Add item to waiting for approval
 *   node scripts/update-notion-session.js list               - List all sub-pages
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
const INCOMPLETE_ISSUES_PAGE_ID = '2ef1596c-d154-80cc-b201-edef850fbfbf';
const COMPLETE_ISSUES_PAGE_ID = '2f21596c-d154-80e1-8acc-eb9363246b9f';

if (!NOTION_API_TOKEN) {
    console.error('ERROR: NOTION_INTEGRATION_TOKEN not found in .env file');
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${NOTION_API_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
};

async function fetchBlocks(blockId) {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, { headers });
    if (!response.ok) throw new Error(`Failed to fetch blocks: ${response.status}`);
    return response.json();
}

async function appendBlocks(blockId, children) {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ children })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to append blocks: ${response.status} - ${text}`);
    }
    return response.json();
}

async function deleteBlock(blockId) {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}`, {
        method: 'DELETE',
        headers
    });
    if (!response.ok) throw new Error(`Failed to delete block: ${response.status}`);
    return response.json();
}

async function updatePageTitle(pageId, newTitle) {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            properties: {
                title: {
                    title: [{ text: { content: newTitle } }]
                }
            }
        })
    });
    if (!response.ok) throw new Error(`Failed to update page title: ${response.status}`);
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

async function getSubPages(parentPageId) {
    const blocks = await fetchBlocks(parentPageId);
    const subPages = [];
    for (const block of blocks.results) {
        if (block.type === 'child_page') {
            subPages.push({
                id: block.id,
                title: block.child_page.title
            });
        }
    }
    return subPages;
}

async function findApprovedItems(pageId) {
    const blocks = await fetchBlocks(pageId);
    const approvedItems = [];
    let inApprovedSection = false;

    for (const block of blocks.results) {
        const text = extractTextFromBlock(block);

        if (block.type === 'heading_2') {
            inApprovedSection = text.includes('Approved to Move');
            continue;
        }

        if (inApprovedSection && text && block.type !== 'child_page') {
            approvedItems.push({
                blockId: block.id,
                text: text,
                type: block.type
            });
        }
    }

    return approvedItems;
}

async function findWaitingApprovalItems(pageId) {
    const blocks = await fetchBlocks(pageId);
    let hasItems = false;
    let inWaitingSection = false;

    for (const block of blocks.results) {
        const text = extractTextFromBlock(block);

        if (block.type === 'heading_2') {
            inWaitingSection = text.includes('Waiting for Manual Approval');
            continue;
        }

        if (inWaitingSection && text && block.type !== 'child_page') {
            hasItems = true;
            break;
        }
    }

    return hasItems;
}

async function findSectionBlockId(pageId, sectionName) {
    const blocks = await fetchBlocks(pageId);

    for (let i = 0; i < blocks.results.length; i++) {
        const block = blocks.results[i];
        if (block.type === 'heading_2') {
            const text = extractTextFromBlock(block);
            if (text.includes(sectionName)) {
                return block.id;
            }
        }
    }
    return null;
}

async function transferApprovedItems() {
    console.log('='.repeat(60));
    console.log('TRANSFER APPROVED ITEMS TO COMPLETED');
    console.log('='.repeat(60));

    // Get all sub-pages from both Incomplete and Complete
    const incompletePages = await getSubPages(INCOMPLETE_ISSUES_PAGE_ID);
    const completePages = await getSubPages(COMPLETE_ISSUES_PAGE_ID);

    console.log(`Found ${incompletePages.length} incomplete sub-pages`);
    console.log(`Found ${completePages.length} complete sub-pages\n`);

    let totalTransferred = 0;

    for (const incompletePage of incompletePages) {
        // Find approved items
        const approvedItems = await findApprovedItems(incompletePage.id);

        if (approvedItems.length === 0) {
            await new Promise(r => setTimeout(r, 350));
            continue;
        }

        console.log(`\n[${incompletePage.title}] Found ${approvedItems.length} approved items`);

        // Find matching complete page (strip "(Items to Approve)" suffix for matching)
        const baseTitle = incompletePage.title.replace(' (Items to Approve)', '').trim();
        const completePage = completePages.find(p =>
            p.title.replace(' (Items to Approve)', '').trim() === baseTitle
        );

        if (!completePage) {
            console.log(`  WARNING: No matching complete page found for "${baseTitle}"`);
            continue;
        }

        // Transfer each item
        for (const item of approvedItems) {
            // Add to complete page as paragraph
            await appendBlocks(completePage.id, [{
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: item.text } }]
                }
            }]);

            // Delete from incomplete page
            await deleteBlock(item.blockId);

            console.log(`  Transferred: ${item.text.substring(0, 50)}...`);
            totalTransferred++;

            await new Promise(r => setTimeout(r, 350));
        }

        // Check if "Waiting for Manual Approval" section is empty
        const hasWaitingItems = await findWaitingApprovalItems(incompletePage.id);

        if (!hasWaitingItems && incompletePage.title.includes('(Items to Approve)')) {
            // Remove the suffix from the title
            const newTitle = incompletePage.title.replace(' (Items to Approve)', '');
            await updatePageTitle(incompletePage.id, newTitle);
            console.log(`  Removed "(Items to Approve)" suffix from page title`);
        }

        await new Promise(r => setTimeout(r, 350));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`SUMMARY: Transferred ${totalTransferred} items`);
    console.log('='.repeat(60));
}

async function addCompletedItem(pageName, itemText) {
    console.log('='.repeat(60));
    console.log('ADD COMPLETED ITEM TO WAITING FOR APPROVAL');
    console.log('='.repeat(60));

    const incompletePages = await getSubPages(INCOMPLETE_ISSUES_PAGE_ID);

    // Find matching page (case-insensitive, partial match)
    const matchingPage = incompletePages.find(p =>
        p.title.toLowerCase().includes(pageName.toLowerCase())
    );

    if (!matchingPage) {
        console.log(`ERROR: No page found matching "${pageName}"`);
        console.log('Available pages:');
        incompletePages.forEach(p => console.log(`  - ${p.title}`));
        process.exit(1);
    }

    console.log(`Found page: ${matchingPage.title}`);

    // Find the "Waiting for Manual Approval" section
    const sectionBlockId = await findSectionBlockId(matchingPage.id, 'Waiting for Manual Approval');

    if (!sectionBlockId) {
        console.log('ERROR: Could not find "Waiting for Manual Approval" section');
        process.exit(1);
    }

    // Add the item after the section heading
    await appendBlocks(sectionBlockId, [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [{ type: 'text', text: { content: itemText } }]
        }
    }]);

    console.log(`Added item to "${matchingPage.title}"`);

    // Update page title to include "(Items to Approve)" if not already there
    if (!matchingPage.title.includes('(Items to Approve)')) {
        const newTitle = `${matchingPage.title} (Items to Approve)`;
        await updatePageTitle(matchingPage.id, newTitle);
        console.log(`Updated page title to: ${newTitle}`);
    }

    console.log('\nDone!');
}

async function listPages() {
    console.log('='.repeat(60));
    console.log('AVAILABLE SUB-PAGES');
    console.log('='.repeat(60));

    const incompletePages = await getSubPages(INCOMPLETE_ISSUES_PAGE_ID);

    console.log('\nIncomplete Issues & Features:');
    incompletePages.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title}`);
    });

    const completePages = await getSubPages(COMPLETE_ISSUES_PAGE_ID);

    console.log('\nCompleted Issues and Features:');
    completePages.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title}`);
    });
}

async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'transfer':
            await transferApprovedItems();
            break;

        case 'add':
            const pageName = process.argv[3];
            const itemText = process.argv.slice(4).join(' ');

            if (!pageName || !itemText) {
                console.log('Usage: node scripts/update-notion-session.js add <page-name> <item-text>');
                console.log('Example: node scripts/update-notion-session.js add Dashboard "Title: Fixed button. Description: Fixed the save button. Test: Click save. Expected: Item saves. Files: app.js"');
                process.exit(1);
            }

            await addCompletedItem(pageName, itemText);
            break;

        case 'list':
            await listPages();
            break;

        default:
            console.log('Notion Session Update Script');
            console.log('');
            console.log('Commands:');
            console.log('  transfer              - Transfer approved items to completed');
            console.log('  add <page> <item>     - Add item to waiting for approval');
            console.log('  list                  - List all sub-pages');
            console.log('');
            console.log('Examples:');
            console.log('  node scripts/update-notion-session.js transfer');
            console.log('  node scripts/update-notion-session.js list');
            console.log('  node scripts/update-notion-session.js add Dashboard "Title: Fix. Test: Click. Expected: Works."');
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
