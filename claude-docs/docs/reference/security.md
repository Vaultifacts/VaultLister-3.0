# Security Reference
> Last reviewed: 2026-03-28

## Overview
## Overview

VaultLister implements multiple security layers:
1. JWT Authentication
2. CSRF Protection
3. Rate Limiting
4. Security Headers
5. Input Validation/Sanitization
6. XSS Prevention

---

## JWT Authentication

**File:** `src/backend/middleware/auth.js`

```javascript
// Token format
Authorization: Bearer <jwt_token>

// Token payload
{
    userId: "uuid",
    email: "user@example.com",
    tier: "free",
    iat: 1234567890,
    exp: 1234567890
}
```

**Access token expiry:** 15 minutes
**Refresh token expiry:** 7 days (stored in `sessions` table)
**Refresh tokens:** Supported via `/api/auth/refresh`

---

## CSRF Protection

**File:** `src/backend/middleware/csrf.js`

**How it works:**
1. Client requests token via `GET /api/auth/csrf`
2. Server generates 32-byte random token, stores in DB
3. Client includes token in header for mutations
4. Server validates token exists and isn't expired

**Header:** `X-CSRF-Token: <token>`

**Required for:** POST, PUT, PATCH, DELETE requests

**Token expiry:** 4 hours

**Frontend usage:**
```javascript
await api.ensureCSRFToken();
const response = await api.post('/endpoint', data);
```

**Disable for testing:**
```bash
DISABLE_CSRF=true bun run src/backend/server.js
```

---

## Rate Limiting

**File:** `src/backend/middleware/rateLimiter.js`

**Limits:**
| Category | Limit | Window |
|----------|-------|--------|
| Default | 100 requests | 1 minute |
| Auth endpoints | 10 requests | 15 minutes |
| Mutations | 30 requests | 1 minute |

**Response headers:**
- `X-RateLimit-Limit` - Max requests allowed
- `X-RateLimit-Remaining` - Requests left
- `Retry-After` - Seconds until reset (when limited)

**Automatic IP blocking:** After 3 violations, IP blocked for 1 hour

**Disable for testing:**
```bash
DISABLE_RATE_LIMIT=true bun run src/backend/server.js
```

---

## Security Headers

**File:** `src/backend/middleware/securityHeaders.js`

Applied headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

---

## Input Validation

**File:** `src/shared/utils/sanitize.js`

```javascript
import { validateInventoryData, validatePrice, escapeHtml } from '../../shared/utils/sanitize.js';

// Validate inventory data
const validation = validateInventoryData(body, isUpdate);
if (!validation.valid) {
    return { status: 400, data: { error: 'Validation failed', errors: validation.errors } };
}

// Validate price
const priceValidation = validatePrice(body.price);
if (!priceValidation.valid) {
    return { status: 400, data: { error: priceValidation.error } };
}

// Escape HTML for display
const safeTitle = escapeHtml(userInput);
```

---

## XSS Prevention

**Frontend:** Always use `escapeHtml()` for user content:

```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Usage in templates
`<div>${escapeHtml(item.title)}</div>`
```

**Backend:** Input validation strips dangerous characters

---

## Security Logging

**Table:** `security_logs`

```sql
CREATE TABLE security_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,     -- rate_limit, csrf_failure, auth_failure
    ip_address TEXT,
    user_id TEXT,
    details TEXT,                 -- JSON
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Logged events:
- Rate limit violations
- CSRF validation failures
- Authentication failures
- IP blocks

---

## Password Security

**Library:** bcryptjs

**Requirements:**
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}|;:'"<>,.?/)

```javascript
import bcrypt from 'bcryptjs';

// Hash password (12 rounds)
const hash = await bcrypt.hash(password, 12);

// Verify password
const valid = await bcrypt.compare(password, hash);

// Validate password strength
function validatePassword(password) {
    const errors = [];
    if (password.length < 12) errors.push('Must be at least 12 characters');
    if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase');
    if (!/[a-z]/.test(password)) errors.push('Must contain lowercase');
    if (!/[0-9]/.test(password)) errors.push('Must contain number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain special char');
    return errors;
}
```

## Account Lockout

After 5 failed login attempts, the account is locked for 15 minutes.

```javascript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
```

## MFA (Multi-Factor Authentication)

**Files:** `src/backend/services/mfa.js`, `src/backend/routes/security.js`

**Endpoints:**
- `POST /api/security/mfa/setup` - Initialize MFA (returns QR code)
- `POST /api/security/mfa/verify-setup` - Complete MFA setup
- `POST /api/security/mfa/disable` - Disable MFA (requires password)
- `GET /api/security/mfa/status` - Check MFA status
- `POST /api/security/mfa/regenerate-codes` - Get new backup codes

**Login with MFA:**
1. User submits email/password to `/api/auth/login`
2. If MFA enabled, returns `{ mfaRequired: true, mfaToken: "..." }`
3. User submits MFA code to `/api/auth/mfa-verify`
4. Server issues tokens after verification

## Email Verification

**Files:** `src/backend/services/email.js`, `src/backend/routes/security.js`

**Endpoints:**
- `POST /api/security/send-verification` - Send verification email
- `POST /api/security/verify-email` - Verify with token
- `POST /api/security/forgot-password` - Request password reset
- `POST /api/security/reset-password` - Reset with token

---

## Token Encryption

**File:** `src/backend/utils/encryption.js`

For OAuth tokens:

```javascript
import { encryptToken, decryptToken } from '../utils/encryption.js';

// Encrypt before storing
const encrypted = encryptToken(oauthToken);

// Decrypt when using
const token = decryptToken(encrypted);
```

**Algorithm:** AES-256-GCM with random IV and auth tag

---

## Security Checklist

When implementing new features:

- [ ] Validate all user input
- [ ] Escape HTML output
- [ ] Require CSRF token for mutations
- [ ] Check user authorization (not just authentication)
- [ ] Log security-relevant events
- [ ] Use parameterized queries (never string concatenation)
- [ ] Don't expose internal errors to users
- [ ] Set appropriate CORS headers

---

## Testing Security

Run security tests:
```bash
bun test src/tests/security.test.js
```

Run with security disabled (for API testing):
```bash
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun test
```

Security scan script:
```bash
bun run scripts/securityScan.js
```
