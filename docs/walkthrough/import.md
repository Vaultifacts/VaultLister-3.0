# Import -- Walkthrough Findings

## Open Items

None -- all Import findings have been resolved.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Extended QA Session Findings (Import Tab)

### Resolved

| Finding | Status |
|---------|--------|
| Parse Data button does nothing with pasted CSV/TSV/JSON | VERIFIED -- d8c7002 -- startImportFromPaste() now has client-side CSV/TSV/JSON parser; advances to Step 2 |
| Label hardcoded to CSV regardless of format selection | VERIFIED -- d8c7002 -- label and placeholder now dynamic based on store.state.importFormat |
| File format order is inconsistent across UI copy | VERIFIED -- d8c7002 -- standardized to CSV, TSV, Excel (.xlsx), or JSON throughout |
| No download template / sample file available | VERIFIED -- d8c7002 -- Download Template button added; downloadImportTemplate() generates canonical CSV blob |
| Heading hierarchy skips H2 (H1 to H3) | VERIFIED -- d8c7002 -- Step 1 and Step 2 headings changed from H3 to H2 |
| Browser tab title does not update | VERIFIED -- d8c7002 -- import route added to PAGE_TITLES in router |
| Drop zone lacks keyboard accessibility and ARIA roles | VERIFIED -- d8c7002 -- role, tabindex, aria-label, onkeydown added to drop zone div |
| Tabs missing aria-controls association | VERIFIED -- d8c7002 -- aria-controls added to tabs; panel gets id + role=tabpanel |
| Browse Files button has no type attribute | VERIFIED -- d8c7002 -- type=button added |
| Format select has no visible label | VERIFIED -- d8c7002 -- visible label + aria-label added; onchange wired to re-render |
| Manage breadcrumb navigates to Analytics instead of a relevant parent | CONFIRMED N/A -- breadcrumb not present in current codebase |
| Step 1 label implies a multi-step wizard, but Steps 2/3 are not shown | CONFIRMED N/A -- Step 2 already conditionally renders when importJob is set |
