# UI Restructure — Manual Review Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 22 manual-review UI/UX fixes across 7 source files: sidebar restructure, settings tab merge, analytics new tabs, financials restructure, orders reorder, inventory cleanup, and light-mode badge fix.

**Architecture:** All changes are in the SPA source modules (`src/frontend/**/*.js`). Source modules are bundled into `src/frontend/core-bundle.js` via `bun run dev:bundle` — never edit core-bundle.js directly. Changes are pure frontend; no backend routes or DB migrations needed.

**Tech Stack:** Bun.js, Vanilla JS SPA (source module pattern), CSS custom properties. Build: `bun run dev:bundle`. Lint: `bun run lint`.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/frontend/ui/components.js` | Sidebar nav restructure, Focus Mode removal |
| `src/frontend/pages/pages-settings-account.js` | Settings tabs, Appearance cleanup, Most Popular badge |
| `src/frontend/core/utils.js` | SUPPORTED_PLATFORMS reorder |
| `src/frontend/pages/pages-core.js` | Analytics: 4 new tabs |
| `src/frontend/pages/pages-sales-orders.js` | Orders tab reorder + Shipping tab, Sourcing removal, Reports empty state, Financials restructure |
| `src/frontend/pages/pages-inventory-catalog.js` | Inventory tab removal, Listings Import button |
| `src/frontend/pages/pages-community-help.js` | Help page stats removal |

---

## Task 1: Sidebar + Header Restructure (`components.js`)

**Files:**
- Modify: `src/frontend/ui/components.js` (sidebar `navItems` array ~line 196, header ~line 329)

### What to change

The `navItems` array in `sidebar()` currently has this structure (lines ~196–228):
```javascript
const navItems = [
    { section: '', items: [{ id: 'dashboard', ... }]},
    { section: 'Sell', items: [
        { id: 'inventory', ... },
        { id: 'listings', ... },
        { id: 'sales', ... },
        { id: 'orders-sales', ... }
    ]},
    { section: 'Manage', items: [
        { id: 'automations', ... },
        { id: 'financials', ... },
        { id: 'analytics', ... },
        { id: 'shops', ... },
        { id: 'planner', ... },
        { id: 'image-bank', ... },
        { id: 'calendar', ... },
        { id: 'reports', ... },
        { id: 'inventory-import', label: 'Import', icon: 'inventory' },   // REMOVE
        { id: 'receipt-parser', label: 'Receipts', icon: 'file-text' },   // REMOVE
        { id: 'community', label: 'Community', icon: 'help' },             // REMOVE (move to bottom)
        { id: 'roadmap', label: 'Roadmap', icon: 'list' }                 // REMOVE (move to bottom)
    ]},
    { section: '', divider: true, items: [
        { id: 'plans-billing', ... },
        { id: 'account', ... },
        { id: 'settings', ... },
        { id: 'help-support', label: 'Help', icon: 'help' },             // RENAME to 'Get Help'
        { id: 'changelog', ... },
        ...(admin check)
    ]}
];
```

- [ ] **Step 1: Update the navItems array**

Replace the `navItems` array definition (the entire `const navItems = [...]` block) with:

```javascript
const navItems = [
    { section: '', items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    ]},
    { section: 'Sell', items: [
        { id: 'inventory', label: 'Inventory', icon: 'inventory', badge: inventoryAlerts > 0 ? inventoryAlerts : null, badgeType: 'warning' },
        { id: 'listings', label: 'Listings', icon: 'list', badge: draftListings > 0 ? draftListings : null, badgeType: 'info' },
        { id: 'sales', label: 'Sales & Purchases', icon: 'dollar' },
        { id: 'orders-sales', label: 'Offers, Orders, & Shipping', icon: 'sales', badge: unseenOrders > 0 ? unseenOrders : null, badgeType: 'primary' }
    ]},
    { section: 'Manage', items: [
        { id: 'automations', label: 'Automations', icon: 'automation' },
        { id: 'financials', label: 'Financials', icon: 'dollar' },
        { id: 'analytics', label: 'Analytics', icon: 'analytics' },
        { id: 'shops', label: 'My Shops', icon: 'shops' },
        { id: 'planner', label: 'Daily Checklist', icon: 'calendar', badge: activeChecklistItems > 0 ? activeChecklistItems : null, badgeType: 'info' },
        { id: 'image-bank', label: 'Image Bank', icon: 'image' },
        { id: 'calendar', label: 'Calendar', icon: 'calendar' },
        { id: 'reports', label: 'Reports', icon: 'list' },
    ]},
    { section: '', divider: true, items: [
        { id: 'plans-billing', label: 'Plans & Billing', icon: 'dollar' },
        { id: 'account', label: 'Account', icon: 'settings' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
        { id: 'help-support', label: 'Get Help', icon: 'help' },
        { id: 'changelog', label: 'Changelog', icon: 'list' },
        { id: 'community', label: 'Community', icon: 'help' },
        { id: 'roadmap', label: 'Roadmap', icon: 'list' },
        ...(store.state.user?.is_admin ? [{ id: 'admin-metrics', label: 'Admin', icon: 'shield' }] : [])
    ]}
];
```

- [ ] **Step 2: Add "Learn more" button after Get Help**

The sidebar renders nav items via a `.map()` template. Find the section that renders each `item` button inside the map (the `<button class="nav-item ...">` template). After the `navItems.map(section => ...)` render, the nav sections are built. To inject the "Learn more" button only after the "Get Help" item, modify the inner item map inside the `navItems.map` to detect `'help-support'` and append an extra element:

Find this pattern inside the `navItems.map(section => ...)`:
```javascript
${section.items.map(item => `
    <button class="nav-item ${currentPage === item.id ? 'active' : ''}"
            onclick="router.navigate('${item.id}')"
            ...>
        ${this.icon(item.icon)}
        <span>${item.label}</span>
        ${item.badge ? `...` : ''}
    </button>
`).join('')}
```

Replace with:
```javascript
${section.items.map(item => `
    <button class="nav-item ${currentPage === item.id ? 'active' : ''}"
            onclick="router.navigate('${item.id}')"
            title="${item.label}"
            data-testid="nav-${item.id}"
            ${currentPage === item.id ? 'aria-current="page"' : ''}>
        ${this.icon(item.icon)}
        <span>${item.label}</span>
        ${item.badge ? `<span class="nav-item-badge ${item.badgeType ? 'nav-item-badge-' + item.badgeType : ''}">${item.badge}</span>` : ''}
    </button>
    ${item.id === 'help-support' ? `
        <button class="nav-item" onclick="router.navigate('help-support')" title="Learn more about VaultLister" style="font-size:12px;opacity:0.7;padding-left:36px;">
            ${this.icon('external-link', 14)}
            <span>Learn more</span>
        </button>
    ` : ''}
`).join('')}
```

- [ ] **Step 3: Remove Focus Mode button from header**

In `header()` (line ~329), find and delete this button entirely:
```javascript
<button class="header-icon-btn" onclick="focusMode.toggle()" title="Focus Mode" aria-label="Toggle focus mode">
```
(Delete the full `<button>...</button>` element including its inner icon content.)

- [ ] **Step 4: Update breadcrumb/page label map**

Search for the `breadcrumbMap` or page label map near line ~727. Find the `'help-support'` entry and update its label to match:
```javascript
'help-support': { label: 'Get Help', section: '' },
```
Also remove stale entries for `'receipt-parser'` and `'inventory-import'` if you want, or leave them — they won't cause errors if unreachable.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/ui/components.js
git commit -m "[AUTO] feat(sidebar): restructure nav — move community/roadmap to bottom, remove receipts/import, rename Help to Get Help, add Learn more, remove Focus Mode"
```

