# Deployment Runbook

## Scope
Local production-like deployment validation using Docker Compose.

## Prerequisites
- Docker Desktop running
- Docker daemon reachable
- Repository root contains `Dockerfile` and `docker-compose.yml`

## Commands
```powershell
docker compose down
docker compose up -d --build
docker compose ps
docker inspect --format='{{.State.Health.Status}}' vaultlister-app
curl.exe -s http://localhost:3000/api/health
```

## Expected Results
- `docker compose up -d --build` exits 0
- `vaultlister-app` and `vaultlister-redis` are `Up`
- `vaultlister-app` health status becomes `healthy`
- `/api/health` returns JSON with `"status":"healthy"`

## Evidence
- `docs/evidence/DEPLOYMENT_VALIDATION.md`
- `docs/evidence/PHASE-04_DOCKER_PS.txt`
- `docs/evidence/PHASE-04_DOCKER_HEALTH_STATUS.txt`
- `docs/evidence/PHASE-04_DOCKER_HEALTH_RESPONSE.json`

## Rollback
```powershell
docker compose down
```
