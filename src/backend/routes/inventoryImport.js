// Inventory Import Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */
function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function inventoryImportRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ============================================
    // Import Jobs CRUD
    // ============================================

    // GET /api/inventory-import/jobs - List import jobs
    if (method === 'GET' && path === '/jobs') {
        try {
            const { status, limit: rawLimit = 50, offset: rawOffset = 0 } = queryParams;

            let sql = 'SELECT * FROM import_jobs WHERE user_id = ?';
            const params = [user.id];

            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }

            const limit = Math.min(Math.max(1, parseInt(rawLimit) || 50), 200);
            const offset = Math.max(0, parseInt(rawOffset) || 0);
            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const jobs = await query.all(sql, params);

            return {
                status: 200,
                data: {
                    jobs: jobs.map(j => ({
                        ...j,
                        field_mapping: safeJsonParse(j.field_mapping, null),
                        errors: safeJsonParse(j.errors, []),
                        preview_data: safeJsonParse(j.preview_data, null)
                    }))
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error listing import jobs', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/inventory-import/jobs/:id - Get single job
    const getJobMatch = path.match(/^\/jobs\/([a-f0-9-]+)$/i);
    if (method === 'GET' && getJobMatch) {
        try {
            const job = await query.get(
                'SELECT * FROM import_jobs WHERE id = ? AND user_id = ?',
                [getJobMatch[1], user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Import job not found' } };
            }

            return {
                status: 200,
                data: {
                    job: {
                        ...job,
                        field_mapping: safeJsonParse(job.field_mapping, null),
                        errors: safeJsonParse(job.errors, []),
                        preview_data: safeJsonParse(job.preview_data, null)
                    }
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error fetching import job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/inventory-import/jobs/:id/rows - Get import row results
    const getRowsMatch = path.match(/^\/jobs\/([a-f0-9-]+)\/rows$/i);
    if (method === 'GET' && getRowsMatch) {
        try {
            // Verify job belongs to authenticated user (prevent IDOR)
            const ownerCheck = await query.get(
                'SELECT id FROM import_jobs WHERE id = ? AND user_id = ?',
                [getRowsMatch[1], user.id]
            );
            if (!ownerCheck) {
                return { status: 404, data: { error: 'Import job not found' } };
            }

            const { status: rowStatus, limit: rawLimit = 100, offset: rawOffset = 0 } = queryParams;

            const limit = Math.min(Math.max(1, parseInt(rawLimit) || 100), 500);
            const offset = Math.max(0, parseInt(rawOffset) || 0);

            let sql = 'SELECT * FROM import_rows WHERE job_id = ?';
            const params = [getRowsMatch[1]];

            if (rowStatus) {
                sql += ' AND status = ?';
                params.push(rowStatus);
            }

            sql += ' ORDER BY row_number ASC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const rows = await query.all(sql, params);

            return {
                status: 200,
                data: {
                    rows: rows.map(r => ({
                        ...r,
                        raw_data: safeJsonParse(r.raw_data, null),
                        parsed_data: safeJsonParse(r.parsed_data, null),
                        validation_errors: safeJsonParse(r.validation_errors, [])
                    }))
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error fetching import rows', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/inventory-import/upload - Upload file and create job
    if (method === 'POST' && path === '/upload') {
      try {
        const {
            filename, source_type, data, has_header_row = true,
            skip_rows = 0, date_format = 'MM/DD/YYYY', name
        } = body;

        if (!source_type || !data) {
            return { status: 400, data: { error: 'Source type and data are required' } };
        }

        // Fix 5: Strip UTF-8 BOM if present at the start of CSV/TSV content
        let fileContent = data;
        if (typeof fileContent === 'string' && fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
        }

        const dataSize = typeof fileContent === 'string' ? fileContent.length : JSON.stringify(fileContent).length;
        if (dataSize > 10 * 1024 * 1024) {
            return { status: 400, data: { error: 'File too large. Maximum size is 10MB' } };
        }

        if (!['csv', 'excel', 'tsv', 'json'].includes(source_type)) {
            return { status: 400, data: { error: 'Invalid source type. Must be csv, excel, tsv, or json' } };
        }

        // Fix 3: Sanitize filename to prevent path traversal
        const safeName = filename
            ? filename.replace(/[/\\]/g, '_').replace(/\.\./g, '_')
            : null;

        const id = uuidv4();

        // Parse the data to get preview
        let rows = [];
        let headers = [];
        let rawArrayRows = [];

        let skippedTitleRows = 0;
        let columnWarnings = 0;

        try {
            if (source_type === 'json') {
                rows = typeof fileContent === 'string' ? safeJsonParse(fileContent, []) : fileContent;
                if (Array.isArray(rows) && rows.length > 0) {
                    headers = Object.keys(rows[0]);
                }
            } else {
                // CSV/TSV parsing with smart header detection
                const separator = source_type === 'tsv' ? '\t' : ',';
                const lines = (typeof fileContent === 'string' ? fileContent : '').split('\n').filter(l => l.trim());
                const parsedLines = lines.map(l => parseCSVLine(l, separator));

                if (has_header_row && parsedLines.length > 0) {
                    // Smart header detection: find the real header row
                    // Title/metadata rows typically have most cells empty and 1-2 cells with long text
                    let headerRowIndex = 0 + skip_rows;

                    for (let r = headerRowIndex; r < Math.min(parsedLines.length, 10); r++) {
                        const cells = parsedLines[r];
                        const totalCells = cells.length;
                        if (totalCells <= 1) continue; // Single-column rows aren't useful for detection

                        const nonEmpty = cells.filter(c => c && c.trim()).length;
                        const nonEmptyRatio = nonEmpty / totalCells;

                        // A good header row has >30% of cells filled with short-ish distinct values
                        // A title row typically has <=1-2 filled cells out of many columns
                        if (nonEmptyRatio >= 0.3 || (totalCells <= 3 && nonEmpty >= 1)) {
                            headerRowIndex = r;
                            break;
                        }

                        // This row looks like a title/metadata row — skip it
                        skippedTitleRows++;
                    }

                    headers = parsedLines[headerRowIndex] || [];

                    // Ensure every header has a unique non-empty key
                    // Empty headers get "Column N", duplicates get "(2)", "(3)" suffix
                    const headerCounts = {};
                    headers = headers.map((h, idx) => {
                        let name = (h && h.trim()) ? h.trim() : `Column ${idx + 1}`;
                        const key = name.toLowerCase();
                        headerCounts[key] = (headerCounts[key] || 0) + 1;
                        if (headerCounts[key] > 1) {
                            name = `${name} (${headerCounts[key]})`;
                        }
                        return name;
                    });

                    // Parse data rows (everything after the header row)
                    for (let i = headerRowIndex + 1; i < parsedLines.length; i++) {
                        const values = parsedLines[i];
                        // Skip completely empty rows
                        if (values.every(v => !v || !v.trim())) continue;
                        // Warn if column count doesn't match headers
                        if (values.length !== headers.length) columnWarnings++;
                        const row = {};
                        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                        rows.push(row);
                        // Also store as array for lossless display
                        rawArrayRows.push(values.map(v => v || ''));
                    }
                } else {
                    const colCount = parsedLines.reduce((max, l) => Math.max(max, l.length), 0);
                    headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
                    for (let i = skip_rows; i < parsedLines.length; i++) {
                        const values = parsedLines[i];
                        if (values.every(v => !v || !v.trim())) continue;
                        const row = {};
                        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                        rows.push(row);
                        rawArrayRows.push(values.map(v => v || ''));
                    }
                }
            }
        } catch (parseError) {
            return { status: 400, data: { error: `Failed to parse file: ${parseError.message}` } };
        }

        if (rows.length > 1000) {
            return { status: 400, data: { error: 'Maximum 1000 items per import. File contains ' + rows.length + ' rows' } };
        }

        const previewData = {
            headers,
            rows: rows,
            cell_data: rawArrayRows,
            total_rows: rows.length,
            skipped_title_rows: skippedTitleRows
        };

        await query.run(`
            INSERT INTO import_jobs (
                id, user_id, name, source_type, original_filename, file_size,
                status, has_header_row, skip_rows, date_format,
                total_rows, preview_data
            ) VALUES (?, ?, ?, ?, ?, ?, 'mapping', ?, ?, ?, ?, ?)
        `, [
            id, user.id, name || safeName || 'Import',
            source_type, safeName, typeof fileContent === 'string' ? fileContent.length : 0,
            has_header_row ? 1 : 0, skip_rows, date_format,
            rows.length, JSON.stringify(previewData)
        ]);

        // Store rows for later processing
        for (let i = 0; i < rows.length; i++) {
            const rowId = uuidv4();
            await query.run(`
                INSERT INTO import_rows (id, job_id, row_number, raw_data)
                VALUES (?, ?, ?, ?)
            `, [rowId, id, i + 1, JSON.stringify(rows[i])]);
        }

        const warnings = [];
        if (columnWarnings > 0) {
            warnings.push(`${columnWarnings} row(s) have a different number of columns than the header row`);
        }

        return {
            status: 201,
            data: {
                message: 'File uploaded and parsed',
                id,
                preview: previewData,
                ...(warnings.length > 0 && { warnings })
            }
        };
      } catch (error) {
          logger.error('[InventoryImport] Error uploading and parsing file', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/inventory-import/jobs/:id/mapping - Set field mapping
    const setMappingMatch = path.match(/^\/jobs\/([a-f0-9-]+)\/mapping$/i);
    if (method === 'POST' && setMappingMatch) {
        try {
            const jobId = setMappingMatch[1];
            const { field_mapping } = body;

            if (!field_mapping || typeof field_mapping !== 'object') {
                return { status: 400, data: { error: 'Field mapping object is required' } };
            }

            const job = await query.get(
                'SELECT id FROM import_jobs WHERE id = ? AND user_id = ?',
                [jobId, user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Import job not found' } };
            }

            await query.run(`
                UPDATE import_jobs SET field_mapping = ?, status = 'validating'
                WHERE id = ?
            `, [JSON.stringify(field_mapping), jobId]);

            return { status: 200, data: { message: 'Field mapping saved' } };
        } catch (error) {
            logger.error('[InventoryImport] Error saving field mapping', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/inventory-import/jobs/:id/validate - Validate import data
    const validateMatch = path.match(/^\/jobs\/([a-f0-9-]+)\/validate$/i);
    if (method === 'POST' && validateMatch) {
        try {
            const jobId = validateMatch[1];

            const job = await query.get(
                'SELECT * FROM import_jobs WHERE id = ? AND user_id = ?',
                [jobId, user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Import job not found' } };
            }

            const fieldMapping = safeJsonParse(job.field_mapping, null);
            if (!fieldMapping) {
                return { status: 400, data: { error: 'Field mapping must be set before validation' } };
            }

            const rows = await query.all(
                'SELECT * FROM import_rows WHERE job_id = ? ORDER BY row_number ASC',
                [jobId]
            );

            const errors = [];
            let validCount = 0;
            let errorCount = 0;

            for (const row of rows) {
                const rawData = safeJsonParse(row.raw_data, {});
                const parsed = {};
                const rowErrors = [];

                // Apply field mapping
                for (const [inventoryField, sourceField] of Object.entries(fieldMapping)) {
                    if (sourceField && rawData[sourceField] !== undefined) {
                        parsed[inventoryField] = rawData[sourceField];
                    }
                }

                // Clean numeric fields — strip currency symbols, commas, whitespace
                const cleanNum = (val) => {
                    if (val == null || val === '') return val;
                    return String(val).replace(/[$£€¥,\s]/g, '').trim();
                };
                if (parsed.list_price != null) parsed.list_price = cleanNum(parsed.list_price);
                if (parsed.cost != null) parsed.cost = cleanNum(parsed.cost);
                if (parsed.quantity != null) parsed.quantity = cleanNum(parsed.quantity);

                // Validate required fields
                if (!parsed.title || String(parsed.title).trim() === '') {
                    rowErrors.push({ field: 'title', message: 'Title is required' });
                }

                // Validate numeric fields (after cleaning)
                if (parsed.list_price != null && parsed.list_price !== '' && isNaN(parseFloat(parsed.list_price))) {
                    rowErrors.push({ field: 'list_price', message: 'Invalid price format' });
                }
                if (parsed.cost != null && parsed.cost !== '' && isNaN(parseFloat(parsed.cost))) {
                    rowErrors.push({ field: 'cost', message: 'Invalid cost format' });
                }
                if (parsed.quantity != null && parsed.quantity !== '' && isNaN(parseInt(parsed.quantity))) {
                    rowErrors.push({ field: 'quantity', message: 'Invalid quantity format' });
                }

                const rowStatus = rowErrors.length > 0 ? 'failed' : 'pending';
                if (rowErrors.length > 0) {
                    errorCount++;
                    errors.push({ row: row.row_number, errors: rowErrors });
                } else {
                    validCount++;
                }

                await query.run(`
                    UPDATE import_rows SET parsed_data = ?, status = ?, validation_errors = ?
                    WHERE id = ?
                `, [JSON.stringify(parsed), rowStatus, rowErrors.length > 0 ? JSON.stringify(rowErrors) : null, row.id]);
            }

            await query.run(`
                UPDATE import_jobs SET status = 'validating', errors = ?
                WHERE id = ?
            `, [errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null, jobId]);

            return {
                status: 200,
                data: {
                    valid: validCount,
                    invalid: errorCount,
                    total: rows.length,
                    errors: errors.slice(0, 20)
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error validating import data', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/inventory-import/jobs/:id/execute - Execute import
    const executeMatch = path.match(/^\/jobs\/([a-f0-9-]+)\/execute$/i);
    if (method === 'POST' && executeMatch) {
      try {
        const jobId = executeMatch[1];
        const { update_existing = false, skip_duplicates = true } = body;

        const job = await query.get(
            'SELECT * FROM import_jobs WHERE id = ? AND user_id = ?',
            [jobId, user.id]
        );

        if (!job) {
            return { status: 404, data: { error: 'Import job not found' } };
        }

        await query.run(`
            UPDATE import_jobs SET status = 'importing', started_at = CURRENT_TIMESTAMP,
                update_existing = ?, skip_duplicates = ?
            WHERE id = ?
        `, [update_existing ? 1 : 0, skip_duplicates ? 1 : 0, jobId]);

        const rows = await query.all(
            "SELECT * FROM import_rows WHERE job_id = ? AND status = 'pending' ORDER BY row_number ASC",
            [jobId]
        );

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        let duplicates = 0;

        for (const row of rows) {
            try {
                const parsed = safeJsonParse(row.parsed_data, {});

                if (!parsed.title) {
                    await query.run("UPDATE import_rows SET status = 'skipped' WHERE id = ?", [row.id]);
                    skipped++;
                    continue;
                }

                // Check for duplicates by SKU
                if (parsed.sku) {
                    const existing = await query.get(
                        'SELECT id FROM inventory WHERE user_id = ? AND sku = ?',
                        [user.id, parsed.sku]
                    );

                    if (existing) {
                        if (update_existing) {
                            // Update existing item
                            const updateFields = [];
                            const updateParams = [];

                            ['title', 'description', 'brand', 'category', 'condition', 'size', 'color'].forEach(f => {
                                if (parsed[f]) {
                                    updateFields.push(`${f} = ?`);
                                    updateParams.push(parsed[f]);
                                }
                            });

                            if (parsed.list_price) {
                                updateFields.push('list_price = ?');
                                updateParams.push(parseFloat(parsed.list_price));
                            }
                            if (parsed.cost) {
                                updateFields.push('cost = ?');
                                updateParams.push(parseFloat(parsed.cost));
                            }
                            if (parsed.quantity !== undefined && parsed.quantity !== '') {
                                updateFields.push('quantity = ?');
                                updateParams.push(parseInt(parsed.quantity));
                            }

                            if (updateFields.length > 0) {
                                updateFields.push('updated_at = CURRENT_TIMESTAMP');
                                updateParams.push(existing.id);
                                await query.run(`UPDATE inventory SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
                            }

                            await query.run(`
                                UPDATE import_rows SET status = 'updated', inventory_id = ? WHERE id = ?
                            `, [existing.id, row.id]);
                            updated++;
                            continue;
                        } else if (skip_duplicates) {
                            await query.run("UPDATE import_rows SET status = 'duplicate' WHERE id = ?", [row.id]);
                            duplicates++;
                            continue;
                        }
                    }
                }

                // Create new inventory item
                const inventoryId = uuidv4();
                // Normalize condition to match CHECK constraint
                const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
                let condition = parsed.condition ? String(parsed.condition).toLowerCase().replace(/\s+/g, '_') : null;
                if (condition && !validConditions.includes(condition)) condition = null;

                await query.run(`
                    INSERT INTO inventory (
                        id, user_id, title, description, sku, brand, category,
                        condition, size, color, list_price, cost_price, quantity, status, location, notes, tags
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
                `, [
                    inventoryId, user.id,
                    parsed.title,
                    parsed.description || '',
                    parsed.sku || null,
                    parsed.brand || null,
                    parsed.category || null,
                    condition,
                    parsed.size || null,
                    parsed.color || null,
                    parsed.list_price ? parseFloat(parsed.list_price) : 0,
                    parsed.cost ? parseFloat(parsed.cost) : 0,
                    parsed.quantity !== undefined && parsed.quantity !== '' ? parseInt(parsed.quantity) : 1,
                    parsed.location || null,
                    parsed.notes || null,
                    parsed.tags ? JSON.stringify(String(parsed.tags).split(',').map(t => t.trim()).filter(Boolean)) : '[]'
                ]);

                await query.run(`
                    UPDATE import_rows SET status = 'imported', inventory_id = ? WHERE id = ?
                `, [inventoryId, row.id]);
                imported++;

            } catch (error) {
                await query.run(`
                    UPDATE import_rows SET status = 'failed', error_message = ? WHERE id = ?
                `, [error.message, row.id]);
                failed++;
            }
        }

        const finalStatus = failed === rows.length ? 'failed' : 'completed';

        await query.run(`
            UPDATE import_jobs
            SET status = ?, completed_at = CURRENT_TIMESTAMP,
                processed_rows = ?, imported_rows = ?, skipped_rows = ?,
                failed_rows = ?, duplicate_rows = ?
            WHERE id = ?
        `, [finalStatus, imported + updated + skipped + failed + duplicates,
            imported, skipped, failed, duplicates, jobId]);

        return {
            status: 200,
            data: {
                message: `Import ${finalStatus}`,
                imported,
                updated,
                skipped,
                failed,
                duplicates,
                total: rows.length
            }
        };
      } catch (error) {
          logger.error('[InventoryImport] Error executing import', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/inventory-import/jobs/:id/cancel - Cancel import job
    const cancelMatch = path.match(/^\/jobs\/([a-f0-9-]+)\/cancel$/i);
    if (method === 'POST' && cancelMatch) {
        try {
            const result = await query.run(`
                UPDATE import_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ? AND status IN ('pending', 'mapping', 'validating')
            `, [cancelMatch[1], user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Job not found or cannot be cancelled' } };
            }

            return { status: 200, data: { message: 'Import job cancelled' } };
        } catch (error) {
            logger.error('[InventoryImport] Error cancelling import job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/inventory-import/jobs/:id - Delete import job
    const deleteJobMatch = path.match(/^\/jobs\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteJobMatch) {
        try {
            const result = await query.run(
                'DELETE FROM import_jobs WHERE id = ? AND user_id = ?',
                [deleteJobMatch[1], user.id]
            );

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Import job not found' } };
            }

            return { status: 200, data: { message: 'Import job deleted' } };
        } catch (error) {
            logger.error('[InventoryImport] Error deleting import job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Saved Field Mappings (Templates)
    // ============================================

    // GET /api/inventory-import/mappings - List saved mappings
    if (method === 'GET' && path === '/mappings') {
        try {
            const mappings = await query.all(
                'SELECT * FROM import_mappings WHERE user_id = ? ORDER BY use_count DESC, created_at DESC',
                [user.id]
            );

            return {
                status: 200,
                data: {
                    mappings: mappings.map(m => ({
                        ...m,
                        field_mapping: safeJsonParse(m.field_mapping, {})
                    }))
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error listing mapping templates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/inventory-import/mappings - Save mapping template
    if (method === 'POST' && path === '/mappings') {
        try {
            const {
                name, description, source_type, source_name,
                field_mapping, has_header_row = true, skip_rows = 0,
                date_format = 'MM/DD/YYYY', is_default = false
            } = body;

            if (!name || !field_mapping) {
                return { status: 400, data: { error: 'Name and field mapping are required' } };
            }

            const id = uuidv4();

            if (is_default) {
                await query.run('UPDATE import_mappings SET is_default = 0 WHERE user_id = ?', [user.id]);
            }

            await query.run(`
                INSERT INTO import_mappings (
                    id, user_id, name, description, source_type, source_name,
                    field_mapping, has_header_row, skip_rows, date_format, is_default
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, user.id, name, description, source_type, source_name,
                JSON.stringify(field_mapping), has_header_row ? 1 : 0, skip_rows,
                date_format, is_default ? 1 : 0
            ]);

            return { status: 201, data: { message: 'Mapping template saved', id } };
        } catch (error) {
            logger.error('[InventoryImport] Error saving mapping template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/inventory-import/mappings/:id
    const patchMappingMatch = path.match(/^\/mappings\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && patchMappingMatch) {
        try {
            const id = patchMappingMatch[1];

            const existing = await query.get('SELECT id FROM import_mappings WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!existing) {
                return { status: 404, data: { error: 'Mapping template not found' } };
            }

            const updates = [];
            const params = [];

            ['name', 'description', 'source_type', 'source_name', 'date_format'].forEach(field => {
                if (body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(body[field]);
                }
            });

            if (body.field_mapping) {
                updates.push('field_mapping = ?');
                params.push(JSON.stringify(body.field_mapping));
            }

            if (body.has_header_row !== undefined) {
                updates.push('has_header_row = ?');
                params.push(body.has_header_row ? 1 : 0);
            }

            if (body.skip_rows !== undefined) {
                updates.push('skip_rows = ?');
                params.push(body.skip_rows);
            }

            if (body.is_default) {
                await query.run('UPDATE import_mappings SET is_default = 0 WHERE user_id = ?', [user.id]);
                updates.push('is_default = 1');
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No updates provided' } };
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            await query.run(`UPDATE import_mappings SET ${updates.join(', ')} WHERE id = ?`, params);

            return { status: 200, data: { message: 'Mapping template updated' } };
        } catch (error) {
            logger.error('[InventoryImport] Error updating mapping template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/inventory-import/mappings/:id
    const deleteMappingMatch = path.match(/^\/mappings\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteMappingMatch) {
        try {
            const result = await query.run(
                'DELETE FROM import_mappings WHERE id = ? AND user_id = ?',
                [deleteMappingMatch[1], user.id]
            );

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Mapping template not found' } };
            }

            return { status: 200, data: { message: 'Mapping template deleted' } };
        } catch (error) {
            logger.error('[InventoryImport] Error deleting mapping template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ============================================
    // Template Download & Validation Helpers
    // ============================================

    // GET /api/inventory-import/templates/download - Download blank import template
    if (method === 'GET' && path === '/templates/download') {
        try {
            const { format = 'csv' } = queryParams;

            const headers = [
                'title', 'description', 'sku', 'brand', 'category', 'condition',
                'size', 'color', 'list_price', 'cost', 'quantity', 'location',
                'notes', 'tags'
            ];

            let content = '';
            let contentType = 'text/csv';
            let filename = 'inventory_import_template.csv';

            if (format === 'csv') {
                content = headers.join(',') + '\n';
                content += '"Example Item","Description here","SKU-001","Brand Name","Clothing","New","M","Blue","29.99","15.00","1","Bin A1","Optional notes","tag1,tag2"\n';
            } else if (format === 'tsv') {
                content = headers.join('\t') + '\n';
                content += 'Example Item\tDescription here\tSKU-001\tBrand Name\tClothing\tNew\tM\tBlue\t29.99\t15.00\t1\tBin A1\tOptional notes\ttag1,tag2\n';
                contentType = 'text/tab-separated-values';
                filename = 'inventory_import_template.tsv';
            } else if (format === 'json') {
                content = JSON.stringify([{
                    title: 'Example Item',
                    description: 'Description here',
                    sku: 'SKU-001',
                    brand: 'Brand Name',
                    category: 'Clothing',
                    condition: 'New',
                    size: 'M',
                    color: 'Blue',
                    list_price: 29.99,
                    cost: 15.00,
                    quantity: 1,
                    location: 'Bin A1',
                    notes: 'Optional notes',
                    tags: 'tag1,tag2'
                }], null, 2);
                contentType = 'application/json';
                filename = 'inventory_import_template.json';
            } else {
                return { status: 400, data: { error: 'Invalid format. Must be csv, tsv, or json' } };
            }

            return {
                status: 200,
                data: {
                    content,
                    contentType,
                    filename,
                    headers
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error downloading import template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/inventory-import/validate-row - Validate a single row
    if (method === 'POST' && path === '/validate-row') {
        try {
            const { row, field_mapping } = body;

            if (!row || typeof row !== 'object') {
                return { status: 400, data: { error: 'Row data is required' } };
            }

            const errors = [];
            const warnings = [];
            const parsed = {};

            // Apply field mapping if provided
            if (field_mapping) {
                for (const [inventoryField, sourceField] of Object.entries(field_mapping)) {
                    if (sourceField && row[sourceField] !== undefined) {
                        parsed[inventoryField] = row[sourceField];
                    }
                }
            } else {
                Object.assign(parsed, row);
            }

            // Validate required fields
            if (!parsed.title || String(parsed.title).trim() === '') {
                errors.push({ field: 'title', message: 'Title is required' });
            } else if (String(parsed.title).length > 255) {
                errors.push({ field: 'title', message: 'Title must be 255 characters or less' });
            }

            // Validate numeric fields
            if (parsed.list_price !== undefined && parsed.list_price !== '') {
                const price = parseFloat(parsed.list_price);
                if (isNaN(price)) {
                    errors.push({ field: 'list_price', message: 'Invalid price format' });
                } else if (price < 0) {
                    errors.push({ field: 'list_price', message: 'Price cannot be negative' });
                }
            }

            if (parsed.cost !== undefined && parsed.cost !== '') {
                const cost = parseFloat(parsed.cost);
                if (isNaN(cost)) {
                    errors.push({ field: 'cost', message: 'Invalid cost format' });
                } else if (cost < 0) {
                    errors.push({ field: 'cost', message: 'Cost cannot be negative' });
                }
            }

            if (parsed.quantity !== undefined && parsed.quantity !== '') {
                const qty = parseInt(parsed.quantity);
                if (isNaN(qty)) {
                    errors.push({ field: 'quantity', message: 'Invalid quantity format' });
                } else if (qty < 0) {
                    errors.push({ field: 'quantity', message: 'Quantity cannot be negative' });
                }
            }

            // Validate condition
            const validConditions = ['New', 'Like New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor'];
            if (parsed.condition && !validConditions.includes(parsed.condition)) {
                warnings.push({ field: 'condition', message: `Unknown condition "${parsed.condition}". Will use as-is.` });
            }

            // Check for potential SKU duplicate
            if (parsed.sku && user) {
                const existing = await query.get(
                    'SELECT id, title FROM inventory WHERE user_id = ? AND sku = ?',
                    [user.id, parsed.sku]
                );
                if (existing) {
                    warnings.push({
                        field: 'sku',
                        message: `SKU already exists for item "${existing.title}"`,
                        existing_id: existing.id
                    });
                }
            }

            return {
                status: 200,
                data: {
                    valid: errors.length === 0,
                    parsed,
                    errors,
                    warnings
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error validating row', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/inventory-import/field-options - Get available field options
    if (method === 'GET' && path === '/field-options') {
        try {
            const inventoryFields = [
                { name: 'title', label: 'Title', required: true, type: 'text' },
                { name: 'description', label: 'Description', required: false, type: 'text' },
                { name: 'sku', label: 'SKU', required: false, type: 'text' },
                { name: 'brand', label: 'Brand', required: false, type: 'text' },
                { name: 'category', label: 'Category', required: false, type: 'text' },
                { name: 'condition', label: 'Condition', required: false, type: 'select', options: ['New', 'Like New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor'] },
                { name: 'size', label: 'Size', required: false, type: 'text' },
                { name: 'color', label: 'Color', required: false, type: 'text' },
                { name: 'list_price', label: 'List Price', required: false, type: 'number' },
                { name: 'cost', label: 'Cost', required: false, type: 'number' },
                { name: 'quantity', label: 'Quantity', required: false, type: 'number', default: 1 },
                { name: 'location', label: 'Storage Location', required: false, type: 'text' },
                { name: 'notes', label: 'Notes', required: false, type: 'text' },
                { name: 'tags', label: 'Tags', required: false, type: 'text', hint: 'Comma-separated' },
                { name: 'weight_oz', label: 'Weight (oz)', required: false, type: 'number' },
                { name: 'length_in', label: 'Length (in)', required: false, type: 'number' },
                { name: 'width_in', label: 'Width (in)', required: false, type: 'number' },
                { name: 'height_in', label: 'Height (in)', required: false, type: 'number' }
            ];

            // Get user's existing categories and brands for suggestions
            let categories = [];
            let brands = [];
            try {
                categories = await query.all(
                    'SELECT DISTINCT category FROM inventory WHERE user_id = ? AND category IS NOT NULL ORDER BY category',
                    [user.id]
                ).map(r => r.category);
                brands = await query.all(
                    'SELECT DISTINCT brand FROM inventory WHERE user_id = ? AND brand IS NOT NULL ORDER BY brand',
                    [user.id]
                ).map(r => r.brand);
            } catch { /* ignore */ }

            return {
                status: 200,
                data: {
                    fields: inventoryFields,
                    suggestions: {
                        categories,
                        brands
                    },
                    dateFormats: [
                        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
                        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' }
                    ]
                }
            };
        } catch (error) {
            logger.error('[InventoryImport] Error fetching field options', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}

// Helper: Parse CSV line handling quoted fields
function parseCSVLine(line, separator = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === separator) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
    }

    if (inQuotes) {
        throw new Error('Unclosed quote in CSV data');
    }

    result.push(current.trim());
    return result;
}