---

## Task 2: Settings — Replace Profile→Account, Billing→Plans&Billing Tabs (`pages-settings-account.js`)

**Files:**
- Modify: `src/frontend/pages/pages-settings-account.js`

### Background

The `settings()` function (line ~723) reads `store.state.settingsTab || 'profile'` and renders a tab bar + content via `renderTabContent()`. Current tabs: `profile`, `appearance`, `notifications`, `integrations`, `tools`, `billing`, `data`. There is also a separate nav link button that calls `router.navigate('account')`.

### What to change

- [ ] **Step 1: Change default tab and tab bar — Profile → Account**

Find the line:
```javascript
const activeTab = store.state.settingsTab || 'profile';
```
Change to:
```javascript
const activeTab = store.state.settingsTab || 'account';
```

- [ ] **Step 2: Update the tab buttons in the tab bar**

Find the settings tab bar (line ~1880). It currently contains:
```javascript
<button class="settings-tab ${activeTab === 'profile' ? 'active' : ''}" onclick="handlers.setSettingsTab('profile')">
    ${components.icon('user', 16)}
    Profile
</button>
<button class="settings-tab" onclick="router.navigate('account')" style="font-size: 13px; padding-left: 36px; opacity: 0.85;">
    ${components.icon('settings', 16)} Account
</button>
```

Replace both of those buttons with a single "Account" tab:
```javascript
<button class="settings-tab ${activeTab === 'account' ? 'active' : ''}" onclick="handlers.setSettingsTab('account')">
    ${components.icon('user', 16)}
    Account
</button>
```

- [ ] **Step 3: Update Billing → Plans & Billing tab button**

Find:
```javascript
<button class="settings-tab ${activeTab === 'billing' ? 'active' : ''}" onclick="handlers.setSettingsTab('billing')">
    ${components.icon('dollar', 16)}
    Billing
</button>
```

Replace with:
```javascript
<button class="settings-tab ${activeTab === 'plans-billing' ? 'active' : ''}" onclick="handlers.setSettingsTab('plans-billing')">
    ${components.icon('dollar', 16)}
    Plans & Billing
</button>
```

- [ ] **Step 4: Add 'account' case to renderTabContent switch**

In the `renderTabContent()` switch statement, find the `case 'profile':` block. It contains avatar, username, email, password change form, etc. Replace the `case 'profile':` label with `case 'account':` and then prepend the Account page sections before the profile-specific fields, or simply render the Account page content inline.

The cleanest approach: replace `case 'profile':` with `case 'account':` and keep the existing profile content. The existing profile content (avatar, user details, password change) IS the core account content — this is sufficient for the tab. The standalone Account page also has Sessions & Security, Account Activity, etc., which are already available via the sidebar `account` link.

So the change is simply renaming the case:
```javascript
case 'account':   // was 'profile'
    return `
        <!-- Profile Avatar Section -->
        ...  // keep all existing profile tab content unchanged
    `;
```

- [ ] **Step 5: Add 'plans-billing' case to renderTabContent switch**

