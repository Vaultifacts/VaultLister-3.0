# Frontend Reference
> Last reviewed: 2026-02-16

## Entry Point
## Entry Point

**File:** `src/frontend/app.js` (~30,000+ lines)

Single-page application with custom state management, no framework dependencies.

---

## UI Enhancement System

The frontend includes a comprehensive set of UI helpers and components for modern interactions:

### Navigation & Workflow
| Helper | Description |
|--------|-------------|
| `commandPalette` | Cmd+K global search for commands, pages, inventory |
| `keyboardShortcuts` | Keyboard shortcuts manager with chord support |
| `contextMenu` | Right-click context menus |

### Data Visualization
| Component | Description |
|-----------|-------------|
| `components.sparkline()` | Inline SVG trend charts |
| `components.progressRing()` | Circular progress indicators |
| `components.comparisonBar()` | This week vs last week bars |
| `calendarHeatmap.render()` | GitHub-style activity heatmap |
| `kanban.render()` | Drag-drop Kanban board |

### Interaction Helpers
| Helper | Description |
|--------|-------------|
| `bulkSelection` | Floating toolbar for multi-select actions |
| `lightbox` | Full-screen image gallery with keyboard nav |
| `inlineEditor` | Click-to-edit table cells |
| `autocomplete` | Smart input suggestions |

### Feedback & UI
| Helper | Description |
|--------|-------------|
| `notificationCenter` | Slide-out notification panel |
| `skeleton` | Loading skeleton placeholders |
| `celebrations.confetti()` | Confetti animation for milestones |
| `toastWithUndo` | Toast notifications with undo action |

### Personalization
| Helper | Description |
|--------|-------------|
| `themeManager` | Accent colors, density, font size |
| `widgetManager` | Dashboard widget customization |
| `tablePrefs` | Column visibility and sort preferences |
| `savedViews` | Save/load filter/sort presets |

### Utilities
| Helper | Description |
|--------|-------------|
| `quickFilters` | One-click filter pills |
| `richTextEditor` | WYSIWYG description editor |
| `quickNotes` | Per-item internal notes |
| `auditLog` | Track all changes with before/after |
| `goalTracker` | Goal progress with streak counter |
| `focusMode` | Distraction-free editing |
| `mobileUI` | Bottom nav, FAB, pull-to-refresh |

---

## Architecture

```
src/frontend/
├── app.js           # Main SPA (state, components, pages, handlers, router)
├── styles/
│   └── main.css     # All styles (~3,500+ lines)
├── index.html       # Entry HTML with script loading
└── oauth-callback.html  # OAuth popup handler
```

---

## State Management

Global store with subscriber pattern:

```javascript
const store = {
    state: {
        // Auth
        user: null,
        isAuthenticated: false,

        // Data
        inventory: [],
        listings: [],
        sales: [],

        // UI State
        currentPage: 'dashboard',
        sidebarOpen: false,
        darkMode: false,

        // Feature-specific
        financialsTab: 'purchases',
        analyticsTab: 'graphs',
        vaultBuddyOpen: false,
        // ... etc
    },

    setState(updates) {
        Object.assign(this.state, updates);
        this.notify();
    },

    subscribe(callback) { ... },
    notify() { ... }
};
```

**Important:** Data loading functions should:
- NOT call `router.handleRoute()` (causes infinite loops)
- Update state via `store.setState()` only
- Be awaited in route handlers before rendering

---

## Components Object

Reusable UI components:

```javascript
const components = {
    // Layout
    sidebar() { ... },
    header() { ... },

    // UI Elements
    icon(name, size) { ... },
    statCard(title, value, icon, change, color) { ... },
    platformBadge(platform) { ... },
    platformLogo(platform) { ... },

    // Feature Components
    vaultBuddy() { ... },  // Floating chat bot

    // Form Elements
    formInput(options) { ... },
    formSelect(options) { ... }
};
```

---

## Pages Object

Page rendering functions:

```javascript
const pages = {
    dashboard() { ... },
    inventory() { ... },
    listings() { ... },
    crosslist() { ... },
    financials() { ... },
    analytics() { ... },
    settings() { ... },
    calendar() { ... },
    checklist() { ... },
    // ... etc
};
```

---

## Handlers Object

Event handlers and API calls:

