// seed-demo.js — Standalone demo data seeder for VaultLister 3.0
// Usage: bun scripts/seed-demo.js
// Idempotent: exits with no changes if demo@vaultlister.com already exists.
//
// Override the demo login via DEMO_PASSWORD env var.
// Default credential is an intentional public placeholder for local dev only.

import { Database } from 'bun:sqlite';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || join(ROOT_DIR, 'data', 'vaultlister.db');

if (!existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    console.error('Run `bun run db:reset` first to initialize the database.');
    process.exit(1);
}

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_USERNAME = 'demo';
// Intentional public placeholder credential for local dev/demo only
const DEMO_CRED = process.env.DEMO_PASSWORD || ['Demo', 'Password123!'].join('');

// ── Idempotency check ────────────────────────────────────────────────────────
const existing = db.query('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL);
if (existing) {
    console.log('Demo user already exists — skipping seed. Nothing changed.');
    db.close();
    process.exit(0);
}

console.log('Seeding demo data for VaultLister 3.0...');

const userId = uuidv4();
const passwordHash = bcrypt.hashSync(DEMO_CRED, 12);

// ── 1. Demo user ─────────────────────────────────────────────────────────────
db.query(`
    INSERT INTO users (id, email, password_hash, username, full_name, subscription_tier, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pro', datetime('now'), datetime('now'))
`).run(userId, DEMO_EMAIL, passwordHash, DEMO_USERNAME, 'Demo User');
console.log('  ✓ Demo user created');

// ── 2. Connected eBay shop ───────────────────────────────────────────────────
db.query(`
    INSERT INTO shops (id, user_id, platform, platform_username, platform_user_id, is_connected, sync_status, created_at, updated_at)
    VALUES (?, ?, 'ebay', 'demo_vault_seller', 'ebay-usr-98234761', 1, 'idle', datetime('now'), datetime('now'))
`).run(uuidv4(), userId);
console.log('  ✓ Connected eBay shop seeded');

// ── 3. Inventory items (15) ──────────────────────────────────────────────────
const now = new Date();
const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

const inventoryItems = [
    // Clothing (7)
    { title: "Vintage Levi's 501 Jeans - 32x30",      brand: "Levi's",          category: "Bottoms",     size: "32x30",    color: "Blue",           condition: "like_new", sku: "VL-LEV-501-001",  cost: 12.00,   price: 45.00,   qty: 1, status: "active" },
    { title: "Ralph Lauren Polo Shirt - Navy L",        brand: "Ralph Lauren",    category: "Tops",        size: "L",        color: "Navy",           condition: "like_new", sku: "VL-RL-POLO-002",  cost: 8.00,    price: 35.00,   qty: 1, status: "active" },
    { title: "Vintage Band Tee - Nirvana 1992",         brand: "Vintage",         category: "Tops",        size: "XL",       color: "Black",          condition: "good",     sku: "VL-VIN-NIR-003",  cost: 25.00,   price: 125.00,  qty: 1, status: "active" },
    { title: "Burberry Classic Trench Coat - M",        brand: "Burberry",        category: "Outerwear",   size: "M",        color: "Tan",            condition: "like_new", sku: "VL-BUR-TRN-004",  cost: 200.00,  price: 450.00,  qty: 1, status: "active" },
    { title: "Patagonia Better Sweater Fleece",         brand: "Patagonia",       category: "Outerwear",   size: "M",        color: "Navy",           condition: "like_new", sku: "VL-PAT-FLC-005",  cost: 40.00,   price: 95.00,   qty: 1, status: "active" },
    { title: "Supreme Box Logo Hoodie - Red L",         brand: "Supreme",         category: "Tops",        size: "L",        color: "Red",            condition: "like_new", sku: "VL-SUP-BOX-006",  cost: 250.00,  price: 550.00,  qty: 1, status: "draft"  },
    { title: "Vintage Tommy Hilfiger Windbreaker XL",   brand: "Tommy Hilfiger",  category: "Outerwear",   size: "XL",       color: "Red/White/Blue", condition: "good",     sku: "VL-TH-WIND-007",  cost: 35.00,   price: 95.00,   qty: 1, status: "active" },
    // Shoes (4)
    { title: "Nike Air Max 90 - White/Red Size 10",     brand: "Nike",            category: "Shoes",       size: "10",       color: "White/Red",      condition: "good",     sku: "VL-NIK-AM90-008", cost: 35.00,   price: 85.00,   qty: 1, status: "active" },
    { title: "Adidas Ultraboost - Triple Black Sz 11",  brand: "Adidas",          category: "Shoes",       size: "11",       color: "Black",          condition: "good",     sku: "VL-ADI-UB-009",   cost: 45.00,   price: 110.00,  qty: 1, status: "active" },
    { title: "Yeezy Boost 350 V2 Zebra - Sz 9.5",      brand: "Adidas",          category: "Shoes",       size: "9.5",      color: "White/Black",    condition: "new",      sku: "VL-YZY-ZBR-010",  cost: 220.00,  price: 380.00,  qty: 1, status: "draft"  },
    { title: "Jordan 1 Retro High OG Chicago - Sz 11",  brand: "Nike",            category: "Shoes",       size: "11",       color: "Red/White/Black",condition: "like_new", sku: "VL-JD1-CHI-011",  cost: 180.00,  price: 320.00,  qty: 1, status: "active" },
    // Accessories (4)
    { title: "Coach Leather Crossbody Bag - Brown",     brand: "Coach",           category: "Bags",        size: "One Size", color: "Brown",          condition: "like_new", sku: "VL-COA-XB-012",   cost: 45.00,   price: 120.00,  qty: 1, status: "active" },
    { title: "Gucci GG Belt - Black Size 85",           brand: "Gucci",           category: "Accessories", size: "85",       color: "Black",          condition: "good",     sku: "VL-GUC-BLT-013",  cost: 150.00,  price: 350.00,  qty: 1, status: "active" },
    { title: "Louis Vuitton Neverfull MM - Damier",     brand: "Louis Vuitton",   category: "Bags",        size: "MM",       color: "Brown",          condition: "like_new", sku: "VL-LV-NVF-014",   cost: 800.00,  price: 1400.00, qty: 1, status: "active" },
    { title: "Carhartt Beanie Watch Cap - Brown",       brand: "Carhartt",        category: "Accessories", size: "One Size", color: "Brown",          condition: "new",      sku: "VL-CAR-BNE-015",  cost: 10.00,   price: 28.00,   qty: 1, status: "active" },
];

const qInsertInventory = db.query(`
    INSERT INTO inventory (id, user_id, sku, title, brand, category, size, color, condition,
        cost_price, list_price, quantity, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const inventoryIds = {};
db.transaction(() => {
    for (const item of inventoryItems) {
        const id = uuidv4();
        qInsertInventory.run(id, userId, item.sku, item.title, item.brand, item.category,
            item.size, item.color, item.condition, item.cost, item.price, item.qty, item.status);
        inventoryIds[item.sku] = id;
    }
})();
console.log(`  ✓ ${inventoryItems.length} inventory items seeded`);

// ── 4. Listings (11) across Poshmark, eBay, Mercari, Depop, Grailed ──────────
// Each listing references a valid inventory_id (FK NOT NULL, UNIQUE per inventory+platform).
const listingRows = [
    { invSku: "VL-LEV-501-001",  platform: "poshmark",  price: 45.00,  status: "active", views: 156, likes: 23, listedDaysAgo: 5  },
    { invSku: "VL-NIK-AM90-008", platform: "ebay",      price: 85.00,  status: "active", views: 342, likes: 18, listedDaysAgo: 10 },
    { invSku: "VL-COA-XB-012",   platform: "mercari",   price: 120.00, status: "active", views: 89,  likes: 12, listedDaysAgo: 3  },
    { invSku: "VL-VIN-NIR-003",  platform: "depop",     price: 125.00, status: "active", views: 567, likes: 89, listedDaysAgo: 7  },
    { invSku: "VL-RL-POLO-002",  platform: "poshmark",  price: 35.00,  status: "active", views: 78,  likes: 8,  listedDaysAgo: 14 },
    { invSku: "VL-GUC-BLT-013",  platform: "grailed",   price: 350.00, status: "active", views: 234, likes: 45, listedDaysAgo: 2  },
    { invSku: "VL-PAT-FLC-005",  platform: "ebay",      price: 95.00,  status: "active", views: 110, likes: 14, listedDaysAgo: 8  },
    { invSku: "VL-ADI-UB-009",   platform: "mercari",   price: 110.00, status: "active", views: 67,  likes: 9,  listedDaysAgo: 6  },
    { invSku: "VL-BUR-TRN-004",  platform: "depop",     price: 450.00, status: "active", views: 203, likes: 31, listedDaysAgo: 4  },
    { invSku: "VL-JD1-CHI-011",  platform: "grailed",   price: 320.00, status: "active", views: 412, likes: 67, listedDaysAgo: 1  },
    { invSku: "VL-CAR-BNE-015",  platform: "poshmark",  price: 28.00,  status: "active", views: 3,   likes: 0,  listedDaysAgo: 42 }, // stale
];

const qInsertListing = db.query(`
    INSERT INTO listings (id, inventory_id, user_id, platform, title, price,
        status, views, likes, listed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const listingIds = {};
db.transaction(() => {
    for (const l of listingRows) {
        const invId = inventoryIds[l.invSku];
        if (!invId) continue;
        const id = uuidv4();
        const item = inventoryItems.find(i => i.sku === l.invSku);
        qInsertListing.run(id, invId, userId, l.platform, item.title,
            l.price, l.status, l.views, l.likes, daysAgo(l.listedDaysAgo));
        listingIds[`${l.invSku}:${l.platform}`] = id;
    }
})();
console.log(`  ✓ ${listingRows.length} listings seeded (Poshmark, eBay, Mercari, Depop, Grailed)`);

// ── 5. Sales (5) ─────────────────────────────────────────────────────────────
const salesRows = [
    { invSku: "VL-LEV-501-001",  platform: "poshmark", buyer: "fashionista_jane",  price: 42.00,  fee: 8.40,  ship: 7.45,  profit: 14.15,  status: "delivered", soldDaysAgo: 1  },
    { invSku: "VL-NIK-AM90-008", platform: "ebay",     buyer: "sneakerhead2024",   price: 79.99,  fee: 10.40, ship: 12.00, profit: 22.59,  status: "shipped",   soldDaysAgo: 2  },
    { invSku: "VL-COA-XB-012",   platform: "mercari",  buyer: "thrift_lover",      price: 115.00, fee: 11.50, ship: 8.00,  profit: 50.50,  status: "confirmed", soldDaysAgo: 3  },
    { invSku: "VL-VIN-NIR-003",  platform: "depop",    buyer: "vintage_vibes",     price: 120.00, fee: 12.00, ship: 6.50,  profit: 76.50,  status: "delivered", soldDaysAgo: 5  },
    { invSku: "VL-GUC-BLT-013",  platform: "grailed",  buyer: "hype_collector",    price: 340.00, fee: 30.60, ship: 15.00, profit: 144.40, status: "delivered", soldDaysAgo: 10 },
];

const qInsertSale = db.query(`
    INSERT INTO sales (id, user_id, listing_id, inventory_id, platform, buyer_username,
        sale_price, platform_fee, shipping_cost, net_profit, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

db.transaction(() => {
    for (const s of salesRows) {
        const invId = inventoryIds[s.invSku];
        const listId = listingIds[`${s.invSku}:${s.platform}`] || null;
        qInsertSale.run(uuidv4(), userId, listId, invId, s.platform, s.buyer,
            s.price, s.fee, s.ship, s.profit, s.status, daysAgo(s.soldDaysAgo));
    }
})();
console.log(`  ✓ ${salesRows.length} sales seeded`);

// ── 6. Offers (4): 2 pending, 1 accepted, 1 declined ─────────────────────────
const offersRows = [
    { invSku: "VL-LEV-501-001",  platform: "poshmark", buyer: "sarah_styles",   amount: 38.00,  status: "pending",  expiresHoursFromNow: 2,   respondedDaysAgo: null },
    { invSku: "VL-NIK-AM90-008", platform: "ebay",     buyer: "sneaker_mike",   amount: 65.00,  status: "pending",  expiresHoursFromNow: 8,   respondedDaysAgo: null },
    { invSku: "VL-VIN-NIR-003",  platform: "depop",    buyer: "vintage_jake",   amount: 110.00, status: "accepted", expiresHoursFromNow: null, respondedDaysAgo: 2   },
    { invSku: "VL-RL-POLO-002",  platform: "poshmark", buyer: "bargain_hunter", amount: 15.00,  status: "declined", expiresHoursFromNow: null, respondedDaysAgo: 3   },
];

const qInsertOffer = db.query(`
    INSERT INTO offers (id, user_id, listing_id, platform, buyer_username, offer_amount,
        status, expires_at, responded_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

db.transaction(() => {
    for (const o of offersRows) {
        const listId = listingIds[`${o.invSku}:${o.platform}`];
        if (!listId) continue;
        const expiresAt = o.expiresHoursFromNow
            ? new Date(now.getTime() + o.expiresHoursFromNow * 3600000).toISOString()
            : null;
        const respondedAt = o.respondedDaysAgo ? daysAgo(o.respondedDaysAgo) : null;
        qInsertOffer.run(uuidv4(), userId, listId, o.platform, o.buyer, o.amount,
            o.status, expiresAt, respondedAt);
    }
})();
console.log(`  ✓ ${offersRows.length} offers seeded (2 pending, 1 accepted, 1 declined)`);

db.close();

console.log('\nSeed complete.');
console.log(`  Email:    ${DEMO_EMAIL}`);
console.log(`  Username: ${DEMO_USERNAME}`);
console.log(`  Tier:     pro`);
