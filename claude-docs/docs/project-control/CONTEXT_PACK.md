# CONTEXT PACK (Targeted)

Goal: minimize token waste by loading only what is needed.

## Always-load (every session)
- claude-docs/PROJECT_BRAIN.md
- claude-docs/docs/project-control/STATE_SNAPSHOT.md
- claude-docs/docs/project-control/PROJECT_ROADMAP.md
- claude-docs/docs/project-control/COMPLETION_GATES.md
- claude-docs/docs/project-control/PROGRESS_ACCOUNTING.md
- claude-docs/CLAUDE.md

## Load only if task touches backend
- claude-docs/docs/reference/backend.md
- claude-docs/docs/reference/database.md
- claude-docs/docs/reference/security.md

## Load only if task touches frontend
- claude-docs/docs/reference/frontend.md
- claude-docs/docs/reference/testing.md

## Load only if task touches deployments
- Dockerfile / docker-compose (if present)
- CI workflow files (if present)

## Three-file sync rule
Any frontend change must be applied consistently to:
1) chunk file(s) under src/frontend/handlers or src/frontend/pages
2) src/frontend/handlers/handlers-deferred.js + src/frontend/pages/pages-deferred.js
3) src/frontend/app.js

If unsure, search for the handler/page name in all three.