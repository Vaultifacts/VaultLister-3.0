# Backend Reference
> Last reviewed: 2026-02-16

## Server Entry Point
## Server Entry Point

**File:** `src/backend/server.js`

```javascript
// Bun.serve() on port 3000
const server = Bun.serve({
    port: 3000,
    fetch: async (request) => { ... }
});
```

**Server startup sequence:**
1. Initialize database (runs migrations)
2. Seed help content
3. Register route handlers
4. Apply middleware chain
5. Start listening

---

## Directory Structure

```
src/backend/
├── db/
│   ├── database.js      # DB connection, query helpers, migrations
│   ├── pg-schema.sql    # PostgreSQL schema (189 tables)
│   ├── seed.js          # Demo data seeding
│   └── migrations/      # Incremental schema changes (001-112)
├── middleware/
│   ├── auth.js          # JWT verification
│   ├── csrf.js          # CSRF token validation
│   ├── rateLimiter.js   # Rate limiting
│   └── securityHeaders.js # HTTP security headers
├── routes/
│   ├── auth.js          # Authentication
│   ├── inventory.js     # Inventory CRUD
│   ├── listings.js      # Listings + delist/relist
│   ├── sales.js         # Sales + FIFO
│   ├── financials.js    # Accounting system
│   ├── chatbot.js       # Vault Buddy AI chat
│   ├── analytics.js     # Dashboard metrics
│   ├── shops.js         # Platform connections
│   ├── templates.js     # Listing templates
│   ├── imageBank.js     # Image management
│   ├── calendar.js      # Events
│   ├── checklists.js    # Daily checklists
│   ├── oauth.js         # OAuth flows
│   ├── mock-oauth.js    # Mock OAuth provider
│   ├── batchPhoto.js    # Batch image processing
│   └── ... (24 total)
├── services/
│   ├── grokService.js      # AI chat responses
│   ├── imageStorage.js     # File storage
│   └── cloudinaryService.js # Image processing
└── utils/
    └── encryption.js    # Token encryption
```

---

## Route Registration

Routes are registered in `server.js`:

```javascript
const apiRoutes = {
    '/api/auth': authRouter,
    '/api/inventory': inventoryRouter,
    '/api/listings': listingsRouter,
    // ... etc
};

const protectedPrefixes = [
    '/api/inventory',
    '/api/listings',
    '/api/financials',
    // Routes requiring authentication
];
```

---

## Router Pattern

Each router exports an async function:

```javascript
export async function inventoryRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/inventory
    if (method === 'GET' && (path === '/' || path === '')) {
        const items = query.all('SELECT * FROM inventory WHERE user_id = ?', [user.id]);
        return { status: 200, data: { items } };
    }

    // POST /api/inventory
    if (method === 'POST' && (path === '/' || path === '')) {
        // Create item logic
        return { status: 201, data: { item } };
    }

    // Path matching for IDs (UUIDs)
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        // Get single item
    }

    return { status: 404, data: { error: 'Route not found' } };
}
```

---

## Middleware Chain

Applied in order:

1. **Security Headers** - CSP, HSTS, X-Frame-Options
2. **CORS** - Cross-origin handling
3. **Rate Limiting** - Request throttling
4. **Auth** - JWT validation (protected routes only)
5. **CSRF** - Token validation (mutations only)

---

## Services

### Grok Service (`grokService.js`)

AI chat responses with mock mode fallback:

```javascript
import { generateResponse, isConfigured, getCannedResponses } from './services/grokService.js';

// Returns AI or canned response
const response = await generateResponse(messages, context);
```

### Image Storage (`imageStorage.js`)

```javascript
import { saveImage, deleteImage, getImageUrl } from './services/imageStorage.js';

// Save uploaded image
const imageId = await saveImage(fileData, userId, filename, mimeType);

// Storage paths: public/uploads/images/{original|thumbnails|edited}/
```

### Cloudinary Service (`cloudinaryService.js`)

```javascript
import { removeBackground, autoEnhance, isCloudinaryConfigured } from './services/cloudinaryService.js';

// Check if Cloudinary is configured
if (isCloudinaryConfigured()) {
    const result = await removeBackground(publicId);
}
```

---

## Environment Variables

```bash
# Required
JWT_SECRET=your-secret-key

# Optional
ANTHROPIC_API_KEY=sk-...       # For AI features
CLOUDINARY_CLOUD_NAME=...      # For image processing
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
XAI_API_KEY=...                # For Grok AI

# Testing
DISABLE_CSRF=true              # Disable CSRF for tests
DISABLE_RATE_LIMIT=true        # Disable rate limiting for tests
```

---

## Error Handling

```javascript
try {
    // Operation
    return { status: 200, data: { result } };
} catch (error) {
    console.error('Operation failed:', error);
    return { status: 500, data: { error: 'Internal server error' } };
}
```

---

## Input Validation

Use sanitize utilities:

```javascript
import { validateInventoryData, validatePrice, escapeHtml } from '../../shared/utils/sanitize.js';

const validation = validateInventoryData(body, isUpdate);
if (!validation.valid) {
    return { status: 400, data: { error: 'Validation failed', errors: validation.errors } };
}
```

---

## UUID Generation

All IDs use UUID v4:

```javascript
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();
```

---

## Important Patterns

**DO NOT:**
- Call `router.handleRoute()` from data loading functions (causes infinite loops)
- Use INTEGER for IDs (use TEXT for UUIDs)
- Skip input validation on user data

**DO:**
- Return proper status codes
- Log errors with context
- Use prepared statements for queries
- Validate all user input
