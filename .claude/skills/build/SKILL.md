---
name: build
description: Build VaultLister 3.0 for production — lint, test, bundle frontend
trigger: /build
---

# /build — VaultLister 3.0 Build

## Steps

1. **Lint check**
   ```
   bun run lint
   ```
   Fix any errors before proceeding.

2. **Run security tests** (mandatory pre-build gate)
   ```
   bun test src/tests/auth.test.js src/tests/security.test.js
   ```

3. **Run unit tests**
   ```
   bun run test:unit
   ```
   All tests must pass. Do not proceed if any fail.

4. **Build frontend bundle**
   ```
   bun run build
   ```
   Output: `dist/` directory.

5. **Validate build output**
   - Confirm `dist/index.html` exists
   - Confirm all chunk files referenced in index.html exist

## On Failure
- Report the exact error verbatim
- Do not retry the same failing command more than once
