#!/usr/bin/env bun
// Automated blog article generator.
//
// Usage:
//   bun scripts/generate-blog-article.js <slug>             # generate a specific topic
//   bun scripts/generate-blog-article.js --next             # generate the next unpublished topic
//   bun scripts/generate-blog-article.js --all              # generate every unpublished topic
//   bun scripts/generate-blog-article.js <slug> --force     # regenerate an existing article
//
// Outputs:
//   - public/blog/<slug>.html   (new article, with JSON-LD + canonical + internal links + related section)
//   - public/blog/index.html    (prepends a card for the new article)
//   - public/sitemap.xml        (adds the new article URL)

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { callTextAPI } from '../src/shared/ai/claude-client.js';

const TEMPLATE_PATH = 'public/blog/how-to-cross-list-50-items.html';
const INDEX_PATH    = 'public/blog/index.html';
const SITEMAP_PATH  = 'public/sitemap.xml';
const TOPICS_PATH   = 'scripts/blog-topics.json';
const BLOG_DIR      = 'public/blog';
const SITE_ORIGIN   = 'https://vaultlister.com';

// ─── Topic / target selection ────────────────────────────────────────────────

function loadTopics() {
    return JSON.parse(readFileSync(TOPICS_PATH, 'utf8')).topics;
}

function isPublished(slug) {
    return existsSync(`${BLOG_DIR}/${slug}.html`);
}

function resolveTargets(arg, { force }) {
    const topics = loadTopics();
    if (!arg || arg === '--next') {
        const next = topics.find(t => !isPublished(t.slug));
        return next ? [next] : [];
    }
    if (arg === '--all') {
        return force ? topics : topics.filter(t => !isPublished(t.slug));
    }
    const match = topics.find(t => t.slug === arg);
    if (!match) throw new Error(`Unknown slug: ${arg}. Add it to ${TOPICS_PATH} first.`);
    return [match];
}

// Returns { slug, title, tag, emoji } for every existing blog article (sans index).
function getPublishedArticles() {
    const topics = loadTopics();
    const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
    return files.map(f => {
        const slug = f.replace(/\.html$/, '');
        const topic = topics.find(t => t.slug === slug);
        if (topic) return { slug, title: topic.title, tag: topic.tag, emoji: topic.emoji, bg: topic.bg };
        // Fall back to reading <h1> from the file for hand-authored articles.
        try {
            const html = readFileSync(`${BLOG_DIR}/${f}`, 'utf8');
            const h1 = html.match(/<h1>([^<]+)<\/h1>/);
            return { slug, title: h1 ? h1[1] : slug, tag: 'Guide', emoji: '&#128218;', bg: 'bg1' };
        } catch {
            return { slug, title: slug, tag: 'Guide', emoji: '&#128218;', bg: 'bg1' };
        }
    });
}

// ─── Claude article generation ───────────────────────────────────────────────

