// Receipt Parser Routes - AI-powered receipt parsing with Claude Vision
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { getAnthropicClient } from '../../shared/ai/claude-client.js';
import { logger } from '../shared/logger.js';
import { validateBase64Image } from '../services/imageStorage.js';
import redis from '../services/redis.js';
import { safeJsonParse } from '../shared/utils.js';
import { withTimeout } from '../shared/fetchWithTimeout.js';
import { circuitBreaker } from '../shared/circuitBreaker.js';



async function checkReceiptRateLimit(userId) {
    const key = 'rl:receipt:' + userId;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= 5;
}

// Helper function to parse receipt with Claude AI
async function parseReceiptWithAI(imageBase64, mimeType) {
    const anthropic = getAnthropicClient(process.env.VAULTLISTER_RECEIPT_PARSER || process.env.ANTHROPIC_API_KEY);
    if (!anthropic) {
        throw new Error('AI service not configured. Please set ANTHROPIC_API_KEY environment variable.');
    }

    const prompt = `You are an expert at reading and extracting data from receipts. Analyze this receipt image and extract ALL information in the following JSON format:

{
    "receiptType": "purchase" or "sale" or "shipping" or "expense",
    "vendor": {
        "name": "Store or platform name (e.g., 'Goodwill', 'eBay', 'UPS')",
        "address": "Address if visible, otherwise null",
        "phone": "Phone number if visible, otherwise null"
    },
    "date": "YYYY-MM-DD format",
    "items": [
        {
            "description": "Item description as shown on receipt",
            "quantity": 1,
            "unitPrice": 0.00,
            "total": 0.00,
            "sku": "SKU or item code if visible, otherwise null"
        }
    ],
    "subtotal": 0.00,
    "shipping": 0.00,
    "discount": 0.00,
    "total": 0.00,
    "paymentMethod": "Cash, Credit Card, Debit Card, PayPal, etc.",
    "lastFourDigits": "Last 4 digits of card if visible, otherwise null",
    "platform": "eBay, Poshmark, Mercari, etc. if this is a platform receipt, otherwise null",
    "orderNumber": "Order or transaction number if visible, otherwise null",
    "trackingNumber": "Tracking number if this is a shipping receipt, otherwise null",
    "buyerInfo": {
        "name": "Buyer name if this is a sale receipt, otherwise null",
        "username": "Buyer username if visible, otherwise null"
    },
    "fees": 0.00,
    "netPayout": 0.00,
    "confidence": "high" or "medium" or "low"
}

Guidelines:
- For PURCHASE receipts: Extract store name, items bought, prices, total
- For SALE receipts (from platforms): Extract buyer info, item sold, fees, net payout
- For SHIPPING receipts: Extract carrier, tracking number, shipping cost
- For EXPENSE receipts: Extract vendor, description, amount (supplies, packaging, etc.)

Determine receipt type based on context:
- "purchase" = buying items (thrift stores, wholesale, retail)
- "sale" = selling items (platform notifications, payout summaries)
- "shipping" = shipping labels or postage receipts
- "expense" = business expenses (supplies, packaging, services)

Return ONLY valid JSON with no additional text or markdown formatting.`;

    const response = await circuitBreaker('anthropic-receipt-parser', () =>
        withTimeout(
            anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType || 'image/jpeg',
                                data: imageBase64
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }]
            }),
            45000,
            'Receipt Vision API'
        ),
        { failureThreshold: 3, cooldownMs: 60000 }
    );

    // Parse the response
    const responseText = response.content[0].text;

    // Try to extract JSON from the response
    let parsed;
    try {
        // Try direct parse first
        parsed = JSON.parse(responseText);
    } catch (e) {
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsed = safeJsonParse(jsonMatch[0], {});
        } else {
            throw new Error('Failed to parse AI response as JSON');
        }
    }

    return parsed;
}

// Map confidence to numeric score
function confidenceToScore(confidence) {
    switch (confidence?.toLowerCase()) {
        case 'high': return 0.9;
        case 'medium': return 0.7;
        case 'low': return 0.5;
        default: return 0.5;
    }
}

