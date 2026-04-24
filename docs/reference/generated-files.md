# Generated and Build-Coupled Files — VaultLister 3.0

> Reference for every file that is auto-generated or whose version strings are auto-managed by the
> build pipeline. Editing these files by hand will either be overwritten on the next build or will
> break cache-busting across the browser stack.

---

## Quick Reference Table

| Path | Source of Truth | Generator Script | Safe Edit Rule | Verification Command |
|---|---|---|---|---|
| `src/frontend/core-bundle.js` | 12 source modules in `src/frontend/core/`, `src/frontend/ui/`, `src/frontend/pages/pages-core.js`, `src/frontend/handlers/handlers-core.js`, `src/frontend/init.js` (in exact load order declared in `build-dev-bundle.js`) | `scripts/build-dev-bundle.js` | Never edit directly — any change is overwritten on the next `bun run dev:bundle` | `bun run dev:bundle` completes without error; `wc -c src/frontend/core-bundle.js` reflects new size |
| `dist/core-bundle.js` and route chunk files (`dist/chunk-inventory.js`, `dist/chunk-sales-orders.js`, etc.) | Same 12 core source modules (Phase 1) + per-chunk source pairs in `src/frontend/pages/` and `src/frontend/handlers/` listed under `chunkDefs` in `build-frontend.js` | `scripts/build-frontend.js` | Never edit anything in `dist/` — the entire directory is rebuilt and overwritten on every production build | `bun run build` completes without error; verify `dist/` contains expected chunk files |
| `src/frontend/index.html` — `?v=` query strings on asset URLs only | The `?v=` hash values are generated from `build-dev-bundle.js`; the HTML structure itself is editable source | `scripts/build-dev-bundle.js` (auto-patches all `?v=[a-f0-9]+` occurrences) | Edit HTML structure and content freely. Never manually change a `?v=XXXXXXXX` value — the script overwrites it based on a content hash of all JS and CSS source files | After any frontend source edit run `bun run dev:bundle` and confirm the `?v=` strings in `index.html` match the printed `bundle version:` in console output |
| `public/sw.js` — `?v=` query strings in `PRECACHE_URLS` only | The `?v=` hash values in `PRECACHE_URLS` are auto-synced; the service worker logic (`CACHE_VERSION`, `API_TTL_MAP`, fetch strategies, etc.) is editable source | `scripts/build-dev-bundle.js` (auto-patches all `?v=[a-f0-9]+` occurrences in the file) | Edit service worker logic freely. Never manually change a `?v=XXXXXXXX` value inside `PRECACHE_URLS` — the script overwrites it | After any frontend source edit run `bun run dev:bundle` and confirm `?v=` strings in `public/sw.js` match the printed `bundle version:` |
| `src/frontend/styles/main.css` — `?v=` query strings on `@import` lines only | The `?v=` hash values on each `@import` are auto-synced; the import list itself is editable source | `scripts/build-dev-bundle.js` (auto-patches all `?v=[a-f0-9]+` occurrences in the file) | Add or remove `@import` lines freely. Never manually change a `?v=XXXXXXXX` value — the script overwrites it | After any CSS or JS source edit run `bun run dev:bundle` and confirm `?v=` strings in `main.css` match the printed `bundle version:` |

---

## Explanations

### 1. What `?v=XXXXXXXX` hash strings are and why they must never be manually updated

`?v=XXXXXXXX` is a cache-bust query parameter appended to every static asset URL loaded by the
browser, the service worker, and the CSS import chain. The 8-character hex value is a SHA-256
content hash computed over the concatenated content of all 12 core JS source files, all route-chunk
source files, and all CSS source files. The hash is computed fresh each time `build-dev-bundle.js`
runs.

The same hash value is written atomically to four places in one pass:

- `src/frontend/core-bundle.js` (injected into `router.js const v` inside the concatenated bundle)
- `src/frontend/index.html` (all `?v=` occurrences on `<script>` and `<link>` tags)
- `public/sw.js` (all `?v=` occurrences inside `PRECACHE_URLS`)
- `src/frontend/styles/main.css` (all `?v=` occurrences on `@import` lines)

Because all four files always carry the same hash, the browser, the service worker's pre-cache, and
the CSS loader all agree on which version of every asset to fetch. If you manually change a `?v=`
value in any one file, it diverges from the others, causing the service worker to pre-cache a URL
that no longer matches what `index.html` requests, or causing the browser to serve a stale cached
bundle while the service worker fetches a different version. The safest rule: treat every
`?v=XXXXXXXX` value as machine-written. Run the build script — never type the hash.

