---
name: design-sync
description: Sync current session with VaultLister 3.0 design docs — read key design files and surface any drift
trigger: /design-sync
---

# /design-sync — VaultLister 3.0 Design Sync

Run at the start of any session where design context may be stale.

## Steps

1. **Read INDEX.md** — confirm canonical entity names and file list
   File: `design/INDEX.md`

2. **Read Executive Summary** — confirm core mission and target personas
   File: `design/00-Executive-Summary.md`

3. **Read Feature Specs** — confirm MVP feature scope and acceptance criteria
   File: `design/03-Feature-Specs.md`

4. **Read Data Model** — confirm entity relationships and data flows
   File: `design/05-Data-Model-and-Flows.md`

5. **Read Architecture** — confirm ADRs and technology decisions
   File: `design/08-Technical-Architecture.md`

6. **Surface any drift** — if code diverges from design, note the specific file + line + design expectation

## Output Format
- One-line summary per design file read
- Flag any drift: "⚠️ DRIFT: [file] — [what's different]"
- No auto-fixes — surface for user review only