Find `case 'billing':` in the switch. Replace the label with `case 'plans-billing':` and keep the existing billing tab content (Plan & Billing section, Billing Information, View Full Billing link).

```javascript
case 'plans-billing':   // was 'billing'
    return `
        ...  // keep all existing billing tab content unchanged
    `;
```

- [ ] **Step 6: Remove Accent Color section from Appearance tab**

In `case 'appearance':`, find and delete the entire block:
```javascript
<div class="settings-section">
    <h4 class="settings-section-title">Accent Color</h4>
    <div class="accent-colors">
        ${['blue', 'green', 'purple', 'orange', 'pink', 'red', 'teal', 'indigo'].map(color => `
            ...
        `).join('')}
    </div>
</div>
```

- [ ] **Step 7: Remove Display (Density + Font Size) section from Appearance tab**

In `case 'appearance':`, find and delete the entire block:
```javascript
<div class="settings-section">
    <h4 class="settings-section-title">Display</h4>
    <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
            <label class="form-label">Density</label>
            <select class="form-select" onchange="themeManager.setDensity(this.value)">
                ...
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Font Size</label>
            <select class="form-select" onchange="themeManager.setFontSize(this.value)">
                ...
            </select>
        </div>
    </div>
</div>
```

- [ ] **Step 8: Commit**

```bash
git add src/frontend/pages/pages-settings-account.js
git commit -m "[AUTO] feat(settings): rename Profile→Account tab, Billing→Plans&Billing tab, remove accent/density/fontsize options"
```

---

## Task 3: Reorder SUPPORTED_PLATFORMS (`utils.js`)

**Files:**
- Modify: `src/frontend/core/utils.js` (line ~11)

Currently Shopify is last (after the three Coming Soon platforms). Need it before them.

- [ ] **Step 1: Reorder the array**

Find:
```javascript
const SUPPORTED_PLATFORMS = [
    { id: 'poshmark', name: 'Poshmark', icon: '🅿️', logoPath: '/assets/logos/poshmark/logo.png' },
    { id: 'ebay', name: 'eBay', icon: 'Ⓔ', logoPath: '/assets/logos/ebay/logo.svg' },
    { id: 'depop', name: 'Depop', icon: 'Ⓓ', logoPath: '/assets/logos/depop/logo.svg' },
    { id: 'facebook', name: 'Facebook', icon: 'Ⓕ', logoPath: '/assets/logos/facebook/logo.png' },
    { id: 'whatnot', name: 'Whatnot', icon: 'Ⓦ', logoPath: '/assets/logos/whatnot/logo.svg' },
    // Coming soon platforms
    { id: 'mercari', name: 'Mercari', icon: 'Ⓜ️', logoPath: '/assets/logos/mercari/logo.svg' },
    { id: 'grailed', name: 'Grailed', icon: 'Ⓖ', logoPath: '/assets/logos/grailed/logo.png' },
    { id: 'etsy', name: 'Etsy', icon: 'Ⓔ', logoPath: '/assets/logos/etsy/logo.svg' },
    { id: 'shopify', name: 'Shopify', icon: '🛍️', logoPath: '/assets/logos/shopify/logo.svg' },
];
```

Replace with:
```javascript
const SUPPORTED_PLATFORMS = [
    { id: 'poshmark', name: 'Poshmark', icon: '🅿️', logoPath: '/assets/logos/poshmark/logo.png' },
    { id: 'ebay', name: 'eBay', icon: 'Ⓔ', logoPath: '/assets/logos/ebay/logo.svg' },
    { id: 'depop', name: 'Depop', icon: 'Ⓓ', logoPath: '/assets/logos/depop/logo.svg' },
    { id: 'facebook', name: 'Facebook', icon: 'Ⓕ', logoPath: '/assets/logos/facebook/logo.png' },
    { id: 'whatnot', name: 'Whatnot', icon: 'Ⓦ', logoPath: '/assets/logos/whatnot/logo.svg' },
    { id: 'shopify', name: 'Shopify', icon: '🛍️', logoPath: '/assets/logos/shopify/logo.svg' },
    // Coming soon platforms
    { id: 'mercari', name: 'Mercari', icon: 'Ⓜ️', logoPath: '/assets/logos/mercari/logo.svg' },
    { id: 'grailed', name: 'Grailed', icon: 'Ⓖ', logoPath: '/assets/logos/grailed/logo.png' },
    { id: 'etsy', name: 'Etsy', icon: 'Ⓔ', logoPath: '/assets/logos/etsy/logo.svg' },
];
```

Note: `isPostLaunch` in `pages-settings-account.js` is defined as `['mercari', 'grailed', 'etsy'].includes(platform)` — Shopify is NOT in that list, so its Connect button will remain active (not "Coming Soon"). This is correct.

- [ ] **Step 2: Commit**

```bash
git add src/frontend/core/utils.js
git commit -m "[AUTO] fix(shops): move Shopify before Coming Soon platforms in display order"
```

---

## Task 4: Analytics Page — Add 4 New Tabs (`pages-core.js`)

**Files:**
- Modify: `src/frontend/pages/pages-core.js` — `analytics()` function (line ~1308)

### Background

The analytics page has a tab bar (line ~2433) with tabs: live, graphs, performance, heatmaps, predictions, reports, ratio-analysis, profitability-analysis, product-analysis, market-intel, sourcing. The render block after the tab bar uses a long ternary chain to select content.

