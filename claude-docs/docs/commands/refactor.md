# /refactor - Refactor Code

Refactor code for better structure, readability, or performance.

## Usage
```
/refactor <file|pattern> [goal]
```

Goals: `extract`, `simplify`, `optimize`, `dedupe`, `rename`

## Workflow

1. **Analyze current code**
   - Read the file(s) to understand structure
   - Identify code smells or improvement areas
   - Note dependencies and usages

2. **Plan refactoring**
   - Define clear goal
   - List specific changes
   - Identify potential breaking changes

3. **Execute refactoring**
   - Make changes incrementally
   - Keep functionality identical
   - Update all references

4. **Verify**
   - Run tests to ensure no breakage
   - Manual verification if no tests exist

## Common Refactoring Patterns

### Extract Function
```javascript
// Before
if (user.role === 'admin' || user.role === 'moderator') {
    // do admin stuff
}

// After
function hasAdminAccess(user) {
    return user.role === 'admin' || user.role === 'moderator';
}
if (hasAdminAccess(user)) {
    // do admin stuff
}
```

### Extract Component (Frontend)
```javascript
// Before: inline HTML in page function
`<div class="card">
    <div class="card-header">${title}</div>
    <div class="card-body">${content}</div>
</div>`

// After: reusable component
components.card = (title, content) => `
    <div class="card">
        <div class="card-header">${title}</div>
        <div class="card-body">${content}</div>
    </div>
`;
```

### Simplify Conditionals
```javascript
// Before
if (status === 'active') {
    return true;
} else {
    return false;
}

// After
return status === 'active';
```

### Remove Duplication
```javascript
// Before: repeated in multiple routes
const purchases = query.all('SELECT * FROM purchases WHERE user_id = ?', [user.id]);
const sales = query.all('SELECT * FROM sales WHERE user_id = ?', [user.id]);

// After: helper function
const getUserRecords = (table, userId) =>
    query.all(`SELECT * FROM ${table} WHERE user_id = ?`, [userId]);
```

## Rules
- Never change functionality during refactoring
- Make small, incremental changes
- Run tests after each change
- Update all usages when renaming
- Keep commits focused (one refactoring per commit)
