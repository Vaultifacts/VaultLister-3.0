# Reports -- Walkthrough Findings

## Open Items

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-rep-1 | Reports | Please move all of these reports to the Reports page (image-13) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Extended QA Session Findings (Reports Tab)

### Resolved

| Finding | Status |
|---------|--------|
| New Report button crashes on click -- TypeError | VERIFIED -- 23281bf -- buttons now call showCreateReportForm(); crash eliminated |
| Report Templates are stub-only -- no actual report creation occurs | VERIFIED -- 23281bf -- API response parsing fixed; createReportFromTemplate uses loadReportsData() |
| New Report and Create Report are inconsistent button labels | VERIFIED -- 23281bf -- empty state button label changed to New Report |
| Heading hierarchy skips a level | VERIFIED -- 23281bf -- H3 changed to H2 in empty state |
| Browser tab title not updated | VERIFIED -- 23281bf -- router now sets document.title on every navigation |
| No visual indicator that the template modal is reachable | VERIFIED -- 23281bf -- empty state description updated to mention templates |
| Report Templates modal provides no way to start with a blank/custom report | VERIFIED -- 23281bf -- Blank Report card added at bottom of template modal |
