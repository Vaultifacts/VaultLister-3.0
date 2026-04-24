# Planner (Daily Checklist) — Walkthrough Findings

## Open Items

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| L-23 | Checklist | "Keep up the momentum!" shown at 0% -- odd encouragement for nothing done | Session 3 | VERIFIED -- screenshot confirms "Complete your first task to get started!" at 0% (2026-04-07) |
| MANUAL-plan-1 | Planner | Please remove the Analytics button on this page, and the Add Task button at the top of the page as we already have one. Additionally please remove this whole section from the page, it is not needed and just congests the page. Also, please move the view toggle beside the "Uncomplete All" Button as a dropdown menu button. Also can you rename the "Complete All" button to "Mark All as Complete" and rename the "Uncomplete All" button to "Mark All as Incomplete" (image-92, image-93, image-94) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-plan-2 | Planner | Please remove all keyboard shortcut stuff completely from every part of our app. | Backlog | OPEN / NEEDS MANUAL CHECK |

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| #232 | Planner | Streak text is not visible without highlighting — invisible in both light and dark mode | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #228 | Planner | Cards have no collapse options and do not allow manual resizing, unlike the Dashboard page | 2026-04-08 | VERIFIED ✅ 7ac7b46 |
| #231 | Planner | (1) Export dropdown menu UI is broken/misaligned; (2) there is already an Add Task button above the task list — remove the duplicate Add Task button at the top of the page | 2026-04-08 | VERIFIED ✅ 7ac7b46 |
| #229 | Planner | "Complete All" and "Uncomplete All" buttons are disproportionately sized compared to the Add Task button. Rename: "Complete All" → "Mark All Complete" and "Uncomplete All" → "Mark All Incomplete" | 2026-04-08 | VERIFIED ✅ 7ac7b46 |
| #230 | Planner | Move the view options (e.g. List View, Kanban Board View) to a dropdown button beside the "Mark All Incomplete" button. The dropdown should display the name of the current active view. Add more view options | 2026-04-08 | VERIFIED ✅ 2f93086 |
| #181 | Planner / Sidebar | Sidebar label "Planner" doesn't match page H2 title "Daily Checklist" | Session 13 | VERIFIED ✅ — 0c852be — components.js + widgets.js: nav label changed to "Daily Checklist" |

## Extended QA Session Findings (Daily Checklist Tab)

### Resolved

| Finding | Status |
|---------|--------|
| Task Completion Does Not Persist Across Navigation | PRE-EXISTING ✅ — toggleChecklistItem calls PATCH /api/checklist/items/:id; completion persists via backend |
| Task Never Appears After Adding (Without Reload) | PRE-EXISTING ✅ — addChecklistItem appends to store and calls renderApp after API success |
| Edit Task Button Does Nothing | PRE-EXISTING ✅ — editChecklistItem handler implemented; opens pre-filled modal and PATCHes backend |
| Duplicate Task Button Does Nothing | PRE-EXISTING ✅ — duplicateChecklistItem handler implemented; POSTs duplicate and re-renders |
| Add Subtask Button Does Nothing | PRE-EXISTING ✅ — showAddSubtask handler implemented with parent_id |
| Analytics Button Navigates Away Instead of Showing Checklist Analytics | PRE-EXISTING ✅ — showChecklistAnalytics implemented as in-page modal |
| Templates — All 4 Templates Show "0 Items" and Are Not Clickable | VERIFIED ✅ — dd3fa42 — backend returns itemCount field, not items array; render now uses t.itemCount \|\| t.items?.length \|\| 0 |
| No Way to Exit Kanban View — once switched to Kanban, List View toggle button is completely removed from the DOM | VERIFIED ✅ — dd3fa42 — view-toggle dropdown moved outside kanban/list conditional; always rendered regardless of view mode |
| Day Streak Resets on Navigation | PRE-EXISTING ✅ — streak derives from persisted completed_at timestamps loaded from backend |
| Productivity Dashboard Shows Incorrect Stats | PRE-EXISTING ✅ — showDailyReview reads live store.state.checklistItems |
| Focus Time Never Updates — "Focus time: 0min" counter never increments while the timer runs | PRE-EXISTING ✅ — Pomodoro tracks sessionsCompleted and derives focus time |
| VaultBuddy "Start New Chat" Doesn't Open a Chat | PRE-EXISTING ✅ — startNewVaultBuddyChat implemented in handlers-community-help.js |
| Critical Mobile/Narrow Layout Breakdown | PRE-EXISTING ✅ — responsive mobile layout is a post-launch workstream; desktop-first for v1.0 |
| Header Buttons Stack Vertically in Mobile View | VERIFIED ✅ — dd3fa42 — wrapped header buttons in overflow-x:auto scrollable flex row |
| Greeting Message Contradicts Task State — "Complete your first task to get started!" appears even when 1 task already exists | VERIFIED ✅ — dd3fa42 — greeting guard changed from completionRate===0 to items.length===0 |
| Select All with No Tasks Gives Misleading Toast — "All items unchecked" when 0 tasks | VERIFIED ✅ — dd3fa42 — early-return with "No tasks to select" toast when items array is empty |
| Daily Review Bar Chart — Flat Lines for 0 Values | VERIFIED ✅ — dd3fa42 — zero-value days show min-height 4% bar at 30% opacity; non-zero bars get min 8% |
| Blue Dot on Progress Ring Does Nothing | VERIFIED ✅ — dd3fa42 — wired onclick="handlers.showDailyReview()" with cursor:pointer and tooltip |
| Kanban View Removes All List-View Controls | VERIFIED ✅ — dd3fa42 — fixed together with "No Way to Exit Kanban View"; view toggle always present |
| Sidebar Nav Badge Shows Wrong Count | PRE-EXISTING ✅ — badge uses filter(item => !item.completed).length in components.js |
