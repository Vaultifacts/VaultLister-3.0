// Unit tests for DB init, seed, demoData, and helpContent modules.
// Tests export shapes and data structures WITHOUT calling seed functions
// (which require a live DB with the correct schema).
// No mock.module usage — avoids cross-file mock contamination in Bun.

import { describe, test, expect, beforeAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', 'backend', 'db');

// ─── init.js — script analysis (cannot import directly, runs side effects) ───

describe('db/init.js — script structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'init.js'), 'utf-8');
  });

  test('file exists and is non-empty', () => {
    expect(source).toBeTruthy();
    expect(source.length).toBeGreaterThan(0);
  });

  test('uses dynamic import for database.js (top-level await)', () => {
    expect(source).toContain("import('./database.js')");
  });

  test('imports initializeDatabase from database.js (dynamic import)', () => {
    expect(source).toContain("initializeDatabase");
    expect(source).toContain("import('./database.js')");
  });

  test('calls initializeDatabase()', () => {
    expect(source).toContain('initializeDatabase()');
  });

  test('does not reference SQLite file paths (PostgreSQL-era script)', () => {
    // Post-migration: no SQLite file management needed
    expect(source).not.toContain('vaultlister.db');
    expect(source).not.toContain('DB_PATH');
    expect(source).not.toContain('-wal');
    expect(source).not.toContain('-shm');
  });

  test('does not use fs/path utilities (no local file manipulation)', () => {
    // PostgreSQL init delegates all setup to initializeDatabase()
    expect(source).not.toContain('mkdirSync');
    expect(source).not.toContain('rmSync');
    expect(source).not.toContain('existsSync');
  });

  test('calls process.exit(0) after successful init', () => {
    expect(source).toContain('process.exit(0)');
  });

  test('logs a success message after init', () => {
    expect(source).toContain('Database initialized');
  });
});

// ─── seed.js — no-op stub analysis ──────────────────────────────────────────

describe('db/seed.js — stub script', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seed.js'), 'utf-8');
  });

  test('file exists and is non-empty', () => {
    expect(source).toBeTruthy();
    expect(source.length).toBeGreaterThan(0);
  });

  test('is a minimal file (under 10 lines)', () => {
    const lines = source.trim().split('\n');
    expect(lines.length).toBeLessThanOrEqual(10);
  });

  test('contains a console.log explaining it is a no-op', () => {
    expect(source).toContain('console.log');
  });

  test('indicates seeds are applied during db:init', () => {
    expect(source).toContain('db:init');
  });

  test('does not import database.js', () => {
    expect(source).not.toContain("from '../database.js'");
    expect(source).not.toContain("from './database.js'");
  });

  test('does not export any functions', () => {
    expect(source).not.toContain('export');
  });
});

// ─── seeds/demoData.js — export shape and data structure validation ─────────

describe('seeds/demoData.js — export shape', () => {
  let demoDataModule;

  beforeAll(async () => {
    demoDataModule = await import('../backend/db/seeds/demoData.js');
  });

  test('exports seedDemoData as a named export', () => {
    expect(demoDataModule.seedDemoData).toBeDefined();
    expect(typeof demoDataModule.seedDemoData).toBe('function');
  });

  test('seedDemoData is the only named export', () => {
    const namedExports = Object.keys(demoDataModule).filter(k => k !== 'default');
    expect(namedExports).toEqual(['seedDemoData']);
  });

  test('does not have a default export', () => {
    // Module should only export { seedDemoData }
    expect(demoDataModule.default).toBeUndefined();
  });
});

describe('seeds/demoData.js — source structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'demoData.js'), 'utf-8');
  });

  test('imports uuid for generating unique IDs', () => {
    expect(source).toContain('uuid');
    expect(source).toContain('uuidv4');
  });

  test('imports query from database.js', () => {
    expect(source).toContain("import { query } from '../database.js'");
  });

  test('defines demo user constants', () => {
    expect(source).toContain('DEMO_USER_EMAIL');
    expect(source).toContain('demo@vaultlister.com');
    expect(source).toContain('DEMO_USER_PASSWORD');
    expect(source).toContain('DEMO_USER_USERNAME');
  });

  test('has a hashPasswordSync helper function', () => {
    expect(source).toContain('function hashPasswordSync');
    expect(source).toContain('Bun.password.hashSync');
    expect(source).toContain('bcrypt');
  });

  test('defines seedInventoryItems function', () => {
    expect(source).toContain('function seedInventoryItems(userId)');
  });

  test('defines seedOrders function', () => {
    expect(source).toContain('function seedOrders(userId)');
  });

  test('defines seedListings function', () => {
    expect(source).toContain('function seedListings(userId)');
  });

  test('defines seedOffers function', () => {
    expect(source).toContain('function seedOffers(userId');
  });

  test('defines seedSales function', () => {
    expect(source).toContain('function seedSales(userId');
  });
});

