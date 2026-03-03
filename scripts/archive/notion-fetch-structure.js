// Fetch page structure
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
const MAIN_PAGE_ID = '2fc3f0ec-f382-80ad-9128-f7ca8b6d4704';

const headers = {
    'Authorization': `Bearer ${NOTION_API_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
};

async function fetchBlocks(blockId, indent = 0) {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, { headers });
    if (!response.ok) {
        console.log(' '.repeat(indent) + `ERROR fetching ${blockId}: ${response.status}`);
        return;
    }
    const data = await response.json();
    
    for (const block of data.results) {
        const prefix = ' '.repeat(indent);
        if (block.type === 'child_page') {
            console.log(`${prefix}- [PAGE] ${block.child_page.title}`);
            console.log(`${prefix}  ID: ${block.id}`);
            // Recursively fetch children
            await fetchBlocks(block.id, indent + 4);
        } else if (block.type === 'heading_2') {
            const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
            console.log(`${prefix}- [H2] ${text}`);
        } else if (block.type === 'to_do') {
            const text = block.to_do.rich_text.map(rt => rt.plain_text).join('');
            const checked = block.to_do.checked ? '[x]' : '[ ]';
            console.log(`${prefix}- [TODO] ${checked} ${text}`);
        } else if (block.type === 'paragraph') {
            const text = block.paragraph.rich_text.map(rt => rt.plain_text).join('');
            if (text) console.log(`${prefix}- [P] ${text}`);
        }
    }
}

console.log('=== VaultLister Claude Code Page Structure ===\n');
await fetchBlocks(MAIN_PAGE_ID);
