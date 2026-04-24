---
name: deploy
description: Deploy VaultLister 3.0 via Railway — push to master triggers auto-deploy
trigger: /deploy
---

# /deploy — VaultLister 3.0 Railway Deployment

⚠️ **This deploys to production. Confirm with the user before proceeding.**

Production: Railway (managed PaaS) behind Cloudflare CDN. Deployments are triggered automatically by pushing to `master`. Manual deploys use the Railway CLI.

## Pre-Deploy Checks
1. All tests passing: `bun run test:all`
2. Clean commit: `git status` shows no uncommitted changes
3. Build succeeds: `bun run build`

## Deploy Steps (Auto via GitHub Actions)

1. **Push to master** (triggers Railway auto-deploy via GitHub Actions)
   ```
   git push origin master
   ```

2. **Monitor deployment**
   ```
   railway logs --tail
   ```

3. **Health check**
   ```
   curl -f https://vaultlister.com/api/health || echo "Health check failed"
   ```

## Manual Deploy (Railway CLI)

```bash
railway up                    # Deploy current branch
railway logs --tail           # Stream live logs
railway status                # Show service status
```

## On Failure
- Check Railway dashboard: https://railway.app
- View logs: `railway logs --tail`
- Roll back: redeploy previous commit from Railway dashboard
- Do NOT retry without investigating root cause
