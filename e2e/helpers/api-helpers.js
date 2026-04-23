// e2e/helpers/api-helpers.js
const TEST_PORT = process.env.TEST_PORT || process.env.PORT || '3100';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${TEST_PORT}`;
const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

/** Get an auth token for API calls */
export async function getAuthToken() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO),
  });
  const data = await res.json();
  return data.token;
}

/** Create a test inventory item via API, returns the created item */
export async function seedInventoryItem(token, overrides = {}) {
  const item = {
    name: `Test Item ${Date.now()}`,
    sku: `TST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    purchase_price: '10.00',
    listing_price: '25.00',
    quantity: 1,
    status: 'active',
    ...overrides,
  };
  const res = await fetch(`${BASE}/api/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(item),
  });
  const created = await res.json();
  
  // Validate inserted data
  if (!created.id) {
    throw new Error(`Seed validation failed: no id in response - ${JSON.stringify(created)}`);
  }
  if (!created.name) {
    throw new Error(`Seed validation failed: no name in response - ${JSON.stringify(created)}`);
  }
  
  return created;
}

/** Delete a test inventory item by ID */
export async function deleteInventoryItem(token, id) {
  await fetch(`${BASE}/api/inventory/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

/** Seed multiple items, returns array of created items */
export async function seedInventoryBatch(token, count = 5) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const item = await seedInventoryItem(token, { name: `Batch Item ${i + 1}` });
    items.push(item);
  }
  
  // Validate batch seeding result
  if (items.length === 0) {
    throw new Error('Seed validation failed: no items created in batch');
  }
  if (items.length !== count) {
    throw new Error(`Seed validation failed: expected ${count} items, got ${items.length}`);
  }
  
  return items;
}

/** Clean up seeded items */
export async function cleanupItems(token, items) {
  for (const item of items) {
    if (item?.id) await deleteInventoryItem(token, item.id);
  }
}
