import os

base = 'docs/walkthrough'

# Each entry: filename -> list of table rows to add to first Resolved table
updates = {
    'community.md': [
        '| #123 | Community | `modals.viewPost()` crashes: "Cannot read properties of undefined (reading \'find\')" | Session 5 | VERIFIED -- 192b485 |',
        '| #145 | Community | Create Post modal: empty submit shows no validation -- required Title/Content fields with no form wrapper | Session 6 | VERIFIED -- empty submit fires toast "Please fill in the title and content." (2026-04-07) |',
    ],
    'help.md': [
        '| #125 | Support Tickets | `modals.viewTicket()` crashes: "Cannot read properties of undefined (reading \'length\')" | Session 5 | VERIFIED -- 192b485 |',
        '| #133 | Support Tickets (reportBug) | Ticket card displays "undefined" text in metadata field -- null-guard missing | Session 5 | VERIFIED -- e097efa |',
        '| #139 | Submit Feedback | Inactive feedback type buttons retain white backgrounds in dark mode | Session 5 | VERIFIED -- .btn-outline shows bg rgb(31,41,55) in dark mode (2026-04-07) |',
        '| #144 | Submit Feedback | Form fires success AND error toasts simultaneously on valid submission | Session 6 | VERIFIED -- 192b485 |',
        '| H-20 | Feedback & Suggestions | "Top Contributor -- top 10%" badge shown to user with 0 submissions | Session 3 | VERIFIED -- 01384e8 -- badge hidden when feedbackSubmitted is 0 |',
    ],
    'market-intel.md': [
        '| CO-3 | Market Intel | "Updated Just now" -- misleading when no data has been fetched | Session 1 | VERIFIED -- 00e1551 -- shows "no data yet" when marketIntelLastUpdated not set |',
        '| CR-6 | Market Intel | Hardcoded fake demand data removed -- shows empty state / N/A | Session 4 | VERIFIED -- 8247946 |',
        '| L-12 | Market Intel | "Competitor Activity -- Live Activity" with green dot suggesting live feed that does not exist | Session 1 | VERIFIED -- 00e1551 -- "Live" badge changed to "Coming Soon" |',
        '| M-10 | Market Intel | "Your items: 89" hardcoded -- should reflect actual inventory count | Session 1 | VERIFIED -- 01384e8 -- reads store.state.inventoryItems.length |',
    ],
    'auth.md': [
        '| CO-4 | Register | Password requirement checkmarks not validated live as user types | Session 2 | CONFIRMED N/A -- already wired: checkRegisterPassword fires on oninput in handlers-core.js |',
        '| L-13 | Register | No Full Name or Display Name field in registration | Session 2 | VERIFIED -- same fix as L-7 -- Full Name field confirmed in registration form |',
        '| M-15 | Register / Login | Sidebar visible on register/login page -- should be hidden for unauthenticated views | Session 2 | CONFIRMED N/A -- login/register use render() not renderApp(); sidebar not rendered |',
        '| M-23 | Auth Pages | All auth pages show gradient seam -- white strip at ~75% width | Session 2 | VERIFIED -- login page screenshot confirms gradient fills full width, no seam (2026-04-07) |',
        '| #183 | Error Handling | 401 Unauthorized does not redirect to login -- user stays on current page with silent API failures | Session 14 | VERIFIED -- api.js line 198: store.setState null + router.navigate(login) confirmed in source (2026-04-07) |',
        '| #184 | Error Handling | 429 Too Many Requests shows generic error toast with no retry guidance | Session 14 | VERIFIED -- api.js line 137: toast.warning(Too many requests. Please wait a moment.) confirmed (2026-04-07) |',
    ],
    'reports.md': [
        '| #158 | Reports | Create Report buttons silently do nothing -- no modal, no toast, no navigation | Session 8 | VERIFIED -- 07338ae |',
        '| #173 | Reports | "Create Report" button -- no response when clicked (duplicate of #158) | Session 11 | VERIFIED -- 07338ae |',
        '| M-27 | Report Builder | "Custom Query -- Run SQL queries" -- security concern if raw SQL exposed to users | Session 3 | CONFIRMED N/A -- admin-only gated (403 for non-admin), SELECT-only enforcement, table allowlist, user_id injection (reports.js:63) |',
    ],
    'image-bank.md': [
        '| M-13 | Image Bank | "5.00 GB free" -- unclear if actual R2 limit or hardcoded | Session 1 | VERIFIED -- storageLimit reads PLAN_STORAGE_GB[tier]: free=0.1GB, starter=1GB, pro=5GB, business=25GB. Live chunk-settings.js confirmed. |',
    ],
    'roadmap.md': [
        '| M-19 | Roadmap | "No features found" -- should have planned features pre-populated | Session 2 | VERIFIED -- 0544b88 -- 6 roadmap features visible on live Roadmap page |',
        '| M-29 | Roadmap | Empty roadmap -- needs planned features pre-populated (duplicate of M-19) | Session 3 | VERIFIED -- 0544b88 |',
    ],
    'transactions.md': [
        '| #142 | Add Transaction | Empty submit shows no validation error -- required fields but no form element; state-controlled form bypasses HTML5 validation | Session 6 | VERIFIED -- toast.error "Please fill in all required fields." confirmed (2026-04-07) |',
        '| #143 | Add Transaction | Modal HTML bleeds into page body -- raw HTML attribute text renders visibly below modal | Session 6 | VERIFIED -- 192b485 |',
    ],
    'connections.md': [
        '| L-18 | Connections | Gmail/Outlook/Cloudinary/Google Drive "Connect" buttons -- unclear if functional | Session 2 | CONFIRMED N/A -- connectGmail() has real OAuth popup flow. Functional pending credentials. |',
        '| L-27 | Connections (dark) | Cloudinary/Anthropic AI toggle buttons nearly invisible in dark mode | Session 3 | VERIFIED -- .rounded-lg.border shows bg rgb(17,24,39) in dark mode (2026-04-07) |',
        '| L-29 | Connections (dark) | Cloudinary/Anthropic toggles nearly invisible (duplicate of L-27) | Session 4 | VERIFIED -- same fix as L-27 |',
        '| M-21 | Connections | Chrome Extension "Install Extension" button -- destination link unclear | Session 2 | VERIFIED -- modal confirmed: "VaultLister Chrome Extension ... coming soon to the Chrome Web Store" (2026-04-07) |',
    ],
    'planner.md': [
        '| L-23 | Checklist | "Keep up the momentum!" shown at 0% -- odd encouragement for nothing done | Session 3 | VERIFIED -- screenshot confirms "Complete your first task to get started!" at 0% (2026-04-07) |',
    ],
    'my-shops.md': [
        '| #129 | Whatnot | modals.viewWhatnotEvent() -- 3 data bugs: "Invalid Date" start time, "undefined" status badge, blank event title in modal header | Session 5 | VERIFIED -- 72af65a -- modal shows "TBD" start time, "Scheduled" status, "Untitled Event" title for bad data (2026-04-07) |',
    ],
}

