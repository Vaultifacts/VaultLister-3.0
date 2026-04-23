# /deploy - Deployment Checklist

Pre-deployment verification and deployment workflow.

## Usage
```
/deploy [environment]
```

Environments: `staging`, `production`

## Pre-Deployment Checklist

### Code Quality
```bash
# Check for uncommitted changes
git status

# Run all tests
bun test
node node_modules/@playwright/test/cli.js test

# Check for console.logs
grep -r "console.log" src/ --include="*.js" | grep -v test
```

### Security
- [ ] No hardcoded secrets in code
- [ ] .env files not committed
- [ ] All API routes have proper auth
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Security headers configured

### Database
- [ ] All migrations registered
- [ ] Migrations tested on fresh DB
- [ ] Backup of production DB taken
- [ ] Migration rollback plan ready

### Environment
- [ ] Environment variables documented
- [ ] Required env vars set in target
- [ ] Port configuration correct
- [ ] Database path configured

## Deployment Steps

### 1. Final Checks
```bash
# Ensure on correct branch
git branch

# Pull latest
git pull origin main

# Install dependencies
bun install
```

### 2. Build Verification
```bash
# Start server and verify
bun run src/backend/server.js

# Test key endpoints
curl http://localhost:3000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@vaultlister.com","password":"DemoPassword123!"}'
```

### 3. Database Migration
```bash
# Backup first!
cp data/vaultlister.db data/vaultlister.db.backup

# Migrations run automatically on server start
```

### 4. Deploy
```bash
# Stop current server
# Copy files to server
# Start new server
# Verify health
```

### 5. Post-Deployment
- [ ] Verify app loads in browser
- [ ] Test login functionality
- [ ] Test core features (inventory, sales)
- [ ] Check error logs
- [ ] Monitor for issues

## Rollback Plan
```bash
# Restore database
cp data/vaultlister.db.backup data/vaultlister.db

# Revert code
git revert HEAD

# Restart server
```

## Environment Variables
```
PORT=3000
DB_PATH=./data/vaultlister.db
JWT_SECRET=<secure-random-string>
ANTHROPIC_API_KEY=<api-key>  # For AI features
```
