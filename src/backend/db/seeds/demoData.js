// Demo Data Seed for VaultLister
// Creates test inventory items and orders for demonstration

import { v4 as uuidv4 } from 'uuid';
import { query } from '../database.js';

// Demo user credentials
const DEMO_USER_EMAIL = 'demo@vaultlister.com';
const DEMO_USER_PASSWORD = process.env.DEMO_PASSWORD || 'DemoPassword123!';
const DEMO_USER_USERNAME = 'demo';

// Simple sync password hash using Bun's built-in
function hashPasswordSync(password) {
    // Use Bun's native password hashing if available, otherwise use a simple approach
    // In production, bcrypt is used async. For seeding, we use sync version.
    try {
        return Bun.password.hashSync(password, { algorithm: 'bcrypt', cost: 12 });
    } catch (e) {
        // Fallback: this shouldn't happen in Bun environment
        console.error('Password hashing failed:', e.message);
        return null;
    }
}

export function seedDemoData() {
    try {
        // Check if demo user exists, create if not
        let demoUser = await query.get('SELECT id FROM users WHERE email = ?', [DEMO_USER_EMAIL]);

        if (!demoUser) {
            console.log('  Creating demo user...');
            const userId = uuidv4();
            const passwordHash = hashPasswordSync(DEMO_USER_PASSWORD);

            if (!passwordHash) {
                console.log('  ⚠ Could not hash password, skipping demo user creation');
                return;
            }

            await query.run(`
                INSERT INTO users (id, email, password_hash, username, full_name, subscription_tier, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
            `, [userId, DEMO_USER_EMAIL, passwordHash, DEMO_USER_USERNAME, 'Demo User', 'pro']);

            demoUser = { id: userId };
            console.log('  ✓ Demo user created');
        }

        const userId = demoUser.id;

        // Ensure demo user has 'pro' tier for full feature access
        await query.run('UPDATE users SET subscription_tier = ? WHERE id = ?', ['pro', userId]);

        console.log('Checking demo data...');

        // Always reseed inventory items for demo user
        console.log('  Reseeding inventory items...');
        await query.run('DELETE FROM inventory WHERE user_id = ?', [userId]);
        seedInventoryItems(userId);

        // Always reseed orders for demo user to ensure they exist
        console.log('  Reseeding orders for demo user...');
        await query.run('DELETE FROM orders WHERE user_id = ?', [userId]);
        seedOrders(userId);

        // Always reseed listings for demo user to ensure they exist
        console.log('  Reseeding listings for demo user...');
        await query.run('DELETE FROM listings WHERE user_id = ?', [userId]);
        const listingIds = seedListings(userId);

        // Always reseed offers for demo user
        if (listingIds.length > 0) {
            console.log('  Reseeding offers for demo user...');
            await query.run('DELETE FROM offers WHERE user_id = ?', [userId]);
            seedOffers(userId, listingIds);
        }

        // Always reseed sales for demo user (for dashboard analytics)
        console.log('  Reseeding sales for demo user...');
        await query.run('DELETE FROM sales WHERE user_id = ?', [userId]);
        seedSales(userId, listingIds);

        // Seed roadmap features (global, not user-specific)
        seedRoadmapFeatures();

        // Seed calendar events for demo user
        const existingEvents = await query.get('SELECT COUNT(*) as count FROM calendar_events WHERE user_id = ?', [userId]);
        if (!existingEvents?.count) seedCalendarEvents(userId);

        // Seed teams for demo user
        const existingTeams = await query.get('SELECT COUNT(*) as count FROM team_members WHERE user_id = ?', [userId]);
        if (!existingTeams?.count) seedTeams(userId);

        console.log('✓ Demo data seeded successfully');
    } catch (error) {
        console.error('Demo data seed error:', error.message);
        // Don't throw - demo data is optional
    }
}

