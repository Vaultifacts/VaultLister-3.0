# Secret Scan Evidence
Date: 2026-03-05T12:25:41.7362359-07:00
Pattern set: AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|xox[baprs]-|ghp_[A-Za-z0-9]{36,}|AIza[0-9A-Za-z\-_]{35}
Working tree scan result: PASS (reviewed)

## git grep HEAD
```
HEAD:.env.example:78:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## git log -G history scan
```
c56e9fd7ca6016749befae4d61301665b6ba5ed5 feat: [AUTO] port VaultLister 2.0 codebase to VaultLister 3.0
```

## Reviewer Notes
- The only current-pattern hit is a placeholder example key block in `.env.example`.
- No active credential values were detected in tracked source/evidence files.
