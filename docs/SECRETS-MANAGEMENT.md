# VaultLister 3.0 — Secrets Management & Rotation

## Current Implementation

VaultLister 3.0 currently stores sensitive configuration in a  file on the deployment server.

## Secret Rotation Schedule

| Secret | Rotation Interval |
|--------|-------------------|
| JWT_SECRET | Quarterly (90 days) |
| REFRESH_TOKEN_SECRET | Quarterly (90 days) |
| ANTHROPIC_API_KEY | Annually (365 days) |
| Marketplace OAuth tokens | Annually (365 days) |
| GITHUB_TOKEN | Annually (365 days) |

See DEPLOYMENT.md for full details on rotation procedures and verification.
