# /fix - Fix Errors

Quickly fix common errors and issues.

## Usage
```
/fix <error-type|error-message>
```

## Common Fixes

### Database Errors

**"no such table"**
```bash
# Check if migration exists and is registered
ls src/backend/db/migrations/
grep "tablename" src/backend/db/database.js

# Restart server to run migrations
bun run src/backend/server.js
```

**"UNIQUE constraint failed"**
```javascript
// Add check before insert
const existing = query.get('SELECT id FROM table WHERE unique_col = ?', [value]);
if (existing) {
    return { status: 400, data: { error: 'Already exists' } };
}
```

### API Errors

**401 Unauthorized**
```javascript
// Check auth header is sent
headers: { 'Authorization': `Bearer ${token}` }

// Check route is in protectedPrefixes
// Check token hasn't expired
```

**400 Bad Request**
```javascript
// Check required fields
if (!requiredField) {
    return { status: 400, data: { error: 'Field required' } };
}

// Check data types
const num = parseInt(value);
if (isNaN(num)) {
    return { status: 400, data: { error: 'Invalid number' } };
}
```

### Frontend Errors

**"Cannot read property X of undefined"**
```javascript
// Add defensive checks
const value = data?.property || 'default';
const items = store.state.items || [];
```

**UI not updating**
```javascript
// Ensure setState is called
store.setState({ property: newValue });

// Ensure renderApp is called
if (store.state.currentPage === 'pagename') {
    renderApp(pages.pagename());
}
```

**Event handler not working**
```javascript
// Check handler is exposed on window.handlers
handlers.myHandler = function() { ... };

// Check onclick syntax
onclick="handlers.myHandler()"
onclick="handlers.myHandler('${escapedValue}')"
```

### Style Errors

**Dark mode not working**
```css
/* Add dark mode variant */
body.dark-mode .element {
    background: var(--gray-700);
    color: white;
}
```

**Layout broken**
```css
/* Check flex container */
display: flex;
flex-direction: row|column;
gap: 16px;

/* Check grid */
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 24px;
```

## Quick Fix Patterns

### Add null safety
```javascript
// Before
const name = user.profile.name;

// After
const name = user?.profile?.name || 'Unknown';
```

### Add error handling
```javascript
try {
    const result = await riskyOperation();
    return { status: 200, data: result };
} catch (error) {
    console.error('Operation failed:', error);
    return { status: 500, data: { error: error.message } };
}
```

### Add loading state
```javascript
// Handler
async loadData() {
    store.setState({ loading: true });
    try {
        const data = await api.get('/endpoint');
        store.setState({ data, loading: false });
    } catch (error) {
        store.setState({ loading: false });
        toast.error('Failed to load');
    }
}

// UI
${store.state.loading ? '<div class="loading">Loading...</div>' : actualContent}
```
