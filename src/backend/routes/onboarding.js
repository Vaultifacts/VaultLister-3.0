// Onboarding Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper
 */
function safeParse(str, fallback = []) {
    try {
        return JSON.parse(str);
    } catch (e) {
        logger.error('[Onboarding] JSON parse error', null, { detail: e?.message || 'Unknown error' });
        return fallback;
    }
}

// Pre-defined tour steps by role
const TOUR_STEPS = {
    reseller: [
        {
            step_id: 'welcome',
            title: 'Welcome to VaultLister',
            description: "Let's get you started with the basics of managing your reselling business.",
            target_element: '#dashboard',
            position: 'center',
        },
        {
            step_id: 'add_inventory',
            title: 'Add Your First Item',
            description: 'Click here to add items to your inventory. You can add single items or bulk import.',
            target_element: '#nav-inventory',
            position: 'right',
        },
        {
            step_id: 'create_listing',
            title: 'Create Listings',
            description: 'Turn your inventory into live listings on marketplaces like eBay, Poshmark, and Mercari.',
            target_element: '#nav-listings',
            position: 'right',
        },
        {
            step_id: 'connect_shop',
            title: 'Connect Your Shop',
            description: 'Link your marketplace accounts to sync listings and orders automatically.',
            target_element: '#nav-settings',
            position: 'right',
        },
        {
            step_id: 'first_sale',
            title: 'Track Your Sales',
            description: 'View orders, manage shipments, and track your revenue all in one place.',
            target_element: '#nav-orders',
            position: 'right',
        },
        {
            step_id: 'analytics_overview',
            title: 'Understand Your Business',
            description: "Use analytics to see what's selling, profit margins, and trends over time.",
            target_element: '#nav-analytics',
            position: 'right',
        },
    ],
    bulk_seller: [
        {
            step_id: 'welcome',
            title: 'Welcome, Bulk Seller',
            description: 'Manage high-volume inventory with automation and batch tools.',
            target_element: '#dashboard',
            position: 'center',
        },
        {
            step_id: 'bulk_import',
            title: 'Bulk Import Inventory',
            description: 'Import hundreds of items at once using CSV templates or receipt scanning.',
            target_element: '#nav-inventory',
            position: 'right',
        },
        {
            step_id: 'sku_setup',
            title: 'SKU & Organization',
            description: 'Set up SKU rules and organize inventory with bins and locations.',
            target_element: '#inventory-settings',
            position: 'left',
        },
        {
            step_id: 'pricing_rules',
            title: 'Automated Pricing',
            description: 'Create pricing rules based on cost, category, and market trends.',
            target_element: '#nav-automations',
            position: 'right',
        },
        {
            step_id: 'batch_photos',
            title: 'Batch Photo Processing',
            description: 'Apply watermarks, resize, and organize photos for hundreds of items.',
            target_element: '#nav-image-vault',
            position: 'right',
        },
        {
            step_id: 'shipping_profiles',
            title: 'Shipping Profiles',
            description: 'Create templates for fast, accurate shipping across all your listings.',
            target_element: '#shipping-settings',
            position: 'left',
        },
    ],
    live_streamer: [
        {
            step_id: 'welcome',
            title: 'Welcome, Live Streamer',
            description: 'Set up your Whatnot events and stage inventory for live selling.',
            target_element: '#dashboard',
            position: 'center',
        },
        {
            step_id: 'whatnot_setup',
            title: 'Connect Whatnot',
            description: 'Link your Whatnot account to sync events and track live sales.',
            target_element: '#nav-settings',
            position: 'right',
        },
        {
            step_id: 'stage_items',
            title: 'Stage Your Show',
            description: 'Select and organize inventory for your upcoming live streams.',
            target_element: '#nav-calendar',
            position: 'right',
        },
        {
            step_id: 'go_live_tips',
            title: 'Go Live Prepared',
            description: 'Use staging tools, co-host management, and flash pricing.',
            target_element: '#live-controls',
            position: 'left',
        },
        {
            step_id: 'post_stream_analytics',
            title: 'Post-Stream Insights',
            description: 'Review performance, engagement, and revenue after each stream.',
            target_element: '#nav-analytics',
            position: 'right',
        },
    ],
    supplier: [
        {
            step_id: 'welcome',
            title: 'Welcome, Supplier',
            description: 'Manage wholesale operations and track buyer relationships.',
            target_element: '#dashboard',
            position: 'center',
        },
        {
            step_id: 'add_buyers',
            title: 'Add Buyers',
            description: 'Track your customer relationships and order history.',
            target_element: '#nav-suppliers',
            position: 'right',
        },
        {
            step_id: 'bulk_inventory',
            title: 'Manage Bulk Stock',
            description: 'Organize large quantities and warehouse locations.',
            target_element: '#nav-inventory',
            position: 'right',
        },
        {
            step_id: 'wholesale_pricing',
            title: 'Wholesale Pricing',
            description: 'Set tiered pricing and volume discounts.',
            target_element: '#pricing-settings',
            position: 'left',
        },
        {
            step_id: 'order_management',
            title: 'Process Orders',
            description: 'Manage bulk orders, invoicing, and shipments.',
            target_element: '#nav-orders',
            position: 'right',
        },
    ],
};

