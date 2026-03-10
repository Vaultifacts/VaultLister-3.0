# VaultLister 3.0 — Auth & Security API Reference
> Covers endpoints added in the Email Verification + MFA phase (commits 478e3b4, 6ba36e8, 465f4b0).

All endpoints require a valid CSRF token for mutating requests (POST/PUT/PATCH/DELETE). Fetch a fresh token via any authenticated GET — the token is returned in the `X-CSRF-Token` response header. Tokens are **single-use** — fetch a new one before each mutating request.

---

## Authentication Endpoints (`/api/auth`)

### GET /api/auth/verify-email

Verify a user's email address using the token from the verification email.

**Auth required:** No

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Verification token from email link |

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ message: string }` | Email verified successfully (or already verified) |
| `400` | `{ error: string }` | Missing token, invalid/expired link, or already-used link |
| `500` | `{ error: string }` | Server error |

**Example:**
```
GET /api/auth/verify-email?token=abc123def456...
```

---

### POST /api/auth/resend-verification

Resend the email verification link to a registered address.

**Auth required:** No

**Rate limited:** Yes (auth tier)

**Request body:**

```json
{ "email": "user@example.com" }
```

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ message: string }` | Always returns success (prevents email enumeration) |

> **Note:** The response is always `200` regardless of whether the account exists or is already verified. This prevents attackers from enumerating registered email addresses.

---

### POST /api/auth/mfa-verify

Complete login when the account has MFA enabled. Called after a `POST /api/auth/login` response returns `{ mfaRequired: true, mfaToken }`.

**Auth required:** No (uses one-time `mfaToken` from login step)

**Rate limited:** Yes (auth tier — protects against TOTP brute-force)

**Request body:**

```json
{
  "mfaToken": "string",  // from login response
  "code": "string"       // 6-digit TOTP code or 8-char backup code
}
```

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ token, refreshToken, user, warning? }` | Login complete — `warning` present when backup code used with few remaining |
| `400` | `{ error: string }` | Missing fields |
| `401` | `{ error: string }` | Invalid or expired MFA session, wrong code |
| `500` | `{ error: string }` | Server error |

**Login flow with MFA:**
1. `POST /api/auth/login` → `202 { mfaRequired: true, mfaToken }`
2. `POST /api/auth/mfa-verify` with `mfaToken + code` → `200 { token, refreshToken, user }`

---

## Security Endpoints (`/api/security`)

All security endpoints require a valid `Authorization: Bearer <token>` header.

### POST /api/security/mfa/setup

Initialize MFA setup for the authenticated user. Returns a QR code and secret for the authenticator app.

**Auth required:** Yes

**Request body:** None

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ qrCode, secret, setupToken }` | QR code URI, plaintext secret for manual entry, one-time setup session token |
| `400` | `{ error: string }` | MFA already enabled |
| `401` | `{ error: string }` | Not authenticated |
| `500` | `{ error: string }` | Server error |

---

### POST /api/security/mfa/verify-setup

Confirm MFA enrollment by verifying the first TOTP code from the authenticator app.

**Auth required:** Yes

**Rate limited:** Yes (auth tier)

**Request body:**

```json
{
  "setupToken": "string",  // from /mfa/setup response
  "secret": "string",      // from /mfa/setup response
  "code": "string"         // 6-digit code from authenticator app
}
```

**Responses:**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ message, backupCodes, warning }` | MFA enabled — `backupCodes` array shown once only; save them |
| `400` | `{ error: string }` | Missing fields, invalid/expired setup token, wrong code |
| `401` | `{ error: string }` | Not authenticated |
| `500` | `{ error: string }` | Server error |

> **Important:** `backupCodes` are shown **once only** in this response. Store them securely.

---

### POST /api/security/mfa/disable

Disable MFA for the authenticated user. Requires current password or a valid TOTP code for confirmation.

**Auth required:** Yes

---

### POST /api/security/mfa/regenerate-codes

Generate new backup codes, invalidating all existing ones.

**Auth required:** Yes

---

## CSRF Token Flow

```
1. GET /api/csrf-token             → X-CSRF-Token: <token>
   (or any authenticated GET endpoint)

2. POST /api/auth/mfa-verify       → X-CSRF-Token: <new-token>
   Headers: X-CSRF-Token: <token from step 1>

3. POST /api/security/mfa/setup    → X-CSRF-Token: <new-token>
   Headers: X-CSRF-Token: <token from step 2>
```

Tokens are single-use — each response returns a fresh token for the next request.
