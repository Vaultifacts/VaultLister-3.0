// Barcode Lookup Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import redis from '../services/redis.js';

export async function barcodeRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/barcode/lookup/:code - Look up barcode
    const lookupMatch = path.match(/^\/lookup\/([0-9]+)$/);
    if (method === 'GET' && lookupMatch) {
        const barcode = lookupMatch[1];

        // Check cache first
        const cached = await redis.getJson('cache:barcode:' + barcode);
        if (cached) {
            return {
                status: 200,
                data: {
                    ...cached,
                    cached: true
                }
            };
        }

        // Check local database for previously saved barcodes
        const localResult = await query.get(`
            SELECT * FROM barcode_lookups WHERE barcode = ?
        `, [barcode]);

        if (localResult) {
            const data = {
                barcode,
                title: localResult.title,
                brand: localResult.brand,
                category: localResult.category,
                description: localResult.description,
                image_url: localResult.image_url,
                source: 'local'
            };
            await redis.setJson('cache:barcode:' + barcode, data, 86400);
            return {
                status: 200,
                data: { ...data, cached: false }
            };
        }

        // Try external API lookup (using free UPC Database API)
        try {
            const externalData = await lookupExternalBarcode(barcode);
            if (externalData) {
                // Save to local database for future lookups
                saveBarcodeLookup(barcode, externalData);
                await redis.setJson('cache:barcode:' + barcode, externalData, 86400);
                return {
                    status: 200,
                    data: { ...externalData, cached: false }
                };
            }
        } catch (error) {
            logger.error('[Barcode] External barcode lookup failed', user?.id || null, { detail: error.message });
        }

        // Return not found
        return {
            status: 404,
            data: {
                error: 'Product not found',
                barcode,
                message: 'Could not find product information for this barcode. You can manually enter the details.'
            }
        };
    }

    // POST /api/barcode/save - Save a barcode lookup manually
    if (method === 'POST' && path === '/save') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const { barcode, title, brand, category, description, image_url } = body;

        if (!barcode) {
            return {
                status: 400,
                data: { error: 'Barcode is required' }
            };
        }

        // Validate barcode format (UPC-A: 12 digits, EAN-13: 13 digits)
        if (!/^\d{8,14}$/.test(barcode)) {
            return {
                status: 400,
                data: { error: 'Invalid barcode format. Must be 8-14 digits.' }
            };
        }

        const id = uuidv4();
        try {
            await query.run(`
                INSERT INTO barcode_lookups
                (id, barcode, title, brand, category, description, image_url, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (barcode) DO UPDATE SET
                    title = EXCLUDED.title, brand = EXCLUDED.brand,
                    category = EXCLUDED.category, description = EXCLUDED.description,
                    image_url = EXCLUDED.image_url, updated_at = NOW()
            `, [id, barcode, title, brand, category, description, image_url, user.id]);

            // Update cache
            const data = { barcode, title, brand, category, description, image_url, source: 'user' };
            await redis.setJson('cache:barcode:' + barcode, data, 86400);

            return {
                status: 201,
                data: {
                    message: 'Barcode saved successfully',
                    id,
                    ...data
                }
            };
        } catch (error) {
            return {
                status: 500,
                data: { error: 'Failed to save barcode' }
            };
        }
    }

    // GET /api/barcode/recent - Get recently scanned barcodes
    if (method === 'GET' && path === '/recent') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const { limit = 10 } = queryParams;

        const recent = await query.all(`
            SELECT DISTINCT barcode, title, brand, category, image_url, created_at
            FROM barcode_lookups
            WHERE created_by = ?
            ORDER BY created_at DESC
            LIMIT ?
        `, [user.id, Math.min(parseInt(limit) || 10, 100)]);

        return {
            status: 200,
            data: { barcodes: recent }
        };
    }

    // POST /api/barcode/validate - Validate barcode format
    if (method === 'POST' && path === '/validate') {
        const { barcode } = body;

        const validation = validateBarcode(barcode);

        return {
            status: 200,
            data: validation
        };
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
}

// External barcode lookup using Open Food Facts or similar free API
async function lookupExternalBarcode(barcode) {
    // Try Open Food Facts API (free, no API key required)
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, { signal: AbortSignal.timeout(10000) });
        if (response.ok) {
            const data = await response.json();
            if (data.status === 1 && data.product) {
                return {
                    barcode,
                    title: data.product.product_name || null,
                    brand: data.product.brands || null,
                    category: data.product.categories?.split(',')[0]?.trim() || null,
                    description: data.product.generic_name || null,
                    image_url: data.product.image_url || null,
                    source: 'openfoodfacts'
                };
            }
        }
    } catch (e) {
        // Silently fail, will try next source
    }

    // Try UPC Item DB (community database, may require proxy in production)
    try {
        const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
            signal: AbortSignal.timeout(10000),
            headers: {
                'Accept': 'application/json'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                return {
                    barcode,
                    title: item.title || null,
                    brand: item.brand || null,
                    category: item.category || null,
                    description: item.description || null,
                    image_url: item.images?.[0] || null,
                    source: 'upcitemdb'
                };
            }
        }
    } catch (e) {
        // Silently fail
    }

    return null;
}

// Save barcode lookup to local database
function saveBarcodeLookup(barcode, data) {
    try {
        const id = uuidv4();
        await query.run(`
            INSERT INTO barcode_lookups
            (id, barcode, title, brand, category, description, image_url, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (barcode) DO UPDATE SET
                title = EXCLUDED.title, brand = EXCLUDED.brand,
                category = EXCLUDED.category, description = EXCLUDED.description,
                image_url = EXCLUDED.image_url, source = EXCLUDED.source, updated_at = NOW()
        `, [id, barcode, data.title, data.brand, data.category, data.description, data.image_url, data.source]);
    } catch (e) {
        // Non-critical, ignore errors
    }
}

// Validate barcode format
function validateBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') {
        return { valid: false, error: 'Barcode is required' };
    }

    // Remove any non-digit characters
    const digits = barcode.replace(/\D/g, '');

    // Check length
    if (digits.length < 8 || digits.length > 14) {
        return { valid: false, error: 'Barcode must be 8-14 digits', type: null };
    }

    // Determine type
    let type = null;
    switch (digits.length) {
        case 8:
            type = 'EAN-8';
            break;
        case 12:
            type = 'UPC-A';
            break;
        case 13:
            type = 'EAN-13';
            break;
        case 14:
            type = 'GTIN-14';
            break;
        default:
            type = 'Unknown';
    }

    // Validate check digit for common formats
    let checkDigitValid = true;
    if (digits.length === 12 || digits.length === 13) {
        checkDigitValid = validateCheckDigit(digits);
    }

    return {
        valid: true,
        normalized: digits,
        type,
        checkDigitValid,
        warning: !checkDigitValid ? 'Check digit may be invalid' : null
    };
}

// Validate UPC/EAN check digit
function validateCheckDigit(barcode) {
    const digits = barcode.split('').map(Number);
    const checkDigit = digits.pop();

    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        // For UPC-A (12 digits) and EAN-13: odd positions * 1, even positions * 3
        const multiplier = (digits.length - i) % 2 === 0 ? 1 : 3;
        sum += digits[i] * multiplier;
    }

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
}
