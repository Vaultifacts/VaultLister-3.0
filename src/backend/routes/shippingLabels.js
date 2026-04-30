// Shipping Labels Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';
import { parseIntSafe } from '../../shared/utils/validation.js';

const EASYPOST_SHIPMENTS_URL = 'https://api.easypost.com/v2/shipments';

function positiveNumber(value, fallback = null) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assignAddressField(address, key, value) {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (normalized) address[key] = normalized;
}

function buildEasyPostAddress(body, prefix) {
    const address = {};
    assignAddressField(address, 'name', body[`${prefix}_name`]);
    assignAddressField(address, 'company', body[`${prefix}_company`]);
    assignAddressField(address, 'street1', body[`${prefix}_street1`]);
    assignAddressField(address, 'street2', body[`${prefix}_street2`]);
    assignAddressField(address, 'city', body[`${prefix}_city`]);
    assignAddressField(address, 'state', body[`${prefix}_state`]);
    assignAddressField(address, 'zip', body[`${prefix}_zip`]);
    assignAddressField(address, 'country', body[`${prefix}_country`] || 'US');
    assignAddressField(address, 'phone', body[`${prefix}_phone`]);
    assignAddressField(address, 'email', body[`${prefix}_email`]);
    return address;
}

function buildEasyPostShipmentPayload(body) {
    return {
        shipment: {
            from_address: buildEasyPostAddress(body, 'from'),
            to_address: buildEasyPostAddress(body, 'to'),
            parcel: {
                weight: positiveNumber(body.weight_oz),
                length: positiveNumber(body.length ?? body.length_in, 12),
                width: positiveNumber(body.width ?? body.width_in, 9),
                height: positiveNumber(body.height ?? body.height_in, 4),
            },
        },
    };
}

function getEasyPostAuthHeader() {
    const token = `${process.env.EASYPOST_API_KEY}:`;
    return `Basic ${Buffer.from(token).toString('base64')}`;
}

async function readEasyPostError(response) {
    const text = await response.text().catch(() => '');
    if (!text) return `HTTP ${response.status}`;
    const parsed = safeJsonParse(text, null);
    return parsed?.error?.message || parsed?.message || text;
}

function mapEasyPostRate(shipment, rate, rowId = null) {
    const deliveryDays = Number.isFinite(Number(rate.delivery_days)) ? Number(rate.delivery_days) : null;
    return {
        id: rowId || rate.id,
        carrier: rate.carrier || 'EasyPost',
        service: rate.service || '',
        rate: Number.parseFloat(rate.rate),
        currency: rate.currency || 'USD',
        delivery_days: deliveryDays,
        delivery_date: rate.delivery_date || null,
        shipment_id: shipment.id,
        rate_id: rate.id,
        easypost_rate_id: rate.id,
        provider: 'easypost',
    };
}

async function fetchEasyPostRates(body, user, { persist = false } = {}) {
    const response = await fetch(EASYPOST_SHIPMENTS_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: getEasyPostAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEasyPostShipmentPayload(body)),
    });

    if (!response.ok) {
        const detail = await readEasyPostError(response);
        logger.error('[EasyPost] Shipment create error', user?.id, { status: response.status, detail });
        return { status: 502, data: { error: 'EasyPost API error', detail: detail || 'Failed to retrieve rates' } };
    }

    const shipment = await response.json();
    const rates = [];
    for (const rate of shipment.rates || []) {
        const amount = Number.parseFloat(rate.rate);
        if (!Number.isFinite(amount)) continue;

        const rowId = persist ? uuidv4() : null;
        const mapped = mapEasyPostRate(shipment, rate, rowId);

        if (persist) {
            await query.run(
                `INSERT INTO shipping_rates (
                    id, user_id, carrier, service, rate, currency, delivery_days, delivery_date, rate_id, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL '1 hour')`,
                [
                    rowId,
                    user.id,
                    mapped.carrier,
                    mapped.service,
                    mapped.rate,
                    mapped.currency,
                    mapped.delivery_days,
                    mapped.delivery_date,
                    mapped.rate_id,
                ],
            );
        }

        rates.push(mapped);
    }

    rates.sort((a, b) => a.rate - b.rate);
    return { status: 200, data: { rates, shipment_id: shipment.id } };
}