function seedInventoryItems(userId) {
    // Valid condition values: 'new', 'like_new', 'good', 'fair', 'poor'
    // Valid status values: 'draft', 'active', 'sold', 'archived', 'deleted'
    const items = [
        // Active items with good stock (quantity 5-10)
        {
            id: uuidv4(),
            title: "Vintage Levi's 501 Jeans - 32x30",
            description: "Classic straight leg jeans in excellent condition. Medium wash with slight fading.",
            brand: "Levi's",
            category: "Bottoms",
            size: "32x30",
            color: "Blue",
            condition: "like_new",
            sku: "VL-LEV-501-001",
            cost_price: 12.00,
            list_price: 45.00,
            quantity: 8,
            status: 'active',
            low_stock_threshold: 3
        },
        {
            id: uuidv4(),
            title: "Nike Air Max 90 - White/Red",
            description: "Classic Nike Air Max 90 sneakers. Iconic design, great condition.",
            brand: "Nike",
            category: "Shoes",
            size: "10",
            color: "White/Red",
            condition: "good",
            sku: "VL-NIK-AM90-002",
            cost_price: 35.00,
            list_price: 85.00,
            quantity: 5,
            status: 'active',
            low_stock_threshold: 2
        },
        {
            id: uuidv4(),
            title: "Coach Leather Crossbody Bag",
            description: "Authentic Coach crossbody bag in brown pebbled leather. Adjustable strap.",
            brand: "Coach",
            category: "Bags",
            size: "One Size",
            color: "Brown",
            condition: "like_new",
            sku: "VL-COA-XB-003",
            cost_price: 45.00,
            list_price: 120.00,
            quantity: 6,
            status: 'active',
            low_stock_threshold: 2
        },
        {
            id: uuidv4(),
            title: "Ralph Lauren Polo Shirt - Navy",
            description: "Classic fit polo shirt with embroidered logo. 100% cotton.",
            brand: "Ralph Lauren",
            category: "Tops",
            size: "L",
            color: "Navy",
            condition: "like_new",
            sku: "VL-RL-POLO-004",
            cost_price: 8.00,
            list_price: 35.00,
            quantity: 10,
            status: 'active',
            low_stock_threshold: 3
        },
        {
            id: uuidv4(),
            title: "Gucci GG Belt - Black",
            description: "Authentic Gucci belt with double G buckle. Size 85.",
            brand: "Gucci",
            category: "Accessories",
            size: "85",
            color: "Black",
            condition: "good",
            sku: "VL-GUC-BLT-005",
            cost_price: 150.00,
            list_price: 350.00,
            quantity: 3,
            status: 'active',
            low_stock_threshold: 1
        },
        // Low stock items (quantity 1-2)
        {
            id: uuidv4(),
            title: "Vintage Band Tee - Nirvana",
            description: "Original 1992 Nirvana tour t-shirt. Some wear consistent with age.",
            brand: "Vintage",
            category: "Tops",
            size: "XL",
            color: "Black",
            condition: "good",
            sku: "VL-VIN-NIR-006",
            cost_price: 25.00,
            list_price: 125.00,
            quantity: 1,
            status: 'active',
            low_stock_threshold: 2
        },
        {
            id: uuidv4(),
            title: "Burberry Trench Coat",
            description: "Classic Burberry trench coat with signature check lining. Size M.",
            brand: "Burberry",
            category: "Outerwear",
            size: "M",
            color: "Tan",
            condition: "like_new",
            sku: "VL-BUR-TRN-007",
            cost_price: 200.00,
            list_price: 450.00,
            quantity: 2,
            status: 'active',
            low_stock_threshold: 2
        },
        // Sold item (out of stock)
        {
            id: uuidv4(),
            title: "Vintage Starter Jacket - Bulls",
            description: "90s Chicago Bulls Starter jacket. Rare find!",
            brand: "Starter",
            category: "Outerwear",
            size: "L",
            color: "Red/Black",
            condition: "good",
            sku: "VL-STR-BUL-008",
            cost_price: 50.00,
            list_price: 175.00,
            quantity: 0,
            status: 'sold',
            low_stock_threshold: 1
        },
        // More active items for variety
        {
            id: uuidv4(),
            title: "Patagonia Better Sweater",
            description: "Full-zip fleece jacket in navy. Very warm and comfortable.",
            brand: "Patagonia",
            category: "Outerwear",
            size: "M",
            color: "Navy",
            condition: "like_new",
            sku: "VL-PAT-FLC-009",
            cost_price: 40.00,
            list_price: 95.00,
            quantity: 7,
            status: 'active',
            low_stock_threshold: 2
        },
        {
            id: uuidv4(),
            title: "Adidas Ultraboost - Triple Black",
            description: "Adidas Ultraboost running shoes. Comfortable and stylish.",
            brand: "Adidas",
            category: "Shoes",
            size: "11",
            color: "Black",
            condition: "good",
            sku: "VL-ADI-UB-010",
            cost_price: 45.00,
            list_price: 110.00,
            quantity: 4,
            status: 'active',
            low_stock_threshold: 2
        },
        // Draft items (not yet listed)
        {
            id: uuidv4(),
            title: "Supreme Box Logo Hoodie - Red",
            description: "Authentic Supreme box logo hoodie. Size L. Needs photos.",
            brand: "Supreme",
            category: "Tops",
            size: "L",
            color: "Red",
            condition: "like_new",
            sku: "VL-SUP-BOX-011",
            cost_price: 250.00,
            list_price: 550.00,
            quantity: 1,
            status: 'draft',
            low_stock_threshold: 1
        },
        {
            id: uuidv4(),
            title: "Yeezy Boost 350 V2 - Zebra",
            description: "Adidas Yeezy Boost 350 V2 Zebra colorway. Size 9.5.",
            brand: "Adidas",
            category: "Shoes",
            size: "9.5",
            color: "White/Black",
            condition: "new",
            sku: "VL-YZY-ZBR-012",
            cost_price: 220.00,
            list_price: 380.00,
            quantity: 2,
            status: 'draft',
            low_stock_threshold: 1
        },
        // Out of stock items
        {
            id: uuidv4(),
            title: "Louis Vuitton Neverfull MM",
            description: "Authentic LV Neverfull in Damier Ebene. Sold out - restock pending.",
            brand: "Louis Vuitton",
            category: "Bags",
            size: "MM",
            color: "Brown",
            condition: "like_new",
            sku: "VL-LV-NVF-013",
            cost_price: 800.00,
            list_price: 1400.00,
            quantity: 0,
            status: 'active',
            low_stock_threshold: 1
        },
        {
            id: uuidv4(),
            title: "Vintage Tommy Hilfiger Windbreaker",
            description: "90s Tommy windbreaker in red/white/blue. Collector's item.",
            brand: "Tommy Hilfiger",
            category: "Outerwear",
            size: "XL",
            color: "Red/White/Blue",
            condition: "good",
            sku: "VL-TH-WIND-014",
            cost_price: 35.00,
            list_price: 95.00,
            quantity: 0,
            status: 'active',
            low_stock_threshold: 1
        },
        // More active inventory
        {
            id: uuidv4(),
            title: "North Face Nuptse Jacket",
            description: "Classic 700-fill down puffer. Black. Excellent condition.",
            brand: "The North Face",
            category: "Outerwear",
            size: "L",
            color: "Black",
            condition: "like_new",
            sku: "VL-TNF-NUP-015",
            cost_price: 120.00,
            list_price: 275.00,
            quantity: 3,
            status: 'active',
            low_stock_threshold: 1
        }
    ];

    for (const item of items) {
        try {
            await query.run(`
                INSERT INTO inventory (
                    id, user_id, title, description, brand, category, size, color,
                    condition, sku, cost_price, list_price, quantity, status,
                    low_stock_threshold, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                item.id, userId, item.title, item.description, item.brand,
                item.category, item.size, item.color, item.condition, item.sku,
                item.cost_price, item.list_price, item.quantity, item.status,
                item.low_stock_threshold
            ]);
        } catch (e) {
            // Skip if already exists
        }
    }

    console.log(`  ✓ Seeded ${items.length} inventory items`);
}

function seedOrders(userId) {
    const now = new Date();
    const orders = [
        // Delivered orders (with tracking)
        {
            id: uuidv4(),
            platform: 'poshmark',
            order_number: 'PSH-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'fashionista_jane',
            item_title: "Vintage Levi's 501 Jeans",
            sale_price: 42.00,
            status: 'delivered',
            tracking_number: '9400111899223033486' + Math.floor(Math.random() * 1000),
            shipping_provider: 'USPS',
            shipped_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
            delivered_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'ebay',
            order_number: 'EB-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'sneakerhead2024',
            item_title: "Nike Air Max 90",
            sale_price: 79.99,
            status: 'delivered',
            tracking_number: '1Z999AA10123456784',
            shipping_provider: 'UPS',
            shipped_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
            delivered_at: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        // Shipped orders (in transit)
        {
            id: uuidv4(),
            platform: 'mercari',
            order_number: 'MRC-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'thrift_lover',
            item_title: "Coach Leather Crossbody Bag",
            sale_price: 115.00,
            status: 'shipped',
            tracking_number: '9261290100130428912' + Math.floor(Math.random() * 100),
            shipping_provider: 'USPS',
            shipped_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'depop',
            order_number: 'DEP-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'vintage_vibes',
            item_title: "Vintage Band Tee - Nirvana",
            sale_price: 120.00,
            status: 'shipped',
            tracking_number: '74899998765432123456',
            shipping_provider: 'FedEx',
            shipped_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        // Pending orders (need to ship)
        {
            id: uuidv4(),
            platform: 'poshmark',
            order_number: 'PSH-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'closet_queen',
            item_title: "Ralph Lauren Polo Shirt",
            sale_price: 32.00,
            status: 'pending',
            tracking_number: null,
            shipping_provider: null
        },
        {
            id: uuidv4(),
            platform: 'grailed',
            order_number: 'GRL-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'hype_collector',
            item_title: "Gucci GG Belt",
            sale_price: 340.00,
            status: 'pending',
            tracking_number: null,
            shipping_provider: null
        },
        // More delivered orders for history
        {
            id: uuidv4(),
            platform: 'ebay',
            order_number: 'EB-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'deal_hunter88',
            item_title: "Patagonia Better Sweater",
            sale_price: 89.00,
            status: 'delivered',
            tracking_number: '1Z999AA10123456799',
            shipping_provider: 'UPS',
            shipped_at: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
            delivered_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'mercari',
            order_number: 'MRC-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            buyer_username: 'runner_mike',
            item_title: "Adidas Ultraboost",
            sale_price: 105.00,
            status: 'delivered',
            tracking_number: '9400111899223033499',
            shipping_provider: 'USPS',
            shipped_at: new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString(),
            delivered_at: new Date(now - 17 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];

    for (const order of orders) {
        try {
            await query.run(`
                INSERT INTO orders (
                    id, user_id, platform, order_number, buyer_username, item_title,
                    sale_price, status, tracking_number, shipping_provider,
                    shipped_at, delivered_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                order.id, userId, order.platform, order.order_number,
                order.buyer_username, order.item_title, order.sale_price,
                order.status, order.tracking_number, order.shipping_provider,
                order.shipped_at || null, order.delivered_at || null
            ]);
        } catch (e) {
            // Skip if already exists
        }
    }

    console.log(`  ✓ Seeded ${orders.length} orders`);
}

