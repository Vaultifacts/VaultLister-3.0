// E2E Test Fixtures and Data Factories

export const demoUser = {
    email: 'demo@vaultlister.com',
    password: 'DemoPassword123!'
};

export function generateTestUser() {
    const timestamp = Date.now();
    return {
        email: `test${timestamp}@example.com`,
        password: 'TestPassword123!',  // Meets security: 12+ chars, upper, lower, number, special
        username: `testuser${timestamp}`
    };
}

export function generateInventoryItem(overrides = {}) {
    const timestamp = Date.now();
    return {
        title: `Test Item ${timestamp}`,
        description: 'A test inventory item for E2E testing',
        brand: 'Test Brand',
        category: 'Tops',
        size: 'M',
        color: 'Blue',
        condition: 'good',
        listPrice: '25.00',
        ...overrides
    };
}

export function generateAutomationRule(overrides = {}) {
    const timestamp = Date.now();
    return {
        name: `Test Rule ${timestamp}`,
        type: 'share',
        platform: 'poshmark',
        ...overrides
    };
}

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

export const routes = {
    login: `${BASE_URL}/#login`,
    register: `${BASE_URL}/#register`,
    dashboard: `${BASE_URL}/#dashboard`,
    inventory: `${BASE_URL}/#inventory`,
    listings: `${BASE_URL}/#listings`,
    crosslist: `${BASE_URL}/#crosslist`,
    automations: `${BASE_URL}/#automations`,
    offers: `${BASE_URL}/#offers`,
    sales: `${BASE_URL}/#sales`,
    analytics: `${BASE_URL}/#analytics`,
    shops: `${BASE_URL}/#shops`,
    settings: `${BASE_URL}/#settings`,
    tutorials: `${BASE_URL}/#tutorials`,
    imageBank: `${BASE_URL}/#image-bank`,
    help: `${BASE_URL}/#help`
};

export const selectors = {
    // Login page
    loginForm: '#login-form',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',

    // Navigation
    sidebar: '.sidebar',
    navLinks: '.nav-link',
    logoutButton: 'text=Logout',

    // Toast notifications
    toast: '.toast',
    toastSuccess: '.toast-success',
    toastError: '.toast-error',

    // Dashboard
    dashboardStats: '.stat-card',
    quickActions: '.quick-actions',

    // Inventory
    inventoryTable: 'table',
    addItemButton: 'text=Add Item',
    searchInput: 'input[placeholder*="Search"]',

    // Automations
    automationsList: '.automation-rules',
    createRuleButton: 'text=Create Rule',

    // Loading
    loadingScreen: '#loading-screen',
    loadingSpinner: '.loading-spinner'
};
