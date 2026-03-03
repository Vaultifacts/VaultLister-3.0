// Search all pages accessible by the Notion integration
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

// Search for all pages
const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
        query: 'VaultLister',
        page_size: 100
    })
});

const data = await response.json();

console.log('=== Pages accessible by Notion integration ===\n');

if (data.results) {
    for (const page of data.results) {
        if (page.object === 'page') {
            const title = page.properties?.title?.title?.[0]?.plain_text || 
                         page.properties?.Name?.title?.[0]?.plain_text ||
                         '(untitled)';
            console.log(`- ${title}`);
            console.log(`  ID: ${page.id}`);
            console.log(`  URL: ${page.url}`);
            console.log('');
        }
    }
    console.log(`Total: ${data.results.length} results`);
} else {
    console.log('No results or error:', data);
}
