import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PAGES = [
  '/about.html', '/affiliate.html', '/ai-info.html', '/api-changelog.html',
  '/api-docs.html', '/careers.html', '/changelog.html', '/contact.html',
  '/cookies.html', '/documentation.html', '/faq.html', '/glossary.html',
  '/help.html', '/landing.html', '/learning.html', '/platforms.html',
  '/pricing.html', '/privacy.html', '/quickstart.html', '/rate-limits.html',
  '/request-feature.html', '/roadmap-public.html', '/schema.html', '/status.html', '/terms.html',
  '/compare/closo.html', '/compare/crosslist-magic.html', '/compare/crosslist.html',
  '/compare/flyp.html', '/compare/list-perfectly.html', '/compare/nifty.html',
  '/compare/oneshop.html', '/compare/primelister.html', '/compare/selleraider.html',
  '/compare/vendoo.html',
  '/'
];

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const allViolations = {};
let totalViolations = 0;

for (const p of PAGES) {
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.addScriptTag({ url: AXE_CDN });
  await page.waitForFunction(() => typeof axe !== 'undefined');

  const violations = await page.evaluate(async () => {
    const results = await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      count: v.nodes.length,
      nodes: v.nodes.map(n => ({
        html: n.html.substring(0, 200),
        target: n.target,
        failureSummary: n.failureSummary.substring(0, 150)
      }))
    }));
  });

  if (violations.length > 0) {
    allViolations[p] = violations;
    const count = violations.reduce((s, v) => s + v.count, 0);
    totalViolations += count;
    console.log(`\n=== ${p} (${count} violations) ===`);
    for (const v of violations) {
      console.log(`  [${v.impact}] ${v.id} (${v.count}x): ${v.description}`);
      for (const n of v.nodes.slice(0, 2)) {
        console.log(`    target: ${JSON.stringify(n.target)}`);
        console.log(`    html: ${n.html.substring(0, 100)}`);
        console.log(`    fix: ${n.failureSummary.substring(0, 100)}`);
      }
    }
  } else {
    console.log(`✓ ${p}`);
  }
}

console.log(`\n\nTOTAL: ${totalViolations} violations across ${Object.keys(allViolations).length} pages`);

import { writeFileSync } from 'fs';
writeFileSync('axe-full-report.json', JSON.stringify(allViolations, null, 2));
console.log('Full report saved to axe-full-report.json');

await browser.close();
