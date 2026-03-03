# /rate-limit-options - Configure Rate Limiting

View and configure VaultLister's rate limiting settings.

## Usage
```
/rate-limit-options [action]
```

Actions: `view`, `disable`, `enable`, `troubleshoot`

---

## Current Configuration

**File:** `src/backend/middleware/rateLimiter.js`

| Tier | Window | Max Requests | Applied To |
|------|--------|--------------|------------|
| `default` | 1 minute | 100 | All API endpoints |
| `auth` | 15 minutes | 10 | `/api/auth/*` (login, register) |
| `mutation` | 1 minute | 30 | POST, PUT, DELETE requests |
| `expensive` | 1 minute | 10 | `/api/ai/*`, `/api/analytics/*` |

**Additional Settings:**
- **Auto-block threshold:** 3 violations
- **Block duration:** 1 hour
- **Cleanup interval:** 5 minutes

---

## Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `DISABLE_RATE_LIMIT` | `true` / `false` | Disable all rate limiting |
| `NODE_ENV` | `test` | Automatically disables rate limiting |
| `MAX_REQUESTS_PER_MINUTE` | number | Reference only (not wired up) |

### Disable for Testing
```bash
# Option 1: Environment variable
DISABLE_RATE_LIMIT=true bun run dev

# Option 2: Test mode
NODE_ENV=test bun test

# Option 3: Combined (for running tests)
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun test
```

---

## Modifying Rate Limits

### Change Limits in rateLimiter.js

```javascript
// src/backend/middleware/rateLimiter.js

static config = {
    // General API endpoints - increase for high-traffic apps
    default: {
        windowMs: 60 * 1000,        // 1 minute
        maxRequests: 100,           // ← Change this
        message: 'Too many requests, please try again later'
    },

    // Authentication - keep strict for security
    auth: {
        windowMs: 15 * 60 * 1000,   // 15 minutes
        maxRequests: 10,            // ← Change this (not recommended)
        message: 'Too many login attempts, please try again in 15 minutes'
    },

    // Write operations
    mutation: {
        windowMs: 60 * 1000,        // 1 minute
        maxRequests: 30,            // ← Change this
        message: 'Too many write requests, please slow down'
    },

    // AI and analytics (expensive operations)
    expensive: {
        windowMs: 60 * 1000,        // 1 minute
        maxRequests: 10,            // ← Change this
        message: 'Rate limit exceeded for this operation'
    },

    // How long to block repeat offenders
    blockDuration: 60 * 60 * 1000   // 1 hour ← Change this
};
```

### Recommended Values by Environment

| Environment | default | auth | mutation | expensive |
|-------------|---------|------|----------|-----------|
| Development | 100/min | 10/15min | 30/min | 10/min |
| Production | 60/min | 5/15min | 20/min | 5/min |
| Testing | Disabled | Disabled | Disabled | Disabled |

---

## Response Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 100        # Max requests allowed
X-RateLimit-Remaining: 95     # Requests remaining
X-RateLimit-Reset: 1706198400 # Timestamp when limit resets
Retry-After: 45               # Seconds to wait (only when limited)
```

### Check Headers with curl
```bash
curl -I http://localhost:3000/api/inventory \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Monitoring & Debugging

### View Security Logs
```sql
-- Recent rate limit events
SELECT * FROM security_logs
WHERE event_type LIKE 'RATE_LIMIT%'
ORDER BY created_at DESC
LIMIT 20;

-- Top offenders
SELECT ip_or_user, COUNT(*) as violations
FROM security_logs
WHERE event_type = 'RATE_LIMIT_EXCEEDED'
GROUP BY ip_or_user
ORDER BY violations DESC
LIMIT 10;

-- Blocked IPs/users
SELECT * FROM security_logs
WHERE event_type = 'RATE_LIMIT_BLOCK'
ORDER BY created_at DESC;
```

### Using the API Stats
```javascript
// In rateLimiter.js, use getStats() and getTopOffenders()
import { RateLimiter } from './middleware/rateLimiter.js';

// Get current tracking stats
const stats = RateLimiter.getStats();
console.log(stats);
// { totalTracked: 150, blockedCount: 3 }

// Get top requesters
const topOffenders = RateLimiter.getTopOffenders(5);
console.log(topOffenders);
// [{ key: 'ip:192.168.1.1', requests: 89, blocked: false }, ...]
```

---

## Troubleshooting 429 Errors

### "Too many requests" Error

**Symptoms:**
- API returns 429 status
- Response: `{ "error": "Too many requests..." }`

**Solutions:**

1. **Check if testing** - Disable rate limiting:
   ```bash
   DISABLE_RATE_LIMIT=true bun run dev
   ```

2. **Increase limits** - Edit rateLimiter.js config

3. **Check for loops** - Ensure frontend isn't making excessive calls:
   ```javascript
   // ❌ BAD: Polling every 100ms
   setInterval(() => api.get('/status'), 100);

   // ✅ GOOD: Reasonable interval
   setInterval(() => api.get('/status'), 5000);
   ```

4. **Add request debouncing** - For search inputs:
   ```javascript
   // Debounce search to avoid rapid API calls
   let searchTimeout;
   function onSearchInput(value) {
       clearTimeout(searchTimeout);
       searchTimeout = setTimeout(() => {
           api.get(`/search?q=${value}`);
       }, 300);
   }
   ```

### "Blocked" Error (1 hour ban)

**Symptoms:**
- All requests return 429
- Message mentions being blocked

**Solutions:**

1. **Wait** - Block expires after 1 hour

2. **Manual unblock** (development only):
   ```javascript
   import { RateLimiter } from './middleware/rateLimiter.js';
   RateLimiter.unblock('ip:YOUR_IP');
   // or
   RateLimiter.unblock('user:USER_ID');
   ```

3. **Restart server** - Clears in-memory tracking (not recommended for production)

---

## Skipped Paths

These paths bypass rate limiting:
```javascript
const skipPaths = ['/api/health', '/api/status'];
```

Add more if needed:
```javascript
// In applyRateLimit function
const skipPaths = [
    '/api/health',
    '/api/status',
    '/api/my-custom-path'  // Add here
];
```

---

## Quick Reference

| Task | Command/Action |
|------|----------------|
| Disable rate limiting | `DISABLE_RATE_LIMIT=true` |
| View current limits | Check `rateLimiter.js` config |
| See who's being limited | Query `security_logs` table |
| Unblock someone | `RateLimiter.unblock('ip:X.X.X.X')` |
| Check response headers | `curl -I http://localhost:3000/api/...` |
| Run tests without limits | `DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun test` |
