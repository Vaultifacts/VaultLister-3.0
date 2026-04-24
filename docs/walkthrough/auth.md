# Auth / Login / Register -- Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CO-4 | Register | Password requirement checkmarks not validated live as user types | Session 2 | CONFIRMED N/A -- already wired: checkRegisterPassword fires on oninput in handlers-core.js |
| L-13 | Register | No Full Name or Display Name field in registration | Session 2 | VERIFIED -- same fix as L-7 -- Full Name field confirmed in registration form |
| M-15 | Register / Login | Sidebar visible on register/login page -- should be hidden for unauthenticated views | Session 2 | CONFIRMED N/A -- login/register use render() not renderApp(); sidebar not rendered |
| M-23 | Auth Pages | All auth pages show gradient seam -- white strip at ~75% width | Session 2 | VERIFIED -- login page screenshot confirms gradient fills full width, no seam (2026-04-07) |
| #183 | Error Handling | 401 Unauthorized does not redirect to login -- user stays on current page with silent API failures | Session 14 | VERIFIED -- api.js line 198: store.setState null + router.navigate(login) confirmed in source (2026-04-07) |
| #184 | Error Handling | 429 Too Many Requests shows generic error toast with no retry guidance | Session 14 | VERIFIED -- api.js line 137: toast.warning(Too many requests. Please wait a moment.) confirmed (2026-04-07) |
| MANUAL-auth-1 | Auth | How can we setup the Continue with Apple Sign in Option? (image-98) | Backlog | OPEN QUESTION / NEEDS TRIAGE |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-1 | Auth / Login | Login page breaks if user navigates directly to /#login -- HTML served without SPA bootstrap | Session 1 | VERIFIED -- 07338ae |
| H-10 | Auth / Register | Register form accepts duplicate emails silently | Session 2 | VERIFIED -- 07338ae |
| H-11 | Auth / Login | Forgot password link does nothing | Session 2 | VERIFIED -- 07338ae |
| H-18 | Auth / Login | Remember Me checkbox has no effect | Session 3 | VERIFIED -- 07338ae |
