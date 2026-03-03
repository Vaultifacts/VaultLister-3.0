'use strict';
// Store (state management, localStorage persistence)
// Extracted from app.js lines 7718-8137

// State Management
// ============================================
const store = {
    state: {
        user: null,
        token: null,
        currentPage: 'dashboard',
        inventory: [
            { id: 'inv-1', title: 'Vintage Levi\'s 501 Jeans', description: 'Classic 501 jeans in excellent vintage condition. Size 32x30.', sku: 'VLJ-001', brand: 'Levi\'s', category: 'Jeans', condition: 'Excellent', size: '32x30', color: 'Blue', purchase_price: 15.00, listing_price: 65.00, quantity: 1, images: '["https://images.unsplash.com/photo-1542272604-787c3835535d?w=400"]', labels: '["vintage", "denim"]', created_at: '2025-12-01T10:00:00Z' },
            { id: 'inv-2', title: 'Nike Air Max 90', description: 'Nike Air Max 90 in white/black colorway. Great condition with minimal wear.', sku: 'NAM-002', brand: 'Nike', category: 'Sneakers', condition: 'Good', size: '10', color: 'White/Black', purchase_price: 45.00, listing_price: 120.00, quantity: 1, images: '["https://images.unsplash.com/photo-1514989940723-e8e51d675571?w=400"]', labels: '["sneakers", "nike"]', created_at: '2025-12-05T14:30:00Z' },
            { id: 'inv-3', title: 'Coach Leather Handbag', description: 'Authentic Coach leather crossbody bag. Brown with gold hardware.', sku: 'CLH-003', brand: 'Coach', category: 'Handbags', condition: 'Excellent', size: 'Medium', color: 'Brown', purchase_price: 25.00, listing_price: 85.00, quantity: 1, images: '["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400"]', labels: '["designer", "leather"]', created_at: '2025-12-10T09:15:00Z' },
            { id: 'inv-4', title: 'Free People Boho Dress', description: 'Beautiful flowy boho dress. Perfect for summer. Size S.', sku: 'FPD-004', brand: 'Free People', category: 'Dresses', condition: 'New with Tags', size: 'S', color: 'Floral', purchase_price: 20.00, listing_price: 55.00, quantity: 1, images: '["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400"]', labels: '["nwt", "boho"]', created_at: '2025-12-15T11:00:00Z' },
            { id: 'inv-5', title: 'Vintage Nirvana Band Tee', description: '1990s Nirvana concert tee. Authentic vintage. Size L.', sku: 'VNT-005', brand: 'Vintage', category: 'T-Shirts', condition: 'Good', size: 'L', color: 'Black', purchase_price: 8.00, listing_price: 55.00, quantity: 1, images: '["https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400"]', labels: '["vintage", "band-tee"]', created_at: '2025-12-20T16:45:00Z' },
            { id: 'inv-6', title: 'Supreme Box Logo Hoodie', description: 'Authentic Supreme box logo hoodie. Red on white. Size M.', sku: 'SBH-006', brand: 'Supreme', category: 'Hoodies', condition: 'Excellent', size: 'M', color: 'White', purchase_price: 180.00, listing_price: 350.00, quantity: 1, images: '["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400"]', labels: '["streetwear", "supreme"]', created_at: '2025-12-22T13:30:00Z' },
            { id: 'inv-7', title: 'Pottery Barn Coffee Table', description: 'Rustic wood coffee table from Pottery Barn. Minor wear.', sku: 'PCT-007', brand: 'Pottery Barn', category: 'Furniture', condition: 'Good', size: '48x24', color: 'Wood', purchase_price: 50.00, listing_price: 175.00, quantity: 1, images: '["https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=400"]', labels: '["furniture", "home"]', created_at: '2025-12-28T10:00:00Z' },
            { id: 'inv-8', title: 'Pokemon Cards Lot', description: 'Lot of 50 vintage Pokemon cards including 5 holos.', sku: 'PKM-008', brand: 'Pokemon', category: 'Collectibles', condition: 'Very Good', size: 'N/A', color: 'Multi', purchase_price: 75.00, listing_price: 275.00, quantity: 1, images: '["https://images.unsplash.com/photo-1613771404721-1f92d799e49f?w=400"]', labels: '["collectibles", "pokemon"]', created_at: '2026-01-02T15:00:00Z' },
            { id: 'inv-9', title: 'Anthropologie Wool Cardigan', description: 'Chunky knit cardigan in oatmeal. Size M. Like new.', sku: 'AWC-009', brand: 'Anthropologie', category: 'Sweaters', condition: 'Like New', size: 'M', color: 'Oatmeal', purchase_price: 18.00, listing_price: 48.00, quantity: 1, images: '["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400"]', labels: '["cozy", "winter"]', created_at: '2026-01-05T09:30:00Z' },
            { id: 'inv-10', title: 'Ray-Ban Wayfarers', description: 'Classic Ray-Ban Wayfarer sunglasses. Black frame.', sku: 'RBW-010', brand: 'Ray-Ban', category: 'Accessories', condition: 'Excellent', size: 'Standard', color: 'Black', purchase_price: 35.00, listing_price: 95.00, quantity: 1, images: '["https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400"]', labels: '["sunglasses", "designer"]', created_at: '2026-01-10T14:00:00Z' }
        ],
        listings: [
            { id: 'lst-1', inventory_id: 'inv-1', platform: 'poshmark', title: 'Vintage Levi\'s 501 Jeans', price: 65.00, status: 'sold', listed_at: '2025-12-05T10:00:00Z', views: 156, likes: 23 },
            { id: 'lst-2', inventory_id: 'inv-2', platform: 'ebay', title: 'Nike Air Max 90 - Size 10', price: 120.00, status: 'active', listed_at: '2025-12-10T14:30:00Z', views: 342, likes: 45 },
            { id: 'lst-3', inventory_id: 'inv-2', platform: 'poshmark', title: 'Nike Air Max 90 - Size 10', price: 125.00, status: 'active', listed_at: '2025-12-10T14:35:00Z', views: 89, likes: 12 },
            { id: 'lst-4', inventory_id: 'inv-3', platform: 'whatnot', title: 'Coach Leather Handbag', price: 85.00, status: 'active', listed_at: '2025-12-15T09:15:00Z', views: 234, likes: 31 },
            { id: 'lst-5', inventory_id: 'inv-4', platform: 'poshmark', title: 'Free People Boho Dress', price: 55.00, status: 'active', listed_at: '2025-12-20T11:00:00Z', views: 178, likes: 28 },
            { id: 'lst-6', inventory_id: 'inv-5', platform: 'depop', title: 'Vintage Nirvana Band Tee', price: 55.00, status: 'sold', listed_at: '2025-12-25T16:45:00Z', views: 412, likes: 67 },
            { id: 'lst-7', inventory_id: 'inv-6', platform: 'shopify', title: 'Supreme Box Logo Hoodie', price: 350.00, status: 'sold', listed_at: '2025-12-28T13:30:00Z', views: 523, likes: 89 },
            { id: 'lst-8', inventory_id: 'inv-7', platform: 'facebook', title: 'Pottery Barn Coffee Table', price: 175.00, status: 'active', listed_at: '2026-01-02T10:00:00Z', views: 156, likes: 8 },
            { id: 'lst-9', inventory_id: 'inv-8', platform: 'ebay', title: 'Pokemon Cards Lot - 50 Cards', price: 275.00, status: 'active', listed_at: '2026-01-05T15:00:00Z', views: 678, likes: 34 },
            { id: 'lst-10', inventory_id: 'inv-9', platform: 'poshmark', title: 'Anthropologie Wool Cardigan', price: 48.00, status: 'active', listed_at: '2026-01-08T09:30:00Z', views: 98, likes: 15 },
            { id: 'lst-11', inventory_id: 'inv-10', platform: 'whatnot', title: 'Ray-Ban Wayfarers Sunglasses', price: 95.00, status: 'active', listed_at: '2026-01-12T14:00:00Z', views: 145, likes: 22 },
            { id: 'lst-12', inventory_id: 'inv-10', platform: 'ebay', title: 'Ray-Ban Wayfarer Sunglasses', price: 99.00, status: 'active', listed_at: '2026-01-12T14:05:00Z', views: 234, likes: 18 }
        ],
        sales: [
            { id: 'sale-1', listing_id: 'lst-1', inventory_id: 'inv-1', platform: 'poshmark', title: 'Vintage Levi\'s 501 Jeans', sale_price: 65.00, buyer: 'fashionista_jane', sold_at: '2026-01-15T10:30:00Z', shipping_cost: 7.45, platform_fee: 13.00, profit: 29.55 },
            { id: 'sale-2', listing_id: 'lst-6', inventory_id: 'inv-5', platform: 'depop', title: 'Vintage Nirvana Band Tee', sale_price: 55.00, buyer: 'y2k_vibes', sold_at: '2026-01-20T14:00:00Z', shipping_cost: 5.50, platform_fee: 5.50, profit: 36.00 },
            { id: 'sale-3', listing_id: 'lst-7', inventory_id: 'inv-6', platform: 'shopify', title: 'Supreme Box Logo Hoodie', sale_price: 350.00, buyer: 'streetwear_king', sold_at: '2026-01-18T16:30:00Z', shipping_cost: 12.00, platform_fee: 31.50, profit: 126.50 },
            { id: 'sale-4', platform: 'poshmark', title: 'Vintage Coach Wallet', sale_price: 42.00, buyer: 'deal_seeker', sold_at: '2026-01-10T09:00:00Z', shipping_cost: 7.45, platform_fee: 8.40, profit: 18.15 },
            { id: 'sale-5', platform: 'ebay', title: 'Patagonia Fleece Jacket', sale_price: 78.00, buyer: 'outdoor_lover', sold_at: '2026-01-05T11:30:00Z', shipping_cost: 9.50, platform_fee: 10.14, profit: 43.36 },
            { id: 'sale-6', platform: 'whatnot', title: 'Kate Spade Crossbody', sale_price: 95.00, buyer: 'bag_collector', sold_at: '2025-12-28T15:00:00Z', shipping_cost: 8.00, platform_fee: 9.50, profit: 52.50 },
            { id: 'sale-7', platform: 'poshmark', title: 'Lululemon Leggings', sale_price: 58.00, buyer: 'yoga_queen', sold_at: '2025-12-20T10:00:00Z', shipping_cost: 7.45, platform_fee: 11.60, profit: 26.95 },
            { id: 'sale-8', platform: 'depop', title: 'Y2K Baby Tee', sale_price: 28.00, buyer: 'retro_style', sold_at: '2025-12-15T14:30:00Z', shipping_cost: 4.50, platform_fee: 2.80, profit: 15.70 },
            { id: 'sale-9', platform: 'ebay', title: 'Vintage Starter Jacket', sale_price: 145.00, buyer: 'sports_fan', sold_at: '2025-12-10T09:00:00Z', shipping_cost: 12.00, platform_fee: 18.85, profit: 89.15 },
            { id: 'sale-10', platform: 'shopify', title: 'Acne Studios Jeans', sale_price: 185.00, buyer: 'denim_head', sold_at: '2025-12-05T16:00:00Z', shipping_cost: 10.00, platform_fee: 16.65, profit: 108.35 }
        ],
        offers: [
            { id: 'offer-1', listing_id: 'lst-2', platform: 'ebay', buyer: 'sneaker_fan', amount: 95.00, status: 'pending', created_at: '2026-01-27T14:00:00Z' },
            { id: 'offer-2', listing_id: 'lst-4', platform: 'whatnot', buyer: 'bag_lover', amount: 70.00, status: 'pending', created_at: '2026-01-26T10:30:00Z' },
            { id: 'offer-3', listing_id: 'lst-9', platform: 'ebay', buyer: 'card_trader', amount: 225.00, status: 'countered', created_at: '2026-01-25T16:00:00Z' },
            { id: 'offer-4', listing_id: 'lst-5', platform: 'poshmark', buyer: 'boho_chic', amount: 40.00, status: 'declined', created_at: '2026-01-24T11:00:00Z' }
        ],
        orders: [
            { id: 'ord-1', platform: 'poshmark', status: 'delivered', buyer_username: 'fashionista_jane', item_title: 'Vintage Levi\'s 501 Jeans', sale_price: 65.00, shipping_method: 'USPS Priority Mail', tracking_number: '9400111899223456789012', carrier: 'USPS', expected_arrival: '2026-01-20', created_at: '2026-01-15T10:30:00Z', shipped_at: '2026-01-16T14:00:00Z', delivered_at: '2026-01-20T11:30:00Z' },
            { id: 'ord-2', platform: 'ebay', status: 'shipped', buyer_username: 'sneaker_collector', item_title: 'Nike Air Max 90 - Size 10', sale_price: 120.00, shipping_method: 'UPS Ground', tracking_number: '1Z999AA10123456784', carrier: 'UPS', expected_arrival: '2026-01-30', created_at: '2026-01-25T09:15:00Z', shipped_at: '2026-01-26T16:00:00Z' },
            { id: 'ord-3', platform: 'whatnot', status: 'shipped', buyer_username: 'vintage_lover', item_title: 'Coach Leather Handbag', sale_price: 85.00, shipping_method: 'USPS Flat Rate', tracking_number: '9400128206335604529118', carrier: 'USPS', expected_arrival: '2026-02-03', created_at: '2026-01-27T14:20:00Z', shipped_at: '2026-01-28T10:00:00Z' },
            { id: 'ord-4', platform: 'poshmark', status: 'pending', buyer_username: 'deal_hunter22', item_title: 'Free People Boho Dress', sale_price: 45.00, shipping_method: 'USPS Priority Mail', tracking_number: null, carrier: null, expected_arrival: null, created_at: '2026-01-28T08:45:00Z' },
            { id: 'ord-5', platform: 'depop', status: 'shipped', buyer_username: 'y2k_vibes', item_title: 'Vintage Band Tee - Nirvana', sale_price: 55.00, shipping_method: 'USPS First Class', tracking_number: '9261290100130739438856', carrier: 'USPS', expected_arrival: '2026-02-01', created_at: '2026-01-24T11:00:00Z', shipped_at: '2026-01-25T10:30:00Z' },
            { id: 'ord-6', platform: 'shopify', status: 'delivered', buyer_username: 'streetwear_king', item_title: 'Supreme Box Logo Hoodie', sale_price: 350.00, shipping_method: 'UPS 2-Day Air', tracking_number: '1Z999AA10123456785', carrier: 'UPS', expected_arrival: '2026-01-22', created_at: '2026-01-18T16:30:00Z', shipped_at: '2026-01-19T09:00:00Z', delivered_at: '2026-01-22T14:00:00Z' },
            { id: 'ord-7', platform: 'facebook', status: 'delivered', buyer_username: 'local_buyer', item_title: 'Pottery Barn Coffee Table', sale_price: 150.00, shipping_method: 'Local Pickup', tracking_number: null, carrier: 'Local Pickup', expected_arrival: '2026-01-29', created_at: '2026-01-27T19:00:00Z', delivered_at: '2026-01-29T14:00:00Z' },
            { id: 'ord-8', platform: 'ebay', status: 'pending', buyer_username: 'collector_mike', item_title: 'Vintage Pokemon Cards Lot', sale_price: 275.00, shipping_method: 'USPS Flat Rate', tracking_number: null, carrier: null, expected_arrival: null, created_at: '2026-01-28T07:30:00Z' }
        ],
        comparisonPeriod: 'week',
        shops: [],
        automations: [],
        deletedItems: [],
        analyticsData: {
            stats: {
                totalRevenue: 4856.00,
                totalProfit: 2145.50,
                totalSales: 47,
                avgSalePrice: 103.32,
                itemsSold: 47,
                activeListings: 28,
                conversionRate: 12.4,
                avgDaysToSell: 8.3
            }
        },
        salesAnalytics: {
            salesData: [
                { date: '2025-01-01', revenue: 245, sales: 3 },
                { date: '2025-01-15', revenue: 312, sales: 4 },
                { date: '2025-02-01', revenue: 189, sales: 2 },
                { date: '2025-02-15', revenue: 456, sales: 5 },
                { date: '2025-03-01', revenue: 278, sales: 3 },
                { date: '2025-03-15', revenue: 523, sales: 6 },
                { date: '2025-04-01', revenue: 345, sales: 4 },
                { date: '2025-04-15', revenue: 412, sales: 5 },
                { date: '2025-05-01', revenue: 289, sales: 3 },
                { date: '2025-05-15', revenue: 567, sales: 6 },
                { date: '2025-06-01', revenue: 423, sales: 5 },
                { date: '2025-06-15', revenue: 378, sales: 4 },
                { date: '2025-07-01', revenue: 512, sales: 6 },
                { date: '2025-07-15', revenue: 445, sales: 5 },
                { date: '2025-08-01', revenue: 389, sales: 4 },
                { date: '2025-08-15', revenue: 623, sales: 7 },
                { date: '2025-09-01', revenue: 456, sales: 5 },
                { date: '2025-09-15', revenue: 534, sales: 6 },
                { date: '2025-10-01', revenue: 478, sales: 5 },
                { date: '2025-10-15', revenue: 612, sales: 7 },
                { date: '2025-11-01', revenue: 523, sales: 6 },
                { date: '2025-11-15', revenue: 689, sales: 8 },
                { date: '2025-12-01', revenue: 845, sales: 10 },
                { date: '2025-12-15', revenue: 756, sales: 9 },
                { date: '2026-01-01', revenue: 523, sales: 6 },
                { date: '2026-01-15', revenue: 612, sales: 7 }
            ],
            byPlatform: [
                { platform: 'poshmark', revenue: 1845.00, sales: 18, avgPrice: 102.50, color: '#AC1A2F' },
                { platform: 'ebay', revenue: 1234.00, sales: 12, avgPrice: 102.83, color: '#E53238' },
                { platform: 'whatnot', revenue: 756.00, sales: 8, avgPrice: 94.50, color: '#FF3B58' },
                { platform: 'depop', revenue: 423.00, sales: 5, avgPrice: 84.60, color: '#FF2300' },
                { platform: 'shopify', revenue: 535.00, sales: 3, avgPrice: 178.33, color: '#000000' },
                { platform: 'facebook', revenue: 63.00, sales: 1, avgPrice: 63.00, color: '#1877F2' }
            ]
        },
        notifications: [
            { id: 'notif-1', title: 'Item Sold!', message: 'Your "Vintage Levi\'s 501 Jeans" sold for $65.00 on Poshmark', type: 'success', time: '2 hours ago', read: false, important: true },
            { id: 'notif-2', title: 'New Offer Received', message: 'You received a $45 offer on "Nike Air Max 90" from buyer_123', type: 'primary', time: '5 hours ago', read: false, important: false },
            { id: 'notif-3', title: 'Listing Expiring Soon', message: '3 listings on eBay will expire in 24 hours', type: 'warning', time: 'Yesterday', read: false, important: true },
            { id: 'notif-4', title: 'Shop Sync Complete', message: 'Successfully synced 42 listings from Poshmark', type: 'success', time: 'Yesterday', read: true, important: false },
            { id: 'notif-5', title: 'Price Drop Alert', message: 'A competitor lowered their price on similar items', type: 'primary', time: '2 days ago', read: true, important: false },
            { id: 'notif-6', title: 'Inventory Low', message: 'You have 3 items with low stock levels', type: 'warning', time: '3 days ago', read: true, important: false },
            { id: 'notif-7', title: 'Weekly Analytics Ready', message: 'Your weekly performance report is available', type: 'primary', time: '4 days ago', read: true, important: false },
            { id: 'notif-8', title: 'Stale Listing Detected', message: '5 listings haven\'t sold in 30+ days - consider relisting', type: 'warning', time: '5 days ago', read: true, important: false }
        ],
        selectedItems: [],
        searchTerm: '',
        activeFilters: {},
        darkMode: false,
        isLoading: false,
        isOffline: !navigator.onLine,
        sidebarOpen: false,
        sidebarCollapsed: false,  // NEW - for collapsible navigation
        sidebarScrollPos: 0,  // Track sidebar scroll position during navigation
        analyticsPeriod: '30d',  // Default analytics timeline
        sizeChartSwapped: true,  // Default to swapped axis for better readability

        // Image Bank state
        imageBankImages: [],
        imageBankFolders: [],
        selectedFolder: null,
        selectedImages: [],
        imageBankFilters: {},
        imageBankViewMode: 'grid',  // 'grid' or 'list'

        // Community state
        communityTab: 'discussion',  // 'discussion', 'success', 'tips', 'leaderboard'
        communityPosts: [
            { id: 'post-1', type: 'discussion', author: 'ResellerPro', avatar: 'R', title: 'Best time to share on Poshmark?', content: 'I\'ve been experimenting with different sharing times. Has anyone found the optimal time to share for maximum visibility?', likes: 24, comments: 12, created_at: '2026-01-27T14:00:00Z' },
            { id: 'post-2', type: 'success', author: 'VintageQueen', avatar: 'V', title: 'Hit $10K in January!', content: 'So excited to share that I just crossed $10K in sales this month! My best month ever. Consistency is key!', likes: 156, comments: 34, created_at: '2026-01-26T10:30:00Z' },
            { id: 'post-3', type: 'tip', author: 'ThriftMaster', avatar: 'T', title: 'Photography tip for beginners', content: 'Use natural light and a clean white background. I use a $20 poster board and it makes a huge difference in my photos!', likes: 89, comments: 15, created_at: '2026-01-25T16:00:00Z' },
            { id: 'post-4', type: 'discussion', author: 'NewSeller2026', avatar: 'N', title: 'Cross-listing strategy question', content: 'Do you list on all platforms at once, or stagger your listings? What works best for you?', likes: 18, comments: 22, created_at: '2026-01-24T11:00:00Z' },
            { id: 'post-5', type: 'success', author: 'SneakerFlip', avatar: 'S', title: 'Sold my first $500+ item!', content: 'Finally sold a pair of rare Jordans for $520! The patience paid off. Never drop your prices too quickly!', likes: 203, comments: 45, created_at: '2026-01-23T09:15:00Z' },
            { id: 'post-6', type: 'tip', author: 'BundleQueen', avatar: 'B', title: 'How I increased my bundle rate', content: 'I started messaging buyers who like 2+ items with a personalized bundle offer. My bundle conversion went up 40%!', likes: 112, comments: 28, created_at: '2026-01-22T14:30:00Z' }
        ],
        leaderboard: [
            { rank: 1, username: 'VintageQueen', avatar: 'V', sales: 156, revenue: 12450, badge: 'gold' },
            { rank: 2, username: 'SneakerFlip', avatar: 'S', sales: 98, revenue: 9870, badge: 'gold' },
            { rank: 3, username: 'ThriftMaster', avatar: 'T', sales: 87, revenue: 6540, badge: 'silver' },
            { rank: 4, username: 'ResellerPro', avatar: 'R', sales: 76, revenue: 5890, badge: 'silver' },
            { rank: 5, username: 'BundleQueen', avatar: 'B', sales: 65, revenue: 4320, badge: 'bronze' },
            { rank: 6, username: 'DesignerDeals', avatar: 'D', sales: 54, revenue: 8900, badge: 'bronze' },
            { rank: 7, username: 'Y2KCollector', avatar: 'Y', sales: 48, revenue: 2890, badge: 'bronze' },
            { rank: 8, username: 'NewSeller2026', avatar: 'N', sales: 12, revenue: 890, badge: null }
        ],

        // Help & Support state
        helpFAQs: [
            { id: 'faq-1', question: 'How do I add items to my inventory?', answer: 'Navigate to the Inventory page and click "Add Item". Fill out the item details including title, description, price, and photos. You can also use the AI Listing Generator to automatically generate descriptions from your photos.', category: 'inventory', helpful_count: 45 },
            { id: 'faq-2', question: 'How does cross-listing work?', answer: 'Cross-listing allows you to list the same item on multiple marketplaces at once. Go to the Cross-List page, select the item you want to list, choose your target platforms, and click "Cross-List". VaultLister will create listings on each selected platform.', category: 'listings', helpful_count: 38 },
            { id: 'faq-3', question: 'Can I use VaultLister offline?', answer: 'Yes! VaultLister is a Progressive Web App (PWA) that works offline. Your data is stored locally on your device. Any changes made offline will sync when you reconnect to the internet.', category: 'general', helpful_count: 52 },
            { id: 'faq-4', question: 'How do I connect my marketplace accounts?', answer: 'Go to My Shops page and click "Connect" next to the marketplace you want to add. Follow the OAuth flow to authorize VaultLister to access your account. Your credentials are encrypted and stored securely.', category: 'platforms', helpful_count: 31 },
            { id: 'faq-5', question: 'What is the AI Listing Generator?', answer: 'The AI Listing Generator uses Claude AI to analyze your product photos and automatically generate titles, descriptions, and suggested prices. Simply upload photos and click "Generate" to get AI-powered listing content.', category: 'ai', helpful_count: 67 },
            { id: 'faq-6', question: 'How do automations work?', answer: 'Automations run scheduled tasks on your connected marketplace accounts. You can enable pre-built automations like "Daily Closet Share" for Poshmark or create custom rules. Configure scheduling in the Automations page.', category: 'automation', helpful_count: 29 },
            { id: 'faq-7', question: 'Is my data secure?', answer: 'Yes, your data is stored locally on your device by default and never leaves without your consent. Passwords are encrypted with bcrypt, API tokens use AES-256 encryption, and all connections use HTTPS.', category: 'security', helpful_count: 41 },
            { id: 'faq-8', question: 'How do I track my sales and profits?', answer: 'Use the Analytics page to view your sales performance, revenue trends, and profit margins. The Financials page provides detailed purchase tracking, COGS calculation, and P&L reports.', category: 'analytics', helpful_count: 36 }
        ],
        helpArticles: [
            { id: 'art-1', slug: 'getting-started', title: 'Getting Started with VaultLister', excerpt: 'A complete guide to setting up your account and making your first listing.', category: 'Getting Started', view_count: 1234, helpful_count: 89, tags: ['beginner', 'setup', 'tutorial'] },
            { id: 'art-2', slug: 'inventory-management', title: 'Mastering Inventory Management', excerpt: 'Learn how to efficiently organize, track, and manage your inventory.', category: 'Inventory', view_count: 892, helpful_count: 67, tags: ['inventory', 'organization', 'bulk-edit'] },
            { id: 'art-3', slug: 'cross-listing-guide', title: 'Cross-Listing Best Practices', excerpt: 'Tips and strategies for successfully cross-listing across multiple platforms.', category: 'Listings', view_count: 1567, helpful_count: 112, tags: ['cross-listing', 'platforms', 'strategy'] },
            { id: 'art-4', slug: 'ai-features', title: 'Using AI Features Effectively', excerpt: 'Maximize the power of AI for listing generation, pricing, and photo editing.', category: 'AI & Automation', view_count: 743, helpful_count: 54, tags: ['ai', 'listing-generator', 'automation'] },
            { id: 'art-5', slug: 'poshmark-automation', title: 'Poshmark Automation Guide', excerpt: 'Set up and optimize automations for sharing, following, and sending offers.', category: 'Automation', view_count: 2103, helpful_count: 156, tags: ['poshmark', 'automation', 'sharing'] },
            { id: 'art-6', slug: 'analytics-reporting', title: 'Understanding Your Analytics', excerpt: 'How to read and interpret your sales data, trends, and performance metrics.', category: 'Analytics', view_count: 621, helpful_count: 43, tags: ['analytics', 'reports', 'metrics'] },
            { id: 'art-7', slug: 'photo-editing', title: 'Photo Editing with Cloudinary', excerpt: 'Use AI-powered tools to remove backgrounds, enhance images, and optimize for platforms.', category: 'Images', view_count: 534, helpful_count: 38, tags: ['photos', 'cloudinary', 'editing'] },
            { id: 'art-8', slug: 'shipping-profiles', title: 'Setting Up Shipping Profiles', excerpt: 'Create reusable shipping configurations for different carriers and platforms.', category: 'Shipping', view_count: 412, helpful_count: 29, tags: ['shipping', 'profiles', 'carriers'] }
        ],
        supportTickets: [],
        selectedTicket: null,
        helpSearchQuery: '',
        helpCategory: null,

        // Financials state
        financialsTab: 'accounts',
        financialStatementsSubTab: 'income',
        listingsTab: 'listings',
        purchases: [
            { id: 'pur-1', date: '2025-12-01', vendor: 'Goodwill', description: 'Vintage Levi\'s 501 Jeans', category: 'Inventory', amount: 15.00, payment_method: 'Cash', receipt_id: null },
            { id: 'pur-2', date: '2025-12-05', vendor: 'Plato\'s Closet', description: 'Nike Air Max 90', category: 'Inventory', amount: 45.00, payment_method: 'Debit Card', receipt_id: null },
            { id: 'pur-3', date: '2025-12-10', vendor: 'Estate Sale', description: 'Coach Leather Handbag', category: 'Inventory', amount: 25.00, payment_method: 'Cash', receipt_id: null },
            { id: 'pur-4', date: '2025-12-15', vendor: 'ThredUp', description: 'Free People Boho Dress', category: 'Inventory', amount: 20.00, payment_method: 'Credit Card', receipt_id: null },
            { id: 'pur-5', date: '2025-12-20', vendor: 'Garage Sale', description: 'Vintage Nirvana Band Tee', category: 'Inventory', amount: 8.00, payment_method: 'Cash', receipt_id: null },
            { id: 'pur-6', date: '2025-12-22', vendor: 'Grailed', description: 'Supreme Box Logo Hoodie', category: 'Inventory', amount: 180.00, payment_method: 'PayPal', receipt_id: null },
            { id: 'pur-7', date: '2025-12-28', vendor: 'Facebook Marketplace', description: 'Pottery Barn Coffee Table', category: 'Inventory', amount: 50.00, payment_method: 'Cash', receipt_id: null },
            { id: 'pur-8', date: '2026-01-02', vendor: 'eBay', description: 'Pokemon Cards Lot', category: 'Inventory', amount: 75.00, payment_method: 'PayPal', receipt_id: null },
            { id: 'pur-9', date: '2026-01-05', vendor: 'USPS', description: 'Shipping Supplies - Boxes', category: 'Supplies', amount: 34.50, payment_method: 'Credit Card', receipt_id: null },
            { id: 'pur-10', date: '2026-01-10', vendor: 'Amazon', description: 'Poly Mailers 100 Pack', category: 'Supplies', amount: 18.99, payment_method: 'Credit Card', receipt_id: null },
            { id: 'pur-11', date: '2026-01-15', vendor: 'Staples', description: 'Printer Paper & Labels', category: 'Supplies', amount: 24.99, payment_method: 'Credit Card', receipt_id: null },
            { id: 'pur-12', date: '2026-01-20', vendor: 'Phone Bill', description: 'Business Phone Line', category: 'Operating Expenses', amount: 45.00, payment_method: 'Auto Pay', receipt_id: null }
        ],
        accounts: [
            { id: 'acc-1', name: 'Inventory Purchases', type: 'Asset', subtype: 'Inventory', balance: 418.00, description: 'Cost of goods purchased for resale' },
            { id: 'acc-2', name: 'Sales Revenue', type: 'Revenue', subtype: 'Sales', balance: 4856.00, description: 'Income from sales' },
            { id: 'acc-3', name: 'Shipping Supplies', type: 'Expense', subtype: 'Cost of Goods', balance: 78.48, description: 'Shipping materials and supplies' },
            { id: 'acc-4', name: 'Platform Fees', type: 'Expense', subtype: 'Fees', balance: 567.89, description: 'Marketplace selling fees' },
            { id: 'acc-5', name: 'Shipping Costs', type: 'Expense', subtype: 'Shipping', balance: 234.50, description: 'Postage and shipping expenses' },
            { id: 'acc-6', name: 'Operating Expenses', type: 'Expense', subtype: 'Operating', balance: 45.00, description: 'Business operating costs' },
            { id: 'acc-7', name: 'PayPal Balance', type: 'Asset', subtype: 'Cash', balance: 1245.67, description: 'PayPal account balance' },
            { id: 'acc-8', name: 'Business Checking', type: 'Asset', subtype: 'Cash', balance: 3456.78, description: 'Main business checking account' }
        ],
        financialTransactions: [],
        financialStatements: null,
        profitLossReport: null,

        // Analytics enhancement
        analyticsTab: 'graphs',
        analyticsReportsSubTab: 'errors',  // Sub-tab for Reports: 'errors', 'supplier', 'turnover', 'custom'
        salesDateStart: null,
        salesDateEnd: null,
        chartDisplayModes: {}, // Stores chart type preference per chartId (e.g., { 'platformRevenue': 'bar' })

        // Settings enhancement
        originalSettings: null,

        // Shipping Profiles state
        shippingProfiles: [],

        // Listing Templates
        templates: [
            { id: 'tpl-1', name: 'Vintage Clothing', category: 'Clothing', description: 'Template for vintage apparel listings', title_pattern: 'Vintage {brand} {item} - {size} - {era}', pricing_strategy: 'Markup', markup_percentage: 200, tags: ['vintage', 'retro', 'clothing', 'thrift'], is_favorite: true, use_count: 34, created_at: '2025-11-15T10:00:00Z' },
            { id: 'tpl-2', name: 'Sneaker Resale', category: 'Sneakers', description: 'Optimized for sneaker flips with key details', title_pattern: '{brand} {model} - Size {size} - {colorway}', pricing_strategy: 'Market Comp', markup_percentage: 80, tags: ['sneakers', 'kicks', 'shoes', 'athletic', 'nike', 'jordan'], is_favorite: true, use_count: 52, created_at: '2025-11-20T14:30:00Z' },
            { id: 'tpl-3', name: 'Designer Handbags', category: 'Designer', description: 'Luxury bag listings with authentication details', title_pattern: 'Authentic {brand} {model} - {color} - {condition}', pricing_strategy: 'Comp Analysis', markup_percentage: 150, tags: ['designer', 'luxury', 'handbag', 'authentic', 'purse'], is_favorite: false, use_count: 18, created_at: '2025-12-01T09:00:00Z' },
            { id: 'tpl-4', name: 'Electronics & Gadgets', category: 'Electronics', description: 'Consumer electronics with specs and condition', title_pattern: '{brand} {model} {storage} - {condition} - {accessories}', pricing_strategy: 'Markup', markup_percentage: 60, tags: ['electronics', 'tech', 'gadgets', 'phones', 'tablets'], is_favorite: false, use_count: 11, created_at: '2025-12-10T16:00:00Z' },
            { id: 'tpl-5', name: 'Home & Decor', category: 'Home', description: 'Furniture and home goods with dimensions', title_pattern: '{brand} {item} - {material} - {dimensions}', pricing_strategy: 'Markup', markup_percentage: 120, tags: ['home', 'decor', 'furniture', 'vintage-home', 'farmhouse'], is_favorite: false, use_count: 7, created_at: '2025-12-20T11:30:00Z' },
            { id: 'tpl-6', name: 'Streetwear Bundle', category: 'Clothing', description: 'Hype streetwear items with brand focus', title_pattern: '{brand} {item} - {size} - {season} {year}', pricing_strategy: 'Market Comp', markup_percentage: 100, tags: ['streetwear', 'hype', 'supreme', 'bape', 'palace'], is_favorite: true, use_count: 28, created_at: '2026-01-05T13:00:00Z' }
        ],

        // Photo Editor (Cloudinary) state
        photoEditorOpen: false,
        photoEditorImageId: null,
        photoEditorImage: null,
        photoEditorTransformations: {
            removeBackground: false,
            enhance: false,
            upscale: false,
            cropWidth: null,
            cropHeight: null,
            cropPreset: null
        },
        photoEditorPreviewUrl: null,
        photoEditorLoading: false,
        cloudinaryConfigured: null,
        cloudinaryCloudName: null,

        // SKU Rules state
        skuRules: [],
        selectedSkuRule: null,
        skuRulePreview: null,
        skuBatchProgress: null,
        defaultSkuRule: null,

        // Receipt Parser state
        receiptQueue: [],
        receiptVendors: [],
        selectedReceipt: null,
        receiptParsing: false,
        receiptUploadProgress: null,
        emailAccounts: [],
        emailConnecting: false,

        // Batch Photo Processing state
        batchPhotoJobs: [],
        batchPhotoPresets: [],
        batchPhotoModalOpen: false,
        batchPhotoSelectedImages: [],  // Selected image IDs for batch processing
        batchPhotoTransformations: {
            removeBackground: false,
            enhance: false,
            upscale: false,
            cropWidth: null,
            cropHeight: null,
            cropPreset: null
        },
        batchPhotoProgress: null,  // { jobId, total, processed, failed, status }
        batchPhotoActivePollInterval: null,  // For polling progress

        // Vault Buddy (Chatbot) state
        vaultBuddyOpen: false,
        vaultBuddyTab: 'home',
        vaultBuddyConversations: [],
        vaultBuddyConversationsLoaded: false,
        vaultBuddyCurrentConversation: null,
        vaultBuddyMessages: [],
        vaultBuddyLoading: false,

        // Roadmap state
        roadmapFilter: 'all',
        roadmapFeatures: [
            { id: 'rf-1', title: 'Mobile App (iOS & Android)', description: 'Native mobile apps for managing inventory on the go with camera integration for quick photo uploads.', status: 'planned', category: 'Mobile', votes: 156, eta: 'Q3 2026', comments: 24, user_voted: false },
            { id: 'rf-2', title: 'Multi-user Team Support', description: 'Invite team members, assign roles, and collaborate on inventory management.', status: 'planned', category: 'Collaboration', votes: 89, eta: 'Q4 2026', comments: 12, user_voted: false },
            { id: 'rf-3', title: 'Etsy Integration', description: 'Cross-list to Etsy marketplace with full sync support.', status: 'in_progress', category: 'Platforms', votes: 234, eta: 'Q2 2026', comments: 45, user_voted: false },
            { id: 'rf-4', title: 'Whatnot Live Selling', description: 'Integration with Whatnot for live selling events and inventory sync.', status: 'planned', category: 'Platforms', votes: 178, eta: 'Q3 2026', comments: 31, user_voted: false },
            { id: 'rf-5', title: 'Bulk Label Printing', description: 'Generate and print shipping labels in bulk for multiple orders.', status: 'in_progress', category: 'Shipping', votes: 145, eta: 'Q1 2026', comments: 19, user_voted: false },
            { id: 'rf-6', title: 'Advanced Analytics Dashboard', description: 'More detailed analytics with customizable widgets, export options, and trend predictions.', status: 'completed', category: 'Analytics', votes: 267, eta: 'Completed', comments: 52, user_voted: true },
            { id: 'rf-7', title: 'AI-Powered Pricing Suggestions', description: 'Get AI recommendations for optimal pricing based on market data and sold comparables.', status: 'in_progress', category: 'AI Features', votes: 198, eta: 'Q1 2026', comments: 28, user_voted: false },
            { id: 'rf-8', title: 'Automated Relisting', description: 'Automatically relist stale items on a schedule with price adjustments.', status: 'completed', category: 'Automation', votes: 312, eta: 'Completed', comments: 67, user_voted: true },
            { id: 'rf-9', title: 'Inventory Import from Spreadsheets', description: 'Bulk import inventory from CSV/Excel files with field mapping.', status: 'completed', category: 'Import/Export', votes: 189, eta: 'Completed', comments: 23, user_voted: false },
            { id: 'rf-10', title: 'Real-time Webhook Notifications', description: 'Instant notifications when items sell or receive offers via webhooks.', status: 'planned', category: 'Integrations', votes: 112, eta: 'Q2 2026', comments: 15, user_voted: false },
            { id: 'rf-11', title: 'Custom Reporting Builder', description: 'Build custom reports with drag-and-drop widgets and scheduled email delivery.', status: 'planned', category: 'Analytics', votes: 76, eta: 'Q4 2026', comments: 8, user_voted: false },
            { id: 'rf-12', title: 'Supplier Management', description: 'Track suppliers, manage purchase orders, and monitor sourcing costs.', status: 'planned', category: 'Inventory', votes: 134, eta: 'Q3 2026', comments: 21, user_voted: false }
        ],

        // User Feedback state
        userFeedback: [
            { id: 'uf-1', type: 'feature', title: 'Add Whatnot integration', category: 'integration', description: 'Would love to be able to cross-list directly to Whatnot for live selling events.', status: 'planned', admin_response: 'Great suggestion! Whatnot integration is on our roadmap for Q2 2026.', created_at: '2026-01-15T10:30:00Z' },
            { id: 'uf-2', type: 'improvement', title: 'Faster bulk editing', category: 'ui', description: 'The bulk edit feature is great but could be faster. Would love to see lazy loading for large inventories.', status: 'reviewing', admin_response: null, created_at: '2026-01-20T14:45:00Z' },
            { id: 'uf-3', type: 'bug', title: 'Image upload sometimes fails', category: 'inventory', description: 'When uploading multiple images at once, sometimes one or two fail to upload. Have to retry manually.', status: 'completed', admin_response: 'Fixed in v1.5.2! We improved the upload queue to handle concurrent uploads more reliably.', created_at: '2026-01-10T09:15:00Z' },
            { id: 'uf-4', type: 'general', title: 'Love the dark mode!', category: 'ui', description: 'Just wanted to say the dark mode looks amazing. Very easy on the eyes for late night listing sessions.', status: 'completed', admin_response: 'Thank you so much! We worked hard on the dark mode design. Glad you enjoy it!', created_at: '2026-01-05T22:00:00Z' },
            { id: 'uf-5', type: 'feature', title: 'Barcode/UPC scanner for quick listing', category: 'inventory', description: 'Would be amazing if we could scan barcodes with our phone camera to auto-fill product details from a database. Would save so much time when listing items!', status: 'pending', admin_response: null, created_at: '2026-01-22T11:20:00Z' },
            { id: 'uf-6', type: 'improvement', title: 'eBay promoted listings management', category: 'integration', description: 'It would be great to manage eBay promoted listing rates directly from VaultLister instead of going to eBay Seller Hub.', status: 'planned', admin_response: 'This is coming in our next major update! Thanks for the suggestion.', created_at: '2026-01-12T13:30:00Z' },
            { id: 'uf-7', type: 'bug', title: 'Analytics graphs not updating with timeline filter', category: 'analytics', description: 'When I change the timeline filter on the analytics page from "Last 30 Days" to "Last 7 Days", the graphs do not update and the dropdown still shows the old value.', status: 'reviewing', admin_response: 'We are investigating this issue. Thanks for the detailed report!', created_at: '2026-01-25T16:00:00Z' },
            { id: 'uf-8', type: 'feature', title: 'Auto-share to multiple platforms', category: 'automation', description: 'Would love a feature to share all my active listings across Poshmark, Mercari, and eBay with one click. Currently have to do each platform manually.', status: 'planned', admin_response: 'Multi-platform auto-share is on our roadmap for Q2 2026!', created_at: '2026-01-18T14:30:00Z' },
            { id: 'uf-9', type: 'improvement', title: 'Add profit margin percentage to analytics', category: 'analytics', description: 'The analytics page shows total profit, but it would be helpful to see profit margin as a percentage alongside the dollar amount.', status: 'completed', admin_response: 'Added in version 1.4.0! Check your analytics dashboard.', created_at: '2026-01-08T09:15:00Z' },
            { id: 'uf-10', type: 'general', title: 'Excellent customer support experience', category: 'other', description: 'Had an issue with my account and reached out to support. Got a response within an hour and the problem was fixed immediately. Great team!', status: 'completed', admin_response: 'We really appreciate you taking the time to share this! Our support team works hard to provide fast resolutions.', created_at: '2026-01-03T18:45:00Z' }
        ],
        feedbackFormType: 'feature',
        feedbackFormCategory: '',

        // Phase 4 Intelligence state
        heatmapData: { grid: [], peakTimes: [] },
        predictions: [],
        demandForecasts: [],
        suppliers: [],
        supplierItems: [],
        competitors: [],
        competitorListings: [],
        marketInsights: [],
        heatmapDays: 30,
        heatmapPlatform: '',

        // Webhooks state
        webhookEndpoints: [],
        webhookEvents: [],
        webhookEventTypes: [],

        // Push notification state
        pushSubscriptions: [],
        pushSettings: { enabled: true, categories: { sales: true, offers: true, orders: true, sync: false, marketing: false } },
        pushSubscribed: false
    },
    subscribers: [],

    setState(updates) {
        Object.assign(this.state, updates);
        this.notify();
        this.persist();
    },

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    },

    notify() {
        this.subscribers.forEach(cb => cb(this.state));
    },

    persist() {
        // When logged out, never re-write auth keys — any post-logout setState
        // (e.g. router updating currentPage) must not resurrect vaultlister_state.
        if (!this.state.token && !this.state.user) {
            localStorage.removeItem('vaultlister_state');
            sessionStorage.removeItem('vaultlister_state');
            return;
        }
        const toPersist = {
            user: this.state.user,
            token: this.state.token,
            refreshToken: this.state.refreshToken
        };
        const storage = this.state.useSessionStorage ? sessionStorage : localStorage;
        storage.setItem('vaultlister_state', JSON.stringify(toPersist));
    },

    hydrate() {
        try {
            // Try sessionStorage first (non-remembered sessions), then localStorage
            let saved = sessionStorage.getItem('vaultlister_state');
            if (saved) {
                this.state.useSessionStorage = true;
            } else {
                saved = localStorage.getItem('vaultlister_state');
            }
            if (saved) {
                const parsed = JSON.parse(saved);
                const allowed = ['user', 'token', 'refreshToken', 'useSessionStorage'];
                for (const key of allowed) {
                    if (key in parsed) this.state[key] = parsed[key];
                }
            }
            const savedVotes = localStorage.getItem('vaultlister_changelog_votes');
            if (savedVotes) this.state.changelogVotes = JSON.parse(savedVotes);
        } catch (e) {
            console.error('Failed to hydrate state:', e);
        }
    }
};
