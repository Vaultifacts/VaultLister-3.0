# Community — Walkthrough Findings

## Open Items

None — all Community findings have been resolved.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|

## Extended QA Session Findings (Community Tab)

### Resolved

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
