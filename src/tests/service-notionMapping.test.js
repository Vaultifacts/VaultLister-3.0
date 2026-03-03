// Notion Service — Mapping Functions & Schema Unit Tests (pure, no Notion SDK needed)
import { describe, expect, test } from 'bun:test';
import {
    INVENTORY_SCHEMA,
    SALES_SCHEMA,
    NOTES_SCHEMA,
    mapInventoryToNotion,
    mapNotionToInventory,
    mapSaleToNotion,
    mapNotionToSale
} from '../backend/services/notionService.js';

describe('INVENTORY_SCHEMA', () => {
    test('has title set to VaultLister Inventory', () => {
        expect(INVENTORY_SCHEMA.title).toBe('VaultLister Inventory');
    });

    test('has all expected property keys', () => {
        const keys = Object.keys(INVENTORY_SCHEMA.properties);
        expect(keys).toContain('Title');
        expect(keys).toContain('SKU');
        expect(keys).toContain('Description');
        expect(keys).toContain('Brand');
        expect(keys).toContain('Category');
        expect(keys).toContain('Condition');
        expect(keys).toContain('Cost Price');
        expect(keys).toContain('List Price');
        expect(keys).toContain('Quantity');
        expect(keys).toContain('Status');
        expect(keys).toContain('Tags');
        expect(keys).toContain('Location');
        expect(keys).toContain('VaultLister ID');
    });

    test('Condition has 5 select options', () => {
        const opts = INVENTORY_SCHEMA.properties['Condition'].select.options;
        expect(opts.length).toBe(5);
        expect(opts.map(o => o.name)).toEqual(['New', 'Like New', 'Good', 'Fair', 'Poor']);
    });

    test('Status has 4 select options', () => {
        const opts = INVENTORY_SCHEMA.properties['Status'].select.options;
        expect(opts.length).toBe(4);
        expect(opts.map(o => o.name)).toContain('active');
        expect(opts.map(o => o.name)).toContain('sold');
    });
});

describe('SALES_SCHEMA', () => {
    test('has title set to VaultLister Sales', () => {
        expect(SALES_SCHEMA.title).toBe('VaultLister Sales');
    });

    test('has all expected property keys', () => {
        const keys = Object.keys(SALES_SCHEMA.properties);
        expect(keys).toContain('Item');
        expect(keys).toContain('Sale Date');
        expect(keys).toContain('Sale Price');
        expect(keys).toContain('Platform');
        expect(keys).toContain('Platform Fees');
        expect(keys).toContain('Shipping Cost');
        expect(keys).toContain('Net Profit');
        expect(keys).toContain('Buyer');
        expect(keys).toContain('Status');
        expect(keys).toContain('VaultLister ID');
    });

    test('Status has 5 options including completed and refunded', () => {
        const opts = SALES_SCHEMA.properties['Status'].select.options;
        expect(opts.length).toBe(5);
        expect(opts.map(o => o.name)).toContain('completed');
        expect(opts.map(o => o.name)).toContain('refunded');
    });
});

describe('NOTES_SCHEMA', () => {
    test('has title set to VaultLister Notes', () => {
        expect(NOTES_SCHEMA.title).toBe('VaultLister Notes');
    });

    test('has all expected property keys', () => {
        const keys = Object.keys(NOTES_SCHEMA.properties);
        expect(keys).toContain('Title');
        expect(keys).toContain('Content');
        expect(keys).toContain('Category');
        expect(keys).toContain('Tags');
        expect(keys).toContain('Created');
        expect(keys).toContain('VaultLister ID');
    });
});

