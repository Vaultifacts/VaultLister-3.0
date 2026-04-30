import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { shippingLabelsRouter } from '../backend/routes/shippingLabels.js';
import { query } from '../backend/db/database.js';

const originalEasyPostKey = process.env.EASYPOST_API_KEY;
const originalFetch = globalThis.fetch;
const originalRun = query.run;

let fetchCalls;
let runCalls;

function restoreEasyPostKey() {
    if (originalEasyPostKey === undefined) {
        delete process.env.EASYPOST_API_KEY;
    } else {
        process.env.EASYPOST_API_KEY = originalEasyPostKey;
    }
}

function makeCtx(path, body = {}) {
    return {
        method: 'POST',
        path,
        body,
        query: {},
        user: { id: 'user-1' }
    };
}

function mockEasyPostShipmentResponse() {
    return new Response(JSON.stringify({
        id: 'shp_123',
        rates: [
            {
                id: 'rate_usps',
                carrier: 'USPS',
                service: 'Priority',
                rate: '10.50',
                currency: 'USD',
                delivery_days: 2,
                delivery_date: null
            },
            {
                id: 'rate_canadapost',
                carrier: 'CanadaPost',
                service: 'ExpeditedParcel',
                rate: '7.25',
                currency: 'CAD',
                delivery_days: 4,
                delivery_date: '2026-05-04'
            }
        ]
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

beforeEach(() => {
    fetchCalls = [];
    runCalls = [];
    process.env.EASYPOST_API_KEY = 'test_easypost_key';
    query.run = async (...args) => {
        runCalls.push(args);
        return { changes: 1 };
    };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    query.run = originalRun;
    restoreEasyPostKey();
});

describe('Shipping Labels EasyPost routing', () => {
    test('default rates endpoint creates an EasyPost shipment and persists returned rates', async () => {
        globalThis.fetch = async (url, options) => {
            fetchCalls.push({ url, options, body: JSON.parse(options.body) });
            return mockEasyPostShipmentResponse();
        };

        const result = await shippingLabelsRouter(makeCtx('/rates', {
            weight_oz: 16,
            from_zip: 'T2P1J9',
            from_country: 'CA',
            to_zip: 'M5V2T6',
            to_country: 'CA',
            length_in: 10,
            width_in: 8,
            height_in: 4
        }));

        expect(result.status).toBe(200);
        expect(fetchCalls).toHaveLength(1);
        expect(fetchCalls[0].url).toBe('https://api.easypost.com/v2/shipments');
        expect(fetchCalls[0].options.method).toBe('POST');
        expect(fetchCalls[0].options.headers.Authorization).toBe(`Basic ${Buffer.from('test_easypost_key:').toString('base64')}`);
        expect(fetchCalls[0].body.shipment.from_address).toMatchObject({ zip: 'T2P1J9', country: 'CA' });
        expect(fetchCalls[0].body.shipment.to_address).toMatchObject({ zip: 'M5V2T6', country: 'CA' });
        expect(fetchCalls[0].body.shipment.parcel).toMatchObject({ weight: 16, length: 10, width: 8, height: 4 });
        expect(runCalls).toHaveLength(2);
        expect(runCalls[0][0]).toContain('INSERT INTO shipping_rates');
        expect(result.data.shipment_id).toBe('shp_123');
        expect(result.data.rates.map(rate => rate.rate)).toEqual([7.25, 10.5]);
        expect(result.data.rates[0]).toMatchObject({
            carrier: 'CanadaPost',
            currency: 'CAD',
            provider: 'easypost',
            rate_id: 'rate_canadapost',
            shipment_id: 'shp_123'
        });
    });

    test('default rates endpoint returns the EasyPost config gate without calling the provider', async () => {
        delete process.env.EASYPOST_API_KEY;
        globalThis.fetch = async () => {
            throw new Error('fetch should not be called');
        };

        const result = await shippingLabelsRouter(makeCtx('/rates', {
            weight_oz: 16,
            from_zip: 'T2P1J9',
            to_zip: 'M5V2T6'
        }));

        expect(result.status).toBe(503);
        expect(result.data.error).toBe('EasyPost not configured');
        expect(result.data.message).toContain('EASYPOST_API_KEY');
        expect(runCalls).toHaveLength(0);
    });

    test('explicit EasyPost rates endpoint uses the same provider path without persisting transient rates', async () => {
        globalThis.fetch = async (url, options) => {
            fetchCalls.push({ url, options, body: JSON.parse(options.body) });
            return mockEasyPostShipmentResponse();
        };

        const result = await shippingLabelsRouter(makeCtx('/easypost/rates', {
            weight_oz: 16,
            from_zip: 'T2P1J9',
            to_zip: 'M5V2T6'
        }));

        expect(result.status).toBe(200);
        expect(fetchCalls[0].url).toBe('https://api.easypost.com/v2/shipments');
        expect(runCalls).toHaveLength(0);
        expect(result.data.rates[0]).toMatchObject({
            id: 'rate_canadapost',
            rate_id: 'rate_canadapost',
            provider: 'easypost'
        });
    });

    test('EasyPost buy endpoint purchases the shipment and stores provider identifiers on the label', async () => {
        globalThis.fetch = async (url, options) => {
            fetchCalls.push({ url, options, body: JSON.parse(options.body) });
            return new Response(JSON.stringify({
                id: 'shp_123',
                tracking_code: 'EZTRACK123',
                selected_rate: {
                    id: 'rate_canadapost',
                    carrier: 'CanadaPost',
                    service: 'ExpeditedParcel',
                    rate: '7.25',
                    currency: 'CAD'
                },
                postage_label: {
                    id: 'pl_123',
                    label_url: 'https://example.test/label.png'
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        const result = await shippingLabelsRouter(makeCtx('/easypost/buy', {
            shipment_id: 'shp_123',
            rate_id: 'rate_canadapost',
            order_id: 'order-1'
        }));

        expect(result.status).toBe(200);
        expect(fetchCalls[0].url).toBe('https://api.easypost.com/v2/shipments/shp_123/buy');
        expect(fetchCalls[0].body).toEqual({ rate: { id: 'rate_canadapost' } });
        expect(runCalls).toHaveLength(1);
        expect(runCalls[0][0]).toContain('external_label_id');
        expect(runCalls[0][1]).toEqual(expect.arrayContaining([
            'user-1',
            'order-1',
            'CanadaPost',
            'EZTRACK123',
            'https://example.test/label.png',
            7.25,
            'CAD',
            'pl_123',
            'shp_123',
            'rate_canadapost'
        ]));
        expect(result.data).toMatchObject({
            label_url: 'https://example.test/label.png',
            tracking_number: 'EZTRACK123',
            carrier: 'CanadaPost',
            service: 'ExpeditedParcel',
            cost: 7.25
        });
    });
});