### 2. Which build command to run after any frontend source change

After editing any file under `src/frontend/` or any CSS file under `src/frontend/styles/`:

```bash
bun run dev:bundle
```

This runs `scripts/build-dev-bundle.js`, which:

1. Reads all 12 core source files and all route-chunk and CSS source files.
2. Computes a fresh SHA-256 content hash.
3. Concatenates the 12 core files (with the version injected into the `router.js` segment) and
   writes `src/frontend/core-bundle.js`.
4. Patches the `?v=` strings in `index.html`, `public/sw.js`, and `main.css` to the new hash.

For a production build (minified, chunked `dist/` output) run `bun run build` instead, which calls
`scripts/build-frontend.js`. The same content-hash logic applies; `dist/` files are fully
regenerated.

### 3. Why editing `core-bundle.js` directly will be overwritten on the next build

`src/frontend/core-bundle.js` is assembled by concatenating the 12 Phase 1 source modules in the
load order declared in `build-dev-bundle.js`. Each time `bun run dev:bundle` runs, the script calls
`writeFileSync` on `src/frontend/core-bundle.js`, replacing the entire file unconditionally. There
is no merge step. Any manual edit made directly to `core-bundle.js` — a bug fix, a console.log, a
variable rename — will be silently discarded the next time any developer (or CI) runs the build
script. The source modules in `src/frontend/core/`, `src/frontend/ui/`, etc. are the only durable
editing surface. Make the change there, then rebuild.

### 4. The pre-commit consistency manifest check that auto-stages hash updates

`build-dev-bundle.js` auto-patches `index.html`, `public/sw.js`, and `main.css` as part of the
same run that produces `core-bundle.js`. Because all four files are written in one script
invocation, they are always consistent after a successful build. The Husky pre-commit hook (``.husky/pre-commit``) therefore requires that these four files are staged together whenever any of
them changes — a partial commit (e.g., staging `core-bundle.js` without staging the updated
`index.html`) will fail the consistency check. The correct workflow before every commit that touches
frontend source:

```bash
bun run dev:bundle
git add src/frontend/core-bundle.js src/frontend/index.html public/sw.js src/frontend/styles/main.css
# then add your actual source file changes
git add src/frontend/core/your-changed-file.js
git commit -m "feat: ..."
```

The pre-commit hook verifies that the `?v=` strings across all four auto-patched files are
identical. If they are not, the commit is rejected with an explanation of which file is out of sync.

---

## Source Module Load Order (Phase 1 — core-bundle.js)

The 12 files concatenated into `core-bundle.js`, in mandatory order:

1. `src/frontend/core/utils.js`
2. `src/frontend/core/store.js`
3. `src/frontend/core/api.js`
4. `src/frontend/core/toast.js`
5. `src/frontend/ui/widgets.js`
6. `src/frontend/core/router.js`
7. `src/frontend/ui/components.js`
8. `src/frontend/pages/pages-core.js`
9. `src/frontend/core/auth.js`
10. `src/frontend/ui/modals.js`
11. `src/frontend/handlers/handlers-core.js`
12. `src/frontend/init.js`

Order is declared in `scripts/build-dev-bundle.js` (`sourceFiles` array) and must match the
`<script>` tag order in `src/frontend/index.html`.

---

## Route Chunk Definitions (Phase 2 — dist/ only)

Route chunks are built only by `scripts/build-frontend.js` (production build). Each chunk is a pair
of a pages file and a handlers file:

| Chunk name | Pages source | Handlers source |
|---|---|---|
| `inventory` | `pages-inventory-catalog.js` | `handlers-inventory-catalog.js` |
| `sales-orders` | `pages-sales-orders.js` | `handlers-sales-orders.js` |
| `tools-tasks` | `pages-tools-tasks.js` | `handlers-tools-tasks.js` |
| `intelligence` | `pages-intelligence.js` | `handlers-intelligence.js` |
| `settings-account` | `pages-settings-account.js` | `handlers-settings-account.js` |
| `community-help` | `pages-community-help.js` | `handlers-community-help.js` |
| `admin` | `pages-admin.js` | `handlers-admin.js` |
| `deferred` | `pages-deferred.js` | `handlers-deferred.js` |

All source files are under `src/frontend/pages/` and `src/frontend/handlers/`. Output lands in
`dist/chunk-{name}.js`. Never edit files in `dist/` directly.