describe('mapInventoryToNotion', () => {
    test('maps minimal item with title and id', () => {
        const result = mapInventoryToNotion({ id: 'item-1', title: 'Test Item' });
        expect(result['Title'].title[0].text.content).toBe('Test Item');
        expect(result['VaultLister ID'].rich_text[0].text.content).toBe('item-1');
    });

    test('defaults title to Untitled when missing', () => {
        const result = mapInventoryToNotion({ id: 'item-2' });
        expect(result['Title'].title[0].text.content).toBe('Untitled');
    });

    test('maps all optional fields when present', () => {
        const item = {
            id: 'item-3',
            title: 'Full Item',
            sku: 'SKU-001',
            description: 'A great item',
            brand: 'Nike',
            category: 'Shoes',
            condition: 'New',
            cost_price: 50,
            list_price: 100,
            quantity: 5,
            status: 'active',
            tags: ['vintage', 'rare'],
            location: 'Bin A'
        };
        const result = mapInventoryToNotion(item);
        expect(result['SKU'].rich_text[0].text.content).toBe('SKU-001');
        expect(result['Brand'].select.name).toBe('Nike');
        expect(result['Category'].select.name).toBe('Shoes');
        expect(result['Condition'].select.name).toBe('New');
        expect(result['Cost Price'].number).toBe(50);
        expect(result['List Price'].number).toBe(100);
        expect(result['Quantity'].number).toBe(5);
        expect(result['Status'].select.name).toBe('active');
        expect(result['Tags'].multi_select).toEqual([{ name: 'vintage' }, { name: 'rare' }]);
        expect(result['Location'].rich_text[0].text.content).toBe('Bin A');
    });

    test('truncates description to 2000 chars', () => {
        const longDesc = 'A'.repeat(3000);
        const result = mapInventoryToNotion({ id: 'item-4', title: 'Long', description: longDesc });
        expect(result['Description'].rich_text[0].text.content.length).toBe(2000);
    });

    test('parses string prices to numbers', () => {
        const result = mapInventoryToNotion({ id: 'item-5', title: 'X', cost_price: '29.99', list_price: '49.99' });
        expect(result['Cost Price'].number).toBe(29.99);
        expect(result['List Price'].number).toBe(49.99);
    });

    test('handles zero price correctly', () => {
        const result = mapInventoryToNotion({ id: 'item-6', title: 'Free', cost_price: 0 });
        expect(result['Cost Price'].number).toBe(0);
    });

    test('does not include optional fields when absent', () => {
        const result = mapInventoryToNotion({ id: 'item-7', title: 'Minimal' });
        expect(result['SKU']).toBeUndefined();
        expect(result['Brand']).toBeUndefined();
        expect(result['Tags']).toBeUndefined();
    });

    test('does not include empty tags array', () => {
        const result = mapInventoryToNotion({ id: 'item-8', title: 'No Tags', tags: [] });
        expect(result['Tags']).toBeUndefined();
    });

    test('handles non-array tags gracefully', () => {
        const result = mapInventoryToNotion({ id: 'item-9', title: 'Bad Tags', tags: 'not-array' });
        expect(result['Tags']).toBeUndefined();
    });
});

describe('mapNotionToInventory', () => {
    test('maps full Notion page to inventory object', () => {
        const page = {
            id: 'notion-page-1',
            last_edited_time: '2025-01-15T10:00:00Z',
            properties: {
                'Title': 'My Item',
                'SKU': 'SKU-001',
                'Brand': 'Nike',
                'Category': 'Shoes',
                'Condition': 'New',
                'Cost Price': 50,
                'List Price': 100,
                'Quantity': 3,
                'Status': 'active',
                'Tags': ['vintage'],
                'Location': 'Shelf B',
                'VaultLister ID': 'local-123'
            }
        };
        const result = mapNotionToInventory(page);
        expect(result.notion_page_id).toBe('notion-page-1');
        expect(result.title).toBe('My Item');
        expect(result.sku).toBe('SKU-001');
        expect(result.brand).toBe('Nike');
        expect(result.cost_price).toBe(50);
        expect(result.status).toBe('active');
        expect(result.vaultlister_id).toBe('local-123');
    });

    test('defaults missing properties', () => {
        const page = { id: 'page-2', last_edited_time: null, properties: {} };
        const result = mapNotionToInventory(page);
        expect(result.title).toBe('');
        expect(result.sku).toBeNull();
        expect(result.quantity).toBe(0);
        expect(result.status).toBe('draft');
        expect(result.tags).toEqual([]);
    });

    test('handles page with no properties key', () => {
        const page = { id: 'page-3' };
        const result = mapNotionToInventory(page);
        expect(result.notion_page_id).toBe('page-3');
        expect(result.title).toBe('');
    });
});

