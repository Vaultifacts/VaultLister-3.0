# VaultLister Chrome Extension

The VaultLister Chrome Extension provides quick product capture, price tracking, and cross-listing helpers for resellers.

## Features

### 1. Product Scraping
- **Amazon** - Automatically extract product details (title, price, images, brand, description)
- **Nordstrom** - Scrape retail products with full metadata
- **One-Click Capture** - Floating button on supported sites for instant product capture

### 2. Price Tracking
- Monitor competitor prices on Amazon and Nordstrom
- Set target prices for price drop alerts
- Automatic price checks every 6 hours
- Desktop notifications when prices drop

### 3. Cross-Listing Helper
- **Auto-fill Forms** - Import VaultLister inventory into marketplace listing forms
- **Supported Platforms:**
  - Poshmark
  - eBay
  - Mercari
- **Smart Mapping** - Automatically maps fields based on platform

### 4. Context Menu Actions
- Right-click images to add directly to VaultLister
- Quick cross-list images from any webpage
- Instant sync to VaultLister inventory

### 5. Extension Popup
- Login/logout from VaultLister
- View scraping and tracking stats
- Process sync queue
- Quick access to VaultLister app

## Installation

### From Source (Development)

1. **Load Extension in Chrome:**
   ```
   1. Open Chrome and go to chrome://extensions/
   2. Enable "Developer mode" (toggle in top-right)
   3. Click "Load unpacked"
   4. Select the chrome-extension/ directory
   ```

2. **Pin the Extension:**
   - Click the Extensions icon in Chrome toolbar
   - Find "VaultLister Helper"
   - Click the pin icon to keep it visible

### Icons Setup

Before loading the extension, add icon files to `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

See `icons/README.md` for icon creation guidelines.

## Usage

### Quick Product Capture

1. **Visit a product page** on Amazon or Nordstrom
2. **Click the floating "Add to VaultLister" button** that appears on the page
3. Product details are automatically extracted and saved
4. **Desktop notification** confirms successful capture

### Price Tracking

1. Visit an Amazon or Nordstrom product page
2. Click the VaultLister extension icon
3. Click **"Track Price"**
4. Price will be checked every 6 hours
5. Receive notifications when price drops below target

### Auto-fill Marketplace Forms

1. **Go to a listing form** on Poshmark, eBay, or Mercari
2. **Click the "Import from VaultLister" button** that appears on the page
3. **Select an item** from your VaultLister inventory
4. **Form is automatically filled** with product details

### Context Menu Actions

1. **Right-click any image** on a webpage
2. Select **"Add to VaultLister"** to save image to sync queue
3. Or select **"Cross-list this image"** to open VaultLister with the image

## Extension Popup

Click the extension icon to access:

- **Login/Logout** - Authenticate with your VaultLister account
- **Capture Product** - Scrape current page (if supported)
- **Track Price** - Add current product to price tracking
- **Open VaultLister** - Quick link to main app
- **Sync Now** - Process all pending sync queue items
- **Stats** - View scraped products and price tracking counts
- **Sync Queue** - See and process pending actions

## API Endpoints

The extension communicates with VaultLister backend via these endpoints:

### Scraped Products
- `POST /api/extension/scraped` - Save scraped product
- `GET /api/extension/scraped` - List scraped products
- `DELETE /api/extension/scraped/:id` - Delete scraped product

### Price Tracking
- `POST /api/extension/price-track` - Add price tracking
- `GET /api/extension/price-track` - List tracked products
- `PATCH /api/extension/price-track/:id` - Update tracking
- `DELETE /api/extension/price-track/:id` - Stop tracking

### Sync Queue
- `POST /api/extension/sync` - Add to sync queue
- `GET /api/extension/sync` - Get pending items
- `POST /api/extension/sync/:id/process` - Mark item as processed

## Permissions

The extension requests the following permissions:

- **storage** - Store auth token and settings
- **activeTab** - Access current tab for scraping
- **contextMenus** - Add right-click menu options
- **alarms** - Schedule price tracking checks
- **notifications** - Show desktop notifications
- **host_permissions** - Access specific websites:
  - localhost:3000 (VaultLister API)
  - amazon.com (product scraping)
  - nordstrom.com (product scraping)
  - poshmark.com (auto-fill)
  - ebay.com (auto-fill)
  - mercari.com (auto-fill)

## Architecture

### Content Scripts
- **scraper.js** - Runs on Amazon and Nordstrom product pages
  - Extracts product data
  - Adds floating capture button

- **autofill.js** - Runs on marketplace listing pages
  - Adds import button
  - Maps VaultLister items to form fields

### Background
- **service-worker.js** - Background tasks
  - Price tracking scheduler (every 6 hours)
  - Context menu handlers
  - Message routing between components
  - Badge updates

### Popup
- **popup.html/css/js** - Extension popup interface
  - Login form
  - Quick actions
  - Stats display
  - Sync queue management

### Library
- **api.js** - API client
  - Authentication management
  - All backend communication
  - Token storage

## Development

### Testing Scrapers

1. Visit Amazon product: https://www.amazon.com/dp/B08N5WRWNW
2. Click "Add to VaultLister" button
3. Check console for scraped data
4. Verify product saved in VaultLister inventory

### Testing Auto-fill

1. Login to VaultLister extension
2. Go to https://poshmark.com/create-listing
3. Click "Import from VaultLister"
4. Select an item
5. Verify form fields are populated

### Debugging

- **Console Logs:** Right-click extension icon > "Inspect popup"
- **Background Script:** Go to chrome://extensions/ > "Inspect views: service worker"
- **Content Scripts:** Open DevTools on the webpage

### Common Issues

**"Failed to load items"**
- Check if logged in to VaultLister
- Verify VaultLister server is running on localhost:3000
- Check browser console for CORS errors

**Scraping doesn't work**
- Reload the product page
- Check if page structure changed (websites update frequently)
- Verify content script is injected (check DevTools > Sources)

**Price tracking not working**
- Check if alarm is registered: chrome://extensions/ > "Inspect views: service worker" > Application > Service Workers
- Verify API endpoint is working

## Updating Scrapers

Website structures change frequently. To update scrapers:

1. Open the product page in Chrome
2. Inspect the elements you want to scrape
3. Update the selectors in `content/scraper.js`
4. Test the scraper by reloading the extension

### Example: Updating Amazon Title Selector

```javascript
// Old selector
const title = document.querySelector('#productTitle')?.textContent?.trim();

// New selector (if Amazon changed their HTML)
const title = document.querySelector('[data-feature-name="title"]')?.textContent?.trim();
```

## Future Enhancements

- [ ] Support more retail sites (Walmart, Target, Best Buy)
- [ ] Batch import from search results
- [ ] OCR for reading product info from images
- [ ] Browser history analysis for sourcing opportunities
- [ ] Bulk price tracking from Amazon wish lists
- [ ] Export data to CSV/Excel
- [ ] Dark mode for popup

## Support

For issues or feature requests, visit the VaultLister repository or contact support through the main application.

## Version History

### v1.0.0 (Current)
- Initial release
- Amazon and Nordstrom scraping
- Price tracking with notifications
- Auto-fill for Poshmark, eBay, Mercari
- Context menu actions
- Sync queue management
