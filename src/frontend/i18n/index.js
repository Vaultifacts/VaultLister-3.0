// VaultLister Internationalization (i18n) System
// Supports multiple languages with lazy loading

const i18n = {
    currentLocale: 'en-US',
    fallbackLocale: 'en-US',
    translations: {},
    loadedLocales: new Set(),

    // Supported locales
    supportedLocales: {
        'en-US': { name: 'English (US)', nativeName: 'English', dir: 'ltr' },
        'en-GB': { name: 'English (UK)', nativeName: 'English', dir: 'ltr' },
        'es-ES': { name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
        'es-MX': { name: 'Spanish (Mexico)', nativeName: 'Español (México)', dir: 'ltr' },
        'fr-FR': { name: 'French', nativeName: 'Français', dir: 'ltr' },
        'de-DE': { name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
        'it-IT': { name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
        'pt-BR': { name: 'Portuguese (Brazil)', nativeName: 'Português', dir: 'ltr' },
        'ja-JP': { name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
        'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文', dir: 'ltr' },
        'ko-KR': { name: 'Korean', nativeName: '한국어', dir: 'ltr' },
        'ar-SA': { name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
    },

    // Initialize i18n
    async init(locale = null) {
        // Detect locale from browser or user preference
        const detectedLocale = locale ||
            localStorage.getItem('vaultlister_locale') ||
            navigator.language ||
            this.fallbackLocale;

        // Find best matching locale
        this.currentLocale = this.findBestLocale(detectedLocale);

        // Load translations
        await this.loadLocale(this.currentLocale);

        // Set document direction for RTL languages
        const localeInfo = this.supportedLocales[this.currentLocale];
        if (localeInfo) {
            document.documentElement.dir = localeInfo.dir;
            document.documentElement.lang = this.currentLocale;
        }

        console.log(`[i18n] Initialized with locale: ${this.currentLocale}`);
        return this;
    },

    // Find best matching locale
    findBestLocale(locale) {
        // Exact match
        if (this.supportedLocales[locale]) {
            return locale;
        }

        // Language match (e.g., 'es' matches 'es-ES')
        const language = locale.split('-')[0];
        for (const supported of Object.keys(this.supportedLocales)) {
            if (supported.startsWith(language)) {
                return supported;
            }
        }

        return this.fallbackLocale;
    },

    // Load locale translations
    async loadLocale(locale) {
        if (this.loadedLocales.has(locale)) {
            return;
        }

        try {
            // In production, this would fetch from server
            // For now, use embedded translations
            this.translations[locale] = await this.getTranslations(locale);
            this.loadedLocales.add(locale);
        } catch (error) {
            console.warn(`[i18n] Failed to load locale ${locale}, using fallback`);
            if (locale !== this.fallbackLocale) {
                await this.loadLocale(this.fallbackLocale);
            }
        }
    },

    // Get translations for a locale
    async getTranslations(locale) {
        // Base English translations
        const en = {
            // Common
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.add': 'Add',
            'common.search': 'Search',
            'common.filter': 'Filter',
            'common.loading': 'Loading...',
            'common.error': 'Error',
            'common.success': 'Success',
            'common.confirm': 'Confirm',
            'common.close': 'Close',
            'common.back': 'Back',
            'common.next': 'Next',
            'common.previous': 'Previous',
            'common.yes': 'Yes',
            'common.no': 'No',
            'common.all': 'All',
            'common.none': 'None',
            'common.select': 'Select',
            'common.upload': 'Upload',
            'common.download': 'Download',
            'common.export': 'Export',
            'common.import': 'Import',
            'common.refresh': 'Refresh',
            'common.settings': 'Settings',
            'common.help': 'Help',
            'common.logout': 'Logout',

            // Auth
            'auth.login': 'Sign In',
            'auth.register': 'Sign Up',
            'auth.email': 'Email',
            'auth.password': 'Password',
            'auth.forgotPassword': 'Forgot Password?',
            'auth.rememberMe': 'Remember me',
            'auth.noAccount': "Don't have an account?",
            'auth.hasAccount': 'Already have an account?',
            'auth.loginSuccess': 'Welcome back!',
            'auth.loginError': 'Invalid email or password',
            'auth.logoutSuccess': 'Logged out successfully',

            // Navigation
            'nav.dashboard': 'Dashboard',
            'nav.inventory': 'Inventory',
            'nav.listings': 'Listings',
            'nav.sales': 'Sales',
            'nav.analytics': 'Analytics',
            'nav.automations': 'Automations',
            'nav.shops': 'Shops',
            'nav.settings': 'Settings',
            'nav.help': 'Help & Support',

            // Dashboard
            'dashboard.welcome': 'Welcome back, {name}!',
            'dashboard.totalSales': 'Total Sales',
            'dashboard.totalRevenue': 'Total Revenue',
            'dashboard.activeListings': 'Active Listings',
            'dashboard.pendingOrders': 'Pending Orders',
            'dashboard.recentActivity': 'Recent Activity',
            'dashboard.quickActions': 'Quick Actions',

            // Inventory
            'inventory.title': 'Inventory',
            'inventory.addItem': 'Add Item',
            'inventory.editItem': 'Edit Item',
            'inventory.deleteItem': 'Delete Item',
            'inventory.itemTitle': 'Title',
            'inventory.brand': 'Brand',
            'inventory.category': 'Category',
            'inventory.size': 'Size',
            'inventory.color': 'Color',
            'inventory.condition': 'Condition',
            'inventory.price': 'Price',
            'inventory.costPrice': 'Cost Price',
            'inventory.listPrice': 'List Price',
            'inventory.quantity': 'Quantity',
            'inventory.sku': 'SKU',
            'inventory.status': 'Status',
            'inventory.status.active': 'Active',
            'inventory.status.sold': 'Sold',
            'inventory.status.archived': 'Archived',
            'inventory.status.draft': 'Draft',
            'inventory.noItems': 'No items found',
            'inventory.addFirst': 'Add your first item to get started',

            // Listings
            'listings.title': 'Listings',
            'listings.createListing': 'Create Listing',
            'listings.crosslist': 'Cross-list',
            'listings.platform': 'Platform',
            'listings.views': 'Views',
            'listings.likes': 'Likes',
            'listings.price': 'Price',

            // Sales
            'sales.title': 'Sales',
            'sales.totalSales': 'Total Sales',
            'sales.revenue': 'Revenue',
            'sales.profit': 'Profit',
            'sales.fees': 'Fees',
            'sales.shipping': 'Shipping',
            'sales.buyer': 'Buyer',
            'sales.soldOn': 'Sold on',

            // Analytics
            'analytics.title': 'Analytics',
            'analytics.overview': 'Overview',
            'analytics.performance': 'Performance',
            'analytics.trends': 'Trends',
            'analytics.period.7d': 'Last 7 days',
            'analytics.period.30d': 'Last 30 days',
            'analytics.period.90d': 'Last 90 days',
            'analytics.period.1y': 'Last year',

            // Settings
            'settings.title': 'Settings',
            'settings.profile': 'Profile',
            'settings.account': 'Account',
            'settings.notifications': 'Notifications',
            'settings.security': 'Security',
            'settings.appearance': 'Appearance',
            'settings.language': 'Language',
            'settings.timezone': 'Timezone',
            'settings.darkMode': 'Dark Mode',

            // Errors
            'error.generic': 'Something went wrong',
            'error.network': 'Network error. Please check your connection.',
            'error.notFound': 'Not found',
            'error.unauthorized': 'Please log in to continue',
            'error.forbidden': 'You do not have permission to access this',
            'error.validation': 'Please check your input',

            // Time
            'time.justNow': 'Just now',
            'time.minutesAgo': '{count} minute ago | {count} minutes ago',
            'time.hoursAgo': '{count} hour ago | {count} hours ago',
            'time.daysAgo': '{count} day ago | {count} days ago',
            'time.weeksAgo': '{count} week ago | {count} weeks ago',
            'time.monthsAgo': '{count} month ago | {count} months ago',
            'time.yearsAgo': '{count} year ago | {count} years ago',
        };

        // Spanish translations
        const es = {
            'common.save': 'Guardar',
            'common.cancel': 'Cancelar',
            'common.delete': 'Eliminar',
            'common.edit': 'Editar',
            'common.add': 'Agregar',
            'common.search': 'Buscar',
            'common.filter': 'Filtrar',
            'common.loading': 'Cargando...',
            'common.error': 'Error',
            'common.success': 'Éxito',
            'common.settings': 'Configuración',
            'common.help': 'Ayuda',
            'common.logout': 'Cerrar sesión',

            'auth.login': 'Iniciar sesión',
            'auth.register': 'Registrarse',
            'auth.email': 'Correo electrónico',
            'auth.password': 'Contraseña',
            'auth.forgotPassword': '¿Olvidaste tu contraseña?',
            'auth.loginSuccess': '¡Bienvenido de nuevo!',

            'nav.dashboard': 'Panel',
            'nav.inventory': 'Inventario',
            'nav.listings': 'Publicaciones',
            'nav.sales': 'Ventas',
            'nav.analytics': 'Analíticas',
            'nav.settings': 'Configuración',

            'dashboard.welcome': '¡Bienvenido, {name}!',
            'dashboard.totalSales': 'Ventas Totales',
            'dashboard.totalRevenue': 'Ingresos Totales',

            'inventory.title': 'Inventario',
            'inventory.addItem': 'Agregar Artículo',
            'inventory.noItems': 'No se encontraron artículos',
        };

        // French translations
        const fr = {
            'common.save': 'Enregistrer',
            'common.cancel': 'Annuler',
            'common.delete': 'Supprimer',
            'common.edit': 'Modifier',
            'common.search': 'Rechercher',
            'common.settings': 'Paramètres',
            'common.logout': 'Déconnexion',

            'auth.login': 'Connexion',
            'auth.register': "S'inscrire",
            'auth.email': 'E-mail',
            'auth.password': 'Mot de passe',

            'nav.dashboard': 'Tableau de bord',
            'nav.inventory': 'Inventaire',
            'nav.sales': 'Ventes',

            'dashboard.welcome': 'Bienvenue, {name}!',
        };

        const translations = {
            'en-US': en,
            'en-GB': en,
            'es-ES': { ...en, ...es },
            'es-MX': { ...en, ...es },
            'fr-FR': { ...en, ...fr },
        };

        return translations[locale] || translations[this.fallbackLocale];
    },

    // Change locale
    async setLocale(locale) {
        const bestLocale = this.findBestLocale(locale);
        await this.loadLocale(bestLocale);
        this.currentLocale = bestLocale;
        localStorage.setItem('vaultlister_locale', bestLocale);

        // Update document
        const localeInfo = this.supportedLocales[bestLocale];
        if (localeInfo) {
            document.documentElement.dir = localeInfo.dir;
            document.documentElement.lang = bestLocale;
        }

        // Emit event for reactivity
        window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale: bestLocale } }));

        return bestLocale;
    },

    // Translate a key
    t(key, params = {}) {
        let translation = this.translations[this.currentLocale]?.[key] ||
            this.translations[this.fallbackLocale]?.[key] ||
            key;

        // Handle pluralization (e.g., "{count} item | {count} items")
        if (translation.includes('|') && 'count' in params) {
            const parts = translation.split('|').map(s => s.trim());
            translation = params.count === 1 ? parts[0] : parts[1] || parts[0];
        }

        // Replace placeholders
        for (const [param, value] of Object.entries(params)) {
            translation = translation.replace(new RegExp(`\\{${param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), value); // nosemgrep: javascript.lang.security.detect-non-literal-regexp
        }

        return translation;
    },

    // Format number according to locale
    formatNumber(number, options = {}) {
        return new Intl.NumberFormat(this.currentLocale, options).format(number);
    },

    // Format currency
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat(this.currentLocale, {
            style: 'currency',
            currency
        }).format(amount);
    },

    // Format date
    formatDate(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(this.currentLocale, {
            dateStyle: 'medium',
            ...options
        }).format(d);
    },

    // Format time
    formatTime(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(this.currentLocale, {
            timeStyle: 'short',
            ...options
        }).format(d);
    },

    // Format relative time
    formatRelativeTime(date) {
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diff = now - d;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return this.t('time.justNow');
        if (minutes < 60) return this.t('time.minutesAgo', { count: minutes });
        if (hours < 24) return this.t('time.hoursAgo', { count: hours });
        if (days < 7) return this.t('time.daysAgo', { count: days });
        if (weeks < 4) return this.t('time.weeksAgo', { count: weeks });
        if (months < 12) return this.t('time.monthsAgo', { count: months });
        return this.t('time.yearsAgo', { count: years });
    },

    // Get locale info
    getLocaleInfo(locale = null) {
        return this.supportedLocales[locale || this.currentLocale];
    },

    // Get list of supported locales
    getSupportedLocales() {
        return Object.entries(this.supportedLocales).map(([code, info]) => ({
            code,
            ...info
        }));
    }
};

// Export for use in app
if (typeof window !== 'undefined') {
    window.i18n = i18n;
}

export default i18n;