async function generateArticle(topic, otherArticles) {
    const linkList = otherArticles.length
        ? otherArticles.slice(0, 6).map(a => `  - "${a.title}" → /blog/${a.slug}.html`).join('\n')
        : '  (no other articles yet)';

    const system = 'You are a writer for VaultLister, a multi-channel reselling platform. Produce grounded, useful articles for resellers. No hype, no AI tropes, no "in today\'s digital landscape" filler. Plain-spoken, second-person, specific. Respond ONLY with valid JSON matching the schema in the user prompt.';
    const user = `Write a blog article for VaultLister on this topic:

Title: ${topic.title}
Tag:   ${topic.tag}
Angle: ${topic.angle}

Other articles on the site (for internal linking — reference 2 of them inside a paragraph using the exact URL path given, only when contextually relevant):
${linkList}

Return JSON with this exact shape:
{
  "title": "<final article title, can refine the input title>",
  "meta_description": "<150-160 char SEO description>",
  "og_description":   "<150-170 char social share description, distinct from meta_description>",
  "read_time_minutes": <integer 8-12>,
  "intro_paragraphs": ["<paragraph 1>", "<paragraph 2>"],
  "sections": [
    { "heading": "<H2 title>", "paragraphs": ["<p1>", "<p2>", "<p3>", "<p4>"] },
    { "heading": "<H2 title>", "paragraphs": ["<p1>", "<p2>", "<p3>", "<p4>"] },
    { "heading": "<H2 title>", "paragraphs": ["<p1>", "<p2>", "<p3>", "<p4>"] },
    { "heading": "<H2 title>", "paragraphs": ["<p1>", "<p2>", "<p3>"] },
    { "heading": "<H2 title>", "paragraphs": ["<p1>", "<p2>", "<p3>"] }
  ],
  "conclusion_paragraphs": ["<paragraph 1>", "<paragraph 2>"],
  "cta_title": "<short CTA headline, matches article topic>",
  "cta_description": "<1-2 sentence CTA pitch>"
}

Rules:
- 5 sections. Sections 1-3 have 4 paragraphs of 4-6 sentences. Sections 4-5 have 3 paragraphs of 4-6 sentences.
- Target total article length: 1800-2200 words.
- Reference VaultLister naturally where relevant, but do not force it into every paragraph.
- Do not invent statistics. If you cite a number, phrase it as an observation, not a precise claim.
- No emojis. No bullet lists. Use flowing prose.
- No placeholders or TODOs in the output.

MANDATORY — INTERNAL LINKS (this is required, not optional):
- TWO of the paragraphs across the whole article MUST contain an internal link to another article from the "Other articles" list.
- Each link must use EXACTLY this HTML format inside the paragraph string: <a href="/blog/<slug>.html">short descriptive anchor text</a>
- The anchor text must be 2-6 words that flow naturally in the sentence. Do NOT use the full article title as anchor text.
- EXAMPLE paragraph (illustrative, don't reuse):
  "Most newer sellers underestimate how much the listing copy itself shapes conversion. If you've never thought about it systematically, our <a href=\\"/blog/writing-listings-that-convert.html\\">copywriting guide for resellers</a> walks through the specific hooks that move items."
- Pick two DIFFERENT target articles. Do not link to the same article twice.
- If the "Other articles" list is empty, skip this rule.`;

    const raw = await callTextAPI({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 10000,
        timeoutMs: 120000,
        system,
        user,
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in Claude response');
    const article = JSON.parse(match[0]);

    // Validate required fields — fail loud rather than silently produce a broken file.
    const required = ['title', 'meta_description', 'og_description', 'read_time_minutes', 'intro_paragraphs', 'sections', 'conclusion_paragraphs', 'cta_title', 'cta_description'];
    for (const k of required) {
        if (article[k] == null) throw new Error(`Claude omitted required field: ${k}`);
    }
    if (!Array.isArray(article.sections) || article.sections.length < 3) {
        throw new Error(`Expected at least 3 sections, got ${article.sections?.length}`);
    }
    stripHallucinatedLinks(article, otherArticles);
    ensureInternalLinks(article, otherArticles);
    return article;
}

// Claude sometimes fabricates /blog/<slug>.html URLs that don't match any real sibling.
// Remove any <a href="/blog/..."> whose slug isn't in the sibling list, keeping the anchor text
// so the sentence still reads naturally.
function stripHallucinatedLinks(article, otherArticles) {
    const validSlugs = new Set(otherArticles.map(a => a.slug));
    const scrub = (p) => String(p).replace(
        /<a href="\/blog\/([a-z0-9-]+)\.html">([^<]+)<\/a>/g,
        (m, slug, anchor) => validSlugs.has(slug) ? m : anchor
    );
    article.intro_paragraphs = article.intro_paragraphs.map(scrub);
    article.sections.forEach(s => { s.paragraphs = s.paragraphs.map(scrub); });
    article.conclusion_paragraphs = article.conclusion_paragraphs.map(scrub);
}

// Scans every paragraph for existing /blog/<slug>.html links. If fewer than 2 unique
// links exist and sibling articles are available, injects links by wrapping a keyword
// (drawn from the target article's title) in the first paragraph that contains it.
// Guarantees at least 2 internal links without Claude's cooperation.
function ensureInternalLinks(article, otherArticles) {
    if (otherArticles.length === 0) return;
    const TARGET_LINKS = Math.min(2, otherArticles.length);

    const allParas = () => [
        ...article.intro_paragraphs,
        ...article.sections.flatMap(s => s.paragraphs),
        ...article.conclusion_paragraphs,
    ];
    const existingSlugs = new Set();
    for (const p of allParas()) {
        const matches = String(p).matchAll(/<a href="\/blog\/([a-z0-9-]+)\.html">/g);
        for (const m of matches) existingSlugs.add(m[1]);
    }
    if (existingSlugs.size >= TARGET_LINKS) return;

    // Pick targets Claude didn't already link.
    const candidates = otherArticles.filter(a => !existingSlugs.has(a.slug));
    const needed = TARGET_LINKS - existingSlugs.size;

    // For each candidate, pick multi-word phrases from its title. Prefer 2-3 word anchors
    // (single-word anchors like "items" are too generic for useful internal linking).
    const keywordsFor = (title) => {
        const clean = title.replace(/[:—–,.?!()'"]/g, '').split(/\s+/);
        const stop = new Set(['the','a','an','and','or','on','in','of','to','for','is','are','what','when','how','your','with','vs','without','that','this','these','those']);
        const words = clean.filter(w => w.length > 2 && !stop.has(w.toLowerCase()));
        const phrases3 = [], phrases2 = [];
        for (let i = 0; i < words.length - 1; i++) {
            phrases2.push(`${words[i]} ${words[i+1]}`);
            if (i < words.length - 2) phrases3.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
        }
        // Also accept single long distinctive words (6+ chars) as last resort.
        const longWords = words.filter(w => w.length >= 6);
        return [...phrases3, ...phrases2, ...longWords];
    };

    const allSections = [article.sections[1], article.sections[2], article.sections[3]].filter(Boolean);
    let injected = 0;

    for (const target of candidates) {
        if (injected >= needed) break;
        const keywords = keywordsFor(target.title);
        let placed = false;
        // Try to find a paragraph whose text contains one of the keywords.
        outer: for (const section of allSections) {
            for (let pi = 0; pi < section.paragraphs.length; pi++) {
                const p = section.paragraphs[pi];
                if (/<a href=/.test(p)) continue; // don't double-link a paragraph
                for (const kw of keywords) {
                    const re = new RegExp('\\b(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'i');
                    if (re.test(p)) {
                        section.paragraphs[pi] = p.replace(re, `<a href="/blog/${target.slug}.html">$1</a>`);
                        placed = true;
                        injected++;
                        break outer;
                    }
                }
            }
        }
        // Fallback: append a short closing sentence to the last section's last paragraph.
        if (!placed && allSections.length) {
            const section = allSections[allSections.length - 1];
            const lastIdx = section.paragraphs.length - 1;
            if (!/<a href=/.test(section.paragraphs[lastIdx])) {
                const anchor = target.title.split(/\s+/).slice(0, 4).join(' ').replace(/[:—,]$/, '');
                section.paragraphs[lastIdx] += ` For a deeper breakdown, see our <a href="/blog/${target.slug}.html">${anchor}</a> guide.`;
                injected++;
            }
        }
    }
}

// ─── HTML assembly ───────────────────────────────────────────────────────────

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// Paragraph bodies from Claude may contain the internal-link <a> tags we asked for.
// Escape everything else but pass through those links verbatim.
function renderParagraph(p) {
    return String(p).replace(
        /(<a href="\/blog\/[a-z0-9-]+\.html">[^<]+<\/a>)|([^<]+)/g,
        (_, linkHtml, text) => linkHtml ? linkHtml : escapeHtml(text)
    );
}

function currentMonthYear() {
    return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function todayIsoDate() {
    return new Date().toISOString().split('T')[0];
}

function countWords(article) {
    const all = [
        article.title,
        ...article.intro_paragraphs,
        ...article.sections.flatMap(s => [s.heading, ...s.paragraphs]),
        ...article.conclusion_paragraphs,
    ].join(' ');
    return all.split(/\s+/).filter(Boolean).length;
}

function buildJsonLd(topic, article) {
    const isoNow = new Date().toISOString();
    const obj = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_ORIGIN}/blog/${topic.slug}.html` },
        headline: article.title,
        description: article.meta_description,
        image: `${SITE_ORIGIN}/assets/logo/app/app_icon_152.png`,
        datePublished: isoNow,
        dateModified: isoNow,
        author: { '@type': 'Organization', name: 'VaultLister Team', url: SITE_ORIGIN },
        publisher: {
            '@type': 'Organization',
            name: 'VaultLister',
            logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/logo/app/app_icon_152.png` }
        },
        keywords: topic.tag,
        articleSection: topic.tag,
    };
    return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function buildRelatedSection(currentSlug, otherArticles) {
    const related = otherArticles.filter(a => a.slug !== currentSlug).slice(0, 3);
    if (related.length === 0) return '';
    const cards = related.map(a => `
            <a class="blog-card" href="/blog/${a.slug}.html">
                <div class="blog-card-img ${a.bg}" aria-hidden="true">${a.emoji}</div>
                <div class="blog-card-body">
                    <span class="blog-tag">${escapeHtml(a.tag)}</span>
                    <h3 style="font-size:1.1rem;font-weight:700;margin:0.5rem 0;">${escapeHtml(a.title)}</h3>
                </div>
            </a>`).join('');
    return `
        <section class="related-articles" style="margin-top:3rem;padding-top:2rem;border-top:1px solid var(--gray-200);">
            <h2 style="font-size:1.5rem;margin-bottom:1.25rem;">Keep Reading</h2>
            <div class="blog-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;">${cards}
            </div>
        </section>`;
}

function buildArticleHtml(topic, article, otherArticles) {
    const template = readFileSync(TEMPLATE_PATH, 'utf8');
    const monthYear = currentMonthYear();
    const canonicalUrl = `${SITE_ORIGIN}/blog/${topic.slug}.html`;

    const bodyHtml = [
        ...article.intro_paragraphs.map(p => `        <p>${renderParagraph(p)}</p>`),
        ...article.sections.flatMap(s => [
            '',
            '        <hr class="article-divider">',
            '',
            `        <h2>${escapeHtml(s.heading)}</h2>`,
            '',
            ...s.paragraphs.map(p => `        <p>${renderParagraph(p)}</p>`)
        ]),
        '',
        '        <hr class="article-divider">',
        '',
        '        <h2>Conclusion</h2>',
        '',
        ...article.conclusion_paragraphs.map(p => `        <p>${renderParagraph(p)}</p>`)
    ].join('\n');

    const relatedHtml = buildRelatedSection(topic.slug, otherArticles);
    const jsonLd = buildJsonLd(topic, article);

    let html = template;

    // ── <head> meta substitutions ──
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(article.title)} — VaultLister Blog</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${escapeHtml(article.meta_description)}">`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/,
        `<meta property="og:title" content="${escapeHtml(article.title)}">`);
    html = html.replace(/<meta property="og:description" content="[^"]*">/,
        `<meta property="og:description" content="${escapeHtml(article.og_description)}">`);
    html = html.replace(/<meta property="og:url" content="[^"]*">/,
        `<meta property="og:url" content="${canonicalUrl}">`);

    // ── Inject canonical + JSON-LD (idempotent) ──
    if (!/rel="canonical"/.test(html)) {
        html = html.replace(/<meta property="og:site_name"[^>]*>/,
            m => `${m}\n    <link rel="canonical" href="${canonicalUrl}">\n    <meta name="robots" content="index, follow">\n    ${jsonLd}`);
    } else {
        // Update canonical + schema on regeneration
        html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonicalUrl}">`);
        html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, jsonLd);
    }

    // ── Body substitutions ──
    html = html.replace(/<div class="article-hero-img" aria-hidden="true">[^<]*<\/div>/,
        `<div class="article-hero-img" aria-hidden="true">${topic.emoji}</div>`);
    html = html.replace(/<span class="blog-tag">[^<]*<\/span>\s*<article>/,
        `<span class="blog-tag">${escapeHtml(topic.tag)}</span>\n    <article>`);

    const articleInner = `
        <h1>${escapeHtml(article.title)}</h1>
        <div class="article-meta">
            <span>VaultLister Team</span>
            <span class="dot"></span>
            <span>${monthYear}</span>
            <span class="dot"></span>
            <span>${article.read_time_minutes} min read</span>
        </div>

${bodyHtml}

        <div class="cta-box">
            <h2>${escapeHtml(article.cta_title)}</h2>
            <p>${escapeHtml(article.cta_description)}</p>
            <a class="btn btn-primary" href="/?app=1#register">Get Started Free</a>
        </div>
${relatedHtml}
    `;
    html = html.replace(/<article>[\s\S]*?<\/article>/, `<article>${articleInner}</article>`);

    return html;
}

