# VaultLister Commands

Reusable workflows for AI-assisted development. Each command saves thousands of keystrokes and makes coding reliable + repeatable.

## Available Commands

### Git & Workflow
| Command | Description |
|---------|-------------|
| `/commit` | Smart git commits with conventional messages |
| `/pr` | Create well-documented pull requests |
| `/review` | Code review with security/quality checklist |
| `/deploy` | Pre-deployment verification and deployment |

### Development
| Command | Description |
|---------|-------------|
| `/feature` | End-to-end feature implementation workflow |
| `/migration` | Create and register database migrations |
| `/route` | Create backend API routes |
| `/page` | Create frontend pages with tabs/state |
| `/handler` | Create frontend event handlers |

### Quality & Debugging
| Command | Description |
|---------|-------------|
| `/test` | Run and fix tests (API, E2E) |
| `/debug` | Systematic debugging workflow |
| `/fix` | Quick fixes for common errors |
| `/refactor` | Refactor code for better structure |
| `/explore` | Understand parts of the codebase |

### Security & Infrastructure
| Command | Description |
|---------|-------------|
| `/rate-limit-options` | Configure rate limiting settings |

### System Evolution
| Command | Description |
|---------|-------------|
| `/evolve` | Turn bugs/mistakes into permanent improvements |

**Related files:**
- `docs/evolution-rules.md` - Quick-reference rules learned from bugs
- `docs/evolution-log.md` - Chronological record of all evolutions

## Usage

Simply type the command with optional arguments:

```
/commit                    # Smart commit
/migration user_notes      # Create user_notes migration
/route notifications       # Create notifications route
/page reports tabs:daily,weekly,monthly
/test e2e                  # Run E2E tests
/debug "Cannot read property"
/fix 401                   # Fix auth errors
```

## Command Structure

Each command file contains:
1. **Usage** - How to invoke
2. **Workflow** - Step-by-step process
3. **Templates** - Reusable code patterns
4. **Best Practices** - Guidelines to follow
5. **Examples** - Real-world usage

## Creating New Commands

When you do something more than twice, make it a command:

1. Create `claude-docs/docs/commands/<name>.md`
2. Document the workflow
3. Include templates and examples
4. Add to this README

## VaultLister-Specific Patterns

These commands are optimized for:
- **Runtime**: Bun.js
- **Database**: SQLite with migrations
- **Backend**: Express-like router pattern
- **Frontend**: Vanilla JS SPA
- **Auth**: JWT tokens
- **Testing**: bun:test + Playwright
