---
name: deploy
description: Deploy VaultLister 3.0 via Docker — build image, update production container
trigger: /deploy
---

# /deploy — VaultLister 3.0 Docker Deployment

⚠️ **This deploys to production. Confirm with the user before proceeding.**

## Pre-Deploy Checks
1. All tests passing: `bun run test:all`
2. Clean commit: `git status` shows no uncommitted changes
3. Build succeeds: `bun run build`

## Deploy Steps

1. **Build Docker image**
   ```
   docker build -t vaultlister-3:latest .
   ```

2. **Tag for registry** (fill `[CONFIGURE]` with your registry URL)
   ```
   docker tag vaultlister-3:latest [CONFIGURE]/vaultlister-3:latest
   ```

3. **Push to registry**
   ```
   docker push [CONFIGURE]/vaultlister-3:latest
   ```

4. **Update production container**
   ```
   docker-compose pull && docker-compose up -d
   ```

5. **Health check**
   ```
   curl -f http://localhost:3000/api/health || echo "Health check failed"
   ```

## On Failure
- Roll back: `docker-compose down && docker-compose up -d`
- Do NOT retry without investigating root cause
