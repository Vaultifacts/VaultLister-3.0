#!/usr/bin/env bun
/**
 * Sync Visual Test Prompt
 *
 * Syncs scripts/visual-test-setup-prompt.md to all locations:
 * 1. C:\Users\Matt1\OneDrive\Desktop\visual-test-setup-prompt.md
 * 2. memory/visual-test-setup-prompt.md
 * 3. Notion page (from NOTION_VISUAL_TEST_PROMPT_PAGE_ID in .env)
 *
 * Usage: bun scripts/sync-visual-test-prompt.js
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/env.js';
import { notionFetch, getBlocks, deleteBlock, appendBlocks, getPageIds } from './lib/notion.js';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const { visualTestPrompt: NOTION_PAGE_ID } = getPageIds();

const sourcePath = resolve(projectRoot, 'scripts/visual-test-setup-prompt.md');
const desktopPath = 'C:\\Users\\Matt1\\OneDrive\\Desktop\\visual-test-setup-prompt.md';
const memoryPath = resolve(projectRoot, '../../../.claude/projects/C--Users-Matt1-OneDrive-Desktop-Vaultlister/memory/visual-test-setup-prompt.md');

console.log('Syncing visual test prompt...\n');

// Read source
const content = await Bun.file(sourcePath).text();
console.log(`Source: ${content.length} chars from ${sourcePath}\n`);

let failures = 0;

// 1. Desktop copy
try {
  await Bun.write(desktopPath, content);
  console.log('[OK] Desktop copy');
} catch (err) {
  console.error(`[FAIL] Desktop: ${err.message}`);
  failures++;
}

// 2. Memory copy
try {
  await Bun.write(memoryPath, content);
  console.log('[OK] Memory copy');
} catch (err) {
  console.error(`[FAIL] Memory: ${err.message}`);
  failures++;
}

// 3. Notion page
try {
  // Get existing blocks and delete them
  const existingBlocks = await getBlocks(NOTION_PAGE_ID);
  if (existingBlocks.length > 0) {
    for (const block of existingBlocks) {
      await deleteBlock(block.id);
    }
  }

  // Convert markdown to Notion blocks
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      const lang = line.trim().replace('```', '').trim() || 'plain text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeText = codeLines.join('\n').slice(0, 2000);
      blocks.push({
        object: 'block', type: 'code',
        code: { rich_text: [{ type: 'text', text: { content: codeText } }], language: lang === 'js' ? 'javascript' : lang }
      });
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2).slice(0, 2000) } }] } });
    } else if (line.startsWith('## ')) {
      blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3).slice(0, 2000) } }] } });
    } else if (line.startsWith('### ')) {
      blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4).slice(0, 2000) } }] } });
    } else if (line.startsWith('- ')) {
      blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2).slice(0, 2000) } }] } });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '').slice(0, 2000) } }] } });
    } else if (line.trim()) {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line.slice(0, 2000) } }] } });
    }
    i++;
  }

  // Append in batches of 100
  for (let j = 0; j < blocks.length; j += 100) {
    const batch = blocks.slice(j, j + 100);
    await appendBlocks(NOTION_PAGE_ID, batch);
  }

  console.log(`[OK] Notion page (${blocks.length} blocks)`);
} catch (err) {
  console.error(`[FAIL] Notion: ${err.message}`);
  failures++;
}

console.log(`\nSync complete. ${failures === 0 ? 'All 3 targets updated.' : `${failures} failure(s).`}`);
process.exit(failures > 0 ? 1 : 0);
