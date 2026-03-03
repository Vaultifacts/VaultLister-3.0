/**
 * Notion Status Checker for VaultLister
 * Run: bun scripts/check-notion-status.js
 *
 * This script:
 * 1. Lists all pending issues from "Issues/Features to Work On" sections
 * 2. Lists all items waiting for approval
 * 3. Lists all items approved and ready to move
 */

import { loadEnv } from './lib/env.js';
import { getChildPages, getBlocks, getPageIds } from './lib/notion.js';

loadEnv();

const { incomplete: INCOMPLETE_ISSUES_PAGE_ID } = getPageIds();

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
        block.toggle?.rich_text ||
        [];

    return richTextArray.map(rt => rt.plain_text).join('').trim();
}

async function parseSubPageSections(pageId, pageTitle) {
    const blocks = await getBlocks(pageId);

    const sections = {
        toWorkOn: [],
        waitingApproval: [],
        approvedToMove: []
    };

    let currentSection = null;

    for (const block of blocks) {
        const text = extractTextFromBlock(block);

        // Check for section headers
        if (block.type === 'heading_2') {
            if (text.includes('Issues/Features to Work On')) {
                currentSection = 'toWorkOn';
            } else if (text.includes('Waiting for Manual Approval')) {
                currentSection = 'waitingApproval';
            } else if (text.includes('Approved to Move')) {
                currentSection = 'approvedToMove';
            } else {
                currentSection = null;
            }
            continue;
        }

        // Collect items in current section
        if (currentSection && text && block.type !== 'child_page') {
            const isChecked = block.type === 'to_do' ? block.to_do?.checked : false;
            // For "toWorkOn" section, only count unchecked to_do blocks as pending
            // Toggle blocks or other types in this section are stale artifacts
            if (currentSection === 'toWorkOn' && block.type !== 'to_do') {
                continue;
            }
            sections[currentSection].push({
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                checked: isChecked,
                type: block.type
            });
        }
    }

    return sections;
}

async function main() {
    console.log('='.repeat(60));
    console.log('VAULTLISTER NOTION STATUS CHECK');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    try {
        // Get all sub-pages under Incomplete Issues
        const subPages = await getChildPages(INCOMPLETE_ISSUES_PAGE_ID);
        console.log(`Found ${subPages.length} sub-pages under Incomplete Issues\n`);

        const allPending = [];
        const allWaitingApproval = [];
        const allApprovedToMove = [];

        for (const subPage of subPages) {
            const sections = await parseSubPageSections(subPage.id, subPage.title);

            // Collect items with page context
            sections.toWorkOn.forEach(item => {
                if (!item.checked) {
                    allPending.push({ page: subPage.title, ...item });
                }
            });

            sections.waitingApproval.forEach(item => {
                allWaitingApproval.push({ page: subPage.title, ...item });
            });

            sections.approvedToMove.forEach(item => {
                allApprovedToMove.push({ page: subPage.title, ...item });
            });

            // Rate limit
            await new Promise(r => setTimeout(r, 350));
        }

        // Display results
        console.log('-'.repeat(60));
        console.log('PENDING ISSUES/FEATURES TO WORK ON');
        console.log('-'.repeat(60));
        if (allPending.length === 0) {
            console.log('  No pending items found.\n');
        } else {
            allPending.forEach((item, i) => {
                console.log(`  ${i + 1}. [${item.page}] ${item.text}`);
            });
            console.log(`\n  Total: ${allPending.length} pending items\n`);
        }

        console.log('-'.repeat(60));
        console.log('WAITING FOR MANUAL APPROVAL');
        console.log('-'.repeat(60));
        if (allWaitingApproval.length === 0) {
            console.log('  No items waiting for approval.\n');
        } else {
            allWaitingApproval.forEach((item, i) => {
                console.log(`  ${i + 1}. [${item.page}] ${item.text}`);
            });
            console.log(`\n  Total: ${allWaitingApproval.length} items waiting for approval\n`);
        }

        console.log('-'.repeat(60));
        console.log('APPROVED TO MOVE (Ready to transfer to Complete)');
        console.log('-'.repeat(60));
        if (allApprovedToMove.length === 0) {
            console.log('  No items approved to move.\n');
        } else {
            allApprovedToMove.forEach((item, i) => {
                console.log(`  ${i + 1}. [${item.page}] ${item.text}`);
            });
            console.log(`\n  Total: ${allApprovedToMove.length} items to transfer\n`);
        }

        console.log('='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Pending:          ${allPending.length}`);
        console.log(`  Waiting Approval: ${allWaitingApproval.length}`);
        console.log(`  Approved to Move: ${allApprovedToMove.length}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