describe('mapSaleToNotion', () => {
    test('maps minimal sale with item_title and id', () => {
        const result = mapSaleToNotion({ id: 'sale-1', item_title: 'Sold Item' });
        expect(result['Item'].title[0].text.content).toBe('Sold Item');
        expect(result['VaultLister ID'].rich_text[0].text.content).toBe('sale-1');
    });

    test('defaults item title to Sale when missing', () => {
        const result = mapSaleToNotion({ id: 'sale-2' });
        expect(result['Item'].title[0].text.content).toBe('Sale');
    });

    test('maps full sale with all fields', () => {
        const sale = {
            id: 'sale-3',
            item_title: 'Vintage Jacket',
            sale_date: '2025-06-15T14:30:00Z',
            sale_price: 75.50,
            platform: 'eBay',
            platform_fees: 10.25,
            shipping_cost: 8.00,
            net_profit: 57.25,
            buyer_username: 'buyer123',
            status: 'completed'
        };
        const result = mapSaleToNotion(sale);
        expect(result['Sale Date'].date.start).toBe('2025-06-15');
        expect(result['Sale Price'].number).toBe(75.50);
        expect(result['Platform'].select.name).toBe('eBay');
        expect(result['Platform Fees'].number).toBe(10.25);
        expect(result['Shipping Cost'].number).toBe(8.00);
        expect(result['Net Profit'].number).toBe(57.25);
        expect(result['Buyer'].rich_text[0].text.content).toBe('buyer123');
        expect(result['Status'].select.name).toBe('completed');
    });

    test('splits date on T to get date-only string', () => {
        const result = mapSaleToNotion({ id: 's-4', sale_date: '2025-12-31T23:59:59Z' });
        expect(result['Sale Date'].date.start).toBe('2025-12-31');
    });

    test('parses string prices to numbers', () => {
        const result = mapSaleToNotion({ id: 's-5', sale_price: '99.99', platform_fees: '5.00' });
        expect(result['Sale Price'].number).toBe(99.99);
        expect(result['Platform Fees'].number).toBe(5.00);
    });
});

describe('mapNotionToSale', () => {
    test('maps full Notion page to sale object', () => {
        const page = {
            id: 'notion-sale-1',
            last_edited_time: '2025-01-20T09:00:00Z',
            properties: {
                'Item': 'Sold Thing',
                'Sale Date': '2025-01-15',
                'Sale Price': 80,
                'Platform': 'Poshmark',
                'Platform Fees': 16,
                'Shipping Cost': 7.99,
                'Net Profit': 56.01,
                'Buyer': 'jane_doe',
                'Status': 'completed',
                'VaultLister ID': 'local-sale-1'
            }
        };
        const result = mapNotionToSale(page);
        expect(result.notion_page_id).toBe('notion-sale-1');
        expect(result.item_title).toBe('Sold Thing');
        expect(result.sale_price).toBe(80);
        expect(result.platform).toBe('Poshmark');
        expect(result.status).toBe('completed');
    });

    test('defaults missing properties', () => {
        const page = { id: 'sale-page-2', properties: {} };
        const result = mapNotionToSale(page);
        expect(result.item_title).toBe('');
        expect(result.sale_price).toBe(0);
        expect(result.platform_fees).toBe(0);
        expect(result.status).toBe('pending');
    });

    test('handles page with no properties', () => {
        const page = { id: 'sale-page-3' };
        const result = mapNotionToSale(page);
        expect(result.notion_page_id).toBe('sale-page-3');
        expect(result.status).toBe('pending');
    });
});
