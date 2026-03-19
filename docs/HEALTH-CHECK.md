# Health Check Endpoint Documentation

## Overview

The `/api/health` endpoint provides a basic health check for orchestration systems (Docker, Kubernetes, load balancers). It is **intentionally public and unauthenticated** to allow external monitoring without credentials.

## Endpoint Details

### GET /api/health
- **Authentication:** None (public)
- **Rate Limit:** Applied at general API rate limit (30r/s per IP)
- **Purpose:** Docker health check, load balancer monitoring, uptime monitoring

#### Response (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2026-03-19T14:23:45.123Z",
  "version": "1.0.0"
}
```

#### Response (503 Service Unavailable)
```json
{
  "status": "unhealthy",
  "error": "Database unavailable"
}
```

## Docker Configuration

In `docker-compose.yml`, the health check uses this endpoint:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Authenticated Alternatives

For detailed health metrics and security checks, use:

- **GET /api/health/detailed** — Requires authentication. Returns comprehensive health status including database, Redis, external APIs.
- **GET /api/metrics** — Requires admin authentication. Returns performance metrics.

## Security Considerations

The public `/api/health` endpoint:
- Only returns basic status (healthy/unhealthy) and does not leak system details
- Is rate-limited like all other API endpoints
- Does not require CSRF tokens (no state modification)
- Should be included in monitoring allowlists (e.g., Uptime Robot, health check services)

Internal monitoring systems should use authenticated endpoints for detailed diagnostics.
