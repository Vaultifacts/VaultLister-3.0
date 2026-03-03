# VaultLister Security Documentation

## Overview

VaultLister implements comprehensive, production-ready security features to protect against common web vulnerabilities and attacks. This document outlines all security measures, their configuration, and best practices.

---

## Security Features

### 1. Input Validation & Sanitization

**File**: `src/shared/utils/sanitize.js`

**Protection Against**: XSS (Cross-Site Scripting), Code Injection

**Features**:
- HTML sanitization removes dangerous tags: `<script>`, `<iframe>`, `<object>`, `<embed>`
- Event handler removal: `onclick`, `onerror`, `onload`, etc.
- Protocol blocking: `javascript:`, malicious data URIs
- Length validation prevents DoS attacks
- Comprehensive validation for all user inputs

**Configuration**:
```javascript
// Maximum field lengths
Title: 500 characters
Description: 2000 characters
Brand: 200 characters
Category/Subcategory: 100 characters
Notes: 1000 characters
Location: 200 characters
```

**Usage**:
```javascript
import { validateInventoryData, validatePrice } from '../shared/utils/sanitize.js';

const validation = validateInventoryData(body, isUpdate);
if (!validation.valid) {
    return { status: 400, data: { errors: validation.errors } };
}
```

---

### 2. Rate Limiting

**File**: `src/backend/middleware/rateLimiter.js`

**Protection Against**: Brute force attacks, API abuse, DoS attacks

**Features**:
- Configurable limits per endpoint type
- Automatic IP/user blocking after violations
- Rate limit headers in responses
- Security event logging
- Automatic cleanup of expired entries

**Configuration**:
```javascript
// Rate limit tiers
Default API: 100 requests/minute
Authentication: 10 requests/15 minutes
Mutations (POST/PUT/DELETE): 30 requests/minute
Expensive Operations (AI, Analytics): 10 requests/minute
Block Duration: 1 hour (after 3 violations)
```

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1768974000
Retry-After: 45
```

**HTTP Status**: `429 Too Many Requests`

**Bypass** (for trusted IPs):
```javascript
import { rateLimiter } from './middleware/rateLimiter.js';

// Manually unblock
rateLimiter.unblock('ip:192.168.1.100');
```

---

### 3. CSRF Protection

**File**: `src/backend/middleware/csrf.js`

**Protection Against**: Cross-Site Request Forgery attacks

**Features**:
- Cryptographically secure tokens (32-byte random)
- Automatic validation for state-changing requests
- 4-hour token expiry
- Session/IP binding
- Automatic cleanup

**How It Works**:
1. Client makes GET request → receives CSRF token in `X-CSRF-Token` header
2. Client includes token in POST/PUT/PATCH/DELETE requests
3. Server validates token before processing
4. Invalid/missing tokens → `403 Forbidden`

**Client Usage**:
```javascript
// Get token from GET request
const response = await fetch('/api/inventory?limit=1', {
    headers: { 'Authorization': `Bearer ${token}` }
});
const csrfToken = response.headers.get('X-CSRF-Token');

// Include in POST request
await fetch('/api/inventory', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
});
```

**Exempt Endpoints**:
- `/api/auth/login` - Uses other protection
- `/api/auth/register` - Uses other protection
- `/api/auth/refresh` - Uses other protection
- `/api/health` - No state change
- `/api/status` - No state change

---

### 4. Security Headers

**File**: `src/backend/middleware/securityHeaders.js`

**Protection Against**: XSS, Clickjacking, MIME sniffing, Man-in-the-middle attacks

**Headers Applied**:

#### Content Security Policy (CSP)
Prevents code injection and XSS attacks.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' http://localhost:* ws://localhost:*;
  frame-ancestors 'none';
  base-uri 'self'
```

#### X-Frame-Options
Prevents clickjacking.
```
X-Frame-Options: DENY
```

#### X-Content-Type-Options
Prevents MIME sniffing.
```
X-Content-Type-Options: nosniff
```

#### X-XSS-Protection
Legacy XSS filter (additional layer).
```
X-XSS-Protection: 1; mode=block
```

#### Strict-Transport-Security (HSTS)
Forces HTTPS (production only).
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

#### Referrer-Policy
Controls referrer information.
```
Referrer-Policy: strict-origin-when-cross-origin
```

#### Permissions-Policy
Disables unnecessary browser features.
```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
```

#### Cross-Origin Policies
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

---

### 5. Authentication & Authorization

**File**: `src/backend/middleware/auth.js`, `src/backend/routes/auth.js`

**Protection Against**: Unauthorized access, session hijacking, brute force attacks

**Features**:
- JWT (JSON Web Tokens) with HS256 algorithm
- bcrypt password hashing (cost factor 12)
- Refresh token rotation
- Session management
- Tier-based permissions
- Account lockout after failed attempts
- MFA/TOTP support (optional)
- Email verification

**Token Expiry**:
- Access Token: 15 minutes
- Refresh Token: 7 days

**Password Requirements**:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&* etc.)
- bcrypt hashing with salt

**Account Lockout**:
- 5 failed login attempts → 15-minute lockout
- Lockout logged to security_logs table

**MFA (Multi-Factor Authentication)**:
- TOTP-based (compatible with Google Authenticator, Authy, etc.)
- 10 backup codes per user (hashed)
- QR code generation for easy setup

---

### 6. SQL Injection Protection

**File**: `src/backend/db/database.js`

**Protection Against**: SQL injection attacks

