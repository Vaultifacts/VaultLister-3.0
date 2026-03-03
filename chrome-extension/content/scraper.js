// Product Scraper for Amazon and Nordstrom
// Extracts product details from retail websites

// Detect which site we're on
const currentSite = detectSite();

function detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes('amazon.com')) return 'amazon';
    if (hostname.includes('nordstrom.com')) return 'nordstrom';
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

            // Main image
            const mainImg = document.querySelector('#landingImage')?.src ||
                           document.querySelector('#imgBlkFront')?.src;
            if (mainImg) images.push(mainImg);

            // Thumbnail images
            const thumbs = document.querySelectorAll('.imageThumbnail img, #altImages img');
            thumbs.forEach(img => {
                if (img.src && !images.includes(img.src)) {
                    images.push(img.src);
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
    }
};

// Add floating button to page
function addFloatingButton() {
    // Check if button already exists
    if (document.getElementById('vaultlister-scrape-btn')) return;

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
