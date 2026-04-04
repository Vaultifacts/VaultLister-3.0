# /evolve - System Evolution

Turn bugs, mistakes, and issues into permanent system improvements. Every problem is an opportunity to make AI coding more reliable.

## Usage
```
/evolve [bug-description]
```

Run after completing a feature, fixing a bug, or encountering any friction.

## Evolution Mindset

> "Every bug is a missing rule. Every mistake is a missing context doc. Every friction point is a workflow to automate."

## Workflow

### Step 1: Identify the Issue Type

| Type | Example | Solution |
|------|---------|----------|
| **Wrong Pattern** | AI uses wrong import style | Add rule to CLAUDE.md |
| **Missing Context** | AI doesn't understand auth flow | Create context doc |
| **Forgotten Step** | AI forgets to run tests | Update command workflow |
| **Repeated Mistake** | Same bug fixed twice | Add to fix.md patterns |
| **Slow Process** | Manual steps every time | Create new command |

### Step 2: Determine the Fix

**Option A: Add Rule to CLAUDE.md**
```markdown
## Rules Learned
- Always use relative imports from src/ (not absolute paths)
- Always check for existing handlers before creating new ones
- Always add dark mode styles when adding new components
```

**Option B: Create/Update Context Doc**
```
claude-docs/docs/reference/<topic>.md
- auth-architecture.md
- database-patterns.md
- frontend-state-flow.md
```

**Option C: Update Command**
```
Edit claude-docs/docs/commands/<command>.md
- Add missing step to workflow
- Add new template/pattern
- Add warning/gotcha
```

**Option D: Create New Command**
```
If you did something manually more than twice,
create claude-docs/docs/commands/<new-command>.md
```

### Step 3: Log the Evolution

Add entry to `claude-docs/docs/evolution-log.md`:

```markdown
## [Date] - [Brief Title]

**Issue**: What went wrong or caused friction
**Root Cause**: Why it happened
**Solution**: What was added/changed
**Files Modified**:
- claude-docs/CLAUDE.md (added rule X)
- claude-docs/docs/reference/auth.md (new file)
**Prevention**: How this prevents future occurrences
```

### Step 4: Verify

- [ ] Rule/doc/command added
- [ ] Evolution logged
- [ ] Would this have prevented the original issue? (test mentally)

## Evolution Categories

### 1. Import/Path Rules
```
Issue: Used wrong import path
Rule: "Always use relative imports: import { x } from '../db/database.js'"
Add to: CLAUDE.md
```

### 2. Testing Rules
```
Issue: Forgot to run tests after changes
Rule: "After modifying any .js file, run: bun test"
Add to: Commands that modify code (feature.md, fix.md, refactor.md)
```

### 3. Style Rules
```
Issue: Forgot dark mode styles
Rule: "When adding CSS, always add body.dark-mode variant"
Add to: style.md command
```

### 4. API Rules
```
Issue: Forgot CSRF token on POST
Rule: "All POST/PUT/DELETE requests need: await api.ensureCSRFToken()"
Add to: handler.md, route.md commands
```

### 5. State Rules
```
Issue: UI didn't update after state change
Rule: "After setState, call renderApp if on affected page"
Add to: handler.md command
```

### 6. Database Rules
```
Issue: Forgot to register migration
Rule: "After creating migration file, add to database.js migrationFiles array"
Add to: migration.md command
```

## Quick Evolution Templates

### Add Rule to CLAUDE.md
```markdown
### [Category] Rules
- [Rule description] (learned from: [brief issue])
```

### Create Reference Doc
```markdown
# [Topic] Architecture

## Overview
Brief description of how this system works.

## Key Files
- file1.js - Purpose
- file2.js - Purpose

## Flow
1. Step 1
2. Step 2

## Common Patterns
```code example```

## Gotchas
- Gotcha 1
- Gotcha 2
```

### Update Command
```markdown
## Gotchas (add section if not exists)
- [Issue description] - [How to avoid]
```

## Examples of Past Evolutions

### Example 1: Wrong Import Style
```
Issue: AI used `import { db } from 'database'` instead of relative path
Root Cause: No explicit import style documented
Solution: Added to CLAUDE.md:
  "Import Rule: Always use relative paths from current file, e.g.,
   import { query } from '../db/database.js'"
Prevention: AI now checks CLAUDE.md before writing imports
```

### Example 2: Forgot Test Step
```
Issue: AI completed feature but didn't run tests
Root Cause: feature.md command didn't emphasize testing
Solution: Updated feature.md Phase 6 to be more prominent:
  "### Phase 6: Testing (REQUIRED)
   1. Run ALL tests: bun test && bunx playwright test
   2. Fix any failures before considering feature complete"
Prevention: Testing is now a required, visible step
```

### Example 3: Auth Flow Confusion
```
Issue: AI didn't understand JWT refresh flow, wrote incorrect code
Root Cause: No documentation of auth architecture
Solution: Created claude-docs/docs/reference/auth-architecture.md
  - Documented login flow
  - Documented token refresh
  - Documented protected routes
Prevention: AI reads auth doc when working on auth-related code
```

## Self-Improvement Checklist

After each session, ask:
- [ ] Did I make any mistakes that could have been prevented by a rule?
- [ ] Did I have to figure something out that should be documented?
- [ ] Did I do something manually that should be a command?
- [ ] Did I repeat any code pattern that should be a template?

If yes to any → Run /evolve
