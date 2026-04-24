# Automations — Walkthrough Findings

## Open Items

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-auto-1 | Automations | Please remove all of this from the Automations page (image-102) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-auto-2 | Automations | Proper platform Icons are not being used. Platform Names are not including (CA) at the end of them. (image-59) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| H-7 | Automations | "Est. at $30/hr" rate hardcoded — should be C$ and user-configurable | Session 1 | VERIFIED ✅ — eb9e086 |
| H-13 | Automations | "83% Success Rate" stale data — shows test run data from development | Session 1 | VERIFIED ✅ — 2026-04-22 live `/api/automations/stats` + `/api/automations/history` returned zero runs for demo user; stale dev automation data not present |
| #154 | Automations | Export button fires 4+ simultaneous "Export failed" error toasts — no CSV/JSON produced | Session 7 | VERIFIED ✅ — e097efa |
| #165 | Automations | "Calendar" toolbar button calls `handlers.showScheduleCalendar()` — no modal opens, no output | Session 10 | CONFIRMED N/A — function is implemented; shows toast when no rules, opens schedule calendar modal when rules exist |
| #166 | Automations | "Performance" toolbar button calls `handlers.showAutomationPerformance()` — no modal opens, no output | Session 10 | CONFIRMED N/A — function is implemented; shows toast when no rules, opens performance modal when rules exist |
| #216 | Automations | No available automations for users to choose from — automations list is empty. Automations shown should only be ones feasibly executable by the platform | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #211 | Automations | Remove the following options from the Automations page: Create Custom Automation, Templates, Export, Import, URL rules, and CSV rules. Platform should offer pre-built automations only | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #212 | Automations | Automation cards display with large gaps between them — should display compactly with only small padding between cards, no large unused whitespace | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #213 | Automations | (1) No option to manually resize cards as available on the Dashboard; (2) no Customize option to choose which cards to show; (3) collapse buttons missing on some cards; (4) cards that do have collapse buttons are showing the arrow horizontally instead of vertically | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #214 | Automations | Many duplicated metrics across cards — e.g. Success Rate appears multiple times. The "System Active" card should function as the main status, statistics, and informational hub for the page; duplicate information from other cards should be removed | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #215 | Automations | (1) "Desktop notifications" label is missing a computer icon between it and the checkbox; (2) no quick action option to "Enable All" notifications | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
