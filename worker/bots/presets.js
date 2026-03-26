// Canonical automation presets — single source of truth
// Used by pages (full format) and handlers (minimal format)

const AUTOMATION_PRESETS = [
    // Sharing automations
    { id: 'daily_share', name: 'Daily Closet Share', platform: 'poshmark', description: 'Share your entire closet daily', category: 'sharing' },
    { id: 'party_share', name: 'Party Share', platform: 'poshmark', description: 'Auto-share items during Posh parties', category: 'sharing' },
    { id: 'community_share', name: 'Community Share', platform: 'poshmark', description: 'Share items from other closets to increase visibility', category: 'sharing' },
    // Engagement automations
    { id: 'follow_back', name: 'Follow Back', platform: 'poshmark', description: 'Automatically follow new followers', category: 'engagement' },
    { id: 'unfollow_inactive', name: 'Unfollow Inactive Users', platform: 'poshmark', description: 'Unfollow users who haven\'t followed back in 7 days', category: 'engagement' },
    { id: 'follow_targeted', name: 'Follow Targeted Users', platform: 'poshmark', description: 'Follow users who engage with similar brands/styles', category: 'engagement' },
    // Offers automations
    { id: 'send_offers', name: 'Send Offers to Likers', platform: 'poshmark', description: 'Auto-send offers to users who like your items', category: 'offers' },
    { id: 'auto_accept', name: 'Auto Accept Offers > 80%', platform: 'poshmark', description: 'Accept offers above 80% of list price', category: 'offers' },
    { id: 'decline_lowball', name: 'Decline Lowball Offers', platform: 'poshmark', description: 'Auto-decline offers below threshold', category: 'offers' },
    { id: 'counter_offers', name: 'Auto Counter Offers', platform: 'poshmark', description: 'Automatically counter low offers with your minimum', category: 'offers' },
    // Bundle automations
    { id: 'bundle_discount', name: 'Bundle Discount Offers', platform: 'poshmark', description: 'Send bundle discounts to users with multiple likes', category: 'bundles' },
    { id: 'bundle_reminder', name: 'Bundle Reminder', platform: 'poshmark', description: 'Remind buyers about items in their bundle', category: 'bundles' },
    { id: 'bundle_for_likers', name: 'Create Bundle for Likers', platform: 'poshmark', description: 'Auto-create bundles for users who like multiple items', category: 'bundles' },
    // Pricing automations
    { id: 'weekly_drop', name: 'Weekly Price Drop', platform: 'poshmark', description: 'Drop prices 10% weekly on stale items', category: 'pricing' },
    { id: 'ccl_rotation', name: 'CCL Price Rotation', platform: 'poshmark', description: 'Rotate CCL (Closet Clear Out) pricing for visibility', category: 'pricing' },
    // Maintenance automations
    { id: 'relist_stale', name: 'Relist Stale Items', platform: 'poshmark', description: 'Relist items not sold in 60 days', category: 'maintenance' },
    { id: 'delist_stale', name: 'Delist Stale Items', platform: 'all', description: 'Automatically delist items with no activity for 90+ days', category: 'maintenance' },
    { id: 'smart_relisting', name: 'Smart Relisting', platform: 'all', description: 'AI-powered relisting that optimizes titles, descriptions, and timing for maximum visibility', category: 'maintenance' },
    { id: 'description_refresh', name: 'Description Refresh', platform: 'poshmark', description: 'Update descriptions with trending keywords', category: 'maintenance' },
    { id: 'error_retry', name: 'Auto Error Recovery', platform: 'all', description: 'Auto-retry failed listings with error correction', category: 'maintenance' },
    // Repricing automations
    { id: 'auto_reprice', name: 'Repricing Automation', platform: 'all', description: 'Automatically adjust prices based on market rules and competitor pricing', category: 'pricing' },
    // Mercari automations
    { id: 'mercari_refresh', name: 'Mercari Daily Refresh', platform: 'mercari', description: 'Refresh all Mercari listings daily to boost visibility', category: 'sharing' },
    { id: 'mercari_relist', name: 'Mercari Relist Stale', platform: 'mercari', description: 'Relist Mercari items with no activity for 60+ days', category: 'maintenance' },
    { id: 'mercari_price_drop', name: 'Mercari Price Drop', platform: 'mercari', description: 'Weekly price drops on stale Mercari listings', category: 'pricing' },
    // Depop automations
    { id: 'depop_refresh', name: 'Depop Daily Refresh', platform: 'depop', description: 'Refresh all Depop listings daily to boost visibility', category: 'sharing' },
    { id: 'depop_share', name: 'Depop Share Listings', platform: 'depop', description: 'Share your Depop listings to increase exposure', category: 'sharing' },
    { id: 'depop_price_drop', name: 'Depop Price Drop', platform: 'depop', description: 'Weekly price drops on stale Depop listings', category: 'pricing' },
    // Grailed automations
    { id: 'grailed_bump', name: 'Grailed Daily Bump', platform: 'grailed', description: 'Bump all Grailed listings daily for more visibility', category: 'sharing' },
    { id: 'grailed_relist', name: 'Grailed Relist Stale', platform: 'grailed', description: 'Relist Grailed items with no activity for 60+ days', category: 'maintenance' },
    { id: 'grailed_price_drop', name: 'Grailed Price Drop', platform: 'grailed', description: 'Weekly price drops on stale Grailed listings', category: 'pricing' },
    // Facebook Marketplace automations
    { id: 'facebook_refresh', name: 'Facebook Daily Refresh', platform: 'facebook', description: 'Refresh all Facebook Marketplace listings daily', category: 'sharing' },
    { id: 'facebook_relist', name: 'Facebook Relist Stale', platform: 'facebook', description: 'Relist Facebook items with no activity for 60+ days', category: 'maintenance' },
    { id: 'facebook_price_drop', name: 'Facebook Price Drop', platform: 'facebook', description: 'Weekly price drops on stale Facebook listings', category: 'pricing' },
    // Whatnot automations
    { id: 'whatnot_refresh', name: 'Whatnot Daily Refresh', platform: 'whatnot', description: 'Refresh all Whatnot listings daily for more visibility', category: 'sharing' },
    { id: 'whatnot_relist', name: 'Whatnot Relist Stale', platform: 'whatnot', description: 'Relist Whatnot items with no activity for 60+ days', category: 'maintenance' },
    { id: 'whatnot_price_drop', name: 'Whatnot Price Drop', platform: 'whatnot', description: 'Weekly price drops on stale Whatnot listings', category: 'pricing' }
];

// Make available globally for vanilla JS SPA
if (typeof window !== 'undefined') {
    window.AUTOMATION_PRESETS = AUTOMATION_PRESETS;
}

// Also export for backend/test use
if (typeof module !== 'undefined') {
    module.exports = { AUTOMATION_PRESETS };
}