// Badge milestones
const BADGE_MILESTONES = {
    first_listing: { points: 10, name: 'First Listing', description: 'Created your first listing' },
    first_sale: { points: 25, name: 'First Sale', description: 'Made your first sale' },
    '10_listings': { points: 50, name: '10 Listings', description: 'Created 10 listings' },
    first_automation: { points: 25, name: 'Automation Pro', description: 'Set up your first automation' },
    profile_complete: { points: 15, name: 'Profile Complete', description: 'Completed your profile' },
    '100_items': { points: 100, name: 'Inventory Master', description: 'Added 100 items to inventory' },
    '50_sales': { points: 150, name: 'Sales Champion', description: 'Achieved 50 sales' },
};

export async function onboardingRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/onboarding/progress - Get user's onboarding progress
    if (method === 'GET' && path === '/progress') {
        try {
            const progress = await query.get(`SELECT * FROM onboarding_progress WHERE user_id = ?`, [user.id]);

            if (!progress) {
                return {
                    status: 200,
                    data: {
                        current_step: 'welcome',
                        completed_steps: [],
                        badges: [],
                        points: 0,
                        role: null,
                    },
                };
            }

            return {
                status: 200,
                data: {
                    ...progress,
                    completed_steps: safeParse(progress.completed_steps || '[]', []),
                    badges: safeParse(progress.badges || '[]', []),
                },
            };
        } catch (error) {
            logger.error('[Onboarding] Get progress error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to load onboarding progress' } };
        }
    }

    // POST /api/onboarding/progress - Create/reset onboarding progress
    if (method === 'POST' && path === '/progress') {
        try {
            const { role } = body;

            if (!role) {
                return { status: 400, data: { error: 'role required' } };
            }

            const validRoles = ['reseller', 'bulk_seller', 'live_streamer', 'supplier'];
            if (!validRoles.includes(role)) {
                return { status: 400, data: { error: `Invalid role. Must be: ${validRoles.join(', ')}` } };
            }

            // Check if progress already exists
            const existing = await query.get('SELECT id FROM onboarding_progress WHERE user_id = ?', [user.id]);

            if (existing) {
                // Reset progress
                await query.run(
                    `UPDATE onboarding_progress
                    SET role = ?, current_step = 'welcome', completed_steps = '[]',
                    badges = '[]', points = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?`,
                    [role, user.id],
                );

                const updated = await query.get('SELECT * FROM onboarding_progress WHERE user_id = ?', [user.id]);

                return { status: 200, data: updated };
            } else {
                // Create new progress
                const id = uuidv4();

                await query.run(
                    `INSERT INTO onboarding_progress
                    (id, user_id, role, current_step, completed_steps, badges, points)
                    VALUES (?, ?, ?, 'welcome', '[]', '[]', 0)`,
                    [id, user.id, role],
                );

                const progress = await query.get('SELECT * FROM onboarding_progress WHERE id = ?', [id]);

                return { status: 201, data: progress };
            }
        } catch (error) {
            logger.error('[Onboarding] Create progress error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to create onboarding progress' } };
        }
    }

    // PUT /api/onboarding/progress/step - Complete a step
    if (method === 'PUT' && path === '/progress/step') {
        try {
            const { step_id } = body;

            if (!step_id) {
                return { status: 400, data: { error: 'step_id required' } };
            }

            const progress = await query.get('SELECT * FROM onboarding_progress WHERE user_id = ?', [user.id]);

            if (!progress) {
                return { status: 404, data: { error: 'Onboarding progress not found. Create progress first.' } };
            }

            const completedSteps = safeParse(progress.completed_steps || '[]', []);

            // Check if already completed
            if (completedSteps.includes(step_id)) {
                return {
                    status: 200,
                    data: { message: 'Step already completed', completed_steps: completedSteps, points_awarded: 0 },
                };
            }

            // Add to completed steps
            completedSteps.push(step_id);

            // Award points based on milestone
            let pointsAwarded = 0;
            const badges = safeParse(progress.badges || '[]', []);

            if (BADGE_MILESTONES[step_id]) {
                pointsAwarded = BADGE_MILESTONES[step_id].points;
                if (!badges.includes(step_id)) {
                    badges.push(step_id);
                }
            }

            const newPoints = (progress.points || 0) + pointsAwarded;

            // Update progress
            await query.run(
                `UPDATE onboarding_progress
                SET completed_steps = ?, badges = ?, points = ?,
                current_step = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?`,
                [JSON.stringify(completedSteps), JSON.stringify(badges), newPoints, step_id, user.id],
            );

            const updated = await query.get('SELECT * FROM onboarding_progress WHERE user_id = ?', [user.id]);

            return {
                status: 200,
                data: {
                    ...updated,
                    completed_steps: safeParse(updated.completed_steps || '[]', []),
                    badges: safeParse(updated.badges || '[]', []),
                    points_awarded: pointsAwarded,
                },
            };
        } catch (error) {
            logger.error('[Onboarding] Complete step error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to complete step' } };
        }
    }

    // GET /api/onboarding/tours/:role - Get tour steps for a role
    if (method === 'GET' && path.match(/^\/tours\/[a-z_]+$/)) {
        try {
            const role = path.split('/')[2];

            if (!TOUR_STEPS[role]) {
                return { status: 404, data: { error: 'Role not found' } };
            }

            return { status: 200, data: TOUR_STEPS[role] };
        } catch (error) {
            logger.error('[Onboarding] Get tours error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to load tour steps' } };
        }
    }

    // GET /api/onboarding/badges - Get all available badges and which user has earned
    if (method === 'GET' && path === '/badges') {
        try {
            const progress = await query.get('SELECT badges, points FROM onboarding_progress WHERE user_id = ?', [
                user.id,
            ]);

            const earnedBadges = safeParse(progress?.badges || '[]', []);
            const currentPoints = progress?.points || 0;

            const allBadges = Object.entries(BADGE_MILESTONES).map(([key, badge]) => ({
                badge_id: key,
                name: badge.name,
                description: badge.description,
                points: badge.points,
                earned: earnedBadges.includes(key),
            }));

            return {
                status: 200,
                data: {
                    badges: allBadges,
                    total_points: currentPoints,
                    earned_count: earnedBadges.length,
                    total_count: Object.keys(BADGE_MILESTONES).length,
                },
            };
        } catch (error) {
            logger.error('[Onboarding] Get badges error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to load badges' } };
        }
    }

    // POST /api/onboarding/badges/claim - Claim a badge reward
    if (method === 'POST' && path === '/badges/claim') {
        try {
            const { badge_id } = body;

            if (!badge_id) {
                return { status: 400, data: { error: 'badge_id required' } };
            }

            if (!BADGE_MILESTONES[badge_id]) {
                return { status: 404, data: { error: 'Badge not found' } };
            }

            const progress = await query.get('SELECT * FROM onboarding_progress WHERE user_id = ?', [user.id]);

            if (!progress) {
                return { status: 404, data: { error: 'Onboarding progress not found' } };
            }

            const badges = safeParse(progress.badges || '[]', []);

            if (!badges.includes(badge_id)) {
                return { status: 400, data: { error: 'Badge not yet earned' } };
            }

            // Mark as claimed (you could add a claimed_badges column if needed)
            return {
                status: 200,
                data: {
                    message: 'Badge claimed',
                    badge: BADGE_MILESTONES[badge_id],
                },
            };
        } catch (error) {
            logger.error('[Onboarding] Claim badge error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to claim badge' } };
        }
    }

    return { status: 404, data: { error: 'Onboarding endpoint not found' } };
}
