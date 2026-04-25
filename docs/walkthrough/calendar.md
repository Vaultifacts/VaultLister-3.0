# Calendar — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-17 | Planner | `pages.planner()` function doesn't exist — sidebar nav item is dead. Route registered but no page function defined in any source module | Session 3 | VERIFIED ✅ — 07338ae |
| #171 | Calendar | Calendar page fails to render: `ReferenceError: date is not defined` at `pages-deferred.js:7537` — stale bundle variable name. Entire Calendar feature unavailable | Session 11 | VERIFIED ✅ — 07338ae |
| #172 | Calendar | Calendar "Today" and "Week" buttons crash: `ReferenceError: date is not defined` — same stale bundle as #171 | Session 11 | VERIFIED ✅ — 07338ae |
| M-25 | Calendar | "Month" button invisible in dark mode — white text on white background | Session 3 | VERIFIED ✅ — 82a8408 |
| M-37 | Calendar (dark) | "Month" view button invisible — white text on white bg in active state in dark mode | Session 4 | VERIFIED ✅ — 82a8408 — duplicate of M-25 |
| #146 | Calendar | Add Event modal: empty submit shows no validation — required Event Title field with no `<form>` wrapper | Session 6 | CONFIRMED N/A — already validated in handlers-tools-tasks.js:2277-2280 |
| #181 | Planner / Sidebar | Sidebar label "Planner" doesn't match page H2 title "Daily Checklist" | Session 13 | VERIFIED ✅ — 0c852be — components.js + widgets.js: nav label changed to "Daily Checklist" |
| MANUAL-cal-1 | Calendar | What is the status of our Google Calendar & Outlook Calendar integrations? (image-91) | Backlog | ANSWERED ✅ — Google Calendar sync fully implemented in src/backend/routes/calendar.js with OAuth flow; currently disabled via feature flag integration.googleCalendarSync (enabled:false, rolloutPercentage:0 in featureFlags.js:44). Enable by setting flag to true and providing GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. Outlook Calendar not implemented. |

## Extended QA Session Findings (Calendar Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| "Today" button navigates to the wrong date (off-by-one timezone bug) — selects April 9 instead of April 10 due to UTC parsing of date-only ISO string | VERIFIED ✅ — 9cdc28b — parseLocalDate() fixes UTC off-by-one in negative-offset timezones |
| "Add Event" toolbar button pre-fills the wrong default date (April 9 instead of April 10) | VERIFIED ✅ — 9cdc28b — Add Event pre-fills correct local date |
| "Schedule Live Show" modal pre-fills the wrong default date | VERIFIED ✅ — 9cdc28b — Schedule Live Show pre-fills correct local date |
| Day view shows the wrong date — "Thursday, April 9, 2026" instead of Friday, April 10 | VERIFIED ✅ — 9cdc28b — Day view now shows correct local date |
| Week view title is wrong and Saturday wraps to a second row (layout break) | VERIFIED ✅ — 9cdc28b — week view title shows date range; weekday:short prevents Saturday wrapping |
| Right sidebar "selected day" panel does not update when navigating months | VERIFIED ✅ — 9cdc28b — navigateCalendarMonth sets selectedCalendarDate to first of new month |
| Sync Settings modal exposes raw environment variable names to users — "Calendar OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env" | VERIFIED ✅ — 9cdc28b — Sync Settings shows user-friendly messaging |
| "Restocks" legend dot is missing its color — renders as invisible/transparent | VERIFIED ✅ — e68a2eb — .calendar-legend-dot.restocks uses var(--warning) (#f59e0b amber) |
| "Schedule Live Show" is hard-coded to Whatnot only but button says "Schedule Live Show" | VERIFIED ✅ — 9cdc28b — button renamed to "Whatnot Live" to match modal title |
| "This Week" strip does not update when navigating months | VERIFIED ✅ — 9cdc28b — This Week label now includes actual date range |
| Mini calendar "today" indicator conflicts with selected date styling — two different visual states one day apart | VERIFIED ✅ — 9cdc28b — conflict resolved after UTC date fix |
| Right panel event count display is split across two lines | VERIFIED ✅ — 9cdc28b — calendarTimeline uses weekday:short to prevent wrapping |
| Active view button styling is subtle and easy to miss — no background color change, no bold text | VERIFIED ✅ — 9cdc28b — active view button now has visible border |
