# Evolution Log

A chronological record of system improvements learned from bugs, mistakes, and friction points.

> "Every entry here represents a bug that will never happen again."

---

## 2026-01-25 - Initial Command System

**Issue**: Repeated workflows were being done manually each time (commits, migrations, routes, pages, etc.)

**Root Cause**: No documented, reusable workflows

**Solution**: Created comprehensive command system with 19 commands:
- Git: commit, pr, review, deploy
- Development: feature, migration, route, page, handler, modal, style, seed
- Quality: test, debug, fix, refactor, explore, api

**Files Created**:
- `claude-docs/docs/commands/*.md` (19 files)
- `claude-docs/docs/commands/README.md` (index)
- `claude-docs/COMMAND_CHEATSHEET.md` (quick reference)

**Prevention**: Common workflows are now documented and repeatable

---

## 2026-01-25 - Evolution System

**Issue**: Bugs and mistakes were fixed but not systematically prevented

**Root Cause**: No process for turning issues into permanent improvements

**Solution**: Created evolution system:
- `/evolve` command for processing issues
- `evolution-log.md` for tracking all evolutions
- `evolution-rules.md` for quick-reference rules

**Files Created**:
- `claude-docs/docs/commands/evolve.md`
- `claude-docs/docs/evolution-log.md`
- `claude-docs/docs/evolution-rules.md`

**Prevention**: Every bug now becomes a rule, doc, or command improvement

---

## 2026-01-25 - Rate Limit Documentation

**Issue**: User tried `/rate-limit-options` command which didn't exist

**Root Cause**: Rate limiting configuration wasn't documented in command format

**Solution**: Created comprehensive rate limiting documentation:
- Current configuration reference (4 tiers)
- How to modify limits
- Troubleshooting 429 errors
- Monitoring via security_logs table

**Files Created**:
- `claude-docs/docs/commands/rate-limit-options.md`

**Files Updated**:
- `claude-docs/docs/commands/README.md` (added Security section)
- `claude-docs/COMMAND_CHEATSHEET.md` (added entry)

**Prevention**: Rate limiting now fully documented, total commands: 20

---

## 2026-01-25 - PRD Update Requirement

**Issue**: PRD.md was getting outdated as features were completed

**Root Cause**: No explicit reminder to update PRD after completing work

**Solution**: Added documentation rules:
- New critical rule #9 in CLAUDE.md
- Documentation Rules section in evolution-rules.md
- `/feature` command already had PRD update step (verified)

**Files Updated**:
- `claude-docs/CLAUDE.md` (added critical rule #9)
- `claude-docs/docs/evolution-rules.md` (added Documentation Rules)
- `claude-docs/docs/PRD.md` (updated to Session 14)

**Prevention**: PRD now stays current as source of truth

---

## 2026-01-30 - Production Polish & Security Hardening

**Issue**: Frontend had 11 console.log statements (including one logging sensitive OAuth email data), 52 native confirm() dialogs with no styling, dark mode nav items indistinguishable from hover state, and keyboard shortcuts modal was incomplete.

**Root Cause**: Rapid feature development left debug logging, unstyled browser dialogs, and incomplete UI polish.

**Solution**:
- Removed all frontend console.log statements; replaced error-path ones with silent comments
- Created `modals.confirm()` returning Promise with styled modal (title, danger mode, custom buttons)
- Replaced 10 most critical native `confirm()` calls (deletes, permanent deletes, account deletion)
- Fixed dark mode `.nav-item.active` to use blue (#3b82f6) distinct from hover grey (#4b5563)
- Updated keyboard shortcuts modal with all implemented shortcuts (Ctrl+D/E/I/S, Escape, Alt+1-5)
- Added DELETE `/api/sales/:id` route with inventory/listing status restoration

**Files Modified**:
- `src/frontend/app.js` (console.log removal, modals.confirm(), shortcuts modal, confirm replacements)
- `src/backend/routes/sales.js` (added DELETE route)
- `src/frontend/styles/main.css` (dark mode nav contrast fix)

**Prevention**:
- Rule: Never commit console.log to production frontend code
- Rule: Use `modals.confirm()` for destructive operations, not native `confirm()`
- Rule: Test dark mode contrast for all interactive states (normal, hover, active, focus)

---

## Template for New Entries

```markdown
## [YYYY-MM-DD] - [Brief Title]

**Issue**: What went wrong or caused friction

**Root Cause**: Why it happened (the real reason, not the symptom)

**Solution**: What was added/changed to prevent recurrence

**Files Modified**:
- file1.md (description of change)
- file2.md (description of change)

**Prevention**: How this prevents the issue in the future

---
```

## Statistics

| Month | Evolutions | Rules Added | Docs Created | Commands Updated |
|-------|------------|-------------|--------------|------------------|
| Jan 2026 | 5 | 5 | 5 | 20 |

---

## Categories of Evolutions

### Import/Path Issues
- (none yet)

### Testing Issues
- (none yet)

### Style/CSS Issues
- 2026-01-30: Fixed dark mode nav-item active/hover contrast

### API/Backend Issues
- 2026-01-30: Added missing DELETE sales route

### Frontend/State Issues
- 2026-01-30: Replaced native confirm() with styled modals for destructive ops
- 2026-01-30: Removed console.log statements (security: OAuth data logging)

### Database Issues
- (none yet)

### Documentation Issues
- 2026-01-25: Added PRD update requirement

### Security/Infrastructure Issues
- 2026-01-25: Created rate-limit-options command

### Workflow Issues
- 2026-01-25: Created command system
- 2026-01-25: Created evolution system