The Financials Analytics content (Profit Margin gauge, Cash Flow Breakdown, Financial Ratios, Budget Progress) is currently in `financials()` in `pages-sales-orders.js`. It uses local variables `profitMarginGauge`, `waterfallChart`, `financialRatios`, `budgetProgress` and related data computed in that function. For the Analytics page, recreate this content using simpler computed values from store state — do NOT import the complex rendering objects from the financials function.

- [ ] **Step 1: Add Financials Analytics tab button to the tab bar**

Find the tab bar block starting with:
```javascript
${!hiddenTabs.includes('live') ? `<button class="tab ...
```

Append new tab buttons at the end of the tab bar (before the closing `</div>`):
```javascript
${!hiddenTabs.includes('financials-analytics') ? `<button class="tab ${currentTab === 'financials-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'financials-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'financials-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('financials-analytics')">Financials Analytics</button>` : ''}
${!hiddenTabs.includes('inventory-analytics') ? `<button class="tab ${currentTab === 'inventory-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'inventory-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'inventory-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('inventory-analytics')">Inventory</button>` : ''}
${!hiddenTabs.includes('sales-analytics') ? `<button class="tab ${currentTab === 'sales-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'sales-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'sales-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('sales-analytics')">Sales</button>` : ''}
${!hiddenTabs.includes('purchases-analytics') ? `<button class="tab ${currentTab === 'purchases-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'purchases-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'purchases-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('purchases-analytics')">Purchases</button>` : ''}
```

- [ ] **Step 2: Add tab content for Financials Analytics**

Define a `financialsAnalyticsTabContent` variable near the other tab content variables (before the `return` statement). Use store state to compute values:

```javascript
const finData = store.state.financialsData || {};
const finRevenue = finData.totalRevenue || store.state.salesAnalytics?.totalRevenue || 0;
const finExpenses = finData.totalExpenses || 0;
const finNetProfit = finRevenue - finExpenses;
const finProfitMargin = finRevenue > 0 ? ((finNetProfit / finRevenue) * 100).toFixed(1) : '0.0';
const finCashFlow = finRevenue - finExpenses;
const budgetCategories = store.state.budgetCategories || [
    { name: 'Marketing', spent: 0, budget: 200 },
    { name: 'Shipping', spent: 0, budget: 500 },
    { name: 'Supplies', spent: 0, budget: 300 },
    { name: 'Fees', spent: 0, budget: 400 }
];

