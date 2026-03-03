# Evolution Rules

Quick-reference rules learned from past issues. Check this before writing code.

> These rules exist because someone made a mistake. Don't repeat it.

---

## Import Rules

```javascript
// ✅ CORRECT: Relative imports with full extension
import { query } from '../db/database.js';
import { authRouter } from './routes/auth.js';

// ❌ WRONG: Absolute imports or missing extension
import { query } from 'database';
import { authRouter } from './routes/auth';
```

---

## Frontend Rules

### State Management
```javascript
// ✅ CORRECT: Always call renderApp after setState if on affected page
store.setState({ items: newItems });
if (store.state.currentPage === 'inventory') {
    renderApp(pages.inventory());
}

// ❌ WRONG: setState without re-render
store.setState({ items: newItems });
// UI won't update!
```

### Event Handlers
```javascript
// ✅ CORRECT: Escape values in onclick
onclick="handlers.edit('${escapeHtml(item.id)}')"

// ❌ WRONG: Unescaped values (XSS risk)
onclick="handlers.edit('${item.id}')"
```

### Dark Mode
```css
/* ✅ CORRECT: Always add dark mode variant with distinct interactive states */
.my-component { background: white; }
body.dark-mode .my-component { background: var(--gray-800); }
body.dark-mode .my-component:hover { background: #4b5563; }
body.dark-mode .my-component.active { background: #3b82f6; }  /* Distinct from hover! */

/* ❌ WRONG: Only light mode styles, or same color for hover and active */
.my-component { background: white; }
body.dark-mode .nav-item:hover { background: #4b5563; }
body.dark-mode .nav-item.active { background: #4b5563; }  /* Can't tell which is active! */
```

### Console Logging
```javascript
// ✅ CORRECT: No console.log in production frontend; use toast or silent comments
try { ... } catch (e) {
    // Silently handle - data will load on next navigation
}

// ❌ WRONG: console.log in production (noise + possible security leak)
console.log('Email OAuth success received:', event.data.email);  // Logs sensitive data!
```

### Confirm Dialogs
```javascript
// ✅ CORRECT: Styled confirm for destructive operations
if (!await modals.confirm('Delete this item?', { title: 'Delete', confirmText: 'Delete', danger: true })) return;

// ❌ WRONG: Native confirm() for destructive operations
if (!confirm('Delete this item?')) return;  // Ugly, no branding, inconsistent!
```

---

## Backend Rules

### API Requests
```javascript
// ✅ CORRECT: Always ensure CSRF token before mutations
await api.ensureCSRFToken();
await api.post('/endpoint', data);

// ❌ WRONG: POST without CSRF
await api.post('/endpoint', data);
// Will fail with 403!
```

### Database Queries
```javascript
// ✅ CORRECT: Always filter by user_id for user data
query.all('SELECT * FROM items WHERE user_id = ?', [user.id]);

// ❌ WRONG: No user filter (data leak!)
query.all('SELECT * FROM items');
```

### Route Patterns
```javascript
// ✅ CORRECT: Check path with regex for IDs
if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
    const id = path.slice(1);
}

// ❌ WRONG: Exact path match only
if (method === 'GET' && path === '/:id') {
    // This never matches!
}
```

---

## Testing Rules

### After Code Changes
```bash
# ✅ CORRECT: Run tests after any .js modification
bun test
bunx playwright test

# ❌ WRONG: Skip tests
# "It works on my machine" is not testing
```

### Before Commits
```bash
# ✅ CORRECT: Verify before commit
git diff  # Review changes
bun test  # Tests pass
git add . && git commit

# ❌ WRONG: Blind commit
git add . && git commit  # Might commit broken code
```

---

## Migration Rules

### Creating Migrations
```bash
# ✅ CORRECT: Create file AND register
1. Create: src/backend/db/migrations/XXX_name.sql
2. Register in database.js migrationFiles array
3. Restart server to run migration

# ❌ WRONG: Create file only
# Migration won't run if not registered!
```

### Migration SQL
```sql
-- ✅ CORRECT: Idempotent statements
CREATE TABLE IF NOT EXISTS items (...);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

-- ❌ WRONG: Non-idempotent
CREATE TABLE items (...);
-- Fails if table already exists!
```

---

## Security Rules

### User Input
```javascript
// ✅ CORRECT: Always escape user content in HTML
${escapeHtml(user.name)}

// ❌ WRONG: Raw user content (XSS!)
${user.name}
```

### SQL Queries
```javascript
// ✅ CORRECT: Parameterized queries
query.all('SELECT * FROM items WHERE name = ?', [userInput]);

// ❌ WRONG: String concatenation (SQL injection!)
query.all(`SELECT * FROM items WHERE name = '${userInput}'`);
```

### Secrets
```javascript
// ✅ CORRECT: Environment variables
const secret = process.env.JWT_SECRET;

// ❌ WRONG: Hardcoded secrets
const secret = 'my-secret-key';  // NEVER!
```

---

## Git Rules

### Commits
```bash
# ✅ CORRECT: Conventional commit format
git commit -m "feat(inventory): add bulk delete"
git commit -m "fix(auth): resolve token refresh race condition"

# ❌ WRONG: Vague messages
git commit -m "fixed stuff"
git commit -m "updates"
```

### Dangerous Commands
```bash
# ⚠️ NEVER without explicit user request:
git push --force
git reset --hard
git rebase -i  # (interactive not supported anyway)
```

---

## Performance Rules

### Database
```javascript
// ✅ CORRECT: Limit queries
query.all('SELECT * FROM items WHERE user_id = ? LIMIT 50', [userId]);

// ❌ WRONG: Unbounded queries
query.all('SELECT * FROM items');  // Could return millions!
```

### Frontend
```javascript
// ✅ CORRECT: Paginate large lists
const items = store.state.items.slice(offset, offset + limit);

// ❌ WRONG: Render all items
const items = store.state.items;  // Could be 10,000 items!
```

---

## Documentation Rules

### After Completing Features
```markdown
✅ CORRECT: Update PRD.md after each feature
1. Move feature from "Next Steps" to "Recently Completed"
2. Increment session number and implementation count
3. Update architecture if structure changed

❌ WRONG: Skip PRD updates
# Feature completed but PRD still shows it as "upcoming"
# Next developer doesn't know it's done!
```

### Session Tracking
```markdown
✅ CORRECT: Update both files
- PRD.md: "Recently Completed (Session X)" section
- CLAUDE.md: Session Log table

❌ WRONG: Only update one
# Creates inconsistency between docs
```

---

## How to Add New Rules

When you encounter a bug or mistake:

1. Identify the pattern that went wrong
2. Write the ✅ CORRECT and ❌ WRONG versions
3. Add to appropriate section above
4. Log in evolution-log.md

```markdown
## [Category] Rules

### [Specific Pattern]
```javascript
// ✅ CORRECT: Description
correct code

// ❌ WRONG: Description
wrong code
```
```