# Rows for source-code-audit.md new section
source_code_extra = [
    '| #131 | Confirm Dialogs | danger button invisible in light mode -- btn-danger has transparent background (--red-600 CSS variable not resolving). Affects all delete confirmations | Session 5 | VERIFIED -- aca307f -- replaced --red-600/--red-700 with --error-600/--error-700 |',
    '| #134 | Feedback Analytics | Admin badge does not inherit dark mode | Session 5 | VERIFIED -- .badge.badge-sm shows bg rgb(55,65,81) in dark mode (2026-04-07) |',
    '| #138 | Account | Text truncates in narrow card columns: "Member Since: Marc...", "Curre plan" | Session 5 | VERIFIED -- Account page screenshot shows full card text without truncation (2026-04-07) |',
    '| #147 | Global Search | Search bar in top nav non-functional -- typing produces no results, pressing Enter has no effect | Session 6 | VERIFIED -- e097efa |',
    '| #178 | Offline Page | offline.html server-redirects to / -- Service Worker offline fallback broken | Session 13 | VERIFIED -- redirect to / only inside "online" event listener, not initial load |',
    '| #180 | Router | Unknown routes while authenticated silently fall back to dashboard -- expected 404 page | Session 13 | VERIFIED -- router.js -- 404 page renders "Page Not Found" with Go to Dashboard + Go Back buttons |',
    '| H-28 | Responsive | Sidebar does not collapse on mobile viewport -- no hamburger menu visible | Session 4 | VERIFIED -- bc2c9f4 -- display:none default + show at <=1024px breakpoint added |',
    '| L-10 | Backend | Console.log statements in production -- ~10 instances in error handlers | Session 1 (Code audit) | CONFIRMED N/A -- no console.log calls in backend routes/middleware error handlers |',
    '| L-11 | Backend | Fake 555-xxxx phone numbers in supplier data -- FCC reserved range | Session 1 (Code audit) | CONFIRMED N/A -- no 555-format phone numbers found in seed files |',
    '| M-38 | Responsive | 34 mobile breakpoints in CSS but mobile bottom nav absent | Session 4 | CONFIRMED N/A -- mobileUI.renderBottomNav() already called in renderApp(); CSS gates to <=768px |',
]

