import { describe, expect, test, mock, beforeEach } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock();
const mockQueryRun = mock();

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  default: {}
}));

// Import real encryption — do NOT mock it (contaminates other test files)
import { encryptToken } from '../backend/utils/encryption.js';

const {
  INVENTORY_SCHEMA,
  SALES_SCHEMA,
  NOTES_SCHEMA,
  mapInventoryToNotion,
  mapNotionToInventory,
  mapSaleToNotion,
  mapNotionToSale,
  isConfigured,
  getSettings,
  deleteSettings,
  getClient,
  getSyncMap,
  getSyncMapByNotionId,
  updateSyncStatus,
  getPendingSyncItems,
  logSyncHistory,
  getSyncHistory
} = await import('../backend/services/notionService.js');

describe('notionService', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryRun.mockReset();
  });

  // =========================================================================
  // Schema constants
  // =========================================================================
  describe('Schema constants', () => {
    test('INVENTORY_SCHEMA has correct title and properties', () => {
      expect(INVENTORY_SCHEMA.title).toBe('VaultLister Inventory');
      expect(INVENTORY_SCHEMA.properties).toHaveProperty('Title');
      expect(INVENTORY_SCHEMA.properties).toHaveProperty('SKU');
      expect(INVENTORY_SCHEMA.properties).toHaveProperty('Cost Price');
      expect(INVENTORY_SCHEMA.properties).toHaveProperty('VaultLister ID');
    });

    test('SALES_SCHEMA has sale-related properties', () => {
      expect(SALES_SCHEMA.title).toBe('VaultLister Sales');
      expect(SALES_SCHEMA.properties).toHaveProperty('Sale Price');
      expect(SALES_SCHEMA.properties).toHaveProperty('Platform');
      expect(SALES_SCHEMA.properties).toHaveProperty('Net Profit');
    });

    test('NOTES_SCHEMA has note properties', () => {
      expect(NOTES_SCHEMA.title).toBe('VaultLister Notes');
      expect(NOTES_SCHEMA.properties).toHaveProperty('Content');
      expect(NOTES_SCHEMA.properties).toHaveProperty('Tags');
    });
  });

  // =========================================================================
  // mapInventoryToNotion
  // =========================================================================
  describe('mapInventoryToNotion', () => {
    test('maps basic required fields', () => {
      const props = mapInventoryToNotion({ id: 'item-1', title: 'Test Item' });
      expect(props['Title'].title[0].text.content).toBe('Test Item');
      expect(props['VaultLister ID'].rich_text[0].text.content).toBe('item-1');
    });

    test('maps all optional fields when present', () => {
      const props = mapInventoryToNotion({
        id: 'item-1', title: 'Full', sku: 'SKU-1', brand: 'Nike',
        category: 'Shoes', condition: 'New', cost_price: 50,
        list_price: 100, quantity: 5, status: 'active',
        tags: ['vintage', 'rare'], location: 'Shelf A',
        description: 'A description'
      });
      expect(props['SKU'].rich_text[0].text.content).toBe('SKU-1');
      expect(props['Brand'].select.name).toBe('Nike');
      expect(props['Cost Price'].number).toBe(50);
      expect(props['Quantity'].number).toBe(5);
      expect(props['Tags'].multi_select).toHaveLength(2);
      expect(props['Location'].rich_text[0].text.content).toBe('Shelf A');
    });

    test('truncates description to 2000 characters', () => {
      const props = mapInventoryToNotion({ id: 'i1', title: 'T', description: 'A'.repeat(3000) });
      expect(props['Description'].rich_text[0].text.content).toHaveLength(2000);
    });

    test('defaults title to Untitled when missing', () => {
      const props = mapInventoryToNotion({ id: 'i1' });
      expect(props['Title'].title[0].text.content).toBe('Untitled');
    });
  });

  // =========================================================================
  // mapNotionToInventory
  // =========================================================================
  describe('mapNotionToInventory', () => {
    test('maps properties correctly', () => {
      const result = mapNotionToInventory({
        id: 'page-1',
        last_edited_time: '2026-01-01T00:00:00Z',
        properties: {
          'Title': 'Test Item', 'SKU': 'SKU-1', 'Brand': 'Nike',
          'Cost Price': 50, 'Quantity': 5, 'Status': 'active',
          'VaultLister ID': 'item-1'
        }
      });
      expect(result.notion_page_id).toBe('page-1');
      expect(result.title).toBe('Test Item');
      expect(result.sku).toBe('SKU-1');
      expect(result.cost_price).toBe(50);
      expect(result.vaultlister_id).toBe('item-1');
    });

    test('uses defaults for missing properties', () => {
      const result = mapNotionToInventory({ id: 'p2', properties: {} });
      expect(result.title).toBe('');
      expect(result.sku).toBeNull();
      expect(result.quantity).toBe(0);
      expect(result.status).toBe('draft');
      expect(result.tags).toEqual([]);
    });
  });

  // =========================================================================
  // mapSaleToNotion / mapNotionToSale
  // =========================================================================
  describe('mapSaleToNotion', () => {
    test('maps sale fields correctly', () => {
      const props = mapSaleToNotion({
        id: 'sale-1', item_title: 'Sold Item',
        sale_date: '2026-01-15T10:30:00Z', sale_price: 75,
        platform: 'eBay', buyer_username: 'buyer123', status: 'completed'
      });
      expect(props['Item'].title[0].text.content).toBe('Sold Item');
      expect(props['Sale Date'].date.start).toBe('2026-01-15');
      expect(props['Sale Price'].number).toBe(75);
      expect(props['Platform'].select.name).toBe('eBay');
    });

    test('defaults item_title to Sale', () => {
      const props = mapSaleToNotion({ id: 's2' });
      expect(props['Item'].title[0].text.content).toBe('Sale');
    });
  });

  describe('mapNotionToSale', () => {
    test('maps properties and uses defaults', () => {
      const result = mapNotionToSale({ id: 'p3', properties: { 'Sale Price': 75, 'Status': 'completed' } });
      expect(result.sale_price).toBe(75);
      expect(result.status).toBe('completed');
      expect(result.item_title).toBe('');
      expect(result.platform).toBeNull();
    });
  });

  // =========================================================================
  // DB functions
  // =========================================================================
  describe('isConfigured', () => {
    test('returns true when env token exists (no userId)', () => {
      const orig = process.env.NOTION_INTEGRATION_TOKEN;
      process.env.NOTION_INTEGRATION_TOKEN = 'test-token';
      expect(isConfigured()).toBe(true);
      if (orig) process.env.NOTION_INTEGRATION_TOKEN = orig;
      else delete process.env.NOTION_INTEGRATION_TOKEN;
    });

    test('returns true when user has encrypted token in DB', () => {
      const orig = process.env.NOTION_INTEGRATION_TOKEN;
      delete process.env.NOTION_INTEGRATION_TOKEN;
      mockQueryGet.mockReturnValue({ encrypted_token: 'enc_tok' });
      expect(isConfigured('user-1')).toBe(true);
      if (orig) process.env.NOTION_INTEGRATION_TOKEN = orig;
    });

    test('returns false when no token anywhere', () => {
      const orig = process.env.NOTION_INTEGRATION_TOKEN;
      delete process.env.NOTION_INTEGRATION_TOKEN;
      mockQueryGet.mockReturnValue(null);
      expect(isConfigured('user-1')).toBe(false);
      if (orig) process.env.NOTION_INTEGRATION_TOKEN = orig;
    });
  });

  describe('getClient', () => {
    test('returns Client with user token from DB', () => {
      const encrypted = encryptToken('my-test-notion-token');
      mockQueryGet.mockReturnValue({ encrypted_token: encrypted });
      const client = getClient('user-1');
      expect(client).toBeTruthy();
    });

    test('throws when no token available', () => {
      const orig = process.env.NOTION_INTEGRATION_TOKEN;
      delete process.env.NOTION_INTEGRATION_TOKEN;
      mockQueryGet.mockReturnValue(null);
      expect(() => getClient('user-1')).toThrow('not configured');
      if (orig) process.env.NOTION_INTEGRATION_TOKEN = orig;
    });
  });

  describe('getSettings / deleteSettings', () => {
    test('getSettings returns DB row', () => {
      mockQueryGet.mockReturnValue({ user_id: 'u1', sync_enabled: 1 });
      expect(getSettings('u1').sync_enabled).toBe(1);
    });

    test('deleteSettings runs 4 cleanup queries', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      deleteSettings('u1');
      expect(mockQueryRun).toHaveBeenCalledTimes(4);
      const queries = mockQueryRun.mock.calls.map(c => c[0]);
      expect(queries.some(q => q.includes('notion_sync_map'))).toBe(true);
      expect(queries.some(q => q.includes('notion_settings'))).toBe(true);
    });
  });

  // =========================================================================
  // Sync operations
  // =========================================================================
  describe('Sync operations', () => {
    test('getSyncMap queries by user, entity type, and local ID', () => {
      mockQueryGet.mockReturnValue({ id: 's1', local_id: 'item-1' });
      const result = getSyncMap('u1', 'inventory', 'item-1');
      expect(result.id).toBe('s1');
      expect(mockQueryGet.mock.calls[0][1]).toEqual(['u1', 'inventory', 'item-1']);
    });

    test('getSyncMapByNotionId queries by notion page ID', () => {
      mockQueryGet.mockReturnValue({ id: 's1' });
      getSyncMapByNotionId('u1', 'inventory', 'page-1');
      expect(mockQueryGet.mock.calls[0][1]).toEqual(['u1', 'inventory', 'page-1']);
    });

    test('updateSyncStatus updates entry', () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      updateSyncStatus('s1', 'error', 'Something failed');
      const args = mockQueryRun.mock.calls[0][1];
      expect(args[0]).toBe('error');
      expect(args[1]).toBe('Something failed');
      expect(args[4]).toBe('s1');
    });

    test('getPendingSyncItems returns items', () => {
      mockQueryAll.mockReturnValue([{ id: 's1', sync_status: 'pending_push' }]);
      expect(getPendingSyncItems('u1')).toHaveLength(1);
    });

    test('getPendingSyncItems filters by entity type', () => {
      mockQueryAll.mockReturnValue([]);
      getPendingSyncItems('u1', 'inventory');
      expect(mockQueryAll.mock.calls[0][1]).toEqual(['u1', 'inventory']);
    });
  });

  describe('Sync history', () => {
    test('logSyncHistory inserts and returns UUID', () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      const id = logSyncHistory('u1', { sync_type: 'manual', status: 'success' });
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    test('getSyncHistory returns ordered results', () => {
      mockQueryAll.mockReturnValue([{ id: 'h1' }, { id: 'h2' }]);
      const history = getSyncHistory('u1', 10);
      expect(history).toHaveLength(2);
      expect(mockQueryAll.mock.calls[0][1]).toEqual(['u1', 10]);
    });
  });
});
