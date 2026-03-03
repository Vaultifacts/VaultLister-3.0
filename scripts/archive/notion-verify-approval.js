import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
const notion = new Client({ auth: token });

async function checkPage(name, id) {
  console.log(`\n=== ${name} ===`);
  
  const page = await notion.pages.retrieve({ page_id: id });
  const title = page.properties.title?.title?.[0]?.plain_text || '(untitled)';
  console.log(`Title: ${title}\n`);
  
  const response = await notion.blocks.children.list({ block_id: id, page_size: 50 });
  
  let inWaiting = false;
  for (const block of response.results) {
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
      console.log(`## ${text}`);
      inWaiting = text.includes('Waiting for Manual Approval');
    } else if (block.type === 'paragraph' && inWaiting) {
      const text = block.paragraph.rich_text.map(rt => rt.plain_text).join('');
      if (text) {
        // Show first 100 chars of each paragraph
        console.log(`  ${text.substring(0, 100)}...`);
      }
    } else if (block.type === 'to_do') {
      // Skip to-dos for this check
    }
  }
}

await checkPage('Inventory', '20a3f0ec-f382-82bc-8d59-01f332e4e196');
await checkPage('Calendar', '31c3f0ec-f382-82c5-88e3-01976e5de201');