**Features**:
- Parameterized queries (prepared statements)
- No string concatenation in SQL
- Input validation before queries

**Safe Pattern**:
```javascript
// ✅ SAFE - Parameterized query
query.run('SELECT * FROM users WHERE email = ?', [userInput]);

// ❌ UNSAFE - String concatenation
query.run(`SELECT * FROM users WHERE email = '${userInput}'`);
```

---

### 7. Security Logging & Monitoring

**File**: Database table `security_logs`

**What's Logged**:
- Rate limit violations
- IP blocks
- CSRF token failures
- Failed authentication attempts
- Suspicious activity

**Schema**:
```sql
CREATE TABLE security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    ip_or_user TEXT NOT NULL,
    user_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Query Examples**:
```sql
-- View recent rate limit violations
SELECT * FROM security_logs
WHERE event_type = 'RATE_LIMIT_EXCEEDED'
ORDER BY created_at DESC
LIMIT 10;

-- Find blocked IPs
SELECT * FROM security_logs
WHERE event_type = 'RATE_LIMIT_BLOCK'
AND created_at > datetime('now', '-1 day');

-- Analyze suspicious patterns
SELECT ip_or_user, COUNT(*) as violations
FROM security_logs
WHERE event_type LIKE 'RATE_LIMIT%'
GROUP BY ip_or_user
ORDER BY violations DESC;
```

---

## Security Testing

### Automated Security Scanner

**File**: `scripts/securityScan.js`

**Checks**:
- ✅ Hardcoded secrets (API keys, passwords)
- ✅ Weak password hashing
- ✅ SQL injection vulnerabilities
- ✅ Dependency vulnerabilities
- ✅ HTTPS/TLS configuration
- ✅ CORS misconfiguration
- ✅ Security headers presence
- ✅ Rate limiting implementation
- ✅ Input validation

**Run**:
```bash
bun run scripts/securityScan.js
```

**Output**:
```
✓ Passed:   12
⚠ Warnings: 3
✗ Failed:   0
```

### Security Features Test Suite

**File**: `scripts/testSecurity.js`

**Tests**:
- XSS protection (4 payload types)
- CSRF protection (with/without tokens)
- Rate limiting (100+ requests)
- Security headers (CSP, X-Frame-Options, etc.)
- Input validation (length, negative values)

**Run**:
```bash
bun run scripts/testSecurity.js
```

---

## Production Security Checklist

### Before Deployment

- [ ] Change/disable demo user credentials
- [ ] Configure HTTPS reverse proxy (nginx/Caddy)
- [ ] Set strong JWT secret (`process.env.JWT_SECRET`)
- [ ] Restrict CORS to specific domains
- [ ] Enable HSTS header (automatic in production)
- [ ] Review and adjust rate limits for your traffic
- [ ] Set up log monitoring and alerts
- [ ] Configure database backups
- [ ] Run security scanner: `bun run scripts/securityScan.js`
- [ ] Test all security features: `bun run scripts/testSecurity.js`

### Environment Variables

```bash
# Required
NODE_ENV=production
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_REFRESH_SECRET=<different-strong-random-secret>

# Optional
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://yourdomain.com
```

### HTTPS Setup (nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers (additional layer)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Security Best Practices

### For Developers

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Use `validateInventoryData()` helpers
3. **Use parameterized queries** - Never concatenate SQL
4. **Keep dependencies updated** - Run `bun update` regularly
5. **Test security changes** - Run security test suite
6. **Review security logs** - Check `security_logs` table weekly
7. **Follow principle of least privilege** - Minimize permissions

### For Users

1. **Use strong passwords** - Minimum 12 characters recommended
2. **Enable 2FA** (when available)
3. **Keep browser updated** - Security patches
4. **Use HTTPS** - Never access over plain HTTP in production
5. **Logout when done** - Especially on shared devices
6. **Review connected shops** - Remove unused integrations

---

## Incident Response

### If You Detect an Attack

1. **Check security logs**:
   ```sql
   SELECT * FROM security_logs
   WHERE created_at > datetime('now', '-1 hour')
   ORDER BY created_at DESC;
   ```

2. **Block malicious IPs**:
   ```javascript
   import { rateLimiter } from './src/backend/middleware/rateLimiter.js';
   rateLimiter.block('ip:xxx.xxx.xxx.xxx', 24 * 60 * 60 * 1000); // 24 hours
   ```

3. **Invalidate all sessions** (if compromised):
   ```sql
   UPDATE sessions SET is_valid = 0;
   ```

4. **Review and patch** - Identify vulnerability, apply fix
5. **Notify users** - If user data potentially compromised
6. **Update security measures** - Strengthen affected areas

---

## Security Updates

### Current Version: 1.0.0 (Production-Ready)

**Security Features**:
- ✅ XSS Protection
- ✅ CSRF Protection
- ✅ Rate Limiting with IP blocking
- ✅ Comprehensive Security Headers
- ✅ Input Validation & Sanitization
- ✅ SQL Injection Protection
- ✅ Password Hashing (bcrypt)
- ✅ JWT Authentication
- ✅ Security Logging & Monitoring
- ✅ Automated Security Scanning

**Known Limitations**:
- HTTP only (requires reverse proxy for HTTPS)
- Redis optional (falls back to in-memory if unavailable)

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [bcrypt for Password Hashing](https://github.com/kelektiv/node.bcrypt.js)

---

## Support

For security issues, please report to: [Create GitHub Issue](https://github.com/anthropics/claude-code/issues)

**Do not** disclose security vulnerabilities publicly before they're patched.
