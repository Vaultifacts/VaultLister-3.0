// Single source of truth for supported marketplaces.
// Imported by: server.js (/api/health/platforms route, /api/platforms/supported),
// uptimeProbeWorker.js, and exposed to status.html via GET /api/platforms/supported.

export const SUPPORTED_PLATFORMS = [
    { id: 'ebay',     name: 'eBay',                 logo: '/assets/logos/ebay/logo.svg',                         logoHeight: 38, marketUrl: 'https://www.ebay.com/',                 vlModule: '../services/platformSync/ebaySync.js' },
    { id: 'shopify',  name: 'Shopify',              logo: '/assets/logos/shopify/logo.svg',                      logoHeight: 34, marketUrl: 'https://www.shopify.com/',              vlModule: '../services/platformSync/shopifySync.js' },
    { id: 'poshmark', name: 'Poshmark',             logo: '/assets/logos/poshmark/logo.png',                     logoHeight: 32, marketUrl: 'https://poshmark.com/',                 vlModule: '../services/platformSync/poshmarkSync.js' },
    { id: 'depop',    name: 'Depop',                logo: '/assets/logos/depop/logo.svg',                        logoHeight: 30, marketUrl: 'https://www.depop.com/',                vlModule: '../services/platformSync/depopSync.js' },
    { id: 'facebook', name: 'Facebook Marketplace', logo: '/assets/logos/facebook/Facebook_Logo_Primary.png',    logoHeight: 36, marketUrl: 'https://www.facebook.com/marketplace/', vlModule: '../services/platformSync/facebookSync.js' },
    { id: 'whatnot',  name: 'Whatnot',              logo: '/assets/logos/whatnot/logo.svg',                      logoHeight: 30, marketUrl: 'https://www.whatnot.com/',              vlModule: '../services/platformSync/whatnotSync.js' }
];

export const SUPPORTED_PLATFORM_IDS = SUPPORTED_PLATFORMS.map(p => p.id);

// Public-safe projection for the status page (excludes vlModule, marketUrl — internal)
export function publicPlatformList() {
    return SUPPORTED_PLATFORMS.map(({ id, name, logo, logoHeight }) => ({ id, name, logo, logoHeight }));
}
