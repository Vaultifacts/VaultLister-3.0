// Fix page title suffixes
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

const headers = {
    'Authorization': `Bearer ${NOTION_API_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
};

// Pages that need suffix removed (all have empty "Waiting for Manual Approval")
const pagesToFix = [
    { id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8', oldName: 'Dashboard (Items to Approve)', newName: 'Dashboard' },
    { id: '20a3f0ec-f382-82bc-8d59-01f332e4e196', oldName: 'Inventory (Items to Approve)', newName: 'Inventory' },
    { id: '5933f0ec-f382-8364-891e-01899cddd9e2', oldName: 'Checklist (Items to Approve)', newName: 'Checklist' },
];

async function renamePage(pageId, newTitle) {
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
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to rename page: ${response.status} - ${error}`);
    }
    return response.json();
}

console.log('=== Fixing Page Title Suffixes ===\n');

for (const page of pagesToFix) {
    try {
        await renamePage(page.id, page.newName);
        console.log(`✓ Renamed: "${page.oldName}" → "${page.newName}"`);
    } catch (error) {
        console.log(`✗ Failed: "${page.oldName}" - ${error.message}`);
    }
}

console.log('\nDone!');