export async function receiptParserRouter(ctx) {
    const { method, path, body, user } = ctx;

    // POST /api/receipts/upload - Upload and parse a receipt
    if (method === 'POST' && path === '/upload') {
        const { imageBase64, mimeType, filename } = body;

        if (!imageBase64) {
            return { status: 400, data: { error: 'Image data required (base64)' } };
        }

        // Validate inputs BEFORE rate-limit check (don't penalise bad requests)
        if (typeof imageBase64 !== 'string') {
            return { status: 400, data: { error: 'Image data required (base64)' } };
        }

        // Validate MIME type, size, and magic bytes
        const imgValidation = validateBase64Image(imageBase64, mimeType);
        if (!imgValidation.valid) {
            return { status: 400, data: { error: imgValidation.error } };
        }

        // Rate limit: 5 uploads per minute per user (checked after validation)
        if (!(await checkReceiptRateLimit(user.id))) {
            return { status: 429, data: { error: 'Too many uploads. Please wait a minute before trying again.' } };
        }

        try {
            // Parse receipt with AI
            const parsedData = await parseReceiptWithAI(imageBase64, mimeType);

            // Create queue entry
            const id = uuidv4();
            const now = new Date().toISOString();

            await query.run(`
                INSERT INTO email_parse_queue (
                    id, user_id, email_subject, email_from, email_body, email_date,
                    parsed_data, status, receipt_type, confidence_score, source_file,
                    file_type, image_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                user.id,
                parsedData.vendor?.name || 'Unknown Receipt',
                parsedData.vendor?.name || null,
                null, // email_body not used for uploads
                parsedData.date || now.split('T')[0],
                JSON.stringify(parsedData),
                'parsed',
                parsedData.receiptType || 'purchase',
                confidenceToScore(parsedData.confidence),
                filename || 'uploaded_receipt',
                'image',
                imageBase64, // Store for display
                now
            ]);

            // Fetch the created record
            const receipt = await query.get('SELECT * FROM email_parse_queue WHERE id = ?', [id]);
            receipt.parsed_data = safeJsonParse(receipt.parsed_data || '{}', {});

            return {
                status: 201,
                data: {
                    receipt,
                    message: 'Receipt parsed successfully'
                }
            };
        } catch (parseError) {
            logger.error('[ReceiptParser] Receipt parsing error', null, { detail: parseError.message });
            return {
                status: 500,
                data: { error: 'Failed to parse receipt. Please try again later.' }
            };
        }
    }

    // GET /api/receipts/queue - List pending/parsed receipts
    if (method === 'GET' && (path === '/queue' || path === '/')) {
        const { status, type, limit = 50, offset = 0 } = ctx.query || {};

        let sql = 'SELECT * FROM email_parse_queue WHERE user_id = ?';
        const params = [user.id];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        } else {
            // Default: exclude processed and ignored
            sql += ' AND status NOT IN (?, ?)';
            params.push('processed', 'ignored');
        }

        if (type) {
            sql += ' AND receipt_type = ?';
            params.push(type);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const receipts = await query.all(sql, params);

        // Parse JSON fields
        receipts.forEach(r => {
            r.parsed_data = safeJsonParse(r.parsed_data || '{}', {});
        });

        // Get counts by status
        const counts = await query.get(`
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'parsed' THEN 1 ELSE 0 END) as parsed,
                SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed,
                SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM email_parse_queue WHERE user_id = ?
        `, [user.id]);

        return {
            status: 200,
            data: { receipts, counts }
        };
    }

    // GET /api/receipts/:id - Get single receipt
    if (method === 'GET' && path.match(/^\/[a-zA-Z0-9_-]+$/) && path !== '/vendors' && path !== '/queue') {
        const id = path.slice(1);

        const receipt = await query.get(
            'SELECT * FROM email_parse_queue WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!receipt) {
            return { status: 404, data: { error: 'Receipt not found' } };
        }

        receipt.parsed_data = safeJsonParse(receipt.parsed_data || '{}', {});

        return { status: 200, data: { receipt } };
    }

    // PUT /api/receipts/:id - Update parsed data (user corrections)
    if (method === 'PUT' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !path.startsWith('/vendors')) {
        const id = path.slice(1);

        const existing = await query.get(
            'SELECT * FROM email_parse_queue WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Receipt not found' } };
        }

        const { parsedData, receiptType } = body;

        await query.run(`
            UPDATE email_parse_queue
            SET parsed_data = ?, receipt_type = ?, status = 'parsed'
            WHERE id = ?
        `, [
            JSON.stringify(parsedData),
            receiptType || existing.receipt_type,
            id
        ]);

        const updated = await query.get('SELECT * FROM email_parse_queue WHERE id = ?', [id]);
        updated.parsed_data = safeJsonParse(updated.parsed_data || '{}', {});

        return { status: 200, data: { receipt: updated } };
    }

    // POST /api/receipts/:id/process - Convert to purchase/sale/expense
    if (method === 'POST' && path.match(/^\/[a-zA-Z0-9_-]+\/process$/)) {
        const id = path.split('/')[1];

        const receipt = await query.get(
            'SELECT * FROM email_parse_queue WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!receipt) {
            return { status: 404, data: { error: 'Receipt not found' } };
        }

        const parsedData = safeJsonParse(receipt.parsed_data || '{}', {});
        const receiptType = receipt.receipt_type || parsedData.receiptType || 'purchase';

        try {
            let result = null;

            if (receiptType === 'purchase') {
                // Create purchase record
                const purchaseId = uuidv4();
                const purchaseNumber = `PUR-${String(await query.get('SELECT COUNT(*) as count FROM purchases WHERE user_id = ?', [user.id]).count + 1).padStart(5, '0')}`;

                // Calculate totals - Cap items at 100 to prevent DoS
                const items = (parsedData.items || []).slice(0, 100);
                const itemTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
                const totalAmount = parsedData.total || (itemTotal + (parsedData.shipping || 0) - (parsedData.discount || 0));

                await query.run(`
                    INSERT INTO purchases (
                        id, user_id, purchase_number, vendor_name, purchase_date,
                        total_amount, shipping_cost, payment_method,
                        status, source, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    purchaseId,
                    user.id,
                    purchaseNumber,
                    parsedData.vendor?.name || 'Unknown Vendor',
                    parsedData.date || new Date().toISOString().split('T')[0],
                    totalAmount,
                    parsedData.shipping || 0,
                    parsedData.paymentMethod || 'Unknown',
                    'completed',
                    'receipt_scan',
                    `Parsed from receipt. Order #: ${parsedData.orderNumber || 'N/A'}`
                ]);

                // Create purchase items
                for (const item of items) {
                    const itemId = uuidv4();
                    await query.run(`
                        INSERT INTO purchase_items (
                            id, purchase_id, description, quantity, unit_cost, total_cost
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        itemId,
                        purchaseId,
                        item.description || 'Item',
                        item.quantity || 1,
                        item.unitPrice || item.total || 0,
                        item.total || 0
                    ]);
                }

                result = { type: 'purchase', id: purchaseId, purchaseNumber };

            } else if (receiptType === 'sale') {
                // Create sale record
                const saleId = uuidv4();

                await query.run(`
                    INSERT INTO sales (
                        id, user_id, platform, sale_price, platform_fee, net_profit,
                        buyer_username, platform_order_id, tracking_number, status,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    saleId,
                    user.id,
                    parsedData.platform || 'Other',
                    parsedData.total || 0,
                    parsedData.fees || 0,
                    parsedData.netPayout || parsedData.total || 0,
                    parsedData.buyerInfo?.username || parsedData.buyerInfo?.name || null,
                    parsedData.orderNumber || null,
                    parsedData.trackingNumber || null,
                    'shipped'
                ]);

                result = { type: 'sale', id: saleId };

            } else if (receiptType === 'expense' || receiptType === 'shipping') {
                // Create expense as a financial transaction
                const transactionId = uuidv4();
                const category = receiptType === 'shipping' ? 'Shipping Expense' : 'Business Expense';

                await query.run(`
                    INSERT INTO financial_transactions (
                        id, user_id, transaction_date, description, amount, category, reference_type, reference_id, account_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
                `, [
                    transactionId,
                    user.id,
                    parsedData.date || new Date().toISOString().split('T')[0],
                    `${parsedData.vendor?.name || 'Expense'}: ${parsedData.trackingNumber ? 'Tracking: ' + parsedData.trackingNumber : parsedData.items?.[0]?.description || 'Receipt expense'}`,
                    parsedData.total || 0,
                    category,
                    'expense',
                    transactionId
                ]);

                result = { type: 'expense', id: transactionId };
            }

            // Mark receipt as processed
            await query.run(`
                UPDATE email_parse_queue
                SET status = 'processed', processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);

            return {
                status: 200,
                data: {
                    success: true,
                    message: `Receipt processed as ${receiptType}`,
                    result
                }
            };
        } catch (error) {
            logger.error('[ReceiptParser] Process receipt error', null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to process receipt' } };
        }
    }

    // POST /api/receipts/:id/ignore - Mark as ignored
    if (method === 'POST' && path.match(/^\/[a-zA-Z0-9_-]+\/ignore$/)) {
        const id = path.split('/')[1];

        const receipt = await query.get(
            'SELECT * FROM email_parse_queue WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!receipt) {
            return { status: 404, data: { error: 'Receipt not found' } };
        }

        await query.run(`
            UPDATE email_parse_queue SET status = 'ignored' WHERE id = ?
        `, [id]);

        return { status: 200, data: { success: true } };
    }

    // DELETE /api/receipts/:id - Delete from queue
    if (method === 'DELETE' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !path.startsWith('/vendors')) {
        const id = path.slice(1);

        const receipt = await query.get(
            'SELECT * FROM email_parse_queue WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!receipt) {
            return { status: 404, data: { error: 'Receipt not found' } };
        }

        await query.run('DELETE FROM email_parse_queue WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { success: true } };
    }

    // POST /api/receipts/:id/reparse - Re-parse with AI
    if (method === 'POST' && path.match(/^\/[a-zA-Z0-9_-]+\/reparse$/)) {
        const id = path.split('/')[1];

        const receipt = await query.get(
            'SELECT * FROM email_parse_queue WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!receipt) {
            return { status: 404, data: { error: 'Receipt not found' } };
        }

        if (!receipt.image_data) {
            return { status: 400, data: { error: 'No image data available for re-parsing' } };
        }

        try {
            const parsedData = await parseReceiptWithAI(receipt.image_data, 'image/jpeg');

            await query.run(`
                UPDATE email_parse_queue
                SET parsed_data = ?, receipt_type = ?, confidence_score = ?, status = 'parsed'
                WHERE id = ?
            `, [
                JSON.stringify(parsedData),
                parsedData.receiptType || 'purchase',
                confidenceToScore(parsedData.confidence),
                id
            ]);

            const updated = await query.get('SELECT * FROM email_parse_queue WHERE id = ?', [id]);
            updated.parsed_data = safeJsonParse(updated.parsed_data || '{}', {});

            return { status: 200, data: { receipt: updated } };
        } catch (error) {
            logger.error('[ReceiptParser] Re-parse receipt error', null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to re-parse receipt' } };
        }
    }

    // GET /api/receipts/vendors - List saved vendors
    if (method === 'GET' && path === '/vendors') {
        const vendors = await query.all(
            'SELECT * FROM receipt_vendors WHERE user_id = ? ORDER BY name ASC',
            [user.id]
        );

        vendors.forEach(v => {
            v.aliases = safeJsonParse(v.aliases || '[]', []);
        });

        return { status: 200, data: { vendors } };
    }

    // POST /api/receipts/vendors - Create vendor preset
    if (method === 'POST' && path === '/vendors') {
        const { name, aliases, defaultCategory, defaultPaymentMethod, isPlatform, notes } = body;

        if (!name) {
            return { status: 400, data: { error: 'Vendor name is required' } };
        }

        const id = uuidv4();

        await query.run(`
            INSERT INTO receipt_vendors (
                id, user_id, name, aliases, default_category,
                default_payment_method, is_platform, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            user.id,
            name,
            JSON.stringify(aliases || []),
            defaultCategory || null,
            defaultPaymentMethod || null,
            isPlatform ? 1 : 0,
            notes || null
        ]);

        const vendor = await query.get('SELECT * FROM receipt_vendors WHERE id = ?', [id]);
        vendor.aliases = safeJsonParse(vendor.aliases || '[]', []);

        return { status: 201, data: { vendor } };
    }

    // PUT /api/receipts/vendors/:id - Update vendor
    if (method === 'PUT' && path.match(/^\/vendors\/[a-zA-Z0-9_-]+$/)) {
        const id = path.split('/')[2];

        const existing = await query.get(
            'SELECT * FROM receipt_vendors WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Vendor not found' } };
        }

        const { name, aliases, defaultCategory, defaultPaymentMethod, isPlatform, notes } = body;

        await query.run(`
            UPDATE receipt_vendors SET
                name = COALESCE(?, name),
                aliases = COALESCE(?, aliases),
                default_category = ?,
                default_payment_method = ?,
                is_platform = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name,
            aliases ? JSON.stringify(aliases) : null,
            defaultCategory,
            defaultPaymentMethod,
            isPlatform ? 1 : 0,
            notes,
            id
        ]);

        const vendor = await query.get('SELECT * FROM receipt_vendors WHERE id = ?', [id]);
        vendor.aliases = safeJsonParse(vendor.aliases || '[]', []);

        return { status: 200, data: { vendor } };
    }

    // DELETE /api/receipts/vendors/:id - Delete vendor
    if (method === 'DELETE' && path.match(/^\/vendors\/[a-zA-Z0-9_-]+$/)) {
        const id = path.split('/')[2];

        const existing = await query.get(
            'SELECT * FROM receipt_vendors WHERE id = ? AND user_id = ?',
            [id, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Vendor not found' } };
        }

        await query.run('DELETE FROM receipt_vendors WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { success: true } };
    }

    // Route not found
    return { status: 404, data: { error: 'Endpoint not found' } };
}
