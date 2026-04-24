# Transactions -- Walkthrough Findings

## Open Items

None.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| #142 | Add Transaction | Empty submit shows no validation error -- required fields but no form element; state-controlled form bypasses HTML5 validation | Session 6 | VERIFIED -- toast.error "Please fill in all required fields." confirmed (2026-04-07) |
| #143 | Add Transaction | Modal HTML bleeds into page body -- raw HTML attribute text renders visibly below modal | Session 6 | VERIFIED -- 192b485 |
| M-17 | Transactions | "$0 / $999" filter defaults shown in USD | Session 2 | VERIFIED -- efe7ab1 -- filter shows C$0 / C$999 |
| M-18 | Transactions | "All Categorie" dropdown text truncated -- missing 's' | Session 2 | CONFIRMED N/A -- already reads "All Categories" in source |
| M-31 | Transactions | "All Categorie" truncated dropdown text -- missing 's' (duplicate of M-18) | Session 3 | CONFIRMED N/A -- already reads "All Categories" in source |
| M-32 | Transactions | "$0 / $999" filter in USD not CAD (duplicate of M-17) | Session 3 | VERIFIED -- efe7ab1 -- same fix as M-17 |
