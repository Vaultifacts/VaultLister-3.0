# Frontend Source of Truth

This document defines which frontend files are editable source files versus generated artifacts.

## Source Files (Editable)

Primary source modules:

- `src/frontend/core/*.js`
- `src/frontend/ui/*.js`
- `src/frontend/pages/pages-core.js`
- `src/frontend/pages/pages-deferred.js`
- `src/frontend/handlers/handlers-core.js`
- `src/frontend/handlers/handlers-deferred.js`
- `src/frontend/init.js`

## Generated Files (Do Not Edit Directly)

Generated bundle:

- `src/frontend/core-bundle.js`

Generated route-group chunks:

- `src/frontend/handlers/handlers-inventory-catalog.js`
- `src/frontend/handlers/handlers-sales-orders.js`
- `src/frontend/handlers/handlers-tools-tasks.js`
- `src/frontend/handlers/handlers-intelligence.js`
- `src/frontend/handlers/handlers-settings-account.js`
- `src/frontend/handlers/handlers-community-help.js`
- `src/frontend/pages/pages-inventory-catalog.js`
- `src/frontend/pages/pages-sales-orders.js`
- `src/frontend/pages/pages-tools-tasks.js`
- `src/frontend/pages/pages-intelligence.js`
- `src/frontend/pages/pages-settings-account.js`
- `src/frontend/pages/pages-community-help.js`

## Regeneration Commands

Rebuild `core-bundle.js`:

- `bun scripts/build-dev-bundle.js`

Re-split deferred pages/handlers into route chunks:

- `bun scripts/split-deferred-chunks.js`

## Editing Rules

- Edit source files only, then regenerate artifacts.
- Do not hand-edit generated artifacts except temporary debugging with immediate regeneration.
- If generated outputs are committed, commit them only as outputs of generator scripts, not manual edits.
- Keep runtime behavior unchanged during source-of-truth cleanup work.