function seedListings(userId) {
    const now = new Date();

    // Helper to create date X days ago
    const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

    const listings = [
        // Active listings with good engagement (NOT stale)
        {
            id: uuidv4(),
            platform: 'poshmark',
            title: "Vintage Levi's 501 Jeans - 32x30",
            description: "Classic straight leg jeans in excellent condition.",
            price: 45.00,
            status: 'active',
            views: 156,
            likes: 23,
            listed_at: daysAgo(5) // 5 days ago - fresh
        },
        {
            id: uuidv4(),
            platform: 'ebay',
            title: "Nike Air Max 90 - White/Red Size 10",
            description: "Classic Nike Air Max 90 sneakers in great condition.",
            price: 85.00,
            status: 'active',
            views: 342,
            likes: 18,
            listed_at: daysAgo(10) // 10 days ago - fresh
        },
        {
            id: uuidv4(),
            platform: 'mercari',
            title: "Coach Leather Crossbody Bag - Brown",
            description: "Authentic Coach crossbody in pebbled leather.",
            price: 120.00,
            status: 'active',
            views: 89,
            likes: 12,
            listed_at: daysAgo(3) // 3 days ago - fresh
        },
        {
            id: uuidv4(),
            platform: 'depop',
            title: "Vintage Nirvana Tour Tee 1992",
            description: "Original tour t-shirt. Rare vintage find!",
            price: 125.00,
            status: 'active',
            views: 567,
            likes: 89,
            listed_at: daysAgo(7) // 7 days ago - fresh
        },
        {
            id: uuidv4(),
            platform: 'poshmark',
            title: "Ralph Lauren Polo Shirt - Navy L",
            description: "Classic fit polo, 100% cotton.",
            price: 35.00,
            status: 'active',
            views: 78,
            likes: 8,
            listed_at: daysAgo(14) // 14 days ago - fresh
        },
        {
            id: uuidv4(),
            platform: 'grailed',
            title: "Gucci GG Belt - Black Size 85",
            description: "Authentic Gucci belt with double G buckle.",
            price: 350.00,
            status: 'active',
            views: 234,
            likes: 45,
            listed_at: daysAgo(2) // 2 days ago - fresh
        },
        // STALE LISTINGS - over 30 days old with low activity
        {
            id: uuidv4(),
            platform: 'poshmark',
            title: "Vintage Tommy Hilfiger Sweater - XL",
            description: "90s crew neck sweater with classic logo. Great vintage condition.",
            price: 48.00,
            status: 'active',
            views: 5,  // Low views
            likes: 1,  // Low likes
            listed_at: daysAgo(45) // 45 days - STALE
        },
        {
            id: uuidv4(),
            platform: 'ebay',
            title: "Adidas Track Jacket - Vintage Blue",
            description: "Classic three-stripe track jacket from the 90s. Size M.",
            price: 55.00,
            status: 'active',
            views: 8,  // Low views
            likes: 2,  // Low likes
            listed_at: daysAgo(60) // 60 days - STALE
        },
        {
            id: uuidv4(),
            platform: 'mercari',
            title: "Carhartt Beanie - Brown",
            description: "Classic Carhartt watch cap. New with tags.",
            price: 22.00,
            status: 'active',
            views: 3,  // Low views
            likes: 0,  // Low likes
            listed_at: daysAgo(38) // 38 days - STALE
        },
        {
            id: uuidv4(),
            platform: 'depop',
            title: "Vintage Starter Jacket - Raiders",
            description: "90s Raiders starter jacket. Some minor wear, overall great condition.",
            price: 95.00,
            status: 'active',
            views: 7,  // Low views
            likes: 2,  // Low likes
            listed_at: daysAgo(55) // 55 days - STALE
        },
        {
            id: uuidv4(),
            platform: 'grailed',
            title: "Acne Studios Scarf - Gray Wool",
            description: "Oversized wool scarf from Acne Studios. Excellent condition.",
            price: 145.00,
            status: 'active',
            views: 4,  // Low views
            likes: 1,  // Low likes
            listed_at: daysAgo(75) // 75 days - VERY STALE
        }
    ];

    for (const listing of listings) {
        try {
            await query.run(`
                INSERT INTO listings (
                    id, user_id, platform, title, description, price,
                    status, views, likes, listed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                listing.id, userId, listing.platform, listing.title,
                listing.description, listing.price, listing.status,
                listing.views, listing.likes, listing.listed_at
            ]);
        } catch (e) {
            // Skip if already exists
        }
    }

    console.log(`  ✓ Seeded ${listings.length} listings`);

    // Return listing IDs for offers seeding
    return listings.map(l => l.id);
}

function seedOffers(userId, listingIds) {
    const now = new Date();
    const offers = [
        // Pending offers (need response)
        {
            id: uuidv4(),
            listing_id: listingIds[0], // Levi's Jeans
            platform: 'poshmark',
            buyer_name: 'Sarah M.',
            buyer_username: 'sarah_styles',
            offer_amount: 38.00,
            listing_price: 45.00,
            status: 'pending',
            message: 'Would you accept $38? I can pay right away!',
            expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString() // 2 hours - CRITICAL
        },
        {
            id: uuidv4(),
            listing_id: listingIds[1], // Nike Air Max
            platform: 'ebay',
            buyer_name: 'Mike J.',
            buyer_username: 'sneaker_mike',
            offer_amount: 65.00,
            listing_price: 85.00,
            status: 'pending',
            message: 'Best I can do is $65',
            expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString() // 8 hours - URGENT
        },
        {
            id: uuidv4(),
            listing_id: listingIds[2], // Coach Bag
            platform: 'mercari',
            buyer_name: 'Emily R.',
            buyer_username: 'emilys_closet',
            offer_amount: 100.00,
            listing_price: 120.00,
            status: 'pending',
            message: null,
            expires_at: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString() // 18 hours - WARNING
        },
        {
            id: uuidv4(),
            listing_id: listingIds[5], // Gucci Belt
            platform: 'grailed',
            buyer_name: 'Alex T.',
            buyer_username: 'designer_alex',
            offer_amount: 280.00,
            listing_price: 350.00,
            status: 'pending',
            message: 'Very interested! Is this price negotiable?',
            expires_at: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString()
        },
        // Accepted offers (history)
        {
            id: uuidv4(),
            listing_id: listingIds[3], // Nirvana Tee
            platform: 'depop',
            buyer_name: 'Jake P.',
            buyer_username: 'vintage_jake',
            offer_amount: 110.00,
            listing_price: 125.00,
            status: 'accepted',
            responded_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        // Declined offers (history)
        {
            id: uuidv4(),
            listing_id: listingIds[4], // Polo Shirt
            platform: 'poshmark',
            buyer_name: 'Chris L.',
            buyer_username: 'bargain_hunter',
            offer_amount: 15.00,
            listing_price: 35.00,
            status: 'declined',
            message: 'Will you take $15?',
            responded_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        // Countered offers (history)
        {
            id: uuidv4(),
            listing_id: listingIds[1], // Nike Air Max (different buyer)
            platform: 'ebay',
            buyer_name: 'Tom S.',
            buyer_username: 'tomsneakers',
            offer_amount: 55.00,
            listing_price: 85.00,
            status: 'countered',
            counter_amount: 75.00,
            responded_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];

    for (const offer of offers) {
        try {
            await query.run(`
                INSERT INTO offers (
                    id, user_id, listing_id, platform, buyer_username,
                    offer_amount, status, counter_amount,
                    expires_at, responded_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                offer.id, userId, offer.listing_id, offer.platform,
                offer.buyer_username || offer.buyer_name, offer.offer_amount,
                offer.status, offer.counter_amount || null,
                offer.expires_at || null, offer.responded_at || null
            ]);
        } catch (e) {
            console.error('Offer insert error:', e.message);
        }
    }

    console.log(`  ✓ Seeded ${offers.length} offers`);
}