function buildIndexCard(topic, article) {
    const monthYear = currentMonthYear();
    return `
        <a class="blog-card" href="/blog/${topic.slug}.html">
            <div class="blog-card-img ${topic.bg}" aria-hidden="true">${topic.emoji}</div>
            <div class="blog-card-body">
                <span class="blog-tag">${escapeHtml(topic.tag)}</span>
                <h2>${escapeHtml(article.title)}</h2>
                <p>${escapeHtml(article.og_description)}</p>
                <div class="blog-card-meta">
                    <span>VaultLister Team</span>
                    <span class="dot"></span>
                    <span>${monthYear}</span>
                </div>
            </div>
        </a>
`;
}

function insertIntoIndex(cardHtml, slug) {
    const indexHtml = readFileSync(INDEX_PATH, 'utf8');
    if (indexHtml.includes(`/blog/${slug}.html`)) return false;
    const marker = '<div class="blog-grid">';
    const idx = indexHtml.indexOf(marker);
    if (idx === -1) throw new Error(`Could not find "${marker}" in ${INDEX_PATH}`);
    const insertionPoint = idx + marker.length;
    writeFileSync(INDEX_PATH, indexHtml.slice(0, insertionPoint) + '\n' + cardHtml + indexHtml.slice(insertionPoint), 'utf8');
    return true;
}

