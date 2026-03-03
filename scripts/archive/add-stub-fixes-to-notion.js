/**
 * Add stub fix completions to Notion "Waiting for Manual Approval" sections
 * Run: bun scripts/add-stub-fixes-to-notion.js
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
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
const INCOMPLETE_ISSUES_PAGE_ID = '3f13f0ec-f382-8394-94e8-81b1614d19ab';

if (!NOTION_API_TOKEN) {
    console.error('ERROR: NOTION_INTEGRATION_TOKEN not found');
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${NOTION_API_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
};

// Items grouped by category page name
const itemsByCategory = {
    'Settings': [
        {
            title: 'Avatar Upload (Profile Picture)',
            description: 'Replaced "Photo upload coming soon" with real file picker. Users can upload PNG/JPEG/GIF/WebP up to 5MB. Image stored as data URL in localStorage.',
            test: 'Settings > Profile > Change Avatar > Upload Photo > choose image file',
            expected: 'File picker opens, image loads as avatar, persists across sessions',
            files: 'src/frontend/app.js (handleAvatarUpload handler, changeAvatar modal)'
        },
        {
            title: '2FA Authenticator App Setup',
            description: 'Replaced "Authenticator app setup coming soon" with real setup flow. Shows QR code placeholder + secret key, verification code input, enables 2FA on success.',
            test: 'Settings > Security > Enable 2FA > Authenticator App > enter 6-digit code > Verify',
            expected: 'Setup modal with secret key, code verification, 2FA enabled confirmation',
            files: 'src/frontend/app.js (setup2FAAuthenticator, verify2FACode handlers)'
        },
        {
            title: '2FA SMS Code Setup',
            description: 'Replaced "SMS setup coming soon" with real setup flow. Phone number input, sends code, verification step, enables 2FA.',
            test: 'Settings > Security > Enable 2FA > SMS Code > enter phone > Send Code > enter code > Verify',
            expected: 'Phone entry, code sent confirmation, verification, 2FA enabled',
            files: 'src/frontend/app.js (setup2FASMS, sendSMS2FACode, verify2FACode handlers)'
        }
    ],
    'Help & Support': [
        {
            title: 'Feature Request Submission (Real API)',
            description: 'Replaced console.log stub with real POST /feedback API call. Submits feature_request type with category, title, description, and reason.',
            test: 'Help > Submit Feature Request > fill form > Submit',
            expected: 'Request saved to feedback database, success toast shown',
            files: 'src/frontend/app.js (sendFeatureRequest handler), src/backend/routes/feedback.js'
        },
        {
            title: 'Getting Started Step Persistence',
            description: 'Replaced toast-only stub with localStorage persistence. Steps toggle complete/incomplete and persist across sessions. State stored in store.state.gettingStartedSteps.',
            test: 'Help > Getting Started > click step to mark complete > refresh page',
            expected: 'Step stays checked after refresh, can toggle back to incomplete',
            files: 'src/frontend/app.js (toggleGettingStartedStep handler)'
        }
    ],
    'About Us': [
        {
            title: 'Social Media Links (Real URLs)',
            description: 'Replaced "coming soon" toasts on Twitter/X, Instagram, YouTube, Discord links with proper external URLs that open in new tabs.',
            test: 'About > Connect With Us > click any social link',
            expected: 'Links open in new tab with target="_blank" rel="noopener noreferrer"',
            files: 'src/frontend/app.js (About page social links section)'
        }
    ],
    'Market Intel': [
        {
            title: 'Market Insight Detail View',
            description: 'Replaced "Detailed insight analysis coming soon" with real detail modal showing category, trend, confidence score, analysis text, and actionable recommendation.',
            test: 'Market Intel > click any insight card > view details',
            expected: 'Modal with stats grid (category/trend/confidence), analysis text, recommendation panel',
            files: 'src/frontend/app.js (viewInsightDetails handler)'
        }
    ],
    'Automations': [
        {
            title: 'Edit Automation Modal',
            description: 'Replaced "Edit automation feature coming soon" with real edit modal. Allows editing name, schedule (hourly/daily/weekly/manual), and active status. Saves via PUT /automations/:id.',
            test: 'Automations > click edit on any automation > change name/schedule > Save',
            expected: 'Edit modal opens with current values, saves changes to backend, list refreshes',
            files: 'src/frontend/app.js (editAutomation, saveAutomationEdit handlers)'
        }
    ],
    'Analytics': [
        {
            title: 'Detailed Analytics Views (Revenue/Sales/Margin/Inventory)',
            description: 'Replaced "Detailed analytics coming soon" with real data modals. Revenue shows 30-day total + platform breakdown. Sales shows week/30d/all-time counts. Margin shows revenue/COGS/margin%. Inventory shows total items/listed/value.',
            test: 'Analytics > click any metric card (Revenue/Sales/Margin/Inventory)',
            expected: 'Modal opens with real data from store state, formatted stat cards',
            files: 'src/frontend/app.js (showDetailedAnalytics handler)'
        },
        {
            title: 'Weekly Report Export',
            description: 'Replaced "Report export coming soon" with real text file export. Generates report with summary stats, 30-day revenue, sales count, and itemized sales list. Downloads as .txt file.',
            test: 'Analytics > Weekly Report > Export PDF button',
            expected: 'Text file downloads with report date, summary stats, and sales detail',
            files: 'src/frontend/app.js (exportWeeklyReport handler)'
        }
    ],
    'My Listings': [
        {
            title: 'Bulk Listing Optimization',
            description: 'Replaced "Bulk optimization coming soon" with real optimization action. Scans up to 20 listings for short titles/descriptions, reports improvement count.',
            test: 'Listings > Bulk Optimize > select type/scope > Start Optimization',
            expected: 'Progress toast, completion message with improvement count, navigates to listings',
            files: 'src/frontend/app.js (runBulkOptimize handler)'
        }
    ]
};

function makeToggle(item) {
    return {
        object: 'block',
        type: 'toggle',
        toggle: {
            rich_text: [
                { type: 'text', text: { content: '\ud83d\udd27 ' } },
                { type: 'text', text: { content: item.title }, annotations: { bold: true } }
            ],
            color: 'default',
            children: [
                {
                    object: 'block', type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content: item.description }, annotations: { italic: true, color: 'gray' } }]
                    }
                },
                {
                    object: 'block', type: 'bulleted_list_item',
                    bulleted_list_item: {
                        rich_text: [
                            { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
                            { type: 'text', text: { content: item.test } }
                        ]
                    }
                },
                {
                    object: 'block', type: 'bulleted_list_item',
                    bulleted_list_item: {
                        rich_text: [
                            { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
                            { type: 'text', text: { content: item.expected } }
                        ]
                    }
                },
                {
                    object: 'block', type: 'bulleted_list_item',
                    bulleted_list_item: {
                        rich_text: [
                            { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } },
                            { type: 'text', text: { content: item.files }, annotations: { code: true } }
                        ]
                    }
                }
            ]
        }
    };
}

async function getSubPages() {
    const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({ filter: { property: 'object', value: 'page' } })
    });
    const data = await response.json();
    return (data.results || [])
        .filter(page => page.parent?.page_id === INCOMPLETE_ISSUES_PAGE_ID)
        .map(page => ({
            id: page.id,
            title: page.properties?.title?.title?.[0]?.plain_text || 'Untitled'
        }));
}

async function findWaitingHeading(pageId) {
    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, { headers });
    const data = await response.json();
    for (const block of (data.results || [])) {
        if (block.type === 'heading_2') {
            const text = (block.heading_2?.rich_text || []).map(rt => rt.plain_text).join('');
            if (text.includes('Waiting for Manual Approval')) {
                return block.id;
            }
        }
    }
    return null;
}

async function appendAfter(pageId, afterBlockId, children) {
    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ children, after: afterBlockId })
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to append: ${response.status} - ${err}`);
    }
    return response.json();
}

async function main() {
    console.log('Finding Notion sub-pages...');
    const subPages = await getSubPages();
    console.log(`Found ${subPages.length} sub-pages\n`);

    let totalAdded = 0;

    for (const [category, items] of Object.entries(itemsByCategory)) {
        const page = subPages.find(p => p.title.replace(/\s*\(Items to Approve\)/i, '').trim() === category);
        if (!page) {
            console.log(`  SKIP: No page found for "${category}"`);
            continue;
        }

        console.log(`\n[${category}] (${page.id}) - ${items.length} items`);
        await new Promise(r => setTimeout(r, 350));

        const waitingId = await findWaitingHeading(page.id);
        if (!waitingId) {
            console.log(`  SKIP: No "Waiting for Manual Approval" heading found`);
            continue;
        }

        const toggles = items.map(makeToggle);
        try {
            await appendAfter(page.id, waitingId, toggles);
            console.log(`  Added ${items.length} toggle blocks`);
            totalAdded += items.length;
        } catch (e) {
            console.error(`  ERROR: ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 350));
    }

    console.log(`\n=== DONE: Added ${totalAdded} toggle blocks across ${Object.keys(itemsByCategory).length} pages ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
