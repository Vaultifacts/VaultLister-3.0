# Changelog

## 1.0.1 (2026-04-29)


### Bug Fixes

* **a11y:** BS-1 fix public-site color contrast tokens ([27023ff](https://github.com/Vaultifacts/VaultLister-3.0/commit/27023fff5ebdb0a06598c58d9f288a7404851e0b))
* **ci:** check SKIPPED status inside loop to fix timing race in Item 8 ([40ecaa8](https://github.com/Vaultifacts/VaultLister-3.0/commit/40ecaa83ade2439470cab18ab5161a1906cbb3cb))
* **public:** correct cookie-policy.html link to cookies.html in footer ([87fa5eb](https://github.com/Vaultifacts/VaultLister-3.0/commit/87fa5eb32995afd941fd258b5e1f51deddf9a372))
* **security:** add user_id guard to warehouse_bins UPDATE (qrAnalytics.js) ([2a90214](https://github.com/Vaultifacts/VaultLister-3.0/commit/2a90214661dbc5fbdd34759356aef549d3a24a5d))
* **security:** remove open-redirect in billing routes — ignore user-supplied redirect URLs ([8244270](https://github.com/Vaultifacts/VaultLister-3.0/commit/8244270a0b92c93fe7ba40967015152cecf5a9f1))
* **security:** remove open-redirect in billing routes — ignore user-supplied redirect URLs ([359bad8](https://github.com/Vaultifacts/VaultLister-3.0/commit/359bad8d114879b73301be886996c1e627dd0125))

## 1.0.0 (2026-04-23)


### Features

* add progress field to roadmap_features + PATCH route for admin updates ([3ec5015](https://github.com/Vaultifacts/VaultLister-3.0/commit/3ec50154ec1bad0f2d0a49b86a2ab6a0e4427955))
* **chatbot:** add api.stream() SSE reader method + parsing tests ([20326ef](https://github.com/Vaultifacts/VaultLister-3.0/commit/20326ef840145a54b8b10b5e1221e40bcac731cd))
* **chatbot:** update full-page VaultBuddy UI to use SSE streaming ([cc5cf2a](https://github.com/Vaultifacts/VaultLister-3.0/commit/cc5cf2ac4046b5fc0831a3f85fa00557b28d13e4))
* **nav:** add Feedback & Support dropdown to all 46 public pages ([80f8269](https://github.com/Vaultifacts/VaultLister-3.0/commit/80f8269f3da6f0fc5993530f8bb2189a734958b4))
* **pricing:** currency selector now converts prices with FX rates ([38eaa29](https://github.com/Vaultifacts/VaultLister-3.0/commit/38eaa29a5000246cd20c3977ddd57cc0a2bb4f39))
* **public:** add documentation page with tabs, redesign features section ([39d01c8](https://github.com/Vaultifacts/VaultLister-3.0/commit/39d01c8a236fde1f1b5ada6ff0e620c6a7d9be97))
* **public:** consistent footers across all pages, add language selector dropdown ([6653b28](https://github.com/Vaultifacts/VaultLister-3.0/commit/6653b28c679c8347519b05dd63c951abd6210361))
* **public:** recreate platforms page, add 6 public pages, fix footer links ([1996c10](https://github.com/Vaultifacts/VaultLister-3.0/commit/1996c10ac27e2ccff6c405eed7c399793d1ffea6))


### Bug Fixes

* **certification:** clear smoke and public e2e blockers ([59c6818](https://github.com/Vaultifacts/VaultLister-3.0/commit/59c6818d0522f18263823be2d6d5c17ada5ba84d))
* **chatbot:** address streaming quality issues ([2c55a68](https://github.com/Vaultifacts/VaultLister-3.0/commit/2c55a686a5fbe43d251a33a83c93a381254f4e38))
* **chatbot:** harden chatWidget streaming against concurrency and detached DOM ([0bc38be](https://github.com/Vaultifacts/VaultLister-3.0/commit/0bc38be971bb2d849791f5fd2d00f98ed183d085))
* **chatbot:** use extractQuickActions in streamResponse mock path ([4ebd700](https://github.com/Vaultifacts/VaultLister-3.0/commit/4ebd700f1f3adfa2e7e92eaf4fa59b41d1b18695))
* **chatbot:** yield error event on stream failure; fix Grok reader leak ([0bf4766](https://github.com/Vaultifacts/VaultLister-3.0/commit/0bf47663ca5e43e246d1b23dc6b7448bcd0f1b8d))
* **ci:** normalize timed KNOWN_FAIL baseline entries ([378d7e7](https://github.com/Vaultifacts/VaultLister-3.0/commit/378d7e7541199da202825fe5c8309b973cc2b81c))
* **ci:** use valid smoke oauth key ([20cb561](https://github.com/Vaultifacts/VaultLister-3.0/commit/20cb561c92873327aff9b0e0040f121eb3db491f))
* **connections:** load live connection state ([be9ca46](https://github.com/Vaultifacts/VaultLister-3.0/commit/be9ca46abdf8f879d6d8299bb986a914957c4b9a))
* **connections:** preload route data on navigation ([c640309](https://github.com/Vaultifacts/VaultLister-3.0/commit/c640309569096f30839e12ba3009c5b70f4e3b6b))
* CSRF session binding strips IP prefix for load-balanced deployments ([d8d62ed](https://github.com/Vaultifacts/VaultLister-3.0/commit/d8d62ed2aa373a843da1eea3089280a659eff08c))
* **nav:** rename 'Product Updates' to 'Status \& Updates' on status.html ([d5bdb3f](https://github.com/Vaultifacts/VaultLister-3.0/commit/d5bdb3f7fb346dc296e47388473e39e5552316dc))
* **public:** social URLs, marketplace icons, Media Kit footer link ([c6cf159](https://github.com/Vaultifacts/VaultLister-3.0/commit/c6cf1594f9e5682a9888fc5ad91091067f6eb09e))
* **public:** update comparison pages with verified competitor pricing and features ([13fb588](https://github.com/Vaultifacts/VaultLister-3.0/commit/13fb588bdbcaf47b312547c84cf1c178f03f3584))
* **tests:** mock database.js in chatbot-streaming tests to prevent DB connect timeout ([7047e14](https://github.com/Vaultifacts/VaultLister-3.0/commit/7047e140cbc1c12a33255d580d164cb139f735dd))
* wire applyAffiliate() handler to POST /api/affiliate/apply ([d09f035](https://github.com/Vaultifacts/VaultLister-3.0/commit/d09f03588b074cafefc079cb34ff0f3bc7f44ca7))
* **worker:** make bun executable by non-root user in Docker ([a120c62](https://github.com/Vaultifacts/VaultLister-3.0/commit/a120c6225e36832b3683424960bd12000019ad49))
