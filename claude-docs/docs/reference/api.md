# API Reference
> Last reviewed: 2026-03-15

## Route Pattern
## Route Pattern

All routes use a context object pattern:
```javascript
export async function routerName(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;
    // Return { status: 200, data: {...} }
}
```

## Base URL
`http://localhost:3000/api`

---

## Authentication Routes (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Create new user account |
| POST | `/login` | Authenticate user, returns JWT |
| POST | `/logout` | Invalidate session |
| POST | `/refresh` | Refresh JWT token |
| GET | `/me` | Get current user info |
| POST | `/password-reset` | Request password reset email |
| GET | `/verify-email?token=` | Verify email address via token |
| POST | `/resend-verification` | Resend email verification link |
| POST | `/demo-login` | Login with demo credentials |

**Auth Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-CSRF-Token: <csrf_token>` (required for POST/PUT/PATCH/DELETE)

### Email Verification

**`GET /api/auth/verify-email?token=<token>`**

Verifies a user's email address using a token from the verification email.

| Status | Response |
|--------|----------|
| 200 | `{ message: "Email verified successfully!" }` |
| 400 | `{ error: "Invalid or expired verification link." }` |
| 400 | `{ error: "This verification link has already been used." }` |

**`POST /api/auth/resend-verification`**

Resends the verification email. Always returns 200 to prevent email enumeration.

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |

---

## Security Routes (`/api/security`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send-verification` | Send email verification (authenticated) |
| POST | `/verify-email` | Verify email with token |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password` | Reset password with token |
| POST | `/mfa/setup` | Initialize MFA setup (returns QR code) |
| POST | `/mfa/verify-setup` | Verify TOTP code and enable MFA |
| POST | `/mfa/disable` | Disable MFA |
| POST | `/mfa/verify` | Verify MFA code during login |
| POST | `/change-password` | Change password (authenticated) |

### MFA Setup Flow

1. **`POST /api/security/mfa/setup`** (requires auth)
   - Returns: `{ qrCode, secret, setupToken }`
   - User scans QR code with authenticator app

2. **`POST /api/security/mfa/verify-setup`** (requires auth)
   - Body: `{ setupToken, code, secret }`
   - Returns: `{ message, backupCodes, warning }`
   - `backupCodes` are one-time use recovery codes — shown only once

3. **`POST /api/security/mfa/verify`** (during login)
   - Body: `{ code, mfaToken }` (mfaToken from login response when MFA required)
   - Returns: JWT tokens on success

### Password Reset Flow

1. **`POST /api/security/forgot-password`** — `{ email }` → sends reset email
2. **`POST /api/security/reset-password`** — `{ token, password }` → resets password, invalidates all sessions

---

## Inventory Routes (`/api/inventory`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all inventory items |
| GET | `/:id` | Get single item |
| POST | `/` | Create new item |
| PUT | `/:id` | Update item |
| DELETE | `/:id` | Soft delete item |
| GET | `/deleted` | List deleted items (30-day retention) |
| POST | `/:id/restore` | Restore deleted item |
| DELETE | `/:id/permanent` | Permanently delete item |
| POST | `/cleanup-deleted` | Remove items older than 30 days |

**Query Parameters:**
- `search` - FTS5 full-text search
- `status` - Filter by status (draft, active, sold)
- `category` - Filter by category
- `limit`, `offset` - Pagination

---

## Listings Routes (`/api/listings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all listings |
| GET | `/:id` | Get single listing |
| POST | `/` | Create listing |
| PUT | `/:id` | Update listing |
| DELETE | `/:id` | Delete listing |
| POST | `/crosslist` | Create listings for multiple platforms |
| POST | `/batch` | Bulk create listings |
| POST | `/:id/share` | Share listing (Poshmark) |
| GET | `/stats` | Get listing statistics |
| GET | `/folders` | List listing folders |
| POST | `/folders` | Create folder |

**Delist/Relist Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stale` | Get stale listings (default 30+ days) |
| POST | `/:id/delist` | Delist a listing |
| POST | `/:id/relist` | Relist a listing |
| POST | `/:id/refresh` | Delist + relist in one action |
| POST | `/refresh-bulk` | Bulk refresh multiple listings |
| GET | `/:id/refresh-history` | View refresh history |
| PUT | `/:id/staleness-settings` | Configure staleness threshold |

---

## Sales Routes (`/api/sales`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all sales |
| GET | `/:id` | Get single sale |
| POST | `/` | Record new sale |
| PUT | `/:id` | Update sale |
| DELETE | `/:id` | Delete sale |

**Query Parameters:**
- `startDate`, `endDate` - Date range filter
- `platform` - Filter by platform
- `status` - Filter by status (pending, shipped, delivered)

---

## Financials Routes (`/api/financials`)

**Purchases:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/purchases` | List all purchases |
| GET | `/purchases/:id` | Get purchase with line items |
| POST | `/purchases` | Create purchase (triggers FIFO) |
| PUT | `/purchases/:id` | Update purchase |
| DELETE | `/purchases/:id` | Delete purchase |

**Chart of Accounts:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounts` | List accounts grouped by type |
| GET | `/accounts/:id` | Get account with transactions |
| POST | `/accounts` | Create account |
| PUT | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Delete account |
| POST | `/seed-accounts` | Seed default accounts |

**Reports:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/statements` | Financial statements (date range) |
| GET | `/profit-loss` | P&L report (date range) |
| GET | `/transactions` | List all transactions |

---

## Chatbot Routes (`/api/chatbot`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/conversations` | Create new conversation |
| GET | `/conversations` | List all conversations |
| GET | `/conversations/:id` | Get conversation with messages |
| DELETE | `/conversations/:id` | Delete conversation |
| POST | `/message` | Send message (returns AI response) |
| POST | `/rate` | Rate message helpfulness |

**Request Body for `/message`:**
```json
{
    "conversation_id": "uuid",
    "message": "How do I cross-list items?"
}
```

---

## Analytics Routes (`/api/analytics`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard metrics |
| GET | `/sales` | Sales analytics |
| GET | `/snapshots` | Historical snapshots |

---

## Other Routes

**OAuth (`/api/oauth`):**
- `GET /authorize/:platform` - Start OAuth flow
- `GET /callback/:platform` - OAuth callback
- `POST /refresh/:platform` - Refresh token
- `DELETE /revoke/:platform` - Disconnect platform

**Shops (`/api/shops`):**
- CRUD for platform connections

**Templates (`/api/templates`):**
- CRUD for listing templates

**Image Bank (`/api/image-bank`):**
- Upload, manage, search images
- Folder management
- AI analysis endpoint

**Calendar (`/api/calendar`):**
- Event CRUD

**Checklists (`/api/checklists`):**
- Checklist and item CRUD

---

## Response Format

**Success:**
```json
{
    "success": true,
    "data": { ... }
}
```

**Error:**
```json
{
    "error": "Error message",
    "errors": ["field1: validation error", ...]
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (CSRF, rate limit)
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Server Error
