# /debug - Debug Issues

Systematically debug and fix issues in the application.

## Usage
```
/debug <error-message|symptom|file>
```

## Workflow

1. **Reproduce the issue**
   - Understand exact steps to trigger
   - Note error messages, stack traces
   - Identify affected area (frontend/backend/database)

2. **Gather information**
   ```bash
   # Check server logs
   tail -50 logs/server.log

   # Check database state
   sqlite3 data/vaultlister.db "SELECT * FROM table LIMIT 5;"

   # Check network requests (browser devtools)
   ```

3. **Isolate the problem**
   - Add strategic console.logs or debugger statements
   - Check input/output at each step
   - Binary search through code if needed

4. **Identify root cause**
   - Trace the data flow
   - Check for null/undefined values
   - Verify API responses match expectations
   - Check database schema matches code expectations

5. **Fix the issue**
   - Make minimal, focused fix
   - Don't introduce new features during debugging
   - Add defensive checks if appropriate

6. **Verify fix**
   - Test the original reproduction steps
   - Check for regression in related areas
   - Consider adding test to prevent recurrence

## Common Issues & Solutions

### "Cannot read property X of undefined"
- Check if API returned expected data
- Add null checks: `data?.property || defaultValue`
- Verify state is initialized before use

### API returns 401 Unauthorized
- Check if token is being sent in header
- Verify token hasn't expired
- Check route is in protectedPrefixes

### Database query returns empty
- Check user_id filter is correct
- Verify table exists (migration ran)
- Check column names match schema

### Frontend not updating
- Verify setState is called
- Check renderApp is called after state change
- Look for typos in state property names

### CORS errors
- Check corsHeaders in server.js
- Verify preflight OPTIONS handling
- Check for mismatched origins

## Debug Checklist
- [ ] Can I reproduce consistently?
- [ ] What changed recently?
- [ ] Is the data correct at each step?
- [ ] Are all dependencies available?
- [ ] Does the schema match the code?
