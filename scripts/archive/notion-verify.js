import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
const notion = new Client({ auth: token });

const response = await notion.blocks.children.list({
  block_id: '29f3f0ec-f382-83a6-8d1c-01d6640c22b8', // Dashboard
  page_size: 50,
});

console.log('=== Dashboard Page Structure ===\n');

for (const block of response.results) {
  if (block.type === 'heading_2') {
    const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
    console.log(`## ${text}`);
  } else if (block.type === 'to_do') {
    const text = block.to_do.rich_text.map(rt => rt.plain_text).join('');
    const checked = block.to_do.checked ? '[x]' : '[ ]';
    console.log(`  ${checked} ${text.substring(0, 60)}...`);
  } else {
    console.log(`  (${block.type})`);
  }
}
