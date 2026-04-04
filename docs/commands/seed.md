# /seed - Add Seed Data

Create seed data for testing and development.

## Usage
```
/seed <type> [count]
```

Types: `users`, `inventory`, `sales`, `purchases`, `all`

## Workflow

1. **Add seed function** to `src/backend/db/seed.js` or create new file
2. **Call from database initialization** or create endpoint
3. **Run seed**

## Seed Templates

### Create Seed File
```javascript
// src/backend/db/seeds/<name>Seed.js
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database.js';

export function seed<Name>(userId) {
    const items = [
        { name: 'Item 1', field: 'value1' },
        { name: 'Item 2', field: 'value2' },
        // ...
    ];

    for (const item of items) {
        const id = uuidv4();
        query.run(`
            INSERT OR IGNORE INTO <table> (id, user_id, name, field)
            VALUES (?, ?, ?, ?)
        `, [id, userId, item.name, item.field]);
    }

    console.log(`✓ Seeded ${items.length} <items>`);
}
```

### Inventory Seed Example
```javascript
export function seedInventory(userId, count = 20) {
    const categories = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Accessories'];
    const brands = ['Nike', 'Adidas', 'Zara', 'H&M', 'Levi\'s', 'Gap'];
    const conditions = ['New with Tags', 'Like New', 'Good', 'Fair'];
    const statuses = ['active', 'active', 'active', 'listed', 'sold'];

    for (let i = 0; i < count; i++) {
        const id = uuidv4();
        const category = categories[Math.floor(Math.random() * categories.length)];
        const brand = brands[Math.floor(Math.random() * brands.length)];

        query.run(`
            INSERT INTO inventory (
                id, user_id, title, category, brand, condition,
                cost_price, list_price, quantity, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, userId,
            `${brand} ${category} Item ${i + 1}`,
            category,
            brand,
            conditions[Math.floor(Math.random() * conditions.length)],
            Math.floor(Math.random() * 30) + 5,  // cost: $5-35
            Math.floor(Math.random() * 80) + 20, // list: $20-100
            1,
            statuses[Math.floor(Math.random() * statuses.length)]
        ]);
    }

    console.log(`✓ Seeded ${count} inventory items`);
}
```

### Sales Seed Example
```javascript
export function seedSales(userId, count = 10) {
    const platforms = ['poshmark', 'ebay', 'mercari', 'depop'];
    const statuses = ['pending', 'shipped', 'delivered'];

    // Get some inventory items to link
    const items = query.all(
        'SELECT id, title, list_price FROM inventory WHERE user_id = ? LIMIT ?',
        [userId, count]
    );

    for (let i = 0; i < Math.min(count, items.length); i++) {
        const item = items[i];
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        const salePrice = item.list_price * (0.8 + Math.random() * 0.3); // 80-110% of list

        query.run(`
            INSERT INTO sales (
                id, user_id, inventory_id, platform, sale_price,
                platform_fee, net_profit, status, buyer_username
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), userId, item.id, platform, salePrice,
            salePrice * 0.1, // 10% fee
            salePrice * 0.7, // rough profit
            statuses[Math.floor(Math.random() * statuses.length)],
            `buyer${Math.floor(Math.random() * 1000)}`
        ]);
    }

    console.log(`✓ Seeded ${Math.min(count, items.length)} sales`);
}
```

### Full Seed Runner
```javascript
// src/backend/db/seed.js
import { seedInventory } from './seeds/inventorySeed.js';
import { seedSales } from './seeds/salesSeed.js';
import { seedPurchases } from './seeds/purchasesSeed.js';

export function seedAll(userId) {
    console.log('Seeding database...');

    seedInventory(userId, 20);
    seedPurchases(userId, 5);
    seedSales(userId, 10);

    console.log('✓ Database seeding complete');
}
```

### API Endpoint for Seeding
```javascript
// In a route file
if (method === 'POST' && path === '/seed') {
    if (process.env.NODE_ENV === 'production') {
        return { status: 403, data: { error: 'Seeding disabled in production' } };
    }

    seedAll(user.id);
    return { status: 200, data: { message: 'Database seeded successfully' } };
}
```

## Existing Seeds
- `src/backend/db/seeds/helpContent.js` - Help articles and FAQs
- Run with: Server automatically seeds on startup
