/**
 * Shared Notion API helper for scripts
 *
 * Usage:
 *   import { loadEnv } from './lib/env.js';
 *   import { notion, getChildPages, getBlocks, appendBlocks } from './lib/notion.js';
 *   loadEnv();
 */

const NOTION_VERSION = '2022-06-28';

function getHeaders() {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) {
    console.error('Error: NOTION_INTEGRATION_TOKEN not found in .env');
    process.exit(1);
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}

export async function notionFetch(path, options = {}, _retries = 0) {
  const url = `https://api.notion.com/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...options.headers }
  });
  if (res.status === 429 && _retries < 3) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
    const delay = Math.max(retryAfter, 1) * 1000 * (_retries + 1);
    console.warn(`Notion rate limited (429), retrying in ${delay}ms (attempt ${_retries + 1}/3)...`);
    await new Promise(r => setTimeout(r, delay));
    return notionFetch(path, options, _retries + 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getChildPages(parentId) {
  const data = await notionFetch('/search', {
    method: 'POST',
    body: JSON.stringify({ filter: { property: 'object', value: 'page' } })
  });
  return (data.results || [])
    .filter(page => page.parent?.page_id === parentId)
    .map(page => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text || 'Untitled'
    }));
}

export async function getBlocks(blockId, pageSize = 100) {
  const all = [];
  let cursor;
  do {
    const url = `/blocks/${blockId}/children?page_size=${pageSize}${cursor ? `&start_cursor=${cursor}` : ''}`;
    const data = await notionFetch(url);
    all.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return all;
}

export async function appendBlocks(parentId, children, afterId) {
  const body = { children };
  if (afterId) body.after = afterId;
  return notionFetch(`/blocks/${parentId}/children`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export async function updateBlock(blockId, data) {
  return notionFetch(`/blocks/${blockId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export async function deleteBlock(blockId) {
  return notionFetch(`/blocks/${blockId}`, { method: 'DELETE' });
}

export async function getPage(pageId) {
  return notionFetch(`/pages/${pageId}`);
}

export async function updatePage(pageId, properties) {
  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties })
  });
}

export async function searchPages(query) {
  return notionFetch('/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      filter: { property: 'object', value: 'page' }
    })
  });
}

/** Get the Notion page IDs from .env (required — no fallbacks) */
export function getPageIds() {
  const ids = {
    main: process.env.NOTION_MAIN_PAGE_ID,
    incomplete: process.env.NOTION_INCOMPLETE_PAGE_ID,
    complete: process.env.NOTION_COMPLETE_PAGE_ID,
    visualTestPrompt: process.env.NOTION_VISUAL_TEST_PROMPT_PAGE_ID
  };
  const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(`Error: Missing Notion page IDs in .env: ${missing.join(', ')}`);
    console.error('See .env.example for required NOTION_*_PAGE_ID values.');
    process.exit(1);
  }
  return ids;
}
