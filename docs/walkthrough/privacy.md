# Privacy Policy (In-App) -- Walkthrough Findings

## Open Items

None.

## Notes

- Privacy email (M-33) is tracked in connections.md and environment.md.
- Public privacy/terms pages are tracked in public-site.md.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| #136 | Privacy Policy (in-app) | Contains false claims: "Your inventory never leaves your device" and "Data not uploaded to cloud servers" -- factually false for Railway-hosted SaaS | Session 5 | VERIFIED -- aca307f -- replaced with accurate cloud storage statements |
| #137 | Privacy Policy (in-app) | Shows "Last updated: January 2026" -- static page shows April 5, 2026 | Session 5 | VERIFIED -- 15dba34 -- pages-community-help.js: both dates updated to April 2026 |
| M-36 | Privacy (in-app) | "GDPR Compliant" claim -- Canada uses PIPEDA, not GDPR | Session 3 | VERIFIED -- 8f2457c -- changed to "PIPEDA Compliant" |
| M-39 | Privacy (in-app) | Claims "GDPR Compliant" -- Canada uses PIPEDA (duplicate of M-36) | Session 4 | VERIFIED -- 8f2457c -- same fix |
| L-28 | Privacy (in-app) | "Download PDF" button -- unclear if it generates a real PDF | Session 3 | CONFIRMED N/A -- handlers-core.js:1515: shows toast then calls window.print() which opens browser print dialog (save as PDF). Functional. |
| L-31 | Privacy (in-app) | "Download PDF" button -- untested (duplicate of L-28) | Session 4 | CONFIRMED N/A -- duplicate of L-28; same window.print() implementation confirmed |
