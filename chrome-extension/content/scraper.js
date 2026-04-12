// Product Scraper for Amazon, Nordstrom, eBay, Poshmark, Mercari, Depop, Grailed, Etsy, Shopify
// Extracts product details from retail and resale websites

// Detect which site we're on
const currentSite = detectSite();

function detectSite() {
    const hostname = window.location.hostname;
    if (hostname === 'amazon.com' || hostname.endsWith('.amazon.com')) return 'amazon';
    if (hostname === 'nordstrom.com' || hostname.endsWith('.nordstrom.com')) return 'nordstrom';
    if (hostname === 'ebay.com' || hostname.endsWith('.ebay.com')) return 'ebay';
    if (hostname === 'poshmark.com' || hostname.endsWith('.poshmark.com')) return 'poshmark';
    if (hostname === 'mercari.com' || hostname.endsWith('.mercari.com')) return 'mercari';
    if (hostname === 'depop.com' || hostname.endsWith('.depop.com')) return 'depop';
    if (hostname === 'grailed.com' || hostname.endsWith('.grailed.com')) return 'grailed';
    if (hostname === 'etsy.com' || hostname.endsWith('.etsy.com')) return 'etsy';
    if (hostname === 'myshopify.com' || hostname.endsWith('.myshopify.com') || document.querySelector('meta[name="shopify-checkout-api-token"]')) return 'shopify';
    return null;
}

