# Security Policy

## Supported Versions

Only the latest release on the `master` branch receives security fixes.
Older versions are not supported.

| Version | Supported |
|---------|-----------|
| latest (master) | Yes |
| older releases | No |

## Responsible Disclosure Policy

VaultLister follows coordinated disclosure. Please do not open public GitHub
issues for security vulnerabilities. Report privately so a fix can be prepared
before details are made public.

## Reporting a Vulnerability

Email: **security@vaultlister.com**

Include in your report:
- A clear description of the vulnerability
- Steps to reproduce
- Affected component (backend route, auth flow, Playwright automation, etc.)
- Potential impact (data exposure, privilege escalation, RCE, etc.)
- Any proof-of-concept code or screenshots (attach, do not paste credentials)

PGP encryption is not required but is welcomed. If you need a PGP key,
request one in your initial email.

## What Qualifies as a Security Issue

- Authentication bypass or privilege escalation
- SQL injection or unsafe query construction
- Cross-site scripting (XSS) in the Vanilla JS SPA
- CSRF protection bypass
- JWT token forgery or secret leakage
- Sensitive data exposure via API responses
- Path traversal in file upload or static-asset handling
- Playwright automation abuse (credential theft, marketplace account takeover)
- Remote code execution via any vector
- Supply chain issues in Docker image or GitHub Actions workflows

Out of scope: UI bugs without a security impact, rate-limiting tuning
requests, and features requests.

## Response Timeline

| Milestone | Target |
|-----------|--------|
| Initial acknowledgment | 48 hours |
| Triage and severity assessment | 5 business days |
| Patch for critical issues | 14 days |
| Patch for high/medium issues | 30 days |
| Public disclosure (coordinated) | After patch is released |

We will credit researchers who report valid vulnerabilities in the release
notes, unless they prefer to remain anonymous.
