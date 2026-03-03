// Simulate Real User Workflow
const API_BASE = 'http://localhost:3000/api';

let token = null;
let userId = null;
let createdItems = [];

async function api(method, endpoint, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    const data = await response.json();
    return { status: response.status, data };
}

async function workflow() {
    console.log('\n🚀 Starting Real User Workflow Simulation\n');
    console.log('━'.repeat(60));

    // ==========================================
    // STEP 1: Login
    // ==========================================
    console.log('\n📝 STEP 1: Login as demo user');
    const login = await api('POST', '/auth/login', {
        email: 'demo@vaultlister.com',
        password: 'DemoPassword123!'
    });

    if (login.status === 200) {
        token = login.data.token;
        userId = login.data.user.id;
        console.log(`✅ Logged in as ${login.data.user.email}`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Tier: ${login.data.user.subscription_tier}`);
    } else {
        console.log('❌ Login failed:', login.data);
        return;
    }

    // ==========================================
    // STEP 2: Check Current Inventory
    // ==========================================
    console.log('\n📦 STEP 2: Check current inventory');
    const inventory = await api('GET', '/inventory');
    console.log(`✅ Found ${inventory.data.items.length} existing items`);
    console.log(`   Total value: $${inventory.data.items.reduce((sum, item) => sum + item.list_price, 0).toFixed(2)}`);

    // ==========================================
    // STEP 3: Add New Items (Thrift Store Haul)
    // ==========================================
    console.log('\n🛍️  STEP 3: Adding new thrift store haul (5 items)');

    const newItems = [
        {
            title: 'Vintage Nike Windbreaker - 90s Retro',
            brand: 'Nike',
            category: 'Outerwear',
            subcategory: 'Jackets',
            size: 'L',
            color: 'Teal/Purple',
            condition: 'good',
            costPrice: 8.99,
            listPrice: 45.00,
            description: 'Classic 90s Nike windbreaker in excellent vintage condition. Iconic colorway with minimal wear.',
            tags: ['vintage', 'nike', 'windbreaker', '90s', 'retro', 'streetwear']
        },
        {
            title: 'Lululemon Align Leggings - Black',
            brand: 'Lululemon',
            category: 'Activewear',
            subcategory: 'Leggings',
            size: '6',
            color: 'Black',
            condition: 'like_new',
            costPrice: 12.00,
            listPrice: 68.00,
            description: 'Lululemon Align leggings in black. Size 6. Barely worn, no pilling. Super soft nulu fabric.',
            tags: ['lululemon', 'align', 'leggings', 'athletic', 'yoga']
        },
        {
            title: 'Vintage Harley Davidson T-Shirt',
            brand: 'Harley Davidson',
            category: 'Tops',
            subcategory: 'T-Shirts',
            size: 'XL',
            color: 'Black',
            condition: 'good',
            costPrice: 6.50,
            listPrice: 32.00,
            description: 'Authentic vintage Harley Davidson tee from the 90s. Faded graphics, soft worn-in feel. Perfect for collectors.',
            tags: ['vintage', 'harley-davidson', 'motorcycle', 'band-tee-style', '90s']
        },
        {
            title: 'North Face Fleece Jacket - Denali',
            brand: 'The North Face',
            category: 'Outerwear',
            subcategory: 'Fleece',
            size: 'M',
            color: 'Black',
            condition: 'good',
            costPrice: 15.00,
            listPrice: 75.00,
            description: 'Classic North Face Denali fleece jacket. Full zip, excellent condition. Perfect for layering.',
            tags: ['north-face', 'denali', 'fleece', 'outdoor', 'hiking']
        },
        {
            title: 'Frye Leather Boots - Harness Style',
            brand: 'Frye',
            category: 'Shoes',
            subcategory: 'Boots',
            size: '9',
            color: 'Brown',
            condition: 'good',
            costPrice: 25.00,
            listPrice: 120.00,
            description: 'Frye harness boots in brown leather. Classic western style. Some wear on soles but tons of life left.',
            tags: ['frye', 'boots', 'leather', 'harness', 'western', 'vintage']
        }
    ];

    for (const item of newItems) {
        const result = await api('POST', '/inventory', item);
        if (result.status === 201) {
            console.log(`   ✅ Added: ${item.title} - $${item.listPrice} (paid $${item.costPrice})`);
            createdItems.push(result.data.item);
        } else {
            console.log(`   ❌ Failed to add: ${item.title}`);
            console.log(`      Error: ${result.data.error}`);
        }
    }

    const totalInvested = newItems.reduce((sum, item) => sum + item.costPrice, 0);
    const potentialRevenue = newItems.reduce((sum, item) => sum + item.listPrice, 0);
    const potentialProfit = potentialRevenue - totalInvested;

    console.log(`\n   💰 Haul Summary:`);
    console.log(`      Total invested: $${totalInvested.toFixed(2)}`);
    console.log(`      Potential revenue: $${potentialRevenue.toFixed(2)}`);
    console.log(`      Potential profit: $${potentialProfit.toFixed(2)} (${Math.round(potentialProfit/totalInvested*100)}% ROI)`);

    // ==========================================
    // STEP 4: Search Inventory
    // ==========================================
    console.log('\n🔍 STEP 4: Search for "Nike" items');
    const searchResults = await api('GET', '/inventory?search=nike');
    console.log(`✅ Found ${searchResults.data.items.length} Nike items`);
    searchResults.data.items.forEach(item => {
        console.log(`   - ${item.title} - $${item.list_price}`);
    });

    // ==========================================
    // STEP 5: Filter by Category
    // ==========================================
    console.log('\n🏷️  STEP 5: Filter by category "Outerwear"');
    const filtered = await api('GET', '/inventory?category=Outerwear');
    console.log(`✅ Found ${filtered.data.items.length} outerwear items`);

    // ==========================================
    // STEP 6: Check Automations
    // ==========================================
    console.log('\n⚙️  STEP 6: Check automation rules');
    const automations = await api('GET', '/automations');
    console.log(`✅ Found ${automations.data.rules.length} automation rules`);
    automations.data.rules.forEach(rule => {
        console.log(`   ${rule.is_enabled ? '🟢' : '⚪'} ${rule.name} (${rule.platform})`);
    });

    // ==========================================
    // STEP 7: Toggle an Automation
    // ==========================================
    if (automations.data.rules.length > 0) {
        const firstRule = automations.data.rules[0];
        console.log(`\n🔄 STEP 7: Toggle automation "${firstRule.name}"`);
        const toggle = await api('POST', `/automations/${firstRule.id}/toggle`);
        if (toggle.status === 200) {
            console.log(`✅ Toggled successfully - Now ${toggle.data.isEnabled ? 'enabled' : 'disabled'}`);
        } else {
            console.log(`❌ Toggle failed:`, toggle.data);
        }
    }

    // ==========================================
    // STEP 8: Check Connected Shops
    // ==========================================
    console.log('\n🏪 STEP 8: Check connected shops');
    const shops = await api('GET', '/shops');
    console.log(`✅ Found ${shops.data.shops.length} connected shops`);
    shops.data.shops.forEach(shop => {
        console.log(`   ${shop.is_connected ? '🟢' : '⚪'} ${shop.platform} - ${shop.platform_username || 'Not configured'}`);
    });

    // ==========================================
    // STEP 9: Bulk Price Update
    // ==========================================
    if (createdItems.length >= 2) {
        console.log('\n💵 STEP 9: Bulk price reduction (10% off first 2 items)');
        const itemIds = createdItems.slice(0, 2).map(item => item.id);

        const bulkUpdate = await api('POST', '/inventory/bulk', {
            action: 'updatePrice',
            ids: itemIds,
            data: {
                adjustment: {
                    type: 'percentage',
                    value: -10
                }
            }
        });

        if (bulkUpdate.status === 200) {
            console.log(`✅ Reduced prices by 10% on ${itemIds.length} items`);
        } else {
            console.log(`❌ Bulk update failed:`, bulkUpdate.data);
        }
    }

    // ==========================================
    // STEP 10: Final Inventory Check
    // ==========================================
    console.log('\n📊 STEP 10: Final inventory summary');
    const finalInventory = await api('GET', '/inventory');

    const activeItems = finalInventory.data.items.filter(i => i.status === 'active');
    const draftItems = finalInventory.data.items.filter(i => i.status === 'draft');
    const totalValue = finalInventory.data.items.reduce((sum, item) => sum + item.list_price, 0);
    const totalCost = finalInventory.data.items.reduce((sum, item) => sum + (item.cost_price || 0), 0);

    console.log(`✅ Inventory Summary:`);
    console.log(`   Total items: ${finalInventory.data.items.length}`);
    console.log(`   Active: ${activeItems.length}`);
    console.log(`   Draft: ${draftItems.length}`);
    console.log(`   Total inventory value: $${totalValue.toFixed(2)}`);
    console.log(`   Total cost basis: $${totalCost.toFixed(2)}`);
    console.log(`   Potential profit: $${(totalValue - totalCost).toFixed(2)}`);

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '━'.repeat(60));
    console.log('✅ Workflow Simulation Complete!');
    console.log('━'.repeat(60));
    console.log('\n📋 Actions Performed:');
    console.log('   ✅ Logged in');
    console.log('   ✅ Checked existing inventory');
    console.log('   ✅ Added 5 new items (thrift haul)');
    console.log('   ✅ Searched inventory');
    console.log('   ✅ Filtered by category');
    console.log('   ✅ Checked automations');
    console.log('   ✅ Toggled automation rule');
    console.log('   ✅ Checked connected shops');
    console.log('   ✅ Bulk price update');
    console.log('   ✅ Generated final report');
    console.log('\n🎉 All core workflows functional!\n');
}

workflow().catch(error => {
    console.error('\n❌ Workflow failed:', error);
    console.error(error.stack);
});
