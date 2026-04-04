# /commit - Smart Git Commit

Create well-formatted git commits with conventional commit messages.

## Usage
```
/commit [message hint]
```

## Workflow

1. **Check status and changes**
   ```bash
   git status
   git diff --staged
   git diff
   ```

2. **Analyze changes** to determine:
   - Type: feat, fix, refactor, docs, test, chore, style, perf
   - Scope: affected area (e.g., auth, inventory, frontend)
   - Description: concise summary of what changed

3. **Stage relevant files** (if not already staged)
   ```bash
   git add <relevant-files>
   ```

4. **Create commit** with conventional format:
   ```bash
   git commit -m "$(cat <<'EOF'
   type(scope): description

   - Detail 1
   - Detail 2

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

## Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no functional change)
- `docs`: Documentation only
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `style`: Formatting, whitespace
- `perf`: Performance improvement

## Rules
- Never commit .env files or secrets
- Never use `--force` or `--amend` without explicit request
- Always include Co-Authored-By
- Keep first line under 72 characters
- Use imperative mood ("Add feature" not "Added feature")
