// Size Charts Routes
// Manage custom size charts, brand size guides, international conversions, and size recommendations

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper
 */
function safeParse(str, fallback = []) {
    try {
        return JSON.parse(str);
    } catch (e) {
        logger.error('JSON parse error:', e.message);
        return fallback;
    }
}

/**
 * Size Charts router
 */
export async function sizeChartsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    if (!user) {
        return {
            status: 401,
            data: { error: 'Authentication required' }
        };
    }

    // ============================================
    // CRUD: USER SIZE CHARTS
    // ============================================

    // GET /api/size-charts - List user's size charts with optional filters
    if (method === 'GET' && (path === '' || path === '/')) {
        const { category, gender, brand, is_template } = queryParams;

        try {
            let sql = `SELECT * FROM size_charts WHERE user_id = ?`;
            const params = [user.id];

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (gender) {
                sql += ` AND gender = ?`;
                params.push(gender);
            }

            if (brand) {
                sql += ` AND brand = ?`;
                params.push(brand);
            }

            if (is_template !== undefined) {
                sql += ` AND is_template = ?`;
                params.push(is_template === 'true' || is_template === '1' ? 1 : 0);
            }

            sql += ` ORDER BY created_at DESC LIMIT 500`;

            const charts = await query.all(sql, params);

            // Parse JSON fields
            const chartsWithParsed = charts.map(chart => ({
                ...chart,
                measurements: safeParse(chart.measurements || '[]', []),
                sizes: safeParse(chart.sizes || '[]', []),
                custom_fields: safeParse(chart.custom_fields || '[]', []),
                linked_listings: safeParse(chart.linked_listings || '[]', [])
            }));

            return {
                status: 200,
                data: { charts: chartsWithParsed }
            };
        } catch (error) {
            logger.error('Error fetching size charts:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch size charts' }
            };
        }
    }

    // POST /api/size-charts - Create new size chart
    if (method === 'POST' && (path === '' || path === '/')) {
        const {
            name,
            category,
            garment_type,
            brand,
            gender,
            size_system,
            measurements,
            sizes,
            custom_fields,
            notes,
            is_template,
            linked_listings
        } = body;

        // Validation
        if (!name || !category) {
            return {
                status: 400,
                data: { error: 'Name and category are required' }
            };
        }

        const validGenders = ['mens', 'womens', 'kids', 'unisex'];
        if (gender && !validGenders.includes(gender)) {
            return {
                status: 400,
                data: { error: 'Invalid gender. Must be mens, womens, kids, or unisex' }
            };
        }

        try {
            const chartId = nanoid();
            await query.run(
                `INSERT INTO size_charts (
                    id, user_id, name, category, garment_type, brand, gender, size_system,
                    measurements, sizes, custom_fields, notes, is_template, linked_listings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    chartId,
                    user.id,
                    name,
                    category,
                    garment_type || null,
                    brand || null,
                    gender || 'unisex',
                    size_system || 'US',
                    JSON.stringify(measurements || []),
                    JSON.stringify(sizes || []),
                    JSON.stringify(custom_fields || []),
                    notes || null,
                    is_template ? 1 : 0,
                    JSON.stringify(linked_listings || [])
                ]
            );

            const chart = await query.get(`SELECT * FROM size_charts WHERE id = ?`, [chartId]);

            return {
                status: 201,
                data: {
                    chart: {
                        ...chart,
                        measurements: safeParse(chart.measurements, []),
                        sizes: safeParse(chart.sizes, []),
                        custom_fields: safeParse(chart.custom_fields, []),
                        linked_listings: safeParse(chart.linked_listings, [])
                    }
                }
            };
        } catch (error) {
            logger.error('Error creating size chart:', error);
            return {
                status: 500,
                data: { error: 'Failed to create size chart' }
            };
        }
    }

    // GET /api/size-charts/:id - Get single size chart
    if (method === 'GET' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !path.includes('/convert') && !path.includes('/conversions') && !path.includes('/brands') && !path.includes('/availability') && !path.includes('/recommend')) {
        const chartId = path.substring(1);

        try {
            const chart = await query.get(
                `SELECT * FROM size_charts WHERE id = ? AND user_id = ?`,
                [chartId, user.id]
            );

            if (!chart) {
                return {
                    status: 404,
                    data: { error: 'Size chart not found' }
                };
            }

            return {
                status: 200,
                data: {
                    chart: {
                        ...chart,
                        measurements: safeParse(chart.measurements, []),
                        sizes: safeParse(chart.sizes, []),
                        custom_fields: safeParse(chart.custom_fields, []),
                        linked_listings: safeParse(chart.linked_listings, [])
                    }
                }
            };
        } catch (error) {
            logger.error('Error fetching size chart:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch size chart' }
            };
        }
    }

    // PUT /api/size-charts/:id - Update size chart
    if (method === 'PUT' && path.match(/^\/[a-zA-Z0-9_-]+$/)) {
        const chartId = path.substring(1);

        try {
            const chart = await query.get(
                `SELECT * FROM size_charts WHERE id = ? AND user_id = ?`,
                [chartId, user.id]
            );

            if (!chart) {
                return {
                    status: 404,
                    data: { error: 'Size chart not found' }
                };
            }

            const {
                name,
                category,
                garment_type,
                brand,
                gender,
                size_system,
                measurements,
                sizes,
                custom_fields,
                notes,
                is_template,
                linked_listings
            } = body;

            await query.run(
                `UPDATE size_charts SET
                    name = ?,
                    category = ?,
                    garment_type = ?,
                    brand = ?,
                    gender = ?,
                    size_system = ?,
                    measurements = ?,
                    sizes = ?,
                    custom_fields = ?,
                    notes = ?,
                    is_template = ?,
                    linked_listings = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    name || chart.name,
                    category || chart.category,
                    garment_type !== undefined ? garment_type : chart.garment_type,
                    brand !== undefined ? brand : chart.brand,
                    gender || chart.gender,
                    size_system || chart.size_system,
                    measurements ? JSON.stringify(measurements) : chart.measurements,
                    sizes ? JSON.stringify(sizes) : chart.sizes,
                    custom_fields ? JSON.stringify(custom_fields) : chart.custom_fields,
                    notes !== undefined ? notes : chart.notes,
                    is_template !== undefined ? (is_template ? 1 : 0) : chart.is_template,
                    linked_listings ? JSON.stringify(linked_listings) : chart.linked_listings,
                    chartId
                ]
            );

            const updatedChart = await query.get(`SELECT * FROM size_charts WHERE id = ?`, [chartId]);

            return {
                status: 200,
                data: {
                    chart: {
                        ...updatedChart,
                        measurements: safeParse(updatedChart.measurements, []),
                        sizes: safeParse(updatedChart.sizes, []),
                        custom_fields: safeParse(updatedChart.custom_fields, []),
                        linked_listings: safeParse(updatedChart.linked_listings, [])
                    }
                }
            };
        } catch (error) {
            logger.error('Error updating size chart:', error);
            return {
                status: 500,
                data: { error: 'Failed to update size chart' }
            };
        }
    }

    // DELETE /api/size-charts/:id - Delete size chart
    if (method === 'DELETE' && path.match(/^\/[a-zA-Z0-9_-]+$/)) {
        const chartId = path.substring(1);

        try {
            const chart = await query.get(
                `SELECT * FROM size_charts WHERE id = ? AND user_id = ?`,
                [chartId, user.id]
            );

            if (!chart) {
                return {
                    status: 404,
                    data: { error: 'Size chart not found' }
                };
            }

            await query.run(`DELETE FROM size_charts WHERE id = ? AND user_id = ?`, [chartId, user.id]);

            return {
                status: 200,
                data: { message: 'Size chart deleted successfully' }
            };
        } catch (error) {
            logger.error('Error deleting size chart:', error);
            return {
                status: 500,
                data: { error: 'Failed to delete size chart' }
            };
        }
    }

    // ============================================
    // INTERNATIONAL SIZE CONVERSIONS
    // ============================================

    // GET /api/size-charts/convert - Convert between size systems
    if (method === 'GET' && (path === '/convert' || path === '/conversions')) {
        const { from, to, size, garment, brand } = queryParams;

        if (!from || !to || !size) {
            return {
                status: 400,
                data: { error: 'Parameters required: from, to, size' }
            };
        }

        try {
            // Build query based on filters
            let sql = `SELECT * FROM brand_size_guides WHERE 1=1`;
            const params = [];

            if (brand) {
                sql += ` AND brand = ?`;
                params.push(brand);
            }

            if (garment) {
                sql += ` AND garment_type = ?`;
                params.push(garment);
            }

            // Map size system to column
            const sizeSystemMap = {
                'US': 'us_size',
                'UK': 'uk_size',
                'EU': 'eu_size',
                'JP': 'jp_size',
                'CN': 'cn_size',
                'IT': 'it_size',
                'FR': 'fr_size',
                'AU': 'au_size'
            };

            const fromColumn = sizeSystemMap[from.toUpperCase()];
            const toColumn = sizeSystemMap[to.toUpperCase()];

            if (!fromColumn || !toColumn) {
                return {
                    status: 400,
                    data: { error: 'Invalid size system. Supported: US, UK, EU, JP, CN, IT, FR, AU' }
                };
            }

            sql += ` AND ${fromColumn} = ? LIMIT 500`;
            params.push(size);

            const results = await query.all(sql, params);

            if (results.length === 0) {
                return {
                    status: 404,
                    data: { error: 'No conversion data found for specified parameters' }
                };
            }

            // Return conversion data with all size systems
            const conversions = results.map(result => ({
                brand: result.brand,
                garment_type: result.garment_type,
                size_label: result.size_label,
                from: {
                    system: from.toUpperCase(),
                    size: result[fromColumn]
                },
                to: {
                    system: to.toUpperCase(),
                    size: result[toColumn]
                },
                all_sizes: {
                    US: result.us_size,
                    UK: result.uk_size,
                    EU: result.eu_size,
                    JP: result.jp_size,
                    CN: result.cn_size,
                    IT: result.it_size,
                    FR: result.fr_size,
                    AU: result.au_size
                },
                measurements: {
                    chest_cm: result.chest_cm,
                    waist_cm: result.waist_cm,
                    hips_cm: result.hips_cm,
                    length_cm: result.length_cm,
                    shoulder_cm: result.shoulder_cm,
                    sleeve_cm: result.sleeve_cm,
                    inseam_cm: result.inseam_cm,
                    foot_length_cm: result.foot_length_cm
                }
            }));

            return {
                status: 200,
                data: { conversions }
            };
        } catch (error) {
            logger.error('Error converting size:', error);
            return {
                status: 500,
                data: { error: 'Failed to convert size' }
            };
        }
    }

    // ============================================
    // BRAND SIZE GUIDES
    // ============================================

    // GET /api/size-charts/brands - List available brands
    if (method === 'GET' && path === '/brands') {
        try {
            const brands = await query.all(
                `SELECT DISTINCT brand, COUNT(*) as guide_count
                 FROM brand_size_guides
                 GROUP BY brand
                 ORDER BY brand ASC`
            );

            return {
                status: 200,
                data: { brands }
            };
        } catch (error) {
            logger.error('Error fetching brands:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch brands' }
            };
        }
    }

    // GET /api/size-charts/brands/:brand - Get brand-specific guide
    if (method === 'GET' && path.startsWith('/brands/') && path.split('/').length === 3) {
        const brandName = decodeURIComponent(path.split('/')[2]);

        try {
            const guides = await query.all(
                `SELECT * FROM brand_size_guides WHERE brand = ? ORDER BY garment_type, size_label`,
                [brandName]
            );

            if (guides.length === 0) {
                return {
                    status: 404,
                    data: { error: 'Brand not found' }
                };
            }

            // Group by garment type
            const groupedGuides = guides.reduce((acc, guide) => {
                const type = guide.garment_type || 'general';
                if (!acc[type]) {
                    acc[type] = [];
                }
                acc[type].push(guide);
                return acc;
            }, {});

            return {
                status: 200,
                data: {
                    brand: brandName,
                    guides: groupedGuides
                }
            };
        } catch (error) {
            logger.error('Error fetching brand guide:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch brand guide' }
            };
        }
    }

    // GET /api/size-charts/brands/:brand/:garment - Get brand+garment guide
    if (method === 'GET' && path.startsWith('/brands/') && path.split('/').length === 4) {
        const parts = path.split('/');
        const brandName = decodeURIComponent(parts[2]);
        const garmentType = decodeURIComponent(parts[3]);

        try {
            const guides = await query.all(
                `SELECT * FROM brand_size_guides WHERE brand = ? AND garment_type = ? ORDER BY size_label`,
                [brandName, garmentType]
            );

            if (guides.length === 0) {
                return {
                    status: 404,
                    data: { error: 'No guides found for specified brand and garment type' }
                };
            }

            return {
                status: 200,
                data: {
                    brand: brandName,
                    garment_type: garmentType,
                    guides
                }
            };
        } catch (error) {
            logger.error('Error fetching brand garment guide:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch guide' }
            };
        }
    }

    // ============================================
    // SIZE RECOMMENDATION
    // ============================================

    // POST /api/size-charts/recommend - Get size recommendation based on measurements
    if (method === 'POST' && path === '/recommend') {
        const { measurements, brand, garment_type } = body;

        if (!measurements) {
            return {
                status: 400,
                data: { error: 'Measurements are required' }
            };
        }

        try {
            // Build query based on available filters
            let sql = `SELECT * FROM brand_size_guides WHERE 1=1`;
            const params = [];

            if (brand) {
                sql += ` AND brand = ?`;
                params.push(brand);
            }

            if (garment_type) {
                sql += ` AND garment_type = ?`;
                params.push(garment_type);
            }

            sql += ` LIMIT 500`;
            const guides = await query.all(sql, params);

            if (guides.length === 0) {
                return {
                    status: 404,
                    data: { error: 'No size guides found for specified criteria' }
                };
            }

            // Find best matching size based on measurements
            const recommendations = guides.map(guide => {
                let score = 0;
                let matchCount = 0;

                // Compare each measurement
                const measurementFields = [
                    'chest_cm', 'waist_cm', 'hips_cm', 'length_cm',
                    'shoulder_cm', 'sleeve_cm', 'inseam_cm', 'foot_length_cm'
                ];

                measurementFields.forEach(field => {
                    const userValue = measurements[field.replace('_cm', '')];
                    const guideValue = guide[field];

                    if (userValue != null && guideValue != null) {
                        // Calculate difference percentage
                        const diff = Math.abs(userValue - guideValue);
                        const diffPercent = (diff / guideValue) * 100;

                        // Score: 100 for perfect match, decreases with difference
                        const fieldScore = Math.max(0, 100 - diffPercent);
                        score += fieldScore;
                        matchCount++;
                    }
                });

                return {
                    ...guide,
                    match_score: matchCount > 0 ? score / matchCount : 0,
                    matched_fields: matchCount
                };
            });

            // Sort by match score
            recommendations.sort((a, b) => b.match_score - a.match_score);

            // Return top 5 recommendations
            const topRecommendations = recommendations.slice(0, 5);

            return {
                status: 200,
                data: {
                    recommendations: topRecommendations,
                    best_match: topRecommendations[0] || null
                }
            };
        } catch (error) {
            logger.error('Error generating size recommendation:', error);
            return {
                status: 500,
                data: { error: 'Failed to generate recommendation' }
            };
        }
    }

    // ============================================
    // AUTO-LINK LISTINGS
    // ============================================

    // POST /api/size-charts/:id/link-listings - Link chart to listings
    if (method === 'POST' && path.match(/^\/[a-zA-Z0-9_-]+\/link-listings$/)) {
        const chartId = path.split('/')[1];
        const { listing_ids } = body;

        if (!listing_ids || !Array.isArray(listing_ids)) {
            return {
                status: 400,
                data: { error: 'listing_ids array is required' }
            };
        }

        try {
            const chart = await query.get(
                `SELECT * FROM size_charts WHERE id = ? AND user_id = ?`,
                [chartId, user.id]
            );

            if (!chart) {
                return {
                    status: 404,
                    data: { error: 'Size chart not found' }
                };
            }

            // Parse existing linked listings
            const existingLinked = safeParse(chart.linked_listings || '[]', []);

            // Merge with new IDs (deduplicate)
            const mergedLinked = [...new Set([...existingLinked, ...listing_ids])];

            // Update chart
            await query.run(
                `UPDATE size_charts SET linked_listings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(mergedLinked), chartId]
            );

            return {
                status: 200,
                data: {
                    message: 'Listings linked successfully',
                    linked_count: mergedLinked.length,
                    newly_linked: listing_ids.length
                }
            };
        } catch (error) {
            logger.error('Error linking listings:', error);
            return {
                status: 500,
                data: { error: 'Failed to link listings' }
            };
        }
    }

    // GET /api/size-charts/:id/linked-listings - Get linked listings
    if (method === 'GET' && path.match(/^\/[a-zA-Z0-9_-]+\/linked-listings$/)) {
        const chartId = path.split('/')[1];

        try {
            const chart = await query.get(
                `SELECT * FROM size_charts WHERE id = ? AND user_id = ?`,
                [chartId, user.id]
            );

            if (!chart) {
                return {
                    status: 404,
                    data: { error: 'Size chart not found' }
                };
            }

            const linkedIds = safeParse(chart.linked_listings || '[]', []);

            if (linkedIds.length === 0) {
                return {
                    status: 200,
                    data: { listings: [] }
                };
            }

            // Fetch actual listing data
            const placeholders = linkedIds.map(() => '?').join(',');
            const listings = await query.all(
                `SELECT id, title, platform, status, price, sku
                 FROM listings
                 WHERE id IN (${placeholders}) AND user_id = ?`,
                [...linkedIds, user.id]
            );

            return {
                status: 200,
                data: { listings }
            };
        } catch (error) {
            logger.error('Error fetching linked listings:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch linked listings' }
            };
        }
    }

    // ============================================
    // HEATMAP DATA (SIZE AVAILABILITY)
    // ============================================

    // GET /api/size-charts/availability - Get size availability data from inventory
    if (method === 'GET' && path === '/availability') {
        const { category, brand, garment_type } = queryParams;

        try {
            // This requires inventory to have size information
            // We'll query inventory grouped by size
            let sql = `
                SELECT
                    size,
                    COUNT(*) as count,
                    SUM(quantity) as total_quantity,
                    AVG(cost) as avg_cost,
                    AVG(selling_price) as avg_price
                FROM inventory
                WHERE user_id = ? AND size IS NOT NULL AND size != ''
            `;
            const params = [user.id];

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (brand) {
                sql += ` AND brand = ?`;
                params.push(brand);
            }

            sql += ` GROUP BY size ORDER BY size`;

            const availability = await query.all(sql, params);

            // Calculate total for percentage calculation
            const total = availability.reduce((sum, item) => sum + item.count, 0);

            const availabilityWithPercentage = availability.map(item => ({
                ...item,
                percentage: total > 0 ? ((item.count / total) * 100).toFixed(2) : 0
            }));

            return {
                status: 200,
                data: {
                    availability: availabilityWithPercentage,
                    total_items: total
                }
            };
        } catch (error) {
            logger.error('Error fetching size availability:', error);
            return {
                status: 500,
                data: { error: 'Failed to fetch size availability' }
            };
        }
    }

    // 404
    return {
        status: 404,
        data: { error: 'Endpoint not found' }
    };
}

/**
 * Seed brand size guide data
 * This function should be called during initialization or manually via admin endpoint
 */
export async function seedBrandSizeGuides() {
    try {
        // Check if already seeded
        const existing = await query.get(`SELECT COUNT(*) as count FROM brand_size_guides`);
        if (existing && existing.count > 0) {
            logger.info('Brand size guides already seeded');
            return;
        }

        logger.info('Seeding brand size guides...');

        const guides = [
            // Nike - Mens Tops
            { brand: 'Nike', garment_type: 'tops', size_label: 'XS', us_size: 'XS', uk_size: 'XS', eu_size: 'XS', jp_size: 'XS', cn_size: 'XS', chest_cm: 86, waist_cm: 71, length_cm: 71 },
            { brand: 'Nike', garment_type: 'tops', size_label: 'S', us_size: 'S', uk_size: 'S', eu_size: 'S', jp_size: 'S', cn_size: 'S', chest_cm: 91, waist_cm: 76, length_cm: 73 },
            { brand: 'Nike', garment_type: 'tops', size_label: 'M', us_size: 'M', uk_size: 'M', eu_size: 'M', jp_size: 'M', cn_size: 'M', chest_cm: 97, waist_cm: 81, length_cm: 76 },
            { brand: 'Nike', garment_type: 'tops', size_label: 'L', us_size: 'L', uk_size: 'L', eu_size: 'L', jp_size: 'L', cn_size: 'L', chest_cm: 104, waist_cm: 89, length_cm: 78 },
            { brand: 'Nike', garment_type: 'tops', size_label: 'XL', us_size: 'XL', uk_size: 'XL', eu_size: 'XL', jp_size: 'XL', cn_size: 'XL', chest_cm: 112, waist_cm: 97, length_cm: 81 },
            { brand: 'Nike', garment_type: 'tops', size_label: '2XL', us_size: '2XL', uk_size: '2XL', eu_size: '2XL', jp_size: '2XL', cn_size: '2XL', chest_cm: 122, waist_cm: 106, length_cm: 84 },

            // Nike - Mens Bottoms
            { brand: 'Nike', garment_type: 'bottoms', size_label: 'S', us_size: 'S', uk_size: 'S', eu_size: 'S', jp_size: 'S', waist_cm: 71, hips_cm: 89, inseam_cm: 81 },
            { brand: 'Nike', garment_type: 'bottoms', size_label: 'M', us_size: 'M', uk_size: 'M', eu_size: 'M', jp_size: 'M', waist_cm: 76, hips_cm: 94, inseam_cm: 81 },
            { brand: 'Nike', garment_type: 'bottoms', size_label: 'L', us_size: 'L', uk_size: 'L', eu_size: 'L', jp_size: 'L', waist_cm: 84, hips_cm: 102, inseam_cm: 81 },
            { brand: 'Nike', garment_type: 'bottoms', size_label: 'XL', us_size: 'XL', uk_size: 'XL', eu_size: 'XL', jp_size: 'XL', waist_cm: 94, hips_cm: 112, inseam_cm: 81 },

            // Adidas - Mens Tops
            { brand: 'Adidas', garment_type: 'tops', size_label: 'XS', us_size: 'XS', uk_size: '32', eu_size: '42', jp_size: 'XS', chest_cm: 88, waist_cm: 72, length_cm: 70 },
            { brand: 'Adidas', garment_type: 'tops', size_label: 'S', us_size: 'S', uk_size: '34', eu_size: '44', jp_size: 'S', chest_cm: 92, waist_cm: 76, length_cm: 72 },
            { brand: 'Adidas', garment_type: 'tops', size_label: 'M', us_size: 'M', uk_size: '36', eu_size: '48', jp_size: 'M', chest_cm: 96, waist_cm: 80, length_cm: 74 },
            { brand: 'Adidas', garment_type: 'tops', size_label: 'L', us_size: 'L', uk_size: '38', eu_size: '52', jp_size: 'L', chest_cm: 104, waist_cm: 88, length_cm: 76 },
            { brand: 'Adidas', garment_type: 'tops', size_label: 'XL', us_size: 'XL', uk_size: '40', eu_size: '56', jp_size: 'XL', chest_cm: 112, waist_cm: 96, length_cm: 78 },

            // Levi's - Mens Jeans (Waist sizes)
            { brand: "Levi's", garment_type: 'jeans', size_label: '28', us_size: '28', uk_size: '28', eu_size: '38', jp_size: '28', waist_cm: 71, hips_cm: 86, inseam_cm: 81 },
            { brand: "Levi's", garment_type: 'jeans', size_label: '30', us_size: '30', uk_size: '30', eu_size: '40', jp_size: '30', waist_cm: 76, hips_cm: 91, inseam_cm: 81 },
            { brand: "Levi's", garment_type: 'jeans', size_label: '32', us_size: '32', uk_size: '32', eu_size: '42', jp_size: '32', waist_cm: 81, hips_cm: 96, inseam_cm: 81 },
            { brand: "Levi's", garment_type: 'jeans', size_label: '34', us_size: '34', uk_size: '34', eu_size: '44', jp_size: '34', waist_cm: 86, hips_cm: 101, inseam_cm: 81 },
            { brand: "Levi's", garment_type: 'jeans', size_label: '36', us_size: '36', uk_size: '36', eu_size: '46', jp_size: '36', waist_cm: 91, hips_cm: 106, inseam_cm: 81 },
            { brand: "Levi's", garment_type: 'jeans', size_label: '38', us_size: '38', uk_size: '38', eu_size: '48', jp_size: '38', waist_cm: 96, hips_cm: 111, inseam_cm: 81 },

            // Supreme - Mens Tops
            { brand: 'Supreme', garment_type: 'tops', size_label: 'S', us_size: 'S', uk_size: 'S', eu_size: 'S', jp_size: 'S', chest_cm: 94, waist_cm: 78, length_cm: 71 },
            { brand: 'Supreme', garment_type: 'tops', size_label: 'M', us_size: 'M', uk_size: 'M', eu_size: 'M', jp_size: 'M', chest_cm: 99, waist_cm: 83, length_cm: 74 },
            { brand: 'Supreme', garment_type: 'tops', size_label: 'L', us_size: 'L', uk_size: 'L', eu_size: 'L', jp_size: 'L', chest_cm: 107, waist_cm: 91, length_cm: 76 },
            { brand: 'Supreme', garment_type: 'tops', size_label: 'XL', us_size: 'XL', uk_size: 'XL', eu_size: 'XL', jp_size: 'XL', chest_cm: 117, waist_cm: 99, length_cm: 79 },

            // Ralph Lauren - Mens Tops
            { brand: 'Ralph Lauren', garment_type: 'tops', size_label: 'XS', us_size: 'XS', uk_size: '32', eu_size: '42', jp_size: 'XS', chest_cm: 86, waist_cm: 71, length_cm: 72 },
            { brand: 'Ralph Lauren', garment_type: 'tops', size_label: 'S', us_size: 'S', uk_size: '34-36', eu_size: '44-46', jp_size: 'S', chest_cm: 91, waist_cm: 76, length_cm: 74 },
            { brand: 'Ralph Lauren', garment_type: 'tops', size_label: 'M', us_size: 'M', uk_size: '38-40', eu_size: '48-50', jp_size: 'M', chest_cm: 97, waist_cm: 81, length_cm: 76 },
            { brand: 'Ralph Lauren', garment_type: 'tops', size_label: 'L', us_size: 'L', uk_size: '42-44', eu_size: '52-54', jp_size: 'L', chest_cm: 107, waist_cm: 91, length_cm: 78 },
            { brand: 'Ralph Lauren', garment_type: 'tops', size_label: 'XL', us_size: 'XL', uk_size: '46-48', eu_size: '56-58', jp_size: 'XL', chest_cm: 117, waist_cm: 101, length_cm: 80 },

            // Ralph Lauren - Mens Bottoms
            { brand: 'Ralph Lauren', garment_type: 'bottoms', size_label: '30', us_size: '30', uk_size: '30', eu_size: '40', jp_size: 'S', waist_cm: 76, hips_cm: 94, inseam_cm: 81 },
            { brand: 'Ralph Lauren', garment_type: 'bottoms', size_label: '32', us_size: '32', uk_size: '32', eu_size: '42', jp_size: 'M', waist_cm: 81, hips_cm: 99, inseam_cm: 81 },
            { brand: 'Ralph Lauren', garment_type: 'bottoms', size_label: '34', us_size: '34', uk_size: '34', eu_size: '44', jp_size: 'L', waist_cm: 86, hips_cm: 104, inseam_cm: 81 },
            { brand: 'Ralph Lauren', garment_type: 'bottoms', size_label: '36', us_size: '36', uk_size: '36', eu_size: '46', jp_size: 'XL', waist_cm: 91, hips_cm: 109, inseam_cm: 81 },
        ];

        // Insert all guides
        for (const guide of guides) {
            await query.run(
                `INSERT INTO brand_size_guides (
                    id, brand, garment_type, size_label, us_size, uk_size, eu_size, jp_size, cn_size,
                    it_size, fr_size, au_size, chest_cm, waist_cm, hips_cm, length_cm,
                    shoulder_cm, sleeve_cm, inseam_cm, foot_length_cm
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nanoid(),
                    guide.brand,
                    guide.garment_type,
                    guide.size_label,
                    guide.us_size || null,
                    guide.uk_size || null,
                    guide.eu_size || null,
                    guide.jp_size || null,
                    guide.cn_size || null,
                    guide.it_size || null,
                    guide.fr_size || null,
                    guide.au_size || null,
                    guide.chest_cm || null,
                    guide.waist_cm || null,
                    guide.hips_cm || null,
                    guide.length_cm || null,
                    guide.shoulder_cm || null,
                    guide.sleeve_cm || null,
                    guide.inseam_cm || null,
                    guide.foot_length_cm || null
                ]
            );
        }

        logger.info(`✓ Seeded ${guides.length} brand size guides`);
    } catch (error) {
        logger.error('Error seeding brand size guides:', error);
    }
}
