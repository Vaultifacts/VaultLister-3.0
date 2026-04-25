# Community — Walkthrough Findings

## Open (Needs Fix)

None — all Community findings have been resolved.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| #123 | Community | `modals.viewPost()` crashes: "Cannot read properties of undefined (reading 'find')" | Session 5 | VERIFIED -- 192b485 |
| #145 | Community | Create Post modal: empty submit shows no validation -- required Title/Content fields with no form wrapper | Session 6 | VERIFIED -- empty submit fires toast "Please fill in the title and content." (2026-04-07) |

## Extended QA Session Findings (Community Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Page does not re-render after any state change — tabs and post creation are both broken | VERIFIED ✅ — 880f698 — setCommunityTab() + submitCreatePost() now call renderApp(window.pages.community()) |
| Clicking a post card opens no detail view — handlers.viewPost() is a no-op | VERIFIED ✅ — 880f698 — viewPost() now shows detail modal with title/author/type/content |
| Post author displays as "Unknown" instead of the logged-in user's name | VERIFIED ✅ — 880f698 — author reads post.author_name first, then post.author, then email prefix |
| Post content body does not appear in the post card preview | VERIFIED ✅ — 880f698 — preview reads post.content \|\| post.body (150 char truncation) |
| All form labels in the Create Post modal are disconnected from their inputs | VERIFIED ✅ — 880f698 — all 7 labels get for attributes; inputs get matching id attributes |
| Modal close button has type="submit" instead of type="button" | VERIFIED ✅ — 880f698 — type="button" added to close button |
| Heading hierarchy is inconsistent across tabs | VERIFIED ✅ — 880f698 — post title headings H3 → H2 in Discussion/Success/Tips tabs |
| Empty-state text "No posts yet" is marked as H3 | VERIFIED ✅ — 880f698 — H3 → `<p class="font-semibold text-gray-500">` |
| No validation error messages when submitting empty required fields | VERIFIED ✅ — 880f698 — separate toast.error for empty title vs content |
| Tabs missing aria-controls association | VERIFIED ✅ — 880f698 — aria-controls added to tabs; panel gets id + role=tabpanel |
| Browser tab title does not update | VERIFIED ✅ — already fixed — community is in PAGE_TITLES in router |