function addToSitemap(slug) {
    const sitemap = readFileSync(SITEMAP_PATH, 'utf8');
    const url = `${SITE_ORIGIN}/blog/${slug}.html`;
    if (sitemap.includes(url)) return false;
    const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${todayIsoDate()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    const updated = sitemap.replace('</urlset>', entry + '</urlset>');
    writeFileSync(SITEMAP_PATH, updated, 'utf8');
    return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const arg = args.find(a => !a.startsWith('--'));
    const targets = resolveTargets(arg, { force });
    if (targets.length === 0) {
        console.log(`No unpublished topics. Add one to ${TOPICS_PATH} or pass --force.`);
        process.exit(0);
    }

    console.log(`Generating ${targets.length} article${targets.length === 1 ? '' : 's'}${force ? ' (--force)' : ''}...`);
    let ok = 0, failed = 0;

    for (const topic of targets) {
        const outPath = `${BLOG_DIR}/${topic.slug}.html`;
        if (existsSync(outPath) && !force) {
            console.log(`  ↷ ${topic.slug}: already exists, skipping (--force to regenerate)`);
            continue;
        }
        const otherArticles = getPublishedArticles().filter(a => a.slug !== topic.slug);
        console.log(`  ✎ ${topic.slug}: calling Claude... (${otherArticles.length} siblings for linking)`);
        try {
            const article = await generateArticle(topic, otherArticles);
            const words = countWords(article);
            const html = buildArticleHtml(topic, article, otherArticles);
            writeFileSync(outPath, html, 'utf8');
            const indexUpdated = insertIntoIndex(buildIndexCard(topic, article), topic.slug);
            const sitemapUpdated = addToSitemap(topic.slug);
            console.log(`  ✓ ${topic.slug}: ${html.length}B | ${words} words | index=${indexUpdated} sitemap=${sitemapUpdated}`);
            ok++;
        } catch (err) {
            console.log(`  ✗ ${topic.slug}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone. ${ok} generated, ${failed} failed.`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
