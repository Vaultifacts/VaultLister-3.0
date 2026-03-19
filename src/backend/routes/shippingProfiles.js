// Shipping Profiles Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function shippingProfilesRouter(ctx) {
    const { method, path, body, user, query: queryParams } = ctx;

    // GET /api/shipping-profiles - List user's shipping profiles
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const profiles = query.all(
                `SELECT * FROM shipping_profiles WHERE user_id = ? ORDER BY is_default DESC, name ASC`,
                [user.id]
            );

            // Parse platforms JSON for each profile
            const parsedProfiles = profiles.map(p => ({
                ...p,
                platforms: safeJsonParse(p.platforms, [])
            }));

            return { status: 200, data: { profiles: parsedProfiles } };
        } catch (error) {
            logger.error('[ShippingProfiles] Error listing shipping profiles', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shipping-profiles/:id - Get single profile
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        try {
            const profileId = path.slice(1);
            const profile = query.get(
                `SELECT * FROM shipping_profiles WHERE id = ? AND user_id = ?`,
                [profileId, user.id]
            );

            if (!profile) {
                return { status: 404, data: { error: 'Shipping profile not found' } };
            }

            return {
                status: 200,
                data: {
                    profile: {
                        ...profile,
                        platforms: safeJsonParse(profile.platforms, [])
                    }
                }
            };
        } catch (error) {
            logger.error('[ShippingProfiles] Error fetching shipping profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shipping-profiles - Create shipping profile
    if (method === 'POST' && (path === '/' || path === '')) {
        try {
            const {
                name,
                carrier,
                serviceType,
                packageType,
                weightOz,
                length,
                width,
                height,
                handlingTimeDays,
                domesticCost,
                internationalCost,
                freeShippingThreshold,
                isDefault,
                platforms,
                notes
            } = body;

            if (!name) {
                return { status: 400, data: { error: 'Name is required' } };
            }

            const id = uuidv4();
            const now = new Date().toISOString();

            // If setting as default, clear existing default first
            if (isDefault) {
                query.run(
                    `UPDATE shipping_profiles SET is_default = 0 WHERE user_id = ?`,
                    [user.id]
                );
            }

            query.run(
                `INSERT INTO shipping_profiles
                 (id, user_id, name, carrier, service_type, package_type, weight_oz, length, width, height,
                  handling_time_days, domestic_cost, international_cost, free_shipping_threshold,
                  is_default, platforms, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, user.id, name, carrier || null, serviceType || null, packageType || null,
                    weightOz || 0, length || 0, width || 0, height || 0,
                    handlingTimeDays || 1, domesticCost || 0, internationalCost || null,
                    freeShippingThreshold || null, isDefault ? 1 : 0,
                    JSON.stringify(platforms || []), notes || null, now, now
                ]
            );

            return {
                status: 201,
                data: {
                    id,
                    name,
                    message: 'Shipping profile created successfully'
                }
            };
        } catch (error) {
            logger.error('[ShippingProfiles] Error creating shipping profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/shipping-profiles/:id - Update shipping profile
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/) && !path.includes('set-default')) {
        try {
            const profileId = path.slice(1);

            // Verify ownership
            const existing = query.get(
                `SELECT id FROM shipping_profiles WHERE id = ? AND user_id = ?`,
                [profileId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Shipping profile not found' } };
            }

            const {
                name,
                carrier,
                serviceType,
                packageType,
                weightOz,
                length,
                width,
                height,
                handlingTimeDays,
                domesticCost,
                internationalCost,
                freeShippingThreshold,
                isDefault,
                platforms,
                notes
            } = body;

            // If setting as default, clear existing default first
            if (isDefault) {
                query.run(
                    `UPDATE shipping_profiles SET is_default = 0 WHERE user_id = ?`,
                    [user.id]
                );
            }

            const now = new Date().toISOString();

            query.run(
                `UPDATE shipping_profiles SET
                 name = ?, carrier = ?, service_type = ?, package_type = ?,
                 weight_oz = ?, length = ?, width = ?, height = ?,
                 handling_time_days = ?, domestic_cost = ?, international_cost = ?,
                 free_shipping_threshold = ?, is_default = ?, platforms = ?, notes = ?, updated_at = ?
                 WHERE id = ? AND user_id = ?`,
                [
                    name, carrier || null, serviceType || null, packageType || null,
                    weightOz || 0, length || 0, width || 0, height || 0,
                    handlingTimeDays || 1, domesticCost || 0, internationalCost || null,
                    freeShippingThreshold || null, isDefault ? 1 : 0,
                    JSON.stringify(platforms || []), notes || null, now,
                    profileId, user.id
                ]
            );

            return { status: 200, data: { message: 'Shipping profile updated successfully' } };
        } catch (error) {
            logger.error('[ShippingProfiles] Error updating shipping profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/shipping-profiles/:id/set-default - Set as default profile
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+\/set-default$/)) {
        try {
            const profileId = path.match(/^\/([a-f0-9-]+)\/set-default$/)[1];

            // Verify ownership
            const existing = query.get(
                `SELECT id FROM shipping_profiles WHERE id = ? AND user_id = ?`,
                [profileId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Shipping profile not found' } };
            }

            // Clear all defaults for this user
            query.run(
                `UPDATE shipping_profiles SET is_default = 0 WHERE user_id = ?`,
                [user.id]
            );

            // Set this one as default
            query.run(
                `UPDATE shipping_profiles SET is_default = 1, updated_at = ? WHERE id = ?`,
                [new Date().toISOString(), profileId]
            );

            return { status: 200, data: { message: 'Default shipping profile updated' } };
        } catch (error) {
            logger.error('[ShippingProfiles] Error setting default shipping profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/shipping-profiles/:id - Delete shipping profile
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        try {
            const profileId = path.slice(1);

            // Verify ownership
            const existing = query.get(
                `SELECT id FROM shipping_profiles WHERE id = ? AND user_id = ?`,
                [profileId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Shipping profile not found' } };
            }

            query.run(
                `DELETE FROM shipping_profiles WHERE id = ? AND user_id = ?`,
                [profileId, user.id]
            );

            return { status: 200, data: { message: 'Shipping profile deleted successfully' } };
        } catch (error) {
            logger.error('[ShippingProfiles] Error deleting shipping profile', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
