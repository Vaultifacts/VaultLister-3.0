# /explore - Explore Codebase

Quickly understand parts of the codebase.

## Usage
```
/explore <topic|file|pattern>
```

## Workflow

1. **Identify search targets**
   - What are you trying to understand?
   - Keywords, function names, patterns?

2. **Search strategically**
   ```bash
   # Find files by pattern
   Glob: **/*<pattern>*.js

   # Search content
   Grep: <keyword>

   # Find definitions
   Grep: function <name>|class <name>|const <name>
   ```

3. **Read relevant files**
   - Start with entry points
   - Follow imports/dependencies
   - Note patterns and conventions

4. **Summarize findings**
   - Key files involved
   - Data flow
   - Important functions
   - Patterns used

## Common Explorations

### "How does authentication work?"
```
1. Grep: authenticateToken|JWT|Bearer
2. Read: src/backend/middleware/auth.js
3. Read: src/backend/routes/auth.js
4. Check: protectedPrefixes in server.js
```

### "How does the frontend routing work?"
```
1. Grep: router.register|router.navigate
2. Read: src/frontend/core/router.js
3. Check: hashchange event listener
```

### "How does database access work?"
```
1. Read: src/backend/db/database.js
2. Check: query.get, query.all, query.run
3. Look at: migrations folder for schema
```

### "How is state managed?"
```
1. Grep: store.state|setState
2. Read: src/frontend/core/store.js
3. Check: renderApp function
```

## File Map
```
src/
├── backend/
│   ├── server.js          # Entry point, routing
│   ├── db/
│   │   ├── database.js    # DB connection, query helpers
│   │   ├── pg-schema.sql  # PostgreSQL schema
│   │   └── migrations/    # Schema changes
│   ├── middleware/
│   │   ├── auth.js        # JWT authentication
│   │   ├── csrf.js        # CSRF protection
│   │   └── rateLimiter.js # Rate limiting
│   └── routes/            # API endpoints
├── frontend/
│   ├── core-bundle.js     # Built SPA (generated from core/{store,router,api}.js + handlers/ + pages/)
│   └── styles/main.css    # All CSS
└── tests/                 # API tests
e2e/                       # Playwright tests
```

## Output Format
```
## Exploration: [topic]

### Key Files
- file1.js:L10-50 - Description
- file2.js:L100 - Description

### Data Flow
1. Step 1
2. Step 2

### Patterns Found
- Pattern 1: Description
- Pattern 2: Description

### Related Areas
- Related topic 1
- Related topic 2
```
