// CDN and Static Asset Configuration
// Handles CDN URL generation and cache headers for static assets

const CDN_URL = process.env.CDN_URL || '';
const ASSET_VERSION = process.env.ASSET_VERSION || Date.now().toString(36);

// Asset types and their cache durations
const CACHE_DURATIONS = {
    // Immutable assets (hashed filenames)
    immutable: 31536000, // 1 year

    // Static assets
    css: 86400 * 7, // 7 days
    js: 86400 * 7, // 7 days
    images: 86400 * 30, // 30 days
    fonts: 86400 * 365, // 1 year

    // Dynamic content
    html: 0, // No cache
    api: 0, // No cache
};

// Get cache duration based on file extension
function getCacheDuration(path) {
    const ext = path.split('.').pop()?.toLowerCase();

    // Check for hashed filenames (e.g., app.abc123.js)
    if (/\.[a-f0-9]{8,}\.(js|css)$/.test(path)) {
        return CACHE_DURATIONS.immutable;
    }

    switch (ext) {
        case 'css':
        case 'scss':
            return CACHE_DURATIONS.css;
        case 'js':
        case 'mjs':
            return CACHE_DURATIONS.js;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
        case 'ico':
            return CACHE_DURATIONS.images;
        case 'woff':
        case 'woff2':
        case 'ttf':
        case 'eot':
            return CACHE_DURATIONS.fonts;
        case 'html':
        case 'htm':
            return CACHE_DURATIONS.html;
        default:
            return 3600; // 1 hour default
    }
}

// Generate cache control header
function getCacheControl(path, isPrivate = false) {
    const duration = getCacheDuration(path);

    if (duration === 0) {
        return 'no-store, no-cache, must-revalidate, proxy-revalidate';
    }

    const directives = [isPrivate ? 'private' : 'public', `max-age=${duration}`];

    // Add immutable for long-cached assets
    if (duration >= CACHE_DURATIONS.immutable) {
        directives.push('immutable');
    }

    // Add stale-while-revalidate for better UX
    if (duration >= 86400) {
        directives.push(`stale-while-revalidate=${Math.min(duration / 10, 86400)}`);
    }

    return directives.join(', ');
}

// Generate CDN URL for an asset
function cdnUrl(path) {
    if (!CDN_URL) {
        return path;
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Add version query param for cache busting (non-hashed files)
    const hasHash = /\.[a-f0-9]{8,}\.(js|css)$/.test(path);
    const versionedPath = hasHash ? normalizedPath : `${normalizedPath}?v=${ASSET_VERSION}`;

    return `${CDN_URL}${versionedPath}`;
}

// Middleware to add cache headers
function staticCacheMiddleware(ctx) {
    const path = ctx.path || '';

    // Skip API routes
    if (path.startsWith('/api/')) {
        return null;
    }

    const cacheControl = getCacheControl(path);

    return {
        'Cache-Control': cacheControl,
        Vary: 'Accept-Encoding',
    };
}

// Generate preload hints for critical assets
function getPreloadHints() {
    const criticalAssets = [
        { path: '/styles/main.css', as: 'style' },
        { path: '/core-bundle.js', as: 'script' },
    ];

    return criticalAssets
        .map((asset) => {
            const url = cdnUrl(asset.path);
            return `<${url}>; rel=preload; as=${asset.as}`;
        })
        .join(', ');
}

// CDN configuration for nginx
const nginxCdnConfig = `
# CDN and Caching Configuration for VaultLister
# Add to your nginx server block

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    application/json
    application/javascript
    application/xml
    application/xml+rss
    image/svg+xml;

# Static asset caching
location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header Vary "Accept-Encoding";

    # Enable CDN origin pull
    # proxy_pass http://cdn-origin;
}

# HTML files - no cache
location ~* \\.html$ {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}

# API routes - no cache
location /api/ {
    expires -1;
    add_header Cache-Control "no-store";
    proxy_pass http://localhost:3000;
}

# Service worker - short cache
location /sw.js {
    expires 1h;
    add_header Cache-Control "public, max-age=3600";
}
`;

export {
    getCacheDuration,
    getCacheControl,
    cdnUrl,
    staticCacheMiddleware,
    getPreloadHints,
    nginxCdnConfig,
    CDN_URL,
    ASSET_VERSION,
};