function seedSales(userId, listingIds) {
    const now = new Date();

    // Generate sales spread over the last 30 days for analytics
    const sales = [
        // This week sales (for Weekly Comparison - current week)
        {
            id: uuidv4(),
            listing_id: listingIds[0],
            platform: 'poshmark',
            buyer_username: 'fashionista_jane',
            sale_price: 42.00,
            platform_fee: 8.40,
            shipping_cost: 7.45,
            status: 'delivered',
            sold_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
        },
        {
            id: uuidv4(),
            listing_id: listingIds[1],
            platform: 'ebay',
            buyer_username: 'sneakerhead2024',
            sale_price: 79.99,
            platform_fee: 10.40,
            shipping_cost: 12.00,
            status: 'shipped',
            sold_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        },
        {
            id: uuidv4(),
            listing_id: listingIds[2],
            platform: 'mercari',
            buyer_username: 'thrift_lover',
            sale_price: 115.00,
            platform_fee: 11.50,
            shipping_cost: 8.00,
            status: 'confirmed',
            sold_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
        },
        {
            id: uuidv4(),
            listing_id: listingIds[3],
            platform: 'depop',
            buyer_username: 'vintage_vibes',
            sale_price: 120.00,
            platform_fee: 12.00,
            shipping_cost: 6.50,
            status: 'delivered',
            sold_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
        },
        // Last week sales (for Weekly Comparison - previous week)
        {
            id: uuidv4(),
            listing_id: listingIds[4],
            platform: 'poshmark',
            buyer_username: 'closet_queen',
            sale_price: 32.00,
            platform_fee: 6.40,
            shipping_cost: 7.45,
            status: 'delivered',
            sold_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString() // 8 days ago
        },
        {
            id: uuidv4(),
            listing_id: listingIds[5],
            platform: 'grailed',
            buyer_username: 'hype_collector',
            sale_price: 340.00,
            platform_fee: 30.60,
            shipping_cost: 15.00,
            status: 'delivered',
            sold_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
        },
        {
            id: uuidv4(),
            platform: 'ebay',
            buyer_username: 'deal_hunter88',
            sale_price: 89.00,
            platform_fee: 11.57,
            shipping_cost: 10.00,
            status: 'delivered',
            sold_at: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString() // 12 days ago
        },
        // Older sales (for monthly analytics)
        {
            id: uuidv4(),
            platform: 'mercari',
            buyer_username: 'runner_mike',
            sale_price: 105.00,
            platform_fee: 10.50,
            shipping_cost: 8.00,
            status: 'delivered',
            sold_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'poshmark',
            buyer_username: 'style_maven',
            sale_price: 55.00,
            platform_fee: 11.00,
            shipping_cost: 7.45,
            status: 'delivered',
            sold_at: new Date(now - 18 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'ebay',
            buyer_username: 'bargain_betty',
            sale_price: 67.50,
            platform_fee: 8.78,
            shipping_cost: 9.00,
            status: 'delivered',
            sold_at: new Date(now - 22 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'depop',
            buyer_username: 'trendy_teen',
            sale_price: 28.00,
            platform_fee: 2.80,
            shipping_cost: 5.00,
            status: 'delivered',
            sold_at: new Date(now - 25 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: uuidv4(),
            platform: 'mercari',
            buyer_username: 'savvy_shopper',
            sale_price: 145.00,
            platform_fee: 14.50,
            shipping_cost: 11.00,
            status: 'delivered',
            sold_at: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];

    for (const sale of sales) {
        try {
            await query.run(`
                INSERT INTO sales (
                    id, user_id, listing_id, platform, buyer_username,
                    sale_price, platform_fee, shipping_cost, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                sale.id, userId, sale.listing_id || null, sale.platform,
                sale.buyer_username, sale.sale_price, sale.platform_fee,
                sale.shipping_cost, sale.status, sale.sold_at
            ]);
        } catch (e) {
            console.error('Sale insert error:', e.message);
        }
    }

    console.log(`  ✓ Seeded ${sales.length} sales`);
}

function seedCalendarEvents(userId) {
    const now = new Date();
    const day = (offset) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        return d.toISOString().split('T')[0];
    };

    const events = [
        { title: "Ship: Vintage Levi's 501 Jeans", description: 'Sold on Poshmark — ship by today', type: 'order', color: '#3b82f6', date: day(0), time: '10:00' },
        { title: 'Ship: Nike Air Max 90 Sneakers', description: 'Sold on eBay — ship by today', type: 'order', color: '#3b82f6', date: day(0), time: '14:00' },
        { title: 'Poshmark Closet Share', description: 'Scheduled daily closet sharing automation', type: 'automation', color: '#8b5cf6', date: day(1), time: '09:00' },
        { title: 'Ship: Coach Leather Crossbody', description: 'Sold on Depop — ship by tomorrow', type: 'order', color: '#3b82f6', date: day(1), time: '12:00' },
        { title: 'eBay Listing Refresh', description: 'Refresh stale listings for better placement', type: 'automation', color: '#8b5cf6', date: day(2), time: '08:00' },
        { title: 'Ship: Patagonia Fleece Jacket', description: 'Sold on Mercari — ship within 3 days', type: 'order', color: '#3b82f6', date: day(2), time: '11:00' },
        { title: 'Price Drop Campaign', description: 'Drop prices 10% on items listed 30+ days', type: 'reminder', color: '#f59e0b', date: day(3), time: '10:00' },
        { title: 'Weekly Inventory Review', description: 'Review sell-through rates and restock decisions', type: 'reminder', color: '#10b981', date: day(5), time: '09:00' },
        { title: 'Send Offers to Likers', description: 'Automated offer blast to all watchers', type: 'automation', color: '#8b5cf6', date: day(5), time: '19:00' },
        { title: 'Ship: Ray-Ban Wayfarer Sunglasses', description: 'Sold on eBay — ship by this week', type: 'order', color: '#3b82f6', date: day(6), time: '10:00' },
        { title: 'Monthly P&L Review', description: 'Review profit & loss report for the month', type: 'reminder', color: '#10b981', date: day(7), time: '09:00' },
        { title: 'New Listing Batch', description: 'Photo and list 10 items from sourcing haul', type: 'reminder', color: '#f59e0b', date: day(8), time: '14:00' },
        { title: 'Ship: Lululemon Align Leggings', description: 'Sold on Poshmark', type: 'order', color: '#3b82f6', date: day(9), time: '11:00' },
        { title: 'eBay Promoted Listings Review', description: 'Check promoted listing performance and adjust bids', type: 'reminder', color: '#10b981', date: day(10), time: '10:00' },
        { title: 'Closet Audit', description: 'Review items with no views in 60+ days for price drops', type: 'reminder', color: '#ef4444', date: day(12), time: '09:00' },
    ];

    for (const e of events) {
        try {
            await query.run(
                `INSERT INTO calendar_events (id, user_id, title, description, date, time, type, color, all_day, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
                [uuidv4(), userId, e.title, e.description, e.date, e.time, e.type, e.color]
            );
        } catch (err) {
            console.error('Calendar event insert error:', err.message);
        }
    }
    console.log(`  ✓ Seeded ${events.length} calendar events`);
}

function seedTeams(userId) {
    const teamId = uuidv4();
    try {
        await query.run(
            `INSERT INTO teams (id, name, description, owner_user_id, subscription_tier, max_members, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days')`,
            [teamId, 'Vault Crew', 'Main reselling team — cross-listing, pricing, and automation coordination.', userId, 'pro', 5]
        );
        await query.run(
            `INSERT INTO team_members (id, team_id, user_id, role, invited_by, invited_at, accepted_at, status, permissions)
             VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', ?, ?)`,
            [uuidv4(), teamId, userId, 'owner', userId, 'active', JSON.stringify({ manage_listings: true, manage_inventory: true, view_analytics: true, manage_automations: true })]
        );

        // Add a second team
        const team2Id = uuidv4();
        await query.run(
            `INSERT INTO teams (id, name, description, owner_user_id, subscription_tier, max_members, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days')`,
            [team2Id, 'eBay Specialists', 'Dedicated eBay listing and shipping team.', userId, 'pro', 3]
        );
        await query.run(
            `INSERT INTO team_members (id, team_id, user_id, role, invited_by, invited_at, accepted_at, status, permissions)
             VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', ?, ?)`,
            [uuidv4(), team2Id, userId, 'owner', userId, 'active', JSON.stringify({ manage_listings: true, manage_inventory: true, view_analytics: true, manage_automations: false })]
        );

        console.log('  ✓ Seeded 2 teams for demo user');
    } catch (e) {
        console.error('Team seed error:', e.message);
    }
}

function seedRoadmapFeatures() {
    const existing = await query.get('SELECT COUNT(*) as count FROM roadmap_features');
    if (existing?.count > 0) return;

    const features = [
        { id: uuidv4(), title: 'Bulk Cross-Listing', description: 'Select multiple inventory items and push to all 9 platforms in one click with smart field mapping.', status: 'in_progress', category: 'Cross-Listing', eta: 'Q2 2026', votes: 142 },
        { id: uuidv4(), title: 'AI Price Predictor V2', description: 'Real-time price recommendations using sold comps, demand trends, and seasonal data from all connected platforms.', status: 'in_progress', category: 'AI Features', eta: 'Q2 2026', votes: 118 },
        { id: uuidv4(), title: 'Mobile App (iOS & Android)', description: 'Native app for listing on the go — scan barcodes, snap photos, and publish directly from your phone.', status: 'planned', category: 'Platform', eta: 'Q3 2026', votes: 203 },
        { id: uuidv4(), title: 'Automatic Relisting', description: 'Detect stale listings (no views in N days) and automatically delist, refresh, and relist with updated pricing.', status: 'planned', category: 'Automations', eta: 'Q3 2026', votes: 97 },
        { id: uuidv4(), title: 'Shopify Storefront Sync', description: 'Two-way inventory sync between VaultLister and your Shopify store — quantities, prices, and images stay in sync.', status: 'planned', category: 'Integrations', eta: 'Q4 2026', votes: 85 },
        { id: uuidv4(), title: 'CSV Bulk Import', description: 'Import existing inventory from any spreadsheet with smart column mapping and duplicate detection.', status: 'planned', category: 'Inventory', eta: 'Q3 2026', votes: 76 },
        { id: uuidv4(), title: 'Advanced Analytics Dashboard', description: 'Cohort analysis, sell-through rates, platform ROI comparison, and custom date ranges.', status: 'planned', category: 'Analytics', eta: 'Q4 2026', votes: 64 },
        { id: uuidv4(), title: 'Team Roles & Permissions', description: 'Grant listing agents, virtual assistants, or partners scoped access — view-only, lister, or manager roles.', status: 'planned', category: 'Teams', eta: 'Q4 2026', votes: 52 },
        { id: uuidv4(), title: 'Chrome Extension V2', description: 'One-click listing capture from any marketplace product page — auto-fill title, description, and price.', status: 'completed', category: 'Integrations', eta: 'Q1 2026', votes: 189 },
        { id: uuidv4(), title: 'Poshmark Closet Automation', description: 'Scheduled closet sharing, follow-back, and auto-offer rules that run 24/7 without manual effort.', status: 'completed', category: 'Automations', eta: 'Q1 2026', votes: 167 },
        { id: uuidv4(), title: 'AI Listing Generator', description: 'Generate platform-optimized titles, descriptions, and tags from a photo using Claude AI.', status: 'completed', category: 'AI Features', eta: 'Q1 2026', votes: 155 }
    ];

    for (const f of features) {
        try {
            await query.run(
                `INSERT INTO roadmap_features (id, title, description, status, category, eta, votes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [f.id, f.title, f.description, f.status, f.category, f.eta, f.votes]
            );
        } catch (e) {
            console.error('Roadmap feature insert error:', e.message);
        }
    }

    console.log(`  ✓ Seeded ${features.length} roadmap features`);
}