```javascript
const handlers = {
    // Data Loading
    loadInventory: async function() {
        const data = await api.get('/inventory');
        store.setState({ inventory: data.items || [] });
    },

    // CRUD Operations
    addItem: async function(event) {
        event.preventDefault();
        await api.ensureCSRFToken();
        const data = await api.post('/inventory', formData);
        // Update state, show toast, re-render
    },

    // UI Actions
    toggleSidebar: function() {
        store.setState({ sidebarOpen: !store.state.sidebarOpen });
    },

    // Feature-specific
    refreshListing: async function(listingId) { ... },
    toggleVaultBuddy: function() { ... },
    sendVaultBuddyMessage: async function() { ... }
};
```

---

## Router

Hash-based routing:

```javascript
const router = {
    routes: {},

    register(route, handler) {
        this.routes[route] = handler;
    },

    navigate(route) {
        window.location.hash = route;
    },

    handleRoute() {
        const route = window.location.hash.slice(1) || 'dashboard';
        const handler = this.routes[route];
        if (handler) handler();
    }
};

// Registration
router.register('dashboard', () => renderApp(pages.dashboard()));
router.register('inventory', async () => {
    await handlers.loadInventory();
    renderApp(pages.inventory());
});
```

---

## API Client

```javascript
const api = {
    csrfToken: null,

    async ensureCSRFToken() {
        if (!this.csrfToken) {
            const data = await this.get('/auth/csrf');
            this.csrfToken = data.token;
        }
    },

    async get(endpoint) {
        const response = await fetch(`/api${endpoint}`, {
            headers: { 'Authorization': `Bearer ${auth.getToken()}` }
        });
        return response.json();
    },

    async post(endpoint, body) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.getToken()}`,
                'X-CSRF-Token': this.csrfToken
            },
            body: JSON.stringify(body)
        });
        return response.json();
    }
};
```

---

## Render Function

```javascript
function renderApp(pageContent) {
    if (!auth.isAuthenticated()) {
        router.navigate('login');
        return;
    }

    document.getElementById('app').innerHTML = `
        <div class="app-layout">
            ${components.sidebar()}
            <div class="sidebar-backdrop"></div>
            <main class="main-content">
                ${components.header()}
                <div class="page-content">
                    ${pageContent}
                </div>
            </main>
        </div>
        ${components.vaultBuddy()}
    `;
}
```

---

## Toast Notifications

```javascript
const toast = {
    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); },
    info(message) { this.show(message, 'info'); },
    show(message, type) { ... }
};
```

---

## Modal System

```javascript
const modals = {
    show(content) {
        // Create modal overlay and content
    },
    close() {
        // Remove modal, reject pending confirm
    },
    confirm(message, options) {
        // Returns Promise<boolean>
        // Options: { title, confirmText, cancelText, danger }
        // danger: true renders red confirm button
        // Usage: if (!await modals.confirm('Delete?', { danger: true })) return;
    },
    addItem() { this.show(/* Add item form */); },
    editItem(item) { this.show(/* Edit form */); }
};
```

**Note:** `modals.confirm()` replaces native `confirm()` for critical destructive operations (delete, permanent delete, account deletion). The native `confirm()` is still used for lower-priority confirmations.

---

## CSS Variables

Key theme variables in `main.css`:

```css
:root {
    --primary-500: #6366f1;
    --primary-600: #4f46e5;
    --gray-100: #f3f4f6;
    --gray-500: #6b7280;
    --gray-900: #111827;
    --success-500: #22c55e;
    --warning-500: #f59e0b;
    --error-500: #ef4444;
    --radius-md: 8px;
    --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}

body.dark-mode {
    /* Dark mode overrides */
}
```

---

## Common Patterns

**Page Template:**
```javascript
myPage() {
    return `
        <div class="page-header">
            <h1 class="page-title">Page Title</h1>
            <p class="page-description">Description</p>
        </div>

        <div class="stats-grid mb-6">
            ${components.statCard('Stat 1', value, 'icon')}
        </div>

        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Section</h3>
            </div>
            <div class="card-body">
                <!-- Content -->
            </div>
        </div>
    `;
}
```

**Tab Navigation:**
```javascript
<div class="tabs">
    <button class="tab ${activeTab === 'tab1' ? 'active' : ''}"
            onclick="handlers.switchTab('tab1')">
        Tab 1
    </button>
</div>
```

**Escape HTML (XSS Prevention):**
```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

---

## Important Notes

- All HTML is rendered as template literals
- No JSX or framework syntax
- Event handlers use `onclick="handlers.methodName()"`
- Always use `escapeHtml()` for user-provided content
- Re-render via `renderApp(pages.currentPage())`
