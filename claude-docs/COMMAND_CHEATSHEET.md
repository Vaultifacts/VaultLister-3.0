# Command Cheat Sheet

Quick reference for when to use each command. Keep this handy!

---

## At a Glance

| Situation | Command |
|-----------|---------|
| Starting a new feature | `/feature` |
| Made a mistake or hit a bug | `/evolve` |
| Ready to commit changes | `/commit` |
| Need to create a PR | `/pr` |
| Adding database tables | `/migration` |
| Creating API endpoints | `/route` |
| Building a new UI page | `/page` |
| Adding button/form handlers | `/handler` |
| Need a popup/dialog | `/modal` |
| Adding CSS styles | `/style` |
| Running tests | `/test` |
| Something's broken | `/debug` |
| Quick error fix | `/fix` |
| Testing API manually | `/api` |
| Understanding code | `/explore` |
| Improving code structure | `/refactor` |
| Reviewing changes | `/review` |
| Going to production | `/deploy` |
| Need test data | `/seed` |
| Configure rate limiting | `/rate-limit-options` |

---

## Decision Tree

```
What are you doing?
│
├─► Building something new?
│   ├─► Full feature ──────────► /feature
│   ├─► Database table ────────► /migration
│   ├─► API endpoint ──────────► /route
│   ├─► Frontend page ─────────► /page
│   ├─► Event handler ─────────► /handler
│   ├─► Modal/popup ───────────► /modal
│   └─► CSS styles ────────────► /style
│
├─► Fixing something?
│   ├─► Know the error ────────► /fix
│   ├─► Need to investigate ───► /debug
│   └─► After fixing ──────────► /evolve (prevent recurrence!)
│
├─► Testing?
│   ├─► Run test suite ────────► /test
│   ├─► Test API manually ─────► /api
│   └─► Need test data ────────► /seed
│
├─► Git operations?
│   ├─► Commit changes ────────► /commit
│   ├─► Create PR ─────────────► /pr
│   └─► Review code ───────────► /review
│
├─► Understanding code?
│   ├─► How does X work? ──────► /explore
│   └─► Improve structure ─────► /refactor
│
├─► Deploying?
│   └─► Pre-deploy checks ─────► /deploy
│
└─► Security/Infrastructure?
    └─► Rate limiting config ──► /rate-limit-options
```

---

## Command Details

### /feature
**When:** Starting any non-trivial new functionality
```
/feature user-notes "Add personal notes to inventory items"
```
Guides you through: Planning → Database → Backend → Frontend → Testing

---

### /evolve
**When:** After ANY bug, mistake, or friction point
```
/evolve "Forgot to add dark mode styles"
```
Turns problems into permanent improvements. **Run this religiously!**

---

### /commit
**When:** Ready to save your work to git
```
/commit
/commit "add inventory filtering"
```
Creates conventional commit with proper format.

---

### /pr
**When:** Feature complete, ready for review
```
/pr
/pr main
```
Creates well-documented pull request.

---

### /migration
**When:** Need new database tables or columns
```
/migration user_notes
/migration add_timestamps_to_sales
```
Creates SQL file + registers in database.js.

---

### /route
**When:** Need new API endpoints
```
/route notes
/route notifications
```
Creates route file + registers in server.js.

---

### /page
**When:** Building new frontend pages
```
/page reports
/page settings tabs:general,notifications,security
```
Creates page with state, tabs, handlers.

---

### /handler
**When:** Adding frontend interactivity
```
/handler saveNote form
/handler deleteItem crud
/handler filterResults filter
```
Creates event handlers for buttons, forms, etc.

---

### /modal
**When:** Need popups, dialogs, forms
```
/modal addNote form
/modal confirmDelete confirm
/modal itemDetails detail
```
Creates modal with proper structure.

---

### /style
**When:** Adding or fixing CSS
```
/style card
/style button variant:outline
```
Adds styles with dark mode support.

---

### /test
**When:** Running or fixing tests
```
/test           # Run all
/test api       # API tests only
/test e2e       # E2E tests only
/test auth.spec # Specific file
```

---

### /debug
**When:** Something's broken, need to investigate
```
/debug "login returns 401"
/debug "UI not updating after save"
```
Systematic debugging workflow.

---

### /fix
**When:** Know the error, need quick fix
```
/fix 401
/fix "Cannot read property X"
/fix dark-mode
```
Quick fixes for common errors.

---

### /api
**When:** Testing endpoints manually
```
/api GET /inventory
/api POST /sales {"price": 50}
```
Test and debug API endpoints.

---

### /explore
**When:** Understanding unfamiliar code
```
/explore "how does auth work"
/explore "state management"
/explore listings.js
```

---

### /refactor
**When:** Improving code without changing behavior
```
/refactor handlers extract
/refactor inventory.js simplify
```

---

### /review
**When:** Checking code quality
```
/review
/review pr-123
/review feature-branch
```
Security + quality checklist.

---

### /deploy
**When:** Preparing for production
```
/deploy
/deploy production
```
Pre-deployment verification.

---

### /seed
**When:** Need test/demo data
```
/seed inventory 20
/seed all
```
Creates realistic test data.

---

### /rate-limit-options
**When:** Configuring or troubleshooting rate limits
```
/rate-limit-options view
/rate-limit-options disable
/rate-limit-options troubleshoot
```
View current limits, disable for testing, fix 429 errors.

---

## Common Workflows

### New Feature (Full Stack)
```
1. /feature inventory-tags
2. /migration inventory_tags
3. /route tags
4. /page (or modify existing)
5. /handler manageTags
6. /test
7. /commit
8. /evolve (if any issues)
```

### Bug Fix
```
1. /debug "describe the bug"
2. /fix (apply fix)
3. /test
4. /commit
5. /evolve (add rule to prevent)
```

### Quick UI Change
```
1. /handler or /modal
2. /style (if needed)
3. /test e2e
4. /commit
```

### Code Review
```
1. /review
2. Fix any issues
3. /test
4. /pr
```

---

## Remember!

> **After EVERY bug or friction:** Run `/evolve`
>
> This is how the system gets smarter over time.

---

*Last updated: 2026-01-25*
*Commands: 20 total*
