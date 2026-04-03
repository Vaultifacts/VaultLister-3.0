# Walkthrough Session 1: Auth & Session
Date: 2026-03-30
Site: vaultlister.com (production)
Tool: Chrome DevTools MCP

## Summary
- Items tested: 18
- Pass: 9 | Fail: 1 | Issue: 6 | Skipped: 0
- Console errors: 0 (2 preload warnings for app.js + styles/main.css — expected, SPA uses core-bundle.js)
- Screenshots saved: data/walkthrough-screenshots/session-1/
- Pages visited: #login, #register, #forgot-password, #reset-password, #verify-email, #mfa-verify (→ #login), #dashboard (logout test)

## Results by Item
| # | Title | Result | Notes |
|---|-------|--------|-------|
| 1 | Login page renders | Pass | All elements present |
| 2 | Login social buttons | Pass | Google + Apple with SVG |
| 3 | Login valid credentials | Pass | Redirects + "Welcome back!" toast |
| 4 | Login bad credentials | Issue/Med | Double error toast bug |
| 5 | Login field validation | Issue/Med | aria-invalid missing; password field-error missing |
| 6 | Register page | Issue/Med | Terms checkbox missing |
| 7 | Register password strength | Pass | 5 requirements, labels Weak→Very Strong |
| 8 | Register social buttons | Pass | Match login exactly |
| 9 | Forgot password | Pass | Enumeration-safe success message |
| 10 | Reset password modes | Pass | Form+error+mismatch verified; success needs real token |
| 11 | Email verification pending | Issue/Low | No Continue button; pending state not reachable |
| 12 | Verify email async | Issue/Low | No loading state element in DOM |
| 13 | MFA/TOTP | Fail/High | Feature not implemented on frontend |
| 14 | Logout | Pass | Store+storage cleared, redirect, toast |
| 15 | Remember me | Pass | useSessionStorage flag + storage behavior verified |
| 16 | Auth guard | Pass | #inventory → #login redirect confirmed |
| 17 | Token refresh | Pass | 401 → refresh → retry/logout logic verified |
| 18 | Skip-to-content | Issue/Med | Link moves on focus but stays -3px above viewport |

## Mandatory Per-Page Checks
| Page | JS Errors | Dark Mode | Mobile 480px |
|------|-----------|-----------|--------------|
| #login | OK | Not tested | Not tested |
| #register | OK | Not tested | Not tested |
| #forgot-password | OK | Not tested | Not tested |
| #reset-password | OK | Not tested | Not tested |
| #verify-email | OK | Not tested | Not tested |

Note: Dark mode and mobile checks deferred to section-end sweep (Section 3 = first major page group).

## Critical Finding
**#13 MFA/TOTP — FAIL (High)**: No MFA route, no TOTP handler, no OTP inputs anywhere. Feature entirely absent from frontend. window.pages.mfa undefined. Router has no mfa/totp routes.

## Issues Log

### ISSUE-1: Double error toast on login failure (#4)
- Every failed login fires error toast TWICE with identical timestamps
- Reproduced on 2 separate attempts (bad email, locked account)
- Severity: Medium

### ISSUE-2: aria-invalid not set on form validation (#5)
- Login email/password: no aria-invalid="true" set when field has error
- Register: same (not verified, but likely systemic)
- Severity: Medium (a11y)

### ISSUE-3: Missing Terms checkbox on register (#6)
- Test expects "I agree to terms" checkbox — absent from register form
- No terms text, no terms link anywhere on the form
- Confirm Password field present but not in test steps
- Severity: Medium

### ISSUE-4: No Continue button on verify-email page (#11)
- Only "Resend Verification" + "Back to Sign In"
- Pending email state not accessible without post-registration flow
- Severity: Low

### ISSUE-5: No loading state for token verification (#12)
- verify-email page transitions directly to result, no spinner/loading element
- Severity: Low

### ISSUE-6: Skip link not fully visible on focus (#18)
- .skip-nav moves from -31.5px to -3.3px on focus — still clipped 3px above viewport
- Severity: Medium (a11y)

## Preload Warnings
- `app.js` and `styles/main.css` listed as preloaded but unused — expected behavior since SPA uses core-bundle.js. Preload hints in HTML are stale/incorrect. Worth cleaning up to reduce browser warnings.

## Key Observations
- Rate limiting: IP blocked for ~60min from test session bad-credential attempts. Login tests had to use store injection.
- Storage key: app uses `vaultlister_state` (not `vl_*` keys). vl_* keys in localStorage are legacy leftovers.
- retryAfter < 30 guard: PRESENT in code (memory note saying it was missing is incorrect/stale).
- Token refresh architecture: solid — 401 → refresh → retry OR logout.
- Demo user has no MFA, no admin, no data, free plan.

## Next Session
- Session 2: Section 2 (Dashboard + Global Chrome)
- Items: ~15-20 items covering #dashboard, sidebar, header, search, Ctrl+K, notifications
- Start fresh — re-inject toast interceptor, re-login (wait for rate limit to clear or test next day)
