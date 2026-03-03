#!/usr/bin/env bun
// Adds completed features to "Waiting for Manual Approval" using compact toggle format
// Run: bun run scripts/notion-add-completed-feature.js

import { Client } from '@notionhq/client';

const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) {
  console.error('Missing NOTION_INTEGRATION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Features to add (multiple features supported)
const features = [
  {
    pageName: 'Image Bank',
    pageId: '48d3f0ec-f382-83e1-9170-015cab35fd27',
    title: 'Enhanced Storage Quota Indicator',
    description: 'Improved storage gauge with quota warnings, threshold markers, color-coded status (green/yellow/red), and upgrade prompts when storage is low. Shows storage plans modal with tier options.',
    test: 'Go to Image Bank → Check storage gauge card → When storage > 60%, see info message → When > 80%, see warning + upgrade button',
    expected: 'Storage gauge shows color-coded fill, threshold markers at 70% and 90%, contextual warning messages, and upgrade button when needed.',
    files: 'src/frontend/app.js, src/frontend/styles/main.css'
  },
  {
    pageName: 'Automations',
    pageId: '8b83f0ec-f382-8315-9ce0-01a7e520599c',
    title: 'Performance Metrics Dashboard',
    description: 'Added comprehensive performance metrics section showing: Time Saved This Week, Total Actions Completed, Success Rate with target comparison, Estimated Value Created (based on hourly rate), and Actions by Category breakdown with visual bars.',
    test: 'Go to Automations page → Scroll to "Performance Metrics" section below category cards',
    expected: 'Four metric cards display time saved, actions completed, success rate, and estimated value. Category breakdown shows actions per automation type with progress bars.',
    files: 'src/frontend/app.js, src/frontend/styles/main.css'
  }
];

async function addFeatureToWaitingSection(feature) {
  console.log(`Adding feature to ${feature.pageName}...`);

  try {
    const response = await notion.blocks.children.list({
      block_id: feature.pageId,
      page_size: 100,
    });
    await sleep(300);

    let waitingHeadingId = null;

    for (const block of response.results) {
      if (block.type === 'heading_2') {
        const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
        if (text.includes('Waiting for Manual Approval')) {
          waitingHeadingId = block.id;
          break;
        }
      }
    }

    if (!waitingHeadingId) {
      console.log(`  ⚠️ Could not find "Waiting for Manual Approval" heading`);
      return;
    }

    // Create compact toggle block
    const toggleBlock = {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [
          { type: 'text', text: { content: '🔧 ' } },
          { type: 'text', text: { content: feature.title }, annotations: { bold: true } }
        ],
        color: 'default',
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: feature.description }, annotations: { italic: true, color: 'gray' } }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: 'Test: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: feature.test } }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: 'Expected: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: feature.expected } }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: 'Files: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: feature.files }, annotations: { code: true } }
              ]
            }
          }
        ]
      }
    };

    await notion.blocks.children.append({
      block_id: feature.pageId,
      children: [toggleBlock],
      after: waitingHeadingId,
    });
    await sleep(300);

    // Update page title to add suffix if not present
    const page = await notion.pages.retrieve({ page_id: feature.pageId });
    const currentTitle = page.properties.title?.title?.[0]?.plain_text || feature.pageName;

    if (!currentTitle.includes('(Items to Approve)')) {
      await notion.pages.update({
        page_id: feature.pageId,
        properties: {
          title: {
            title: [{ text: { content: `${feature.pageName} (Items to Approve)` } }]
          }
        }
      });
      console.log(`  ✅ Updated page title to "${feature.pageName} (Items to Approve)"`);
    }

    console.log(`  ✅ Added feature: "${feature.title}"`);

  } catch (err) {
    console.error(`  ❌ ERROR: ${err.message}`);
  }
}

async function main() {
  for (const feature of features) {
    await addFeatureToWaitingSection(feature);
    await sleep(500);
  }
  console.log('\nDone!');
}

main();