describe('seeds/demoData.js — inventory item structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'demoData.js'), 'utf-8');
  });

  test('inventory items have required fields', () => {
    const requiredFields = ['id', 'title', 'description', 'brand', 'category',
      'size', 'color', 'condition', 'sku', 'cost_price', 'list_price',
      'quantity', 'status', 'low_stock_threshold'];
    for (const field of requiredFields) {
      expect(source).toContain(field);
    }
  });

  test('uses valid condition values', () => {
    // Valid: 'new', 'like_new', 'good', 'fair', 'poor'
    const validConditions = ['new', 'like_new', 'good'];
    for (const cond of validConditions) {
      expect(source).toContain(`condition: "${cond}"`) ;
    }
  });

  test('uses valid status values for inventory', () => {
    // Valid: 'draft', 'active', 'sold', 'archived', 'deleted'
    expect(source).toContain("status: 'active'");
    expect(source).toContain("status: 'draft'");
    expect(source).toContain("status: 'sold'");
  });

  test('SKUs follow VL- prefix convention', () => {
    const skuMatches = source.match(/sku:\s*["']VL-/g);
    expect(skuMatches).toBeTruthy();
    expect(skuMatches.length).toBeGreaterThanOrEqual(10);
  });

  test('has items across multiple categories', () => {
    const categories = ['Bottoms', 'Shoes', 'Bags', 'Tops', 'Accessories', 'Outerwear'];
    for (const cat of categories) {
      expect(source).toContain(`category: "${cat}"`);
    }
  });

  test('has items with quantity 0 (out of stock)', () => {
    expect(source).toContain('quantity: 0');
  });

  test('has items with varying quantities', () => {
    // Verify there are items with high stock, low stock, and zero stock
    expect(source).toContain('quantity: 1');
    expect(source).toContain('quantity: 8');
    expect(source).toContain('quantity: 10');
    expect(source).toContain('quantity: 0');
  });

  test('cost_price is always less than list_price in items', () => {
    // Extract cost/list price pairs from the source
    const costMatches = [...source.matchAll(/cost_price:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    const listMatches = [...source.matchAll(/list_price:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    expect(costMatches.length).toBe(listMatches.length);
    expect(costMatches.length).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < costMatches.length; i++) {
      expect(costMatches[i]).toBeLessThan(listMatches[i]);
    }
  });
});

describe('seeds/demoData.js — orders structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'demoData.js'), 'utf-8');
  });

  test('orders have required fields', () => {
    const requiredFields = ['platform', 'order_number', 'buyer_username',
      'item_title', 'sale_price', 'status', 'tracking_number', 'shipping_provider'];
    for (const field of requiredFields) {
      expect(source).toContain(field);
    }
  });

  test('orders use valid statuses', () => {
    expect(source).toContain("status: 'delivered'");
    expect(source).toContain("status: 'shipped'");
    expect(source).toContain("status: 'pending'");
  });

  test('orders use multiple platforms', () => {
    expect(source).toContain("platform: 'poshmark'");
    expect(source).toContain("platform: 'ebay'");
    expect(source).toContain("platform: 'mercari'");
    expect(source).toContain("platform: 'depop'");
    expect(source).toContain("platform: 'grailed'");
  });

  test('pending orders have null tracking info', () => {
    expect(source).toContain('tracking_number: null');
    expect(source).toContain('shipping_provider: null');
  });

  test('delivered orders have shipped_at and delivered_at timestamps', () => {
    expect(source).toContain('shipped_at:');
    expect(source).toContain('delivered_at:');
  });

  test('uses valid shipping providers', () => {
    expect(source).toContain("shipping_provider: 'USPS'");
    expect(source).toContain("shipping_provider: 'UPS'");
    expect(source).toContain("shipping_provider: 'FedEx'");
  });
});

