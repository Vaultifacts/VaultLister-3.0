#!/usr/bin/env node
// Refresh the dateModified and visible "Updated" line in an existing blog article.
//
// Usage:
//   node scripts/refresh-blog-article.js <slug>
//
// Example:
//   node scripts/refresh-blog-article.js ebay-sneaker-reselling-guide

import { readFileSync, writeFileSync, existsSync } from 'fs';

const slug = process.argv[2];
if (!slug) {
    console.error('Usage: node scripts/refresh-blog-article.js <slug>');
    process.exit(1);
}

const filePath = `public/blog/${slug}.html`;
if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const todayIso = new Date().toISOString().split('T')[0];
const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

let html = readFileSync(filePath, 'utf8');

// Update dateModified in JSON-LD
html = html.replace(/"dateModified":"[^"]*"/g, `"dateModified":"${todayIso}"`);

// Update or insert the visible "Updated" span.
// If an existing article-updated span is present, replace its date.
if (/<span class="article-updated">/.test(html)) {
    html = html.replace(
        /<span class="article-updated">Updated <time datetime="[^"]*">[^<]*<\/time><\/span>/,
        `<span class="article-updated">Updated <time datetime="${todayIso}">${monthYear}</time></span>`
    );
} else {
    // Insert after the existing <time datetime="..."> element in article-meta.
    html = html.replace(
        /(<time datetime="[^"]*">[^<]*<\/time>)/,
        `$1\n            <span class="article-updated">Updated <time datetime="${todayIso}">${monthYear}</time></span>`
    );
}

writeFileSync(filePath, html, 'utf8');
console.log(`Refreshed: ${filePath} (dateModified → ${todayIso})`);
