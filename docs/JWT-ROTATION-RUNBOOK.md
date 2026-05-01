# JWT Secret Rotation Runbook

**When to use:** `JWT_SECRET` or `OAUTH_ENCRYPTION_KEY` is suspected or confirmed compromised.

---

## JWT_SECRET Rotation

`JWT_SECRET` signs all access tokens (15 min TTL) and is used to verify them in middleware. Rotating it immediately invalidates every active access token. Users mid-session will get a 401 on their next API call and be prompted to log in again; their refresh tokens remain valid and will issue new access tokens automatically on the next refresh cycle.

**If a forced full logout is required** (e.g. confirmed token forgery), also invalidate all refresh tokens per step 3 below.

### Steps

1. **Generate a new secret**
   ```bash
   node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(64).toString('hex'));"
   ```

2. **Update Railway**
   - Railway dashboard → vaultlister-app → Variables
   - Update `JWT_SECRET` to the new value
   - Railway will redeploy automatically

3. **Invalidate all refresh tokens (full forced logout)**
   Run against the production database via Railway's PostgreSQL connect or a one-off query:
   ```sql
   UPDATE sessions SET is_valid = 0 WHERE is_valid = 1;
   ```
   This forces all users to re-authenticate from scratch. Use only when token forgery is confirmed — it logs out every active user.

4. **Verify**
   - Watch Railway logs for JWT verification errors dropping to zero
   - Confirm `/api/auth/refresh` returns 401 for any old tokens you held

---

## OAUTH_ENCRYPTION_KEY Rotation

`OAUTH_ENCRYPTION_KEY` encrypts marketplace OAuth tokens stored in the database (AES-256-GCM). Rotating it without re-encrypting existing tokens will make all stored marketplace credentials unreadable — users will need to reconnect their platforms.

`OAUTH_ENCRYPTION_KEY_OLD` exists in the codebase for graceful migration: the decrypt function tries the new key first, then falls back to the old key.

### Steps

1. **Generate a new key (must be 32 bytes / 64 hex chars)**
   ```bash
   node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));"
   ```

2. **Set the old key as fallback**
   - In Railway Variables, set `OAUTH_ENCRYPTION_KEY_OLD` = current value of `OAUTH_ENCRYPTION_KEY`

3. **Set the new key**
   - Update `OAUTH_ENCRYPTION_KEY` to the new value
   - Railway redeploys

4. **Re-encrypt existing tokens (background task)**
   After deploy, existing tokens will be decrypted with the old key on first use and re-encrypted with the new key automatically (if the re-encryption path is implemented). If not, prompt users to reconnect their platforms.

   To force immediate re-encryption of all stored credentials:
   ```sql
   -- Check how many platform connections exist
   SELECT COUNT(*) FROM platform_connections WHERE access_token IS NOT NULL;
   ```
   Then either implement a migration script or notify affected users to reconnect.

5. **Remove OAUTH_ENCRYPTION_KEY_OLD** once all tokens are confirmed re-encrypted (no decrypt-with-old-key calls in logs).

---

## Related Files

- `src/backend/middleware/auth.js` — JWT verification
- `src/backend/routes/auth/session.js` — refresh token issuance and `sessions` table
- `src/backend/utils/encryption.js` — AES-256-GCM encrypt/decrypt with key fallback
- `src/backend/env.js` — Zod validation (both keys required in production)