describe('seeds/demoData.js — listings structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'demoData.js'), 'utf-8');
  });

  test('listings have required fields', () => {
    const requiredFields = ['platform', 'title', 'description', 'price',
      'status', 'views', 'likes', 'listed_at'];
    for (const field of requiredFields) {
      expect(source).toContain(field);
    }
  });

  test('includes both fresh and stale listings', () => {
    // Fresh listings use small daysAgo values, stale ones use 30+
    expect(source).toContain('daysAgo(5)');   // fresh
    expect(source).toContain('daysAgo(45)');  // stale
    expect(source).toContain('daysAgo(75)');  // very stale
  });

  test('stale listings have low engagement metrics', () => {
    // Stale listings have views < 10 and likes < 3
    expect(source).toContain('views: 5');
    expect(source).toContain('views: 3');
    expect(source).toContain('likes: 0');
    expect(source).toContain('likes: 1');
  });

  test('seedListings returns listing IDs array', () => {
    expect(source).toContain('return listings.map(l => l.id)');
  });
});

describe('seeds/demoData.js — offers structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'demoData.js'), 'utf-8');
  });

  test('offers have required fields', () => {
    const requiredFields = ['listing_id', 'platform', 'buyer_name',
      'buyer_username', 'offer_amount', 'listing_price', 'status'];
    for (const field of requiredFields) {
      expect(source).toContain(field);
    }
  });

  test('offers use valid statuses', () => {
    expect(source).toContain("status: 'pending'");
    expect(source).toContain("status: 'accepted'");
    expect(source).toContain("status: 'declined'");
    expect(source).toContain("status: 'countered'");
  });

  test('pending offers have expires_at timestamps', () => {
    expect(source).toContain('expires_at:');
  });

  test('countered offers include a counter_amount', () => {
    expect(source).toContain('counter_amount:');
  });

  test('accepted and declined offers have responded_at timestamps', () => {
    expect(source).toContain('responded_at:');
  });

  test('offer_amount is always less than listing_price', () => {
    // Extract offer_amount/listing_price pairs
    const offerAmounts = [...source.matchAll(/offer_amount:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    const listingPrices = [...source.matchAll(/listing_price:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    expect(offerAmounts.length).toBe(listingPrices.length);
    expect(offerAmounts.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < offerAmounts.length; i++) {
      expect(offerAmounts[i]).toBeLessThan(listingPrices[i]);
    }
  });
});

describe('seeds/demoData.js — sales structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'demoData.js'), 'utf-8');
  });

  test('sales have required fields', () => {
    const requiredFields = ['platform', 'buyer_username', 'sale_price',
      'platform_fee', 'shipping_cost', 'status', 'sold_at'];
    for (const field of requiredFields) {
      expect(source).toContain(field);
    }
  });

  test('sales use valid statuses', () => {
    expect(source).toContain("status: 'delivered'");
    expect(source).toContain("status: 'shipped'");
    expect(source).toContain("status: 'confirmed'");
  });

  test('sales span multiple platforms for analytics', () => {
    // Check that sales reference multiple platforms
    const platformMatches = [...source.matchAll(/platform:\s*'(\w+)'/g)].map(m => m[1]);
    const uniquePlatforms = [...new Set(platformMatches)];
    expect(uniquePlatforms.length).toBeGreaterThanOrEqual(4);
  });

  test('sales include platform fees and shipping costs', () => {
    const feeMatches = [...source.matchAll(/platform_fee:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    const shippingMatches = [...source.matchAll(/shipping_cost:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    expect(feeMatches.length).toBeGreaterThanOrEqual(8);
    expect(shippingMatches.length).toBeGreaterThanOrEqual(8);
    // All fees and shipping costs should be positive
    for (const fee of feeMatches) {
      expect(fee).toBeGreaterThan(0);
    }
    for (const cost of shippingMatches) {
      expect(cost).toBeGreaterThan(0);
    }
  });

  test('sales are spread over 30 days for analytics', () => {
    // The source creates sales from 1 day ago to 28 days ago
    expect(source).toContain('1 * 24 * 60 * 60 * 1000');
    expect(source).toContain('28 * 24 * 60 * 60 * 1000');
  });
});

// ─── seeds/helpContent.js — export shape and data structure validation ──────

describe('seeds/helpContent.js — export shape', () => {
  let helpModule;

  beforeAll(async () => {
    helpModule = await import('../backend/db/seeds/helpContent.js');
  });

  test('exports seedHelpContent as a named export', () => {
    expect(helpModule.seedHelpContent).toBeDefined();
    expect(typeof helpModule.seedHelpContent).toBe('function');
  });

  test('seedHelpContent is the only named export', () => {
    const namedExports = Object.keys(helpModule).filter(k => k !== 'default');
    expect(namedExports).toEqual(['seedHelpContent']);
  });

  test('does not have a default export', () => {
    expect(helpModule.default).toBeUndefined();
  });
});

describe('seeds/helpContent.js — source structure', () => {
  let source;

  beforeAll(() => {
    source = readFileSync(join(DB_DIR, 'seeds', 'helpContent.js'), 'utf-8');
  });

  test('imports query from database.js', () => {
    expect(source).toContain("import { query } from '../database.js'");
  });

  test('defines video tutorials data', () => {
    expect(source).toContain('videos');
    expect(source).toContain('Video Tutorials');
  });

  test('video entries have required fields', () => {
    const videoFields = ['id', 'title', 'description', 'video_url',
      'category', 'duration', 'thumbnail_url', 'view_count', 'position'];
    for (const field of videoFields) {
      expect(source).toContain(field);
    }
  });

  test('videos cover expected categories', () => {
    expect(source).toContain("category: 'getting_started'");
    expect(source).toContain("category: 'inventory'");
    expect(source).toContain("category: 'cross_listing'");
    expect(source).toContain("category: 'automations'");
    expect(source).toContain("category: 'advanced'");
  });

  test('video IDs follow vid_ prefix convention', () => {
    const vidIdMatches = source.match(/id:\s*'vid_\w+'/g);
    expect(vidIdMatches).toBeTruthy();
    expect(vidIdMatches.length).toBeGreaterThanOrEqual(5);
  });

  test('video durations are positive numbers in seconds', () => {
    const durations = [...source.matchAll(/duration:\s*(\d+)/g)].map(m => parseInt(m[1]));
    expect(durations.length).toBeGreaterThanOrEqual(5);
    for (const d of durations) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(3600); // less than 1 hour
    }
  });

  test('defines FAQ data', () => {
    expect(source).toContain('faqs');
    expect(source).toContain('FAQs');
  });

  test('FAQ entries have required fields', () => {
    const faqFields = ['id', 'question', 'answer', 'category', 'position'];
    for (const field of faqFields) {
      expect(source).toContain(field);
    }
  });

  test('FAQ IDs follow faq_ prefix convention', () => {
    const faqIdMatches = source.match(/id:\s*'faq_\w+'/g);
    expect(faqIdMatches).toBeTruthy();
    expect(faqIdMatches.length).toBeGreaterThanOrEqual(10);
  });

  test('FAQs cover expected categories', () => {
    expect(source).toContain("category: 'general'");
    expect(source).toContain("category: 'platforms'");
    expect(source).toContain("category: 'automations'");
  });

  test('defines knowledge base articles data', () => {
    expect(source).toContain('articles');
    expect(source).toContain('Knowledge Base Articles');
  });

  test('article entries have required fields', () => {
    const articleFields = ['id', 'title', 'slug', 'content', 'category', 'tags', 'is_published'];
    for (const field of articleFields) {
      expect(source).toContain(field);
    }
  });

  test('article IDs follow art_ prefix convention', () => {
    const artIdMatches = source.match(/id:\s*'art_\w+'/g);
    expect(artIdMatches).toBeTruthy();
    expect(artIdMatches.length).toBeGreaterThanOrEqual(4);
  });

  test('articles have slugs for URL routing', () => {
    expect(source).toContain("slug: 'getting-started-guide'");
    expect(source).toContain("slug: 'cross-listing-best-practices'");
    expect(source).toContain("slug: 'poshmark-automation-setup'");
    expect(source).toContain("slug: 'troubleshooting-oauth'");
  });

  test('articles cover different categories', () => {
    expect(source).toContain("category: 'guides'");
    expect(source).toContain("category: 'tutorials'");
    expect(source).toContain("category: 'troubleshooting'");
  });

  test('articles store tags as JSON arrays', () => {
    expect(source).toContain('JSON.stringify(');
    expect(source).toContain("'getting-started'");
    expect(source).toContain("'cross-listing'");
    expect(source).toContain("'automations'");
    expect(source).toContain("'troubleshooting'");
  });

  test('all articles are published', () => {
    const publishedMatches = source.match(/is_published:\s*1/g);
    expect(publishedMatches).toBeTruthy();
    expect(publishedMatches.length).toBeGreaterThanOrEqual(4);
  });

  test('inserts use ON CONFLICT DO NOTHING to handle re-runs', () => {
    expect(source).toContain('ON CONFLICT DO NOTHING');
  });

  test('logs completion message', () => {
    expect(source).toContain('Help content seeded successfully');
  });
});