# Rows for public-site.md -- needs special handling (different section structure)
public_site_rows = [
    '| CR-15 | Landing Page | Massive white space gap between hero section and feature cards -- layout broken | Session 2 | VERIFIED -- 82a8408 |',
    '| L-15 | Terms of Service | "Last updated: March 2026" -- should be April 2026 | Session 2 | VERIFIED -- 15dba34 -- public/terms.html + pages-community-help.js updated to April 2026 |',
    '| L-16 | Terms / Landing | Logo shows "M" purple circle -- should be "V" blue square (brand inconsistency) | Session 2 | CONFIRMED N/A -- source renders V with var(--primary-600) + border-radius, not M purple circle |',
    '| L-22 | Privacy / ToS | "Last updated: March 2026" -- should be April (duplicate of L-15) | Session 3 | VERIFIED -- 15dba34 -- same fix as L-15 |',
    '| M-22 | Landing | "Push listings to all 9 marketplaces" -- should say 5 at launch | Session 2 | VERIFIED -- 82a8408 -- all copy, pills, stats, pricing updated to 5 launch platforms |',
]


def add_to_resolved_table(filepath, rows):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    header = '| # | Page / Component | Issue | Session | Status |'
    separator = '|---|-----------------|-------|---------|--------|'

    if header not in content:
        print(f"WARNING: No resolved table header in {filepath}")
        return False

    pos = content.find(separator)
    if pos == -1:
        print(f"WARNING: No separator in {filepath}")
        return False

    pos_end = pos + len(separator)
    new_rows = '\n' + '\n'.join(rows)
    new_content = content[:pos_end] + new_rows + content[pos_end:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {filepath} (+{len(rows)} rows)")
    return True


# Apply standard updates
for fname, rows in updates.items():
    fpath = os.path.join(base, fname)
    add_to_resolved_table(fpath, rows)

# public-site.md: has no standard resolved table -- append a new Resolved section
pub_path = os.path.join(base, 'public-site.md')
with open(pub_path, 'r', encoding='utf-8') as f:
    pub_content = f.read()

# Find the "## Resolved / Fixed" section and insert before it
insert_before = '## Resolved / Fixed'
if insert_before in pub_content:
    new_section = '## Resolved\n\n| # | Page / Component | Issue | Session | Status |\n|---|-----------------|-------|---------|--------|\n'
    new_section += '\n'.join(public_site_rows) + '\n\n'
    pub_content = pub_content.replace(insert_before, new_section + insert_before, 1)
    with open(pub_path, 'w', encoding='utf-8') as f:
        f.write(pub_content)
    print(f"Updated public-site.md (+{len(public_site_rows)} rows in new Resolved section)")
else:
    print("WARNING: public-site.md missing expected section marker")

# source-code-audit.md: append new section
src_path = os.path.join(base, 'source-code-audit.md')
with open(src_path, 'r', encoding='utf-8') as f:
    src_content = f.read()

new_section = '\n\n## Session-Based Findings (Non-Code-Audit)\n\nBroad UI, routing, and responsive findings discovered across walkthrough sessions.\n\n### Resolved\n\n| # | Page / Component | Issue | Session | Status |\n|---|-----------------|-------|---------|--------|\n'
new_section += '\n'.join(source_code_extra)
src_content += new_section

with open(src_path, 'w', encoding='utf-8') as f:
    f.write(src_content)
print(f"Updated source-code-audit.md (+{len(source_code_extra)} rows)")

print("\nDone.")