const financialsAnalyticsTabContent = `
    <div class="grid grid-cols-2 gap-6 mb-6">
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('target', 18)} Profit Margin</h3></div>
            <div class="card-body text-center">
                <div style="font-size: 48px; font-weight: 700; color: ${parseFloat(finProfitMargin) >= 0 ? 'var(--success)' : 'var(--error)'};">${finProfitMargin}%</div>
                <div class="text-sm text-gray-500">Profit Margin</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('bar-chart', 18)} Cash Flow Breakdown</h3></div>
            <div class="card-body">
                <div class="flex flex-col gap-3">
                    ${[
                        { label: 'Revenue', value: finRevenue, color: 'var(--success)' },
                        { label: 'Expenses', value: -finExpenses, color: 'var(--error)' },
                        { label: 'Net', value: finCashFlow, color: finCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }
                    ].map(item => `
                        <div class="flex justify-between items-center p-2 rounded" style="background:var(--gray-50)">
                            <span class="text-sm">${item.label}</span>
                            <span class="font-bold" style="color:${item.color}">C$${Math.abs(item.value).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
    <div class="grid grid-cols-2 gap-6 mb-6">
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('activity', 18)} Financial Ratios</h3></div>
            <div class="card-body">
                <div class="grid grid-cols-2 gap-4">
                    ${[
                        { label: 'Gross Margin', value: finRevenue > 0 ? finProfitMargin + '%' : 'N/A' },
                        { label: 'Current Ratio', value: '0.00' },
                        { label: 'Debt-to-Equity', value: 'N/A' }
                    ].map(r => `
                        <div class="text-center p-3" style="background:var(--gray-50);border-radius:8px;">
                            <div class="text-xl font-bold text-primary">${r.value}</div>
                            <div class="text-xs text-gray-500">${r.label}</div>
                            <div class="text-xs text-warning mt-1">Review</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('pie-chart', 18)} Budget Progress</h3></div>
            <div class="card-body">
                <div class="flex flex-col gap-3">
                    ${budgetCategories.map(cat => `
                        <div>
                            <div class="flex justify-between text-sm mb-1">
                                <span>${cat.name}</span>
                                <span class="text-gray-500">C$${cat.spent} / C$${cat.budget}</span>
                            </div>
                            <div style="height:6px;background:var(--gray-200);border-radius:3px;">
                                <div style="width:${Math.min(100, (cat.spent/cat.budget)*100)}%;height:100%;background:var(--primary);border-radius:3px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
`;
```

- [ ] **Step 3: Add tab content for Inventory, Sales, Purchases**

Define three more tab content variables. Place them near `financialsAnalyticsTabContent`:

```javascript
const inventory = store.state.inventory || [];
const inventoryActive = inventory.filter(i => i.status === 'active').length;
const inventoryLow = inventory.filter(i => { const q = i.quantity != null ? i.quantity : 1; return q <= (i.low_stock_threshold || 5) && q > 0; }).length;
const inventoryOut = inventory.filter(i => Number(i.quantity) === 0).length;

const inventoryAnalyticsTabContent = `
    <div class="stats-grid mb-6">
        ${components.statCard('Total Items', inventory.length, 'inventory', 0)}
        ${components.statCard('Active', inventoryActive, 'activity', 0)}
        ${components.statCard('Low Stock', inventoryLow, 'calendar', 0)}
        ${components.statCard('Out of Stock', inventoryOut, 'sales', 0)}
    </div>
    <div class="card">
        <div class="card-header"><h3 class="card-title">Stock Status Breakdown</h3></div>
        <div class="card-body">
            <div class="flex gap-6 justify-center py-4">
                ${[
                    { label: 'In Stock', count: inventoryActive - inventoryLow, color: 'var(--success)' },
                    { label: 'Low Stock', count: inventoryLow, color: 'var(--warning)' },
                    { label: 'Out of Stock', count: inventoryOut, color: 'var(--error)' }
                ].map(s => `
                    <div class="text-center">
                        <div class="text-3xl font-bold" style="color:${s.color}">${s.count}</div>
                        <div class="text-sm text-gray-500">${s.label}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
`;

// salesAnalyticsTabContent — reuse the existing salesTabContent variable already defined in analytics()
const salesAnalyticsTabContent = salesTabContent;

const purchases = store.state.purchases || [];
const purchasesTotal = purchases.reduce((sum, p) => sum + (parseFloat(p.total_cost || p.cost || 0)), 0);
const purchasesByPlatform = {};
purchases.forEach(p => {
    const pl = p.platform || p.source || 'Other';
    purchasesByPlatform[pl] = (purchasesByPlatform[pl] || 0) + parseFloat(p.total_cost || p.cost || 0);
});

const purchasesAnalyticsTabContent = `
    <div class="stats-grid mb-6">
        ${components.statCard('Total Purchases', purchases.length, 'inventory', 0)}
        ${components.statCard('Total COGS', 'C$' + purchasesTotal.toFixed(2), 'analytics', 0)}
        ${components.statCard('Avg Cost', purchases.length > 0 ? 'C$' + (purchasesTotal / purchases.length).toFixed(2) : 'C$0', 'activity', 0)}
    </div>
    <div class="card">
        <div class="card-header"><h3 class="card-title">Spend by Source</h3></div>
        <div class="card-body">
            ${Object.keys(purchasesByPlatform).length === 0 ? `<p class="text-gray-500 text-center py-4">No purchase data yet</p>` : `
                <div class="flex flex-col gap-3">
                    ${Object.entries(purchasesByPlatform).map(([pl, amt]) => `
                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span class="font-medium">${escapeHtml(pl)}</span>
                            <span class="font-bold text-primary">C$${amt.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    </div>
`;
```

- [ ] **Step 4: Wire new tabs into the render ternary chain**

Find the long ternary at the end of the `analytics()` return that selects tab content (line ~2569). It currently ends with something like:
```javascript
: currentTab === 'sourcing' ? (() => { ... })() : ''
```

Extend it by appending before the final `''`:
```javascript
: currentTab === 'financials-analytics' ? financialsAnalyticsTabContent
: currentTab === 'inventory-analytics' ? inventoryAnalyticsTabContent
: currentTab === 'sales-analytics' ? salesAnalyticsTabContent
: currentTab === 'purchases-analytics' ? purchasesAnalyticsTabContent
: ''
```

- [ ] **Step 5: Commit**

```bash
git add src/frontend/pages/pages-core.js
git commit -m "[AUTO] feat(analytics): add Financials Analytics, Inventory, Sales, Purchases tabs"
```

---

## Task 5: Orders — Tab Reorder + Shipping Tab (`pages-sales-orders.js`)

**Files:**
- Modify: `src/frontend/pages/pages-sales-orders.js` — `orders()` function (line ~2133)

- [ ] **Step 1: Change ordersMainTab default**

Find (line ~2223):
```javascript
const ordersMainTab = store.state.ordersMainTab || 'orders';
```
Change to:
```javascript
const ordersMainTab = store.state.ordersMainTab || 'offers';
```

- [ ] **Step 2: Replace the tab bar**

Find the current tab bar (lines ~2226–2235):
```javascript
<div class="tab-bar" style="margin-bottom: 0;">
    <button class="tab ${ordersMainTab === 'orders' ? 'active' : ''}"
        onclick="store.setState({ordersMainTab:'orders'}); renderApp(window.pages.orders())">
        Orders
    </button>
    <button class="tab ${ordersMainTab === 'offers' ? 'active' : ''}"
        onclick="store.setState({ordersMainTab:'offers'}); renderApp(window.pages.orders())">
        Offers
    </button>
</div>
```

Replace with:
```javascript
<div class="tab-bar" style="margin-bottom: 0;">
    <button class="tab ${ordersMainTab === 'offers' ? 'active' : ''}"
        onclick="store.setState({ordersMainTab:'offers'}); renderApp(window.pages.orders())">
        Offers
    </button>
    <button class="tab ${ordersMainTab === 'orders' ? 'active' : ''}"
        onclick="store.setState({ordersMainTab:'orders'}); renderApp(window.pages.orders())">
        Orders
    </button>
    <button class="tab ${ordersMainTab === 'shipping' ? 'active' : ''}"
        onclick="store.setState({ordersMainTab:'shipping'}); renderApp(window.pages.orders())">
        Shipping
    </button>
</div>
```

- [ ] **Step 3: Add Shipping tab to the content conditional**

Find the content switch (line ~2237):
```javascript
${ordersMainTab === 'orders' ? `
    <!-- Orders Hero Section ... -->
` : window.pages.offersContent()}
```

Replace with:
```javascript
${ordersMainTab === 'offers' ? window.pages.offersContent()
: ordersMainTab === 'shipping' ? window.pages.shippingLabelsPage()
: `
    <!-- Orders Hero Section ... (all existing orders content) -->
`}
```

Keep all the existing orders hero content (lines ~2238–2562) inside the `orders` branch unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/pages/pages-sales-orders.js
git commit -m "[AUTO] feat(orders): reorder tabs Offers→Orders→Shipping, add embedded Shipping tab"
```

---

## Task 6: Sales & Purchases — Remove Sourcing Platforms; Reports Empty State (`pages-sales-orders.js`)

**Files:**
- Modify: `src/frontend/pages/pages-sales-orders.js` — `sales()` (line ~482) and `reports()` (line ~3441)

- [ ] **Step 1: Remove Sourcing Platforms card from Purchases tab**

In `sales()`, find the Sourcing Platforms card (line ~674):
```javascript
<div class="card mb-6">
    <div class="card-header">
        <h3 class="card-title">Sourcing Platforms</h3>
        <p class="card-subtitle">Connect your sourcing platforms to automatically import purchase orders</p>
    </div>
    <div class="card-body">
        ...AliExpress and Alibaba connect buttons...
    </div>
</div>
```

Delete the entire `<div class="card mb-6">` block containing Sourcing Platforms (from its opening tag through its matching closing `</div>`). The "Connect Sourcing" dropdown button that already exists on the page (lines ~723–724) stays.

- [ ] **Step 2: Remove the Create Report button from the reports() empty state**

In `reports()`, find the empty state block (line ~3489):
```javascript
} : `
    <div class="card">
        <div class="card-body">
            <div class="empty-state text-center py-12">
                <div class="text-4xl mb-4">📊</div>
                <h3 class="font-semibold mb-2">No custom reports yet</h3>
                <p class="text-gray-500 mb-4">Create your first report to track the metrics that matter to you</p>
                <button class="btn btn-primary" onclick="handlers.createReport()">Create Report</button>
            </div>
        </div>
    </div>
`}
```

Delete only the `<button class="btn btn-primary" onclick="handlers.createReport()">Create Report</button>` line. Keep the rest of the empty state (icon, heading, description). The working "New Report" button in the page header (line ~3456) remains.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/pages/pages-sales-orders.js
git commit -m "[AUTO] fix(sales): remove Sourcing Platforms card; fix(reports): remove redundant Create Report button from empty state"
```

---

## Task 7: Financials Page Restructure (`pages-sales-orders.js`)

**Files:**
- Modify: `src/frontend/pages/pages-sales-orders.js` — `financials()` function (line ~788)

### Current layout (verified)
- Lines ~1803–1851: Four always-visible cards (Profit Margin gauge, Cash Flow Breakdown, Financial Ratios, Budget Progress) — rendered ABOVE the tab bar
- Lines ~1853–1857: Tab bar: Chart of Accounts | Financial Statements | P&L
- Line ~1859: `${tabContent[currentTab] || tabContent.accounts}`
- Lines ~1861–end: Tax Estimate Calculator, then Expense Categories, then Bank Reconciliation — all below tabs, always visible

- [ ] **Step 1: Remove the four always-visible financial cards**

Delete the entire block from `<!-- Profit Margin Gauge & Cash Flow Waterfall -->` (line ~1803) through the closing `</div>` of the Budget Progress card (line ~1851). This removes all four cards (Profit Margin, Cash Flow Breakdown, Financial Ratios, Budget Progress). They now live in Analytics → Financials Analytics tab.

- [ ] **Step 2: Move Tax Estimate Calculator into a new tab**

Find the Tax Estimate Calculator card block (starting at `<!-- Tax Estimate Calculator -->` line ~1861). Cut the entire `<div class="card mb-6">` block (from opening tag through closing `</div>`).

Add `'tax-preparation'` to the `tabContent` object (which currently has `accounts`, `statements`, `pnl`):

```javascript
const tabContent = {
    accounts: `...existing accounts content...`,
    statements: `...existing statements content...`,
    pnl: `...existing pnl content...`,
    'tax-preparation': `<div class="card mb-6">
        <div class="card-header">
            <h3 class="card-title">${components.icon('file-text', 18)} Tax Estimate Calculator</h3>
        </div>
        <div class="card-body">
            ...paste the cut Tax Estimate Calculator content here...
        </div>
    </div>`,
    'bank-reconciliation': ``   // filled in next step
};
```

- [ ] **Step 3: Move Bank Reconciliation into a new tab**

Find the Bank Reconciliation card block (starting at `<!-- Bank Reconciliation -->` or `h3 ... Bank Reconciliation` line ~2088). Cut the entire card block.

Set `tabContent['bank-reconciliation']` to the cut Bank Reconciliation content (Bank Balance, Book Balance, Difference cards, Unmatched Transactions table, Start Reconciliation button).

- [ ] **Step 4: Remove Expense Categories section**

Find the Expense Categories card block (line ~2054, `<!-- Expense Category Dashboard -->` or similar). Delete the entire `<div class="card ...">` block containing the "Expense Categories" title and "No expense data yet" message. Do not move it anywhere.

- [ ] **Step 5: Add new tabs to the tab bar**

Find the Financials tab bar (line ~1853):
```javascript
<div class="tabs mb-6" role="tablist">
    <button class="tab ${currentTab === 'accounts' ? 'active' : ''}" ...>Chart of Accounts</button>
    <button class="tab ${currentTab === 'statements' ? 'active' : ''}" ...>Financial Statements</button>
    <button class="tab ${currentTab === 'pnl' ? 'active' : ''}" ...>Profit &amp; Loss (P&amp;L)</button>
</div>
```

Replace with:
```javascript
<div class="tabs mb-6" role="tablist">
    <button class="tab ${currentTab === 'accounts' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'accounts' ? 'true' : 'false'}" onclick="handlers.switchFinancialsTab('accounts')">Chart of Accounts</button>
    <button class="tab ${currentTab === 'statements' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'statements' ? 'true' : 'false'}" onclick="handlers.switchFinancialsTab('statements')">Financial Statements</button>
    <button class="tab ${currentTab === 'pnl' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'pnl' ? 'true' : 'false'}" onclick="handlers.switchFinancialsTab('pnl')">Profit &amp; Loss (P&amp;L)</button>
    <button class="tab ${currentTab === 'tax-preparation' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'tax-preparation' ? 'true' : 'false'}" onclick="handlers.switchFinancialsTab('tax-preparation')">Tax Preparation</button>
    <button class="tab ${currentTab === 'bank-reconciliation' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'bank-reconciliation' ? 'true' : 'false'}" onclick="handlers.switchFinancialsTab('bank-reconciliation')">Bank Reconciliation</button>
</div>
```

- [ ] **Step 6: Confirm switchFinancialsTab handler supports new keys**

Search `handlers-sales-orders.js` for `switchFinancialsTab`. It should call `store.setState({financialsTab: tab})` and `renderApp(window.pages.financials())`. If it does, no change needed — the new tab keys will work automatically. If it has a whitelist of allowed tab names, add `'tax-preparation'` and `'bank-reconciliation'` to it.

- [ ] **Step 7: Commit**

```bash
git add src/frontend/pages/pages-sales-orders.js src/frontend/handlers/handlers-sales-orders.js
git commit -m "[AUTO] feat(financials): add Tax Preparation + Bank Reconciliation tabs, remove Expense Categories, move financial cards to Analytics"
```

---

## Task 8: Inventory Tab Removal + Listings Import Button (`pages-inventory-catalog.js`)

**Files:**
- Modify: `src/frontend/pages/pages-inventory-catalog.js`

### Inventory page — remove tab bar

- [ ] **Step 1: Remove the Catalog/Analytics tab buttons**

Find the tab button bar (lines ~79–92):
```javascript
<button class="inv-tab-btn active" data-tab="catalog" onclick="handlers.switchInventoryTab('catalog')"
    ...>
    ${components.icon('grid', 16)} Catalog
</button>
<button class="inv-tab-btn" data-tab="analytics" onclick="handlers.switchInventoryTab('analytics')"
    ...>
    ${components.icon('analytics', 16)} Analytics
</button>
```

Delete both `<button>` elements and their containing `<div>` wrapper (the parent div that wraps these two buttons).

- [ ] **Step 2: Remove the Analytics tab pane wrapper**

Find:
```javascript
<div class="inv-tab-pane" data-tab="analytics" style="display:none;">
    ${store.state.inventoryAnalytics ? handlers._renderInventoryAnalyticsContent() : '...'}
</div>
```

Delete this entire div. The analytics content was only shown when the tab was clicked — removing it is safe.

- [ ] **Step 3: Remove the catalog pane wrapper but keep its content**

Find:
```javascript
<div class="inv-tab-pane active" data-tab="catalog" style="display:block;">
    ...all catalog content...
</div>
```

Remove the outer `<div class="inv-tab-pane active" data-tab="catalog" ...>` wrapper and its closing `</div>`, leaving the catalog content rendering directly.

### Listings page — add Import dropdown

- [ ] **Step 4: Find the Listings page header actions area**

Search for the Listings page header — it will have a `<div class="page-header">` with action buttons (like "Add Listing", "Cross-list", etc.). Find the flex/gap div containing these buttons.

- [ ] **Step 5: Add the Import dropdown button**

Inside the Listings page header actions div, append:
```javascript
<div class="dropdown" style="position:relative;">
    <button class="btn btn-secondary dropdown-toggle" onclick="event.stopPropagation(); this.closest('.dropdown').classList.toggle('open');" aria-haspopup="true">
        ${components.icon('upload', 16)} Import
        ${components.icon('chevron-down', 14)}
    </button>
    <div class="dropdown-menu" style="min-width:160px;">
        <button class="dropdown-item" onclick="modals.showInventoryImport()">
            ${components.icon('file-text', 14)} Import from CSV
        </button>
        <button class="dropdown-item" onclick="modals.showInventoryImport()">
            ${components.icon('link', 14)} Import from Platform
        </button>
    </div>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/frontend/pages/pages-inventory-catalog.js
git commit -m "[AUTO] fix(inventory): remove Catalog/Analytics tabs, show catalog directly; feat(listings): add Import dropdown button"
```

---

## Task 9: Help Page Stats Removal (`pages-community-help.js`)

**Files:**
- Modify: `src/frontend/pages/pages-community-help.js` (line ~2661)

- [ ] **Step 1: Find and delete the stats row**

Search for `Articles Read` or `help-stat-label` in the file. Find the parent container that wraps all three stats (Articles Read, Open Tickets, Avg Response). It will be a `<div>` with three child stat cards. Delete the entire stats row container and all three stat cards within it.

The three labels are at lines ~2661, ~2672, ~2684. The parent container starts a few lines above the first label. Delete from the parent container's opening tag through its closing `</div>`.

- [ ] **Step 2: Commit**

```bash
git add src/frontend/pages/pages-community-help.js
git commit -m "[AUTO] fix(help): remove Articles Read / Open Tickets / Avg Response stats row"
```

---

## Task 10: "Most Popular" Badge Light Mode Fix (`pages-settings-account.js`)

**Files:**
- Modify: `src/frontend/pages/pages-settings-account.js` — `plansBilling()` function (line ~2340)

- [ ] **Step 1: Find the Most Popular badge**

Search for `Most Popular` in `pages-settings-account.js`. It will be in the Pro plan card template, likely an element like:
```html
<div class="most-popular-badge">Most Popular</div>
```
or an inline styled span.

- [ ] **Step 2: Fix the style**

If it uses a CSS class: add explicit inline styles to ensure visibility in both modes:
```javascript
<div class="most-popular-badge" style="background: var(--primary, #2563eb); color: #fff; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">Most Popular</div>
```

If it already has inline styles: ensure `background` is a solid dark color (not `white` or `transparent`) and `color` is `#fff` or `white`. Remove any `color: white` on `background: white` combination.

- [ ] **Step 3: Check main.css for .most-popular-badge**

Run:
```bash
grep -n "most-popular-badge\|most_popular" src/frontend/styles/main.css
```

If a CSS rule exists, update it to guarantee dark background + white text regardless of theme:
```css
.most-popular-badge {
    background: var(--primary, #2563eb) !important;
    color: #fff !important;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/frontend/pages/pages-settings-account.js src/frontend/styles/main.css
git commit -m "[AUTO] fix(plans): Most Popular badge now visible in light mode"
```

---

## Task 11: Rebuild Bundle + Verify

**Files:**
- Regenerate: `src/frontend/core-bundle.js` (auto-generated, do not edit manually)

- [ ] **Step 1: Run the bundle build**

```bash
bun run dev:bundle
```

Expected: exits 0, `core-bundle.js` is updated. If it errors, check for syntax errors in the modified source files.

- [ ] **Step 2: Run linter**

```bash
bun run lint
```

Expected: no errors. Fix any reported issues before proceeding.

- [ ] **Step 3: Commit the regenerated bundle**

```bash
git add src/frontend/core-bundle.js public/sw.js
git commit -m "[AUTO] build: regenerate core-bundle after UI restructure (22 manual review items)"
```

- [ ] **Step 4: Smoke-check key pages**

If a dev server is running (`bun run dev`), verify in browser:
- Sidebar: Community + Roadmap at bottom, Receipts gone, Import gone, "Get Help" label, Learn more button below it
- Settings: Account tab (not Profile), Plans & Billing tab (not Billing), no Accent Color, no Density/Font Size
- My Shops: Shopify appears before Mercari/Grailed/Etsy
- Analytics: Financials Analytics, Inventory, Sales, Purchases tabs visible
- Offers/Orders/Shipping: tab order is Offers → Orders → Shipping
- Financials: Tax Preparation + Bank Reconciliation tabs visible, no Expense Categories card, no Profit Margin/Cash Flow/Budget cards at top
- Inventory: no Catalog/Analytics tabs, just the catalog list
- Listings: Import dropdown button in header
- Reports: empty state has no Create Report button
- Help: no Articles/Tickets/Response stats row
- Plans: "Most Popular" badge dark-on-light visible

---

## Self-Review Against Spec

**Spec section coverage check:**

| Spec item | Task |
|-----------|------|
| Account Tab replaces Profile tab in Settings | Task 2 |
| Plans & Billing replaces Billing tab in Settings | Task 2 |
| Roadmap + Community moved to sidebar bottom | Task 1 |
| Remove Accent Color + Display Options | Task 2 |
| Remove Focus Mode | Task 1 |
| Remove Sourcing Platforms section (image-4) | Task 6 |
| Remove Receipts from sidebar | Task 1 |
| Offers→Orders→Shipping tab order + Shipping tab | Task 5 |
| Shopify before Coming Soon in My Shops | Task 3 |
| Import dropdown on Listings page | Task 8 |
| Migrate Import page to buttons (sidebar Import removed) | Task 1 (sidebar), Task 8 (button) |
| Remove "New Report" button from empty state (image-5) | Task 6 |
| Financials Analytics tab on Analytics (image-6) | Task 4 |
| Tax Preparation tab on Financials (image-7) | Task 7 |
| Bank Reconciliation tab on Financials (image-8) | Task 7 |
| Remove Expense Categories from Financials (image-9) | Task 7 |
| Add Inventory, Sales, Purchases tabs on Analytics | Task 4 |
| Remove Catalog/Analytics tabs from Inventory (image-10) | Task 8 |
| Remove stats from Help page (image-11) | Task 9 |
| Rename Help → Get Help in sidebar | Task 1 |
| Add Learn more button in sidebar | Task 1 |
| Most Popular badge visible in light mode (image-12) | Task 10 |

All 22 items covered. ✓
