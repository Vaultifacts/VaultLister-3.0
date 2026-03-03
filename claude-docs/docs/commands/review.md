# /review - Code Review

Perform thorough code review on changes or PR.

## Usage
```
/review [file|pr-number|branch]
```

## Workflow

1. **Gather changes**
   ```bash
   # Local changes
   git diff
   git diff --staged

   # PR changes
   gh pr diff <number>

   # Branch comparison
   git diff main...<branch>
   ```

2. **Review checklist**

   ### Security
   - [ ] No hardcoded secrets or API keys
   - [ ] User input is sanitized (escapeHtml, parameterized queries)
   - [ ] Authentication checked on protected routes
   - [ ] No SQL injection vulnerabilities
   - [ ] No XSS vulnerabilities

   ### Code Quality
   - [ ] Functions are focused and single-purpose
   - [ ] No code duplication (DRY)
   - [ ] Variable/function names are descriptive
   - [ ] Error handling is appropriate
   - [ ] No console.logs left in production code

   ### Performance
   - [ ] Database queries are optimized (indexes used)
   - [ ] No N+1 query problems
   - [ ] Large lists are paginated
   - [ ] No unnecessary re-renders (frontend)

   ### Consistency
   - [ ] Follows existing code patterns
   - [ ] Matches project style (vanilla JS, Bun, SQLite)
   - [ ] API response format is consistent

   ### Testing
   - [ ] New functionality has tests
   - [ ] Edge cases are covered
   - [ ] Tests actually test the right thing

3. **Provide feedback**
   - List issues found with file:line references
   - Suggest specific fixes
   - Note any positive aspects

## Output Format
```
## Code Review: [scope]

### Issues Found
1. **[Severity]** file.js:42 - Description
   Suggestion: ...

### Suggestions
- Consider...

### Approved Items
- Good use of...
```

## Severity Levels
- **Critical**: Security issue, data loss risk
- **Major**: Bug that affects functionality
- **Minor**: Style, minor improvement
- **Nit**: Nitpick, optional change
