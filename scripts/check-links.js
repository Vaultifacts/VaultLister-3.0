#!/usr/bin/env bun
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';

const PUBLIC_DIR = resolve(process.cwd(), 'public');
const TIMEOUT_MS = 10000;

const ALLOWLISTED_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
];

function getHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...getHtmlFiles(fullPath)); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    } else if (extname(entry.name) === '.html') {
      files.push(fullPath);
    }
  }
  return files;
}

function extractHrefs(html) {
  const hrefs = [];
  const regex = /href=["']([^"'#][^"']*)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

function isAllowlisted(url) {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWLISTED_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

async function checkExternalLink(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'VaultLister-LinkChecker/1.0' },
    });
    clearTimeout(timeout);
    return resp.status < 400;
  } catch {
    return false;
  }
}

async function main() {
  const htmlFiles = getHtmlFiles(PUBLIC_DIR);
  const brokenInternal = [];
  const brokenExternal = [];
  const checkedExternal = new Set();

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf-8');
    const hrefs = extractHrefs(html);
    const relPath = file.replace(PUBLIC_DIR, '').replace(/\\/g, '/');

    for (const href of hrefs) {
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
      if (href.startsWith('/#') || href.startsWith('/?')) continue;

      if (href.startsWith('http://') || href.startsWith('https://')) {
        if (isAllowlisted(href)) continue;
        if (checkedExternal.has(href)) continue;
        checkedExternal.add(href);
        const ok = await checkExternalLink(href);
        if (!ok) brokenExternal.push({ href, source: relPath });
      } else {
        const cleanHref = href.split('?')[0].split('#')[0];
        if (!cleanHref) continue;
        const resolved = cleanHref.startsWith('/')
          ? join(PUBLIC_DIR, cleanHref)
          : join(file, '..', cleanHref);

        if (!existsSync(resolved) && !existsSync(resolved + '.html')) {
          brokenInternal.push({ href, source: relPath });
        }
      }
    }
  }

  console.log(`Checked ${htmlFiles.length} HTML files, ${checkedExternal.size} unique external URLs`);

  if (brokenInternal.length > 0) {
    console.log(`\n${brokenInternal.length} broken internal links:`);
    for (const { href, source } of brokenInternal) {
      console.log(`  ${source} -> ${href}`);
    }
  }

  if (brokenExternal.length > 0) {
    console.log(`\n${brokenExternal.length} broken external links (advisory):`);
    for (const { href, source } of brokenExternal) {
      console.log(`  ${source} -> ${href}`);
    }
  }

  if (brokenInternal.length === 0 && brokenExternal.length === 0) {
    console.log('All links valid');
  }

  process.exit(brokenInternal.length > 0 ? 1 : 0);
}

main();
