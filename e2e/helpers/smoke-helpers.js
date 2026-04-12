import { apiLogin, BASE } from '../fixtures/auth.js';

function uniqueSuffix() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loginAsDemo(request) {
    return apiLogin(request);
}

export function buildAuthHeaders(token, extraHeaders = {}) {
    return {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
    };
}

export async function buildMutationHeaders(request, token) {
    const headers = buildAuthHeaders(token);
    const csrfResponse = await request.get(`${BASE}/api/inventory`, { headers }).catch(() => null);
    const csrfToken = csrfResponse?.headers()['x-csrf-token'];

    return {
        ...headers,
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    };
}

export function makeInventoryPayload(overrides = {}) {
    const suffix = uniqueSuffix();
    return {
        title: `Smoke Inventory ${suffix}`,
        description: 'Smoke test inventory item',
        brand: 'Smoke Brand',
        category: 'Tops',
        size: 'M',
        color: 'Black',
        condition: 'good',
        listPrice: 25,
        costPrice: 10,
        quantity: 1,
        ...overrides,
    };
}

export function makeListingPayload(inventoryId, overrides = {}) {
    const suffix = uniqueSuffix();
    return {
        inventoryId,
        platform: 'ebay',
        title: `Smoke Listing ${suffix}`,
        description: 'Smoke test listing',
        price: 25,
        ...overrides,
    };
}

export async function createInventory(request, token, overrides = {}) {
    const response = await request.post(`${BASE}/api/inventory`, {
        headers: await buildMutationHeaders(request, token),
        data: makeInventoryPayload(overrides),
    });
    const body = await response.json();
    return {
        response,
        body,
        itemId: body?.item?.id || body?.id || null,
    };
}

export async function createListing(request, token, inventoryId, overrides = {}) {
    const response = await request.post(`${BASE}/api/listings`, {
        headers: await buildMutationHeaders(request, token),
        data: makeListingPayload(inventoryId, overrides),
    });
    const body = await response.json();
    return {
        response,
        body,
        listingId: body?.listing?.id || body?.id || null,
    };
}

export async function getListing(request, token, listingId) {
    const response = await request.get(`${BASE}/api/listings/${listingId}`, {
        headers: buildAuthHeaders(token),
    });
    const body = await response.json();
    return { response, body };
}

export async function publishListingToEbay(request, token, listingId) {
    const response = await request.post(`${BASE}/api/listings/${listingId}/publish-ebay`, {
        headers: await buildMutationHeaders(request, token),
    });
    const body = await response.json();
    return { response, body };
}

export async function deleteListing(request, token, listingId) {
    if (!listingId) {
        return;
    }

    await request.delete(`${BASE}/api/listings/${listingId}`, {
        headers: await buildMutationHeaders(request, token),
    }).catch(() => {});
}

export async function deleteInventory(request, token, inventoryId) {
    if (!inventoryId) {
        return;
    }

    await request.delete(`${BASE}/api/inventory/${inventoryId}`, {
        headers: await buildMutationHeaders(request, token),
    }).catch(() => {});
}

export async function cleanupSmokeResources(request, token, { listingId, inventoryId }) {
    await deleteListing(request, token, listingId);
    await deleteInventory(request, token, inventoryId);
}
