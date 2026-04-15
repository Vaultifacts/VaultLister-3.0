---
name: automation_roadmap
description: 63-item automation roadmap for solo dev — prioritized tiers, implementation status
type: project
---

# Automation Roadmap — 63 Items

**Why:** Solo developer maintaining production SaaS. Every manual task is a failure point.
**How to apply:** Work through tiers in order. Each item becomes a GitHub Actions workflow, CI check, or cron job.

## Already Done (this session)
- [x] `.postgres-version` + CI drift + weekly auto-PR
- [x] `.bun-version` + CI drift + weekly auto-PR
- [x] `.node-version` + CI drift + weekly auto-PR
- [x] `.redis-version` + CI drift + weekly auto-PR

## Tier 1 — Prevents outages (build first)
- [ ] 1. Auto-merge version-check PRs
- [ ] 2. VACUUM/ANALYZE cron
- [ ] 3. SSL cert expiry monitoring
- [ ] 4. Secret rotation reminders
- [ ] 5. Domain expiry monitoring
- [ ] 6. Expired session cleanup

## Tier 2 — Saves weekly time
- [ ] 7. npm audit cron
- [ ] 8. Stale branch cleanup
- [ ] 9. Uptime push notifications (phone alerts via Slack)
- [ ] 10. Changelog/release notes generation
- [ ] 11. GDPR data retention purge
- [ ] 12. Orphaned records cleanup
- [ ] 13. Unused image cleanup
- [ ] 14. .env.example sync check in CI
- [ ] 15. Migration registration check in CI

## Tier 3 — Cost/spend protection
- [ ] 16. Railway spend alerts
- [ ] 17. Anthropic API spend alerts
- [ ] 18. B2 storage cost alerts
- [ ] 19. Token usage budget caps
- [ ] 20. OpenAI/xAI spend tracking

## Tier 4 — Performance/quality
- [ ] 21. Lighthouse score regression
- [ ] 22. Slow query detection
- [ ] 23. Bundle size regression tracking
- [ ] 24. Index bloat check
- [ ] 25. Redis memory alerts
- [ ] 26. Worker queue depth monitoring
- [ ] 27. Periodic load testing
- [ ] 28. Accessibility + ethics audits in CI

## Tier 5 — Operational polish
- [ ] 29. Transactional email health (Resend)
- [ ] 30. Cache purge on deploy (Cloudflare)
- [ ] 31. OAuth token refresh monitoring
- [ ] 32. Rate limit budget tracking
- [ ] 33. Marketplace API deprecation alerts
- [ ] 34. DNS record change detection
- [ ] 35. WAF rule review reminders
- [ ] 36. Test baseline auto-update
- [ ] 37. PR size alerts
- [ ] 38. Commit message lint in CI
- [ ] 39. Backup retention alerting
- [ ] 40. Connection pool monitoring
- [ ] 41. Disk/volume alerts
- [ ] 42. Runbook freshness check
- [ ] 43. Log rotation
- [ ] 44. Dead letter queue processing
- [ ] 45. Web push subscription cleanup
- [ ] 46. Stripe webhook endpoint health
- [ ] 47. Wire Slack webhook to all alerts
- [ ] 48. SonarCloud quality gate alerting
- [ ] 49. Google/Outlook OAuth credential expiry

## Tier 6 — Observability pipeline
- [ ] 50. Prometheus → alerting pipeline
- [ ] 51. BetterStack log drain health
- [ ] 52. Currency exchange API health (frankfurter.app)
- [ ] 53. Marketplace bot health/success rate monitoring
- [ ] 54. Firebase SA key staleness
- [ ] 55. VAPID key rotation monitoring
- [ ] 56. Playwright bot session keepalive scheduling
- [ ] 57. BrowserStack quota monitoring
- [ ] 58. Grok/xAI separate spend monitoring
- [ ] 59. Sentry error rate trend alerting