async function buyEasyPostShipment(shipmentId, rateId, user) {
    const response = await fetch(`${EASYPOST_SHIPMENTS_URL}/${shipmentId}/buy`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: getEasyPostAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: { id: rateId } }),
    });

    if (!response.ok) {
        const detail = await readEasyPostError(response);
        logger.error('[EasyPost] Buy label error', user?.id, { status: response.status, detail });
        return { status: 502, data: { error: 'EasyPost API error', detail: detail || 'Failed to purchase label' } };
    }

    return { status: 200, data: { shipment: await response.json() } };
}

export async function shippingLabelsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ============================================
    // Shipping Labels CRUD
    // ============================================

    // GET /api/shipping-labels/ - List labels
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const { status, carrier, batch_id, limit = 50, offset = 0 } = queryParams;

            let sql = 'SELECT * FROM shipping_labels WHERE user_id = ?';
            const params = [user.id];

            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }
            if (carrier) {
                sql += ' AND carrier = ?';
                params.push(carrier);
            }
            if (batch_id) {
                sql += ' AND batch_id = ?';
                params.push(batch_id);
            }

            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(
                parseIntSafe(limit, { min: 1, max: 200, fallback: 50 }),
                parseIntSafe(offset, { min: 0, fallback: 0 }),
            );

            const labels = await query.all(sql, params);
            const { count } = await query.get('SELECT COUNT(*) as count FROM shipping_labels WHERE user_id = ?', [
                user.id,
            ]);

            return {
                status: 200,
                data: { labels, total: count },
            };
        } catch (error) {
            logger.error('[ShippingLabels] Error listing labels', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shipping-labels/:id - Get single label
    const getLabelMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (
        method === 'GET' &&
        getLabelMatch &&
        !path.startsWith('/addresses') &&
        !path.startsWith('/batches') &&
        !path.startsWith('/rates')
    ) {
        try {
            const label = await query.get('SELECT * FROM shipping_labels WHERE id = ? AND user_id = ?', [
                getLabelMatch[1],
                user.id,
            ]);

            if (!label) {
                return { status: 404, data: { error: 'Label not found' } };
            }

            return { status: 200, data: { label } };
        } catch (error) {
            logger.error('[ShippingLabels] Error fetching label', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shipping-labels/ - Create label
    if (method === 'POST' && (path === '/' || path === '')) {
        try {
            const {
                order_id,
                sale_id,
                carrier,
                service_type,
                weight_oz,
                length_in,
                width_in,
                height_in,
                package_type = 'package',
                from_name,
                from_company,
                from_street1,
                from_street2,
                from_city,
                from_state,
                from_zip,
                from_country = 'US',
                from_phone,
                to_name,
                to_company,
                to_street1,
                to_street2,
                to_city,
                to_state,
                to_zip,
                to_country = 'US',
                to_phone,
                to_email,
                label_format = 'pdf',
                label_size = '4x6',
                notes,
            } = body;

            if (
                !carrier ||
                !from_name ||
                !from_street1 ||
                !from_city ||
                !from_state ||
                !from_zip ||
                !to_name ||
                !to_street1 ||
                !to_city ||
                !to_state ||
                !to_zip
            ) {
                return { status: 400, data: { error: 'Carrier and complete from/to addresses are required' } };
            }

            const id = uuidv4();

            await query.run(
                `
                INSERT INTO shipping_labels (
                    id, user_id, order_id, sale_id, carrier, service_type,
                    weight_oz, length_in, width_in, height_in, package_type,
                    from_name, from_company, from_street1, from_street2, from_city, from_state, from_zip, from_country, from_phone,
                    to_name, to_company, to_street1, to_street2, to_city, to_state, to_zip, to_country, to_phone, to_email,
                    label_format, label_size, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                    id,
                    user.id,
                    order_id,
                    sale_id,
                    carrier,
                    service_type,
                    weight_oz,
                    length_in,
                    width_in,
                    height_in,
                    package_type,
                    from_name,
                    from_company,
                    from_street1,
                    from_street2,
                    from_city,
                    from_state,
                    from_zip,
                    from_country,
                    from_phone,
                    to_name,
                    to_company,
                    to_street1,
                    to_street2,
                    to_city,
                    to_state,
                    to_zip,
                    to_country,
                    to_phone,
                    to_email,
                    label_format,
                    label_size,
                    notes,
                ],
            );

            return { status: 201, data: { message: 'Label created', id } };
        } catch (error) {
            logger.error('[ShippingLabels] Error creating label', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/shipping-labels/:id - Update label
    const patchLabelMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && patchLabelMatch && !path.startsWith('/addresses') && !path.startsWith('/batches')) {
        try {
            const id = patchLabelMatch[1];

            const existing = await query.get('SELECT id FROM shipping_labels WHERE id = ? AND user_id = ?', [
                id,
                user.id,
            ]);
            if (!existing) {
                return { status: 404, data: { error: 'Label not found' } };
            }

            const updates = [];
            const params = [];

            const fields = [
                'order_id',
                'sale_id',
                'tracking_number',
                'carrier',
                'service_type',
                'weight_oz',
                'length_in',
                'width_in',
                'height_in',
                'package_type',
                'from_name',
                'from_company',
                'from_street1',
                'from_street2',
                'from_city',
                'from_state',
                'from_zip',
                'from_country',
                'from_phone',
                'to_name',
                'to_company',
                'to_street1',
                'to_street2',
                'to_city',
                'to_state',
                'to_zip',
                'to_country',
                'to_phone',
                'to_email',
                'label_format',
                'label_size',
                'label_url',
                'label_data',
                'postage_cost',
                'insurance_cost',
                'total_cost',
                'status',
                'notes',
                'batch_id',
                'external_label_id',
                'external_shipment_id',
                'rate_id',
            ];

            fields.forEach((field) => {
                if (body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(body[field]);
                }
            });

            // Handle status timestamp updates
            if (body.status === 'purchased') {
                updates.push('purchased_at = CURRENT_TIMESTAMP');
            } else if (body.status === 'printed') {
                updates.push('printed_at = CURRENT_TIMESTAMP');
            } else if (body.status === 'shipped') {
                updates.push('shipped_at = CURRENT_TIMESTAMP');
            } else if (body.status === 'delivered') {
                updates.push('delivered_at = CURRENT_TIMESTAMP');
            } else if (body.status === 'voided') {
                updates.push('voided_at = CURRENT_TIMESTAMP');
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No updates provided' } };
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id, user.id);

            await query.run(`UPDATE shipping_labels SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

            return { status: 200, data: { message: 'Label updated' } };
        } catch (error) {
            logger.error('[ShippingLabels] Error updating label', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/shipping-labels/:id - Delete label
    const deleteLabelMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteLabelMatch && !path.startsWith('/addresses') && !path.startsWith('/batches')) {
        try {
            const result = await query.run('DELETE FROM shipping_labels WHERE id = ? AND user_id = ? AND status = ?', [
                deleteLabelMatch[1],
                user.id,
                'draft',
            ]);

            if (result.changes === 0) {
                return {
                    status: 404,
                    data: { error: 'Label not found or cannot be deleted (only draft labels can be deleted)' },
                };
            }

            return { status: 200, data: { message: 'Label deleted' } };
        } catch (error) {
            logger.error('[ShippingLabels] Error deleting label', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Return Addresses
    // ============================================

    // GET /api/shipping-labels/addresses - List return addresses
    if (method === 'GET' && path === '/addresses') {
        try {
            const addresses = await query.all(
                'SELECT * FROM return_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
                [user.id],
            );

            return { status: 200, data: { addresses } };
        } catch (error) {
            logger.error('[ShippingLabels] Error listing return addresses', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shipping-labels/addresses - Create return address
    if (method === 'POST' && path === '/addresses') {
        try {
            const {
                name,
                company,
                street1,
                street2,
                city,
                state,
                zip,
                country = 'US',
                phone,
                is_default = false,
            } = body;

            if (!name || !street1 || !city || !state || !zip) {
                return { status: 400, data: { error: 'Name, street, city, state, and zip are required' } };
            }

            const id = uuidv4();

            if (is_default) {
                await query.run('UPDATE return_addresses SET is_default = FALSE WHERE user_id = ?', [user.id]);
            }

            await query.run(
                `
                INSERT INTO return_addresses (id, user_id, name, company, street1, street2, city, state, zip, country, phone, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [id, user.id, name, company, street1, street2, city, state, zip, country, phone, is_default ? 1 : 0],
            );

            return { status: 201, data: { message: 'Address created', id } };
        } catch (error) {
            logger.error('[ShippingLabels] Error creating return address', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/shipping-labels/addresses/:id
    const patchAddrMatch = path.match(/^\/addresses\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && patchAddrMatch) {
        try {
            const id = patchAddrMatch[1];
            const existing = await query.get('SELECT id FROM return_addresses WHERE id = ? AND user_id = ?', [
                id,
                user.id,
            ]);
            if (!existing) {
                return { status: 404, data: { error: 'Address not found' } };
            }

            const updates = [];
            const params = [];

            ['name', 'company', 'street1', 'street2', 'city', 'state', 'zip', 'country', 'phone'].forEach((field) => {
                if (body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(body[field]);
                }
            });

            if (body.is_default) {
                await query.run('UPDATE return_addresses SET is_default = FALSE WHERE user_id = ?', [user.id]);
                updates.push('is_default = TRUE');
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No updates provided' } };
            }

            params.push(id, user.id);
            await query.run(`UPDATE return_addresses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

            return { status: 200, data: { message: 'Address updated' } };
        } catch (error) {
            logger.error('[ShippingLabels] Error updating return address', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/shipping-labels/addresses/:id
    const deleteAddrMatch = path.match(/^\/addresses\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteAddrMatch) {
        try {
            const result = await query.run('DELETE FROM return_addresses WHERE id = ? AND user_id = ?', [
                deleteAddrMatch[1],
                user.id,
            ]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Address not found' } };
            }

            return { status: 200, data: { message: 'Address deleted' } };
        } catch (error) {
            logger.error('[ShippingLabels] Error deleting return address', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Label Batches
    // ============================================

    // GET /api/shipping-labels/batches - List batches
    if (method === 'GET' && path === '/batches') {
        try {
            const batches = await query.all(
                'SELECT * FROM label_batches WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
                [user.id],
            );

            return { status: 200, data: { batches } };
        } catch (error) {
            logger.error('[ShippingLabels] Error listing label batches', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shipping-labels/batches - Create batch
    if (method === 'POST' && path === '/batches') {
        try {
            const { name, label_ids } = body;

            if (!label_ids || !Array.isArray(label_ids) || label_ids.length === 0) {
                return { status: 400, data: { error: 'Label IDs are required' } };
            }

            const id = uuidv4();

            await query.run(
                `
                INSERT INTO label_batches (id, user_id, name, total_labels)
                VALUES (?, ?, ?, ?)
            `,
                [id, user.id, name || `Batch ${new Date().toLocaleDateString()}`, label_ids.length],
            );

            // Associate labels with batch
            for (const labelId of label_ids) {
                await query.run('UPDATE shipping_labels SET batch_id = ? WHERE id = ? AND user_id = ?', [
                    id,
                    labelId,
                    user.id,
                ]);
            }

            return { status: 201, data: { message: 'Batch created', id } };
        } catch (error) {
            logger.error('[ShippingLabels] Error creating label batch', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shipping-labels/batches/:id/process - Process batch
    const processBatchMatch = path.match(/^\/batches\/([a-f0-9-]+)\/process$/i);
    if (method === 'POST' && processBatchMatch) {
        try {
            const batchId = processBatchMatch[1];

            const batch = await query.get('SELECT * FROM label_batches WHERE id = ? AND user_id = ?', [
                batchId,
                user.id,
            ]);

            if (!batch) {
                return { status: 404, data: { error: 'Batch not found' } };
            }

            await query.run("UPDATE label_batches SET status = 'processing' WHERE id = ?", [batchId]);

            const labels = await query.all(
                "SELECT * FROM shipping_labels WHERE batch_id = ? AND user_id = ? AND status = 'draft'",
                [batchId, user.id],
            );

            let completed = 0;
            let failed = 0;
            let totalPostage = 0;

            for (const label of labels) {
                try {
                    let postage = label.postage_cost || 0;

                    if (process.env.EASYPOST_API_KEY && label.external_shipment_id && label.rate_id) {
                        const purchase = await buyEasyPostShipment(label.external_shipment_id, label.rate_id, user);
                        if (purchase.status !== 200) {
                            throw new Error(purchase.data.detail || purchase.data.error || 'EasyPost purchase failed');
                        }
                        const shipment = purchase.data.shipment;
                        const purchasedRate = Number.parseFloat(shipment.selected_rate?.rate);
                        if (Number.isFinite(purchasedRate)) postage = purchasedRate;
                        const postageLabel = shipment.postage_label || {};
                        await query.run(
                            `UPDATE shipping_labels
                         SET status = 'purchased',
                             purchased_at = CURRENT_TIMESTAMP,
                             tracking_number = ?,
                             label_url = ?,
                             external_label_id = ?,
                             total_cost = ?,
                             currency = ?
                         WHERE id = ? AND user_id = ?`,
                            [
                                shipment.tracking_code || null,
                                postageLabel.label_url || null,
                                postageLabel.id || null,
                                postage,
                                shipment.selected_rate?.currency || label.currency || 'USD',
                                label.id,
                                user.id,
                            ],
                        );
                    } else {
                        await query.run(
                            "UPDATE shipping_labels SET status = 'purchased', purchased_at = CURRENT_TIMESTAMP, total_cost = COALESCE(postage_cost, 0) + COALESCE(insurance_cost, 0) WHERE id = ? AND user_id = ?",
                            [label.id, user.id],
                        );
                    }

                    totalPostage += postage;
                    completed++;
                } catch (error) {
                    await query.run("UPDATE shipping_labels SET status = 'draft' WHERE id = ? AND user_id = ?", [
                        label.id,
                        user.id,
                    ]);
                    failed++;
                }
            }

            const finalStatus = failed === labels.length ? 'failed' : failed > 0 ? 'partial' : 'completed';

            await query.run(
                `
            UPDATE label_batches
            SET status = ?, completed_labels = ?, failed_labels = ?, total_postage = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
                [finalStatus, completed, failed, totalPostage, batchId],
            );

            return {
                status: 200,
                data: {
                    message: `Batch processed: ${completed} completed, ${failed} failed`,
                    completed,
                    failed,
                    total_postage: totalPostage,
                },
            };
        } catch (error) {
            logger.error('[ShippingLabels] Error processing label batch', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Rate Shopping
    // ============================================

    // POST /api/shipping-labels/rates - Get shipping rates
    if (method === 'POST' && path === '/rates') {
        try {
            const { weight_oz, from_zip, to_zip } = body || {};

            if (!positiveNumber(weight_oz) || !from_zip || !to_zip) {
                return { status: 400, data: { error: 'Weight, from_zip, and to_zip are required' } };
            }

            if (!process.env.EASYPOST_API_KEY) {
                return {
                    status: 503,
                    data: {
                        error: 'EasyPost not configured',
                        message: 'Set EASYPOST_API_KEY in .env to enable real shipping rates.',
                    },
                };
            }

            return await fetchEasyPostRates(body, user, { persist: true });
        } catch (error) {
            logger.error('[ShippingLabels] Error fetching shipping rates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Print & Download Enhancements
    // ============================================

    // POST /api/shipping-labels/print-batch - Mark labels as printed
    if (method === 'POST' && path === '/print-batch') {
        try {
            const { label_ids, format = 'thermal_4x6' } = body;

            if (!label_ids || !Array.isArray(label_ids) || label_ids.length === 0) {
                return { status: 400, data: { error: 'Label IDs are required' } };
            }

            let printed = 0;
            for (const labelId of label_ids) {
                const result = await query.run(
                    `
                    UPDATE shipping_labels
                    SET printed_at = NOW(), label_format = ?, status = CASE WHEN status = 'purchased' THEN 'printed' ELSE status END
                    WHERE id = ? AND user_id = ?
                `,
                    [format, labelId, user.id],
                );
                if (result.changes > 0) printed++;
            }

            return {
                status: 200,
                data: {
                    message: `${printed} label(s) marked as printed`,
                    printed,
                    format,
                },
            };
        } catch (error) {
            logger.error('[ShippingLabels] Error marking labels as printed', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shipping-labels/download-batch - Get batch download info
    if (method === 'GET' && path === '/download-batch') {
        try {
            const { label_ids, format = 'pdf' } = queryParams;

            if (!label_ids) {
                return { status: 400, data: { error: 'Label IDs are required' } };
            }

            const ids = typeof label_ids === 'string' ? label_ids.split(',') : label_ids;
            const placeholders = ids.map(() => '?').join(',');
            const labels = await query.all(
                `SELECT id, label_url, label_data, carrier, tracking_number FROM shipping_labels WHERE id IN (${placeholders}) AND user_id = ?`,
                [...ids, user.id],
            );

            return {
                status: 200,
                data: {
                    labels,
                    total: labels.length,
                    format,
                    download_ready: labels.every((l) => l.label_url || l.label_data),
                },
            };
        } catch (error) {
            logger.error('[ShippingLabels] Error fetching batch download info', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shipping-labels/generate-pdf - Generate combined PDF for multiple labels
    if (method === 'POST' && path === '/generate-pdf') {
        try {
            const { label_ids, format = 'thermal_4x6', layout = 'single' } = body;

            if (!label_ids || !Array.isArray(label_ids) || label_ids.length === 0) {
                return { status: 400, data: { error: 'Label IDs are required' } };
            }

            const placeholders = label_ids.map(() => '?').join(',');
            const labels = await query.all(
                `
                SELECT id, to_name, to_company, to_street1, to_street2, to_city, to_state, to_zip, to_country,
                       from_name, from_company, from_street1, from_city, from_state, from_zip,
                       carrier, service_type, tracking_number, weight_oz, total_cost, label_url, label_data,
                       created_at
                FROM shipping_labels
                WHERE id IN (${placeholders}) AND user_id = ?
            `,
                [...label_ids, user.id],
            );

            if (labels.length === 0) {
                return { status: 404, data: { error: 'No labels found' } };
            }

            // Format settings based on label type
            const formatSettings = {
                thermal_4x6: { width: 4, height: 6, unit: 'in' },
                letter_8x11: { width: 8.5, height: 11, unit: 'in' },
                a4: { width: 210, height: 297, unit: 'mm' },
            };

            const settings = formatSettings[format] || formatSettings.thermal_4x6;

            // Generate PDF data structure (actual PDF generation happens on frontend)
            const pdfData = {
                format,
                settings,
                layout, // 'single' = one label per page, 'grid' = multiple per page
                labels: labels.map((label) => ({
                    id: label.id,
                    recipient: {
                        name: label.to_name,
                        company: label.to_company,
                        street1: label.to_street1,
                        street2: label.to_street2,
                        city: label.to_city,
                        state: label.to_state,
                        zip: label.to_zip,
                        country: label.to_country || 'US',
                    },
                    sender: {
                        name: label.from_name,
                        company: label.from_company,
                        street1: label.from_street1,
                        city: label.from_city,
                        state: label.from_state,
                        zip: label.from_zip,
                    },
                    shipping: {
                        carrier: label.carrier,
                        service: label.service_type,
                        tracking: label.tracking_number,
                        weight: label.weight_oz,
                        cost: label.total_cost,
                    },
                    label_url: label.label_url,
                    label_data: label.label_data,
                    created_at: label.created_at,
                })),
                generated_at: new Date().toISOString(),
                total_labels: labels.length,
                total_postage: labels.reduce((sum, l) => sum + (l.total_cost || 0), 0),
            };

            // Mark labels as part of a batch PDF
            const batchId = `pdf-${Date.now()}`;
            await query.run(
                `
                UPDATE shipping_labels
                SET batch_id = ?, updated_at = NOW()
                WHERE id IN (${placeholders}) AND user_id = ?
            `,
                [batchId, ...label_ids, user.id],
            );

            return {
                status: 200,
                data: {
                    pdf_data: pdfData,
                    batch_id: batchId,
                    message: `PDF data generated for ${labels.length} label(s)`,
                },
            };
        } catch (error) {
            logger.error('[ShippingLabels] Error generating PDF data', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shipping-labels/stats - Label statistics
    if (method === 'GET' && path === '/stats') {
        const { startDate, endDate } = queryParams;
        const dateStart = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateEnd = endDate || new Date().toISOString().split('T')[0];

        try {
            const stats = {
                total_labels:
                    Number(
                        (
                            await query.get(
                                'SELECT COUNT(*) as count FROM shipping_labels WHERE user_id = ? AND created_at BETWEEN ? AND ?',
                                [user.id, dateStart, dateEnd + 'T23:59:59'],
                            )
                        )?.count,
                    ) || 0,
                printed_labels:
                    Number(
                        (
                            await query.get(
                                'SELECT COUNT(*) as count FROM shipping_labels WHERE user_id = ? AND printed_at IS NOT NULL AND created_at BETWEEN ? AND ?',
                                [user.id, dateStart, dateEnd + 'T23:59:59'],
                            )
                        )?.count,
                    ) || 0,
                shipped_labels:
                    Number(
                        (
                            await query.get(
                                "SELECT COUNT(*) as count FROM shipping_labels WHERE user_id = ? AND status = 'shipped' AND created_at BETWEEN ? AND ?",
                                [user.id, dateStart, dateEnd + 'T23:59:59'],
                            )
                        )?.count,
                    ) || 0,
                total_postage:
                    Number(
                        (
                            await query.get(
                                'SELECT SUM(total_cost) as total FROM shipping_labels WHERE user_id = ? AND created_at BETWEEN ? AND ?',
                                [user.id, dateStart, dateEnd + 'T23:59:59'],
                            )
                        )?.total,
                    ) || 0,
                by_carrier: await query.all(
                    'SELECT carrier, COUNT(*) as count, SUM(total_cost) as cost FROM shipping_labels WHERE user_id = ? AND created_at BETWEEN ? AND ? GROUP BY carrier',
                    [user.id, dateStart, dateEnd + 'T23:59:59'],
                ),
                by_status: await query.all(
                    'SELECT status, COUNT(*) as count FROM shipping_labels WHERE user_id = ? AND created_at BETWEEN ? AND ? GROUP BY status',
                    [user.id, dateStart, dateEnd + 'T23:59:59'],
                ),
            };

            return { status: 200, data: { stats } };
        } catch (error) {
            logger.error('[ShippingLabels] Shipping label stats error', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch shipping label statistics' } };
        }
    }

    // POST /api/shipping-labels/easypost/rates
    if (method === 'POST' && path === '/easypost/rates') {
        const { from_zip, to_zip, weight_oz } = body || {};
        if (!from_zip || !to_zip || !positiveNumber(weight_oz)) {
            return { status: 400, data: { error: 'from_zip, to_zip, and weight_oz are required' } };
        }
        if (!process.env.EASYPOST_API_KEY) {
            return {
                status: 503,
                data: {
                    error: 'EasyPost not configured',
                    message: 'Set EASYPOST_API_KEY in .env to enable EasyPost rates.',
                },
            };
        }
        try {
            return await fetchEasyPostRates(body, user);
        } catch (error) {
            logger.error('[EasyPost] Error fetching rates', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch EasyPost rates' } };
        }
    }

    // POST /api/shipping-labels/easypost/buy
    if (method === 'POST' && path === '/easypost/buy') {
        const { shipment_id, rate_id, order_id, sale_id } = body || {};
        if (!shipment_id || !rate_id) {
            return { status: 400, data: { error: 'shipment_id and rate_id are required' } };
        }
        if (!process.env.EASYPOST_API_KEY) {
            return {
                status: 503,
                data: {
                    error: 'EasyPost not configured',
                    message: 'Set EASYPOST_API_KEY in .env to enable EasyPost label purchase.',
                },
            };
        }
        try {
            const purchase = await buyEasyPostShipment(shipment_id, rate_id, user);
            if (purchase.status !== 200) return purchase;
            const shipment = purchase.data.shipment;
            const postageLabel = shipment.postage_label || {};
            const tracking = shipment.tracking_code || null;
            const cost = Number.parseFloat(shipment.selected_rate?.rate);
            const labelId = uuidv4();
            await query.run(
                `INSERT INTO shipping_labels (
                    id, user_id, order_id, sale_id, carrier, service_type, tracking_number, label_url,
                    total_cost, currency, external_label_id, external_shipment_id, rate_id, status, purchased_at
                )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'purchased', NOW())`,
                [
                    labelId,
                    user.id,
                    order_id || null,
                    sale_id || null,
                    shipment.selected_rate?.carrier || 'EasyPost',
                    shipment.selected_rate?.service || null,
                    tracking,
                    postageLabel.label_url || null,
                    Number.isFinite(cost) ? cost : 0,
                    shipment.selected_rate?.currency || 'USD',
                    postageLabel.id || null,
                    shipment.id || shipment_id,
                    rate_id,
                ],
            );
            return {
                status: 200,
                data: {
                    label_id: labelId,
                    label_url: postageLabel.label_url || null,
                    tracking_number: tracking,
                    carrier: shipment.selected_rate?.carrier,
                    service: shipment.selected_rate?.service,
                    cost: Number.isFinite(cost) ? cost : 0,
                },
            };
        } catch (error) {
            logger.error('[EasyPost] Error purchasing label', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to purchase EasyPost label' } };
        }
    }

    // GET /api/shipping-labels/easypost/track/:trackingCode
    const epTrackMatch = path.match(/^\/easypost\/track\/(.+)$/);
    if (method === 'GET' && epTrackMatch) {
        const trackingCode = epTrackMatch[1];
        if (!process.env.EASYPOST_API_KEY) {
            return { status: 503, data: { error: 'EasyPost not configured' } };
        }
        try {
            const res = await fetch(
                `https://api.easypost.com/v2/trackers?tracking_code=${encodeURIComponent(trackingCode)}`,
                {
                    headers: { Authorization: getEasyPostAuthHeader() },
                },
            );
            if (!res.ok) {
                return { status: 502, data: { error: 'EasyPost tracking error' } };
            }
            const data = await res.json();
            const tracker = (data.trackers || [])[0] || null;
            return { status: 200, data: { tracker } };
        } catch (error) {
            logger.error('[EasyPost] Error tracking shipment', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to track shipment' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