// Scraper functions for each site
const scrapers = {
    amazon: () => {
        try {
            // Product title
            const title = document.querySelector('#productTitle')?.textContent?.trim() ||
                         document.querySelector('h1.a-size-large')?.textContent?.trim();

            // Price
            let price = null;
            const priceWhole = document.querySelector('.a-price-whole')?.textContent?.trim();
            const priceFraction = document.querySelector('.a-price-fraction')?.textContent?.trim();
            if (priceWhole) {
                price = parseFloat(priceWhole.replace(',', '') + (priceFraction || ''));
            }

            // Images
            const images = [];

            // Main image — upgrade to full-res
            const rawMainImg = document.querySelector('#landingImage')?.src ||
                              document.querySelector('#imgBlkFront')?.src;
            const mainImg = rawMainImg
                ? rawMainImg.replace(/\._[A-Z0-9_,]+_\./i, '.')
                : null;
            if (mainImg) images.push(mainImg);

            // Thumbnail images — upgrade to full-res by stripping size suffixes
            const thumbs = document.querySelectorAll('.imageThumbnail img, #altImages img');
            thumbs.forEach(img => {
                const hiRes = img.src
                    ? img.src.replace(/\._[A-Z0-9_,]+_\./i, '.')
                    : null;
                if (hiRes && !images.includes(hiRes)) {
                    images.push(hiRes);
                }
            });

            // Brand
            const brand = document.querySelector('#bylineInfo')?.textContent?.trim()?.replace('Visit the ', '')?.replace(' Store', '') ||
                         document.querySelector('.a-row .a-size-base.po-break-word')?.textContent?.trim();

            // Description
            const description = document.querySelector('#feature-bullets ul')?.textContent?.trim() ||
                              document.querySelector('#productDescription p')?.textContent?.trim();

            // Category
            const breadcrumbs = Array.from(document.querySelectorAll('#wayfinding-breadcrumbs_feature_div a'))
                .map(a => a.textContent.trim())
                .filter(Boolean);

            // ASIN
            const asin = document.querySelector('input[name="ASIN"]')?.value ||
                        window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1];

            return {
                title,
                price,
                images,
                brand,
                description,
                category: breadcrumbs.join(' > '),
                source: 'Amazon',
                sourceUrl: window.location.href,
                sourceId: asin,
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Amazon scraper error:', error);
            return null;
        }
    },

    nordstrom: () => {
        try {
            // Product title
            const title = document.querySelector('[data-testid="product-title"]')?.textContent?.trim() ||
                         document.querySelector('h1')?.textContent?.trim();

            // Price
            let price = null;
            const priceText = document.querySelector('[data-testid="product-price"]')?.textContent?.trim() ||
                             document.querySelector('.price')?.textContent?.trim();
            if (priceText) {
                price = parseFloat(priceText.replace(/[$,]/g, ''));
            }

            // Images
            const images = [];

            // Main image
            const mainImg = document.querySelector('[data-testid="product-image"]')?.src;
            if (mainImg) images.push(mainImg);

            // Gallery images
            const galleryImgs = document.querySelectorAll('[data-testid="product-image-gallery"] img');
            galleryImgs.forEach(img => {
                if (img.src && !images.includes(img.src)) {
                    images.push(img.src);
                }
            });

            // Brand
            const brand = document.querySelector('[data-testid="product-brand"]')?.textContent?.trim() ||
                         document.querySelector('.brand-title')?.textContent?.trim();

            // Description
            const description = document.querySelector('[data-testid="product-description"]')?.textContent?.trim() ||
                              Array.from(document.querySelectorAll('.product-detail p'))
                                  .map(p => p.textContent.trim())
                                  .join('\n');

            // Category
            const breadcrumbs = Array.from(document.querySelectorAll('[data-testid="breadcrumb"] a'))
                .map(a => a.textContent.trim())
                .filter(Boolean);

            // Product ID
            const productId = window.location.pathname.match(/\/s\/([^/]+)/)?.[1];

            return {
                title,
                price,
                images,
                brand,
                description,
                category: breadcrumbs.join(' > '),
                source: 'Nordstrom',
                sourceUrl: window.location.href,
                sourceId: productId,
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Nordstrom scraper error:', error);
            return null;
        }
    },

    ebay: () => {
        try {
            const title = document.querySelector('h1.x-item-title__mainTitle span')?.textContent?.trim() ||
                         document.querySelector('#itemTitle')?.textContent?.trim()?.replace('Details about\u00a0', '');

            let price = null;
            const priceText = document.querySelector('.x-price-primary span.ux-textspans')?.textContent?.trim() ||
                             document.querySelector('#prcIsum')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('#vi_main_img_fs img, .ux-image-magnify__image--original, img[data-zoom-src]').forEach(img => {
                const src = img.getAttribute('data-zoom-src') || img.src;
                if (src && !images.includes(src)) images.push(src);
            });

            const condition = document.querySelector('.x-item-condition-text span.ux-textspans--BOLD')?.textContent?.trim() ||
                             document.querySelector('#vi-itm-cond')?.textContent?.trim();
            const description = document.querySelector('#desc_div')?.textContent?.trim()?.slice(0, 500) || null;
            const category = Array.from(document.querySelectorAll('#vi-VR-brumb-lnkLst a'))
                .map(a => a.textContent.trim()).filter(Boolean).join(' > ');
            const itemId = window.location.pathname.match(/\/itm\/(\d+)/)?.[1];

            return {
                title, price, images, condition, description, category,
                source: 'eBay', sourceUrl: window.location.href, sourceId: itemId,
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('eBay scraper error:', error);
            return null;
        }
    },

    poshmark: () => {
        try {
            const title = document.querySelector('h1.listing-title')?.textContent?.trim() ||
                         document.querySelector('[data-et-name="listing_title"]')?.textContent?.trim();

            let price = null;
            const priceText = document.querySelector('.listing-price')?.textContent?.trim() ||
                             document.querySelector('[data-et-name="price"]')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('.listing-image img, img[data-testid="listing-img"]').forEach(img => {
                const src = img.getAttribute('data-src') || img.src;
                if (src && !images.includes(src) && !src.includes('default')) images.push(src);
            });

            const brand = document.querySelector('.listing-brand')?.textContent?.trim() ||
                         document.querySelector('[itemprop="brand"]')?.textContent?.trim();
            const size = document.querySelector('.listing-size')?.textContent?.trim();
            const condition = document.querySelector('.listing-condition')?.textContent?.trim();
            const description = document.querySelector('.listing-description')?.textContent?.trim()?.slice(0, 500);

            return {
                title, price, images, brand, size, condition, description,
                source: 'Poshmark', sourceUrl: window.location.href,
                sourceId: window.location.pathname.split('/').pop(),
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Poshmark scraper error:', error);
            return null;
        }
    },

    mercari: () => {
        try {
            const title = document.querySelector('h1[class*="ItemName"]')?.textContent?.trim() ||
                         document.querySelector('h1')?.textContent?.trim();

            let price = null;
            const priceText = document.querySelector('[class*="ItemPrice"]')?.textContent?.trim() ||
                             document.querySelector('[data-testid="price"]')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('[class*="ItemImage"] img, [class*="Carousel"] img').forEach(img => {
                const src = img.getAttribute('data-src') || img.src;
                if (src && !images.includes(src)) images.push(src);
            });

            const condition = document.querySelector('[class*="ItemCondition"]')?.textContent?.trim();
            const description = document.querySelector('[class*="ItemDescription"]')?.textContent?.trim()?.slice(0, 500);

            return {
                title, price, images, condition, description,
                source: 'Mercari', sourceUrl: window.location.href,
                sourceId: window.location.pathname.match(/\/item\/([^/]+)/)?.[1],
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Mercari scraper error:', error);
            return null;
        }
    },

    depop: () => {
        try {
            const title = document.querySelector('h1[class*="productCard"]')?.textContent?.trim() ||
                         document.querySelector('h1')?.textContent?.trim();

            let price = null;
            const priceText = document.querySelector('[class*="productPrice"]')?.textContent?.trim() ||
                             document.querySelector('p[class*="price"]')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('[class*="productImage"] img, [class*="ProductImage"] img').forEach(img => {
                const src = img.getAttribute('data-src') || img.src;
                if (src && !images.includes(src) && src.startsWith('http')) images.push(src);
            });

            const brand = document.querySelector('[class*="brandName"]')?.textContent?.trim();
            const size = document.querySelector('[class*="productSize"], [class*="ProductSize"]')?.textContent?.trim();
            const condition = document.querySelector('[class*="productCondition"]')?.textContent?.trim();
            const description = document.querySelector('[class*="productDescription"]')?.textContent?.trim()?.slice(0, 500);

            return {
                title, price, images, brand, size, condition, description,
                source: 'Depop', sourceUrl: window.location.href,
                sourceId: window.location.pathname.match(/\/products\/([^/]+)/)?.[1] ||
                         window.location.pathname.split('/').filter(Boolean).pop(),
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Depop scraper error:', error);
            return null;
        }
    },

    grailed: () => {
        try {
            const title = document.querySelector('h1[class*="ListingCard"]')?.textContent?.trim() ||
                         document.querySelector('h1[class*="listing"]')?.textContent?.trim() ||
                         document.querySelector('h1')?.textContent?.trim();

            let price = null;
            const priceText = document.querySelector('[class*="ListingCard-module_price"]')?.textContent?.trim() ||
                             document.querySelector('[class*="price"]')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('[class*="ListingCard-module_photo"] img, [class*="listing-photo"] img').forEach(img => {
                const src = img.getAttribute('data-src') || img.src;
                if (src && !images.includes(src) && src.startsWith('http')) images.push(src);
            });

            const brand = document.querySelector('[class*="ListingCard-module_designer"]')?.textContent?.trim() ||
                         document.querySelector('[class*="designer"]')?.textContent?.trim();
            const size = document.querySelector('[class*="ListingCard-module_size"]')?.textContent?.trim() ||
                        document.querySelector('[class*="size"]')?.textContent?.trim();
            const condition = document.querySelector('[class*="ListingCard-module_condition"]')?.textContent?.trim();
            const description = document.querySelector('[class*="ListingCard-module_description"]')?.textContent?.trim()?.slice(0, 500) ||
                              document.querySelector('[class*="description"]')?.textContent?.trim()?.slice(0, 500);

            const category = Array.from(document.querySelectorAll('[class*="Breadcrumbs"] a, nav[aria-label="breadcrumb"] a'))
                .map(a => a.textContent.trim()).filter(Boolean).join(' > ');

            return {
                title, price, images, brand, size, condition, description, category,
                source: 'Grailed', sourceUrl: window.location.href,
                sourceId: window.location.pathname.match(/\/listings\/(\d+)/)?.[1],
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Grailed scraper error:', error);
            return null;
        }
    },

    etsy: () => {
        try {
            const title = document.querySelector('h1[data-buy-box-listing-title]')?.textContent?.trim() ||
                         document.querySelector('h1.wt-text-body-01')?.textContent?.trim() ||
                         document.querySelector('h1')?.textContent?.trim();

            let price = null;
            const priceText = document.querySelector('[data-selector="price-only"] .currency-value')?.textContent?.trim() ||
                             document.querySelector('.wt-text-title-larger')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('[data-image-carousel-image] img, [data-appears-component-name="listing_image"] img').forEach(img => {
                const src = img.getAttribute('data-src-zoom') || img.getAttribute('data-src') || img.src;
                if (src && !images.includes(src) && src.startsWith('http')) images.push(src);
            });

            const brand = document.querySelector('[data-component="shop-name-and-title-info"] a')?.textContent?.trim() ||
                         document.querySelector('.wt-text-link[href*="/shop/"]')?.textContent?.trim();
            const description = document.querySelector('#wt-content-toggle-product-details-read-more')?.textContent?.trim()?.slice(0, 500) ||
                              document.querySelector('[data-id="description-text"]')?.textContent?.trim()?.slice(0, 500);

            const category = Array.from(document.querySelectorAll('[data-component="breadcrumb"] a, nav[aria-label="breadcrumb"] a'))
                .map(a => a.textContent.trim()).filter(Boolean).join(' > ');

            const listingId = window.location.pathname.match(/\/listing\/(\d+)/)?.[1];

            return {
                title, price, images, brand, description, category,
                source: 'Etsy', sourceUrl: window.location.href,
                sourceId: listingId,
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Etsy scraper error:', error);
            return null;
        }
    },

    shopify: () => {
        try {
            // Try Shopify JSON API first for accurate data
            let productData = null;
            try {
                const jsonUrl = window.location.pathname.replace(/(\?.*)?$/, '.js');
                // Fallback to DOM if JSON not available synchronously
            } catch (_) {}

            const title = document.querySelector('h1.product__title, h1.product-single__title, .product__title h1')?.textContent?.trim() ||
                         document.querySelector('h1')?.textContent?.trim();

            let price = null;
            const priceText = document.querySelector('[class*="product__price"] .money, .product__price .money, [data-product-price]')?.textContent?.trim();
            if (priceText) price = parseFloat(priceText.replace(/[^0-9.]/g, '')) / 100 ||
                                   parseFloat(priceText.replace(/[^0-9.]/g, ''));

            const images = [];
            document.querySelectorAll('.product__media img, .product-single__photo img, [data-product-media-type="image"] img').forEach(img => {
                const src = img.getAttribute('data-src') || img.src;
                const hiRes = src ? 'https:' + src.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master|1024x1024|2048x2048)(\.[^.]+)$/, '$2').replace(/^https:/, '') : null;
                if (hiRes && !images.includes(hiRes) && hiRes.startsWith('http')) images.push(hiRes);
            });

            const brand = document.querySelector('[class*="product__vendor"], .product-single__vendor')?.textContent?.trim();
            const description = document.querySelector('.product__description, .product-single__description, [itemprop="description"]')?.textContent?.trim()?.slice(0, 500);

            const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb a, nav.breadcrumbs a, [data-breadcrumb] a'))
                .map(a => a.textContent.trim()).filter(Boolean);

            // Extract product handle from URL
            const productHandle = window.location.pathname.match(/\/products\/([^/?]+)/)?.[1];

            return {
                title, price, images, brand, description,
                category: breadcrumbs.join(' > '),
                source: 'Shopify', sourceUrl: window.location.href,
                sourceId: productHandle,
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Shopify scraper error:', error);
            return null;
        }
    }
};

// Returns true if the current Poshmark listing page is owned by the signed-in seller.
// Poshmark renders management controls (Edit / Mark Sold / Delete Listing) only on the owner's
// own listing view. We look for any of those signals before showing the "Add to VaultLister"
// button, so the seller doesn't accidentally scrape their own listing back into inventory.
function isOwnPoshmarkListing() {
    if (!/poshmark\.com$/.test(window.location.hostname)
        && !window.location.hostname.endsWith('.poshmark.com')) return false;
    if (!/^\/listing\//.test(window.location.pathname)) return false;

    const ownerSelectors = [
        '[data-et-name="edit_listing"]',
        '[data-et-name="mark_as_sold"]',
        '[data-et-name="delete_listing"]',
        'a[href*="/edit"][href*="/listing/"]'
    ];
    if (ownerSelectors.some(sel => document.querySelector(sel))) return true;

    // Text fallback — only owner sees Edit/Mark Sold/Delete Listing buttons
    const buttons = Array.from(document.querySelectorAll('button, a'));
    return buttons.some(b => /^(edit|mark (as )?sold|delete listing)$/i.test((b.textContent || '').trim()));
}

// Add floating button to page
function addFloatingButton() {
    // Check if button already exists
    if (document.getElementById('vaultlister-scrape-btn')) return;

    // Skip on the user's own Poshmark listings — they are already in inventory.
    if (isOwnPoshmarkListing()) return;

    const button = document.createElement('button');
    button.id = 'vaultlister-scrape-btn';
    button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
        </svg>
        Add to VaultLister
    `;
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 20px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s;
    `;

    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
    });

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.innerHTML = 'Capturing...';

        try {
            await scrapeAndSend();
            button.innerHTML = '✓ Added!';
            button.style.background = '#10b981';

            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Add to VaultLister
                `;
                button.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
            }, 2000);
        } catch (error) {
            button.innerHTML = '✗ Failed';
            button.style.background = '#ef4444';

            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Add to VaultLister
                `;
                button.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
            }, 2000);
        }
    });

    document.body.appendChild(button);
}

// Scrape product and send to extension
async function scrapeAndSend() {
    if (!currentSite || !scrapers[currentSite]) {
        throw new Error('Unsupported website');
    }

    const productData = scrapers[currentSite]();

    if (!productData || !productData.title) {
        throw new Error('Failed to scrape product data');
    }

    // Send to background script
    chrome.runtime.sendMessage({
        action: 'productScraped',
        data: productData
    });
}

// Initialize
if (currentSite) {
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addFloatingButton);
    } else {
        addFloatingButton();
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeProduct') {
        scrapeAndSend()
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
});
