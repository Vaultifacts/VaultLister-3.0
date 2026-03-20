import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function skuSyncRouter(ctx) {
  const { method, path, body, query: queryParams, user } = ctx;
  if (!user) return { status: 401, data: { error: 'Authentication required' } };

  try {
    // GET / - List all SKU platform links with sync status
    if (method === 'GET' && path === '/') {
      const userId = user.id;
      const { platform, sync_status } = queryParams;

      let sql = `
        SELECT spl.*, i.title, i.sku as inventory_sku
        FROM sku_platform_links spl
        LEFT JOIN inventory i ON spl.inventory_id = i.id
        WHERE spl.user_id = ?
      `;
      const params = [userId];

      if (platform) {
        sql += ` AND spl.platform = ?`;
        params.push(platform);
      }

      if (sync_status) {
        sql += ` AND spl.sync_status = ?`;
        params.push(sync_status);
      }

      sql += ` ORDER BY spl.created_at DESC`;

      const links = await query.all(sql, params);

      return { status: 200, data: { links } };
    }

    // POST /link - Link a master SKU to a platform
    if (method === 'POST' && path === '/link') {
      const userId = user.id;
      const { master_sku, platform, platform_sku, inventory_id } = body;

      if (!master_sku || !platform) {
        return { status: 400, data: { error: 'master_sku and platform are required' } };
      }

      // Check for existing link
      const existing = await query.get(
        `SELECT id FROM sku_platform_links
         WHERE user_id = ? AND master_sku = ? AND platform = ?`,
        [userId, master_sku, platform]
      );

      if (existing) {
        return {
          status: 400,
          data: {
            error: 'SKU already linked to this platform',
            existing_id: existing.id
          }
        };
      }

      const id = nanoid();
      await query.run(
        `INSERT INTO sku_platform_links
         (id, user_id, master_sku, platform, platform_sku, inventory_id, sync_status, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, 'synced', CURRENT_TIMESTAMP)`,
        [id, userId, master_sku, platform, platform_sku, inventory_id]
      );

      const link = await query.get(
        `SELECT * FROM sku_platform_links WHERE id = ?`,
        [id]
      );

      return {
        status: 200,
        data: {
          success: true,
          link
        }
      };
    }

    // GET /conflicts - List SKU conflicts
    if (method === 'GET' && path === '/conflicts') {
      const userId = user.id;

      // Find SKUs linked to multiple inventory items or with different platform_skus
      const conflicts = await query.all(
        `SELECT
           master_sku,
           platform,
           COUNT(DISTINCT inventory_id) as inventory_count,
           COUNT(DISTINCT platform_sku) as platform_sku_count,
           GROUP_CONCAT(DISTINCT inventory_id) as inventory_ids,
           GROUP_CONCAT(DISTINCT platform_sku) as platform_skus
         FROM sku_platform_links
         WHERE user_id = ?
         GROUP BY master_sku, platform
         HAVING inventory_count > 1 OR platform_sku_count > 1`,
        [userId]
      );

      // Get detailed info for each conflict
      const detailedConflicts = [];
      for (const conflict of conflicts) {
        const links = await query.all(
          `SELECT spl.*, i.title
           FROM sku_platform_links spl
           LEFT JOIN inventory i ON spl.inventory_id = i.id
           WHERE spl.user_id = ? AND spl.master_sku = ? AND spl.platform = ?`,
          [userId, conflict.master_sku, conflict.platform]
        );

        detailedConflicts.push({
          master_sku: conflict.master_sku,
          platform: conflict.platform,
          conflict_type: conflict.inventory_count > 1 ? 'multiple_inventory' : 'multiple_platform_skus',
          links
        });
      }

      return {
        status: 200,
        data: {
          conflicts: detailedConflicts,
          count: detailedConflicts.length
        }
      };
    }

    // POST /sync - Sync all pending SKU links
    if (method === 'POST' && path === '/sync') {
      const userId = user.id;

      // HIGH 20: Check for active marketplace connections — sync only updates local DB
      // records; without live API credentials it does not push to marketplace platforms.
      const connectedShops = query.all(
        `SELECT platform FROM shops WHERE user_id = ? AND is_connected = 1`,
        [userId]
      );
      if (!connectedShops || connectedShops.length === 0) {
        return {
          status: 200,
          data: {
            synced: false,
            reason: 'SKU sync requires active marketplace connections. Configure marketplace API credentials.'
          }
        };
      }

      // Get all pending links
      const pending = await query.all(
        `SELECT * FROM sku_platform_links
         WHERE user_id = ? AND sync_status = 'pending'`,
        [userId]
      );

      if (pending.length === 0) {
        return {
          status: 200,
          data: {
            success: true,
            synced: 0,
            message: 'No pending SKU links to sync'
          }
        };
      }

      // Sync SKU to each linked platform's listing
      let synced = 0;
      let failed = 0;
      for (const link of pending) {
        try {
          // Update the corresponding listing's SKU/title/price from inventory
          const inventory = query.get(
            'SELECT sku, title, list_price FROM inventory WHERE id = ? AND user_id = ?',
            [link.inventory_id, user.id]
          );
          if (inventory) {
            const listing = query.get(
              'SELECT id FROM listings WHERE inventory_id = ? AND platform = ?',
              [link.inventory_id, link.platform]
            );
            if (listing) {
              query.run(
                `UPDATE listings SET title = ?, price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [inventory.title, inventory.list_price, listing.id]
              );
            }
          }
          query.run(
            `UPDATE sku_platform_links SET sync_status = 'synced', last_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [link.id]
          );
          synced++;
        } catch (err) {
          query.run(
            `UPDATE sku_platform_links SET sync_status = 'error', last_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [link.id]
          );
          failed++;
          logger.warn('[SKUSync] Sync failed for link ' + link.id + ': ' + err.message);
        }
      }

      return {
        status: 200,
        data: {
          success: true,
          synced,
          failed,
          message: `Synced ${synced} SKU links${failed > 0 ? `, ${failed} failed` : ''}`
        }
      };
    }

    // GET /barcode/:barcode - Find all inventory items linked to a barcode/SKU
    const barcodeMatch = path.match(/^\/barcode\/(.+)$/);
    if (method === 'GET' && barcodeMatch) {
      const userId = user.id;
      const barcode = barcodeMatch[1];

      if (!barcode) {
        return { status: 400, data: { error: 'Barcode is required' } };
      }

      // Search in SKU platform links
      const skuLinks = await query.all(
        `SELECT spl.*, i.title, i.sku, i.quantity, i.location
         FROM sku_platform_links spl
         LEFT JOIN inventory i ON spl.inventory_id = i.id
         WHERE spl.user_id = ?
         AND (spl.master_sku = ? OR spl.platform_sku = ?)`,
        [userId, barcode, barcode]
      );

      // Also search directly in inventory
      const inventoryItems = await query.all(
        `SELECT * FROM inventory
         WHERE user_id = ?
         AND (sku = ? OR barcode = ?)`,
        [userId, barcode, barcode]
      );

      // Search in warehouse bins
      const binLocations = await query.all(
        `SELECT * FROM warehouse_bins
         WHERE user_id = ? AND barcode_data = ?`,
        [userId, barcode]
      );

      return {
        status: 200,
        data: {
          barcode,
          sku_links: skuLinks,
          inventory: inventoryItems,
          bin_locations: binLocations,
          total_results: skuLinks.length + inventoryItems.length + binLocations.length
        }
      };
    }

    // DELETE /:id - Remove a SKU link
    // Must exclude static paths like /link, /conflicts, /sync, /barcode
    if (method === 'DELETE' && path.match(/^\/[a-zA-Z0-9_-]+$/) &&
        !path.startsWith('/link') && !path.startsWith('/conflicts') &&
        !path.startsWith('/sync') && !path.startsWith('/barcode')) {
      const userId = user.id;
      const id = path.split('/').pop();

      // Verify ownership
      const link = await query.get(
        `SELECT id FROM sku_platform_links WHERE id = ? AND user_id = ?`,
        [id, userId]
      );

      if (!link) {
        return { status: 404, data: { error: 'SKU link not found' } };
      }

      await query.run(
        `DELETE FROM sku_platform_links WHERE id = ? AND user_id = ?`,
        [id, userId]
      );

      return {
        status: 200,
        data: {
          success: true,
          message: 'SKU link removed'
        }
      };
    }

    return { status: 404, data: { error: 'Endpoint not found' } };
  } catch (error) {
    logger.error('[SKUSync] SKU sync router error', user?.id || null, { detail: error.message });
    return { status: 500, data: { error: 'Internal server error' } };
  }
}
