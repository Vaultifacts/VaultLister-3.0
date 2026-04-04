# /pr - Create Pull Request

Create well-documented pull requests.

## Usage
```
/pr [base-branch]
```

## Workflow

1. **Check current state**
   ```bash
   git status
   git log main..HEAD --oneline
   git diff main...HEAD --stat
   ```

2. **Ensure branch is ready**
   ```bash
   # All changes committed
   git status

   # Tests pass
   bun test

   # Push to remote
   git push -u origin <branch-name>
   ```

3. **Analyze all commits** (not just latest)
   - Review each commit in the branch
   - Understand the full scope of changes
   - Note any breaking changes

4. **Create PR**
   ```bash
   gh pr create --title "type(scope): description" --body "$(cat <<'EOF'
   ## Summary
   - Bullet point 1
   - Bullet point 2
   - Bullet point 3

   ## Changes
   - file1.js: Description of changes
   - file2.js: Description of changes

   ## Test Plan
   - [ ] Manual test step 1
   - [ ] Manual test step 2
   - [ ] Automated tests pass

   ## Screenshots
   (if applicable)

   ---
   Generated with Claude Code
   EOF
   )"
   ```

5. **Return PR URL** to user

## PR Title Format
```
type(scope): short description

Examples:
feat(financials): add P&L report generation
fix(auth): resolve token refresh race condition
refactor(frontend): extract card component
docs(api): update endpoint documentation
```

## PR Body Template
```markdown
## Summary
Brief description of what this PR does.

- Key change 1
- Key change 2
- Key change 3

## Changes
List of files changed with brief descriptions.

## Test Plan
How to verify these changes work.

## Breaking Changes
(if any)

## Related Issues
Closes #123
```

## Checklist Before PR
- [ ] Code follows project patterns
- [ ] All tests pass
- [ ] No console.logs in production code
- [ ] No hardcoded secrets
- [ ] Migrations tested
- [ ] Manual testing done
